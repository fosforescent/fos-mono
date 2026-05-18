import { FosNodeContent } from '@fosforescent/shared/types';
import {
  addToSyncQueue,
  getPendingMutations,
  getInProgressMutations,
  getSyncQueueItem,
  updateSyncQueueItem,
  deleteSyncQueueItem,
  deleteSyncQueueItems,
  clearSyncQueue,
  getSyncQueueCount,
  SyncQueueItem
} from './db';

export type MutationOp = {
  operation: 'create' | 'update' | 'delete';
  cid: string;
  content?: FosNodeContent;
};

export type SyncResult = {
  status: 'success' | 'partial' | 'failed' | 'skipped';
  processed: number;
  failed: number;
  errors?: Error[];
};

const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

// Queue a mutation for later sync
export async function queueMutation(op: MutationOp): Promise<number> {
  return addToSyncQueue({
    operation: op.operation,
    cid: op.cid,
    content: op.content,
    timestamp: Date.now(),
    retries: 0,
    status: 'pending'
  });
}

// Queue multiple mutations at once
export async function queueMutations(ops: MutationOp[]): Promise<number[]> {
  const results: number[] = [];
  for (const op of ops) {
    const id = await queueMutation(op);
    results.push(id);
  }
  return results;
}

// Get the number of pending mutations
export async function getPendingCount(): Promise<number> {
  const pending = await getPendingMutations();
  return pending.length;
}

// Check if there are any pending mutations
export async function hasPendingMutations(): Promise<boolean> {
  const count = await getSyncQueueCount();
  return count > 0;
}

// Mark items as in-progress before processing
export async function markInProgress(items: SyncQueueItem[]): Promise<void> {
  for (const item of items) {
    if (item.id !== undefined) {
      await updateSyncQueueItem({
        ...item,
        status: 'in-progress'
      });
    }
  }
}

// Mark items as failed with retry tracking
export async function markFailed(items: SyncQueueItem[]): Promise<void> {
  for (const item of items) {
    if (item.id !== undefined) {
      const newRetries = item.retries + 1;
      await updateSyncQueueItem({
        ...item,
        retries: newRetries,
        status: newRetries >= MAX_RETRIES ? 'failed' : 'pending'
      });
    }
  }
}

// Mark items as successfully processed (removes them from queue)
export async function markComplete(items: SyncQueueItem[]): Promise<void> {
  const ids = items
    .map(item => item.id)
    .filter((id): id is number => id !== undefined);

  if (ids.length > 0) {
    await deleteSyncQueueItems(ids);
  }
}

// Calculate backoff delay for retry
export function getBackoffDelay(retries: number): number {
  return Math.min(BASE_BACKOFF_MS * Math.pow(2, retries), 60000); // Max 1 minute
}

// Get items ready for processing (pending, with backoff considered)
export async function getItemsReadyForSync(): Promise<SyncQueueItem[]> {
  const pending = await getPendingMutations();
  const now = Date.now();

  return pending.filter(item => {
    if (item.retries === 0) return true;
    const backoff = getBackoffDelay(item.retries);
    return now - item.timestamp >= backoff;
  });
}

// Group mutations by CID to deduplicate
export function deduplicateMutations(items: SyncQueueItem[]): SyncQueueItem[] {
  // Group by CID, keeping only the latest mutation for each CID
  const byId = new Map<string, SyncQueueItem>();

  for (const item of items) {
    const existing = byId.get(item.cid);
    if (!existing || item.timestamp > existing.timestamp) {
      byId.set(item.cid, item);
    }
  }

  return Array.from(byId.values());
}

// Batch mutations for efficient network requests
export function batchMutations(items: SyncQueueItem[], batchSize = 50): SyncQueueItem[][] {
  const batches: SyncQueueItem[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}

// Clear only successfully synced or permanently failed items
export async function cleanupQueue(): Promise<number> {
  const failed = await getInProgressMutations();
  let cleaned = 0;

  for (const item of failed) {
    // If it's been in-progress for too long, mark as failed
    if (item.id !== undefined && Date.now() - item.timestamp > 5 * 60 * 1000) {
      await updateSyncQueueItem({
        ...item,
        status: 'failed',
        retries: MAX_RETRIES
      });
      cleaned++;
    }
  }

  return cleaned;
}

// Reset all failed items to pending (manual retry)
export async function retryFailedMutations(): Promise<number> {
  const pending = await getPendingMutations();
  const failed = pending.filter(p => p.status === 'failed');

  // Get items that are truly failed (at max retries)
  const failedItems: SyncQueueItem[] = [];
  for (const item of failed) {
    if (item.retries >= MAX_RETRIES && item.id !== undefined) {
      failedItems.push(item);
    }
  }

  for (const item of failedItems) {
    if (item.id !== undefined) {
      await updateSyncQueueItem({
        ...item,
        retries: 0,
        status: 'pending',
        timestamp: Date.now()
      });
    }
  }

  return failedItems.length;
}

// Export for external use
export { clearSyncQueue, getSyncQueueCount };
export type { SyncQueueItem };
