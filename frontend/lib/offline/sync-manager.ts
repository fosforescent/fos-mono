import { FosNodeContent } from '@fosforescent/shared/types';
import { diff, patch, Delta } from '@n1ru4l/json-patch-plus';
import {
  getLastSyncTime,
  setLastSyncTime,
  putNode,
  putNodes,
  NodeRecord,
  getDirtyNodes,
  markNodesSynced
} from './db';
import {
  getPendingMutations,
  getItemsReadyForSync,
  markInProgress,
  markComplete,
  markFailed,
  deduplicateMutations,
  batchMutations,
  SyncQueueItem,
  SyncResult
} from './sync-queue';

export interface SyncConfig {
  apiBaseUrl: string;
  authToken: string;
  onConflict?: (conflicts: ConflictInfo[]) => Promise<ConflictResolution[]>;
  onSyncStart?: () => void;
  onSyncEnd?: (result: SyncResult) => void;
  onOnline?: () => void;
  onOffline?: () => void;
}

export interface ConflictInfo {
  cid: string;
  local: FosNodeContent;
  server: FosNodeContent;
  base?: FosNodeContent;
}

export interface ConflictResolution {
  cid: string;
  resolution: 'local' | 'server' | 'merge';
  merged?: FosNodeContent;
}

interface SyncResponse {
  applied: { id: number; cid: string }[];
  conflicts: ConflictInfo[];
  serverChanges: { cid: string; content: FosNodeContent }[];
  newSyncTime: number;
}

export class SyncManager {
  private config: SyncConfig | null = null;
  private processing = false;
  private syncInterval: number | null = null;
  private onlineHandler: (() => void) | null = null;
  private offlineHandler: (() => void) | null = null;

  configure(config: SyncConfig): void {
    this.config = config;

    // Remove old listeners
    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
    }
    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
    }

    // Set up online/offline listeners
    this.onlineHandler = () => {
      config.onOnline?.();
      // Auto-sync when coming online
      this.syncNow();
    };

    this.offlineHandler = () => {
      config.onOffline?.();
    };

    window.addEventListener('online', this.onlineHandler);
    window.addEventListener('offline', this.offlineHandler);
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  isOnline(): boolean {
    return navigator.onLine;
  }

  /**
   * Start automatic background sync at the given interval
   */
  startAutoSync(intervalMs: number = 30000): void {
    this.stopAutoSync();
    this.syncInterval = window.setInterval(() => {
      if (navigator.onLine && !this.processing) {
        this.syncNow();
      }
    }, intervalMs);
  }

  /**
   * Stop automatic background sync
   */
  stopAutoSync(): void {
    if (this.syncInterval !== null) {
      window.clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Perform a sync operation immediately
   */
  async syncNow(): Promise<SyncResult> {
    if (this.processing) {
      return { status: 'skipped', processed: 0, failed: 0 };
    }

    if (!navigator.onLine) {
      return { status: 'skipped', processed: 0, failed: 0 };
    }

    if (!this.config) {
      console.warn('SyncManager not configured');
      return { status: 'skipped', processed: 0, failed: 0 };
    }

    this.processing = true;
    this.config.onSyncStart?.();

    try {
      const result = await this.performSync();
      this.config.onSyncEnd?.(result);
      return result;
    } finally {
      this.processing = false;
    }
  }

  private async performSync(): Promise<SyncResult> {
    if (!this.config) {
      return { status: 'failed', processed: 0, failed: 0 };
    }

    const errors: Error[] = [];
    let processed = 0;
    let failed = 0;

    try {
      // 1. Get items ready for sync
      const ready = await getItemsReadyForSync();
      if (ready.length === 0) {
        // Still check for server changes
        await this.pullServerChanges();
        return { status: 'success', processed: 0, failed: 0 };
      }

      // 2. Deduplicate mutations (keep latest for each CID)
      const deduplicated = deduplicateMutations(ready);

      // 3. Mark as in-progress
      await markInProgress(deduplicated);

      // 4. Send to server in batches
      const batches = batchMutations(deduplicated);

      for (const batch of batches) {
        try {
          const result = await this.syncBatch(batch);
          processed += result.applied.length;

          // Handle conflicts
          if (result.conflicts.length > 0 && this.config.onConflict) {
            const resolutions = await this.config.onConflict(result.conflicts);
            await this.applyConflictResolutions(resolutions);
          }

          // Apply server changes
          if (result.serverChanges.length > 0) {
            await this.applyServerChanges(result.serverChanges);
          }

          // Mark successful items as complete
          const appliedIds = new Set(result.applied.map(a => a.id));
          const completed = batch.filter(item => item.id !== undefined && appliedIds.has(item.id));
          await markComplete(completed);

          // Update sync time
          await setLastSyncTime(result.newSyncTime);
        } catch (error) {
          console.error('Sync batch failed:', error);
          errors.push(error instanceof Error ? error : new Error(String(error)));
          await markFailed(batch);
          failed += batch.length;
        }
      }

      // 5. Pull any additional server changes
      await this.pullServerChanges();

      if (failed > 0 && processed > 0) {
        return { status: 'partial', processed, failed, errors };
      } else if (failed > 0) {
        return { status: 'failed', processed, failed, errors };
      }

      return { status: 'success', processed, failed };
    } catch (error) {
      console.error('Sync failed:', error);
      return {
        status: 'failed',
        processed,
        failed,
        errors: [error instanceof Error ? error : new Error(String(error))]
      };
    }
  }

  private async syncBatch(batch: SyncQueueItem[]): Promise<SyncResponse> {
    if (!this.config) {
      throw new Error('SyncManager not configured');
    }

    const lastSyncTime = await getLastSyncTime();

    const mutations = batch.map(item => ({
      id: item.id,
      operation: item.operation,
      cid: item.cid,
      content: item.content,
      timestamp: item.timestamp
    }));

    const response = await fetch(`${this.config.apiBaseUrl}/user/data/sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        mutations,
        lastSyncTime: lastSyncTime || 0
      })
    });

    if (!response.ok) {
      throw new Error(`Sync request failed: ${response.status}`);
    }

    return response.json();
  }

  private async pullServerChanges(): Promise<void> {
    if (!this.config) return;

    const lastSyncTime = await getLastSyncTime();

    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/user/data/changes?since=${lastSyncTime || 0}`,
        {
          headers: {
            'Authorization': `Bearer ${this.config.authToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const { changes, syncTime } = await response.json();
        if (changes && changes.length > 0) {
          await this.applyServerChanges(changes);
        }
        await setLastSyncTime(syncTime);
      }
    } catch (error) {
      console.warn('Failed to pull server changes:', error);
    }
  }

  private async applyServerChanges(
    changes: { cid: string; content: FosNodeContent }[]
  ): Promise<void> {
    const records: NodeRecord[] = changes.map(({ cid, content }) => ({
      cid,
      content,
      accessedAt: Date.now(),
      syncedAt: Date.now(),
      dirty: false
    }));

    await putNodes(records);
  }

  private async applyConflictResolutions(
    resolutions: ConflictResolution[]
  ): Promise<void> {
    for (const resolution of resolutions) {
      let content: FosNodeContent;

      switch (resolution.resolution) {
        case 'local':
          // Keep local, nothing to do (already in IndexedDB)
          continue;

        case 'server':
          // Apply server version
          // This would need to be provided by the conflict info
          continue;

        case 'merge':
          if (!resolution.merged) {
            console.warn(`Merge resolution for ${resolution.cid} missing merged content`);
            continue;
          }
          content = resolution.merged;
          break;

        default:
          continue;
      }

      // Save the resolved content
      await putNode({
        cid: resolution.cid,
        content,
        accessedAt: Date.now(),
        syncedAt: Date.now(),
        dirty: true // Mark dirty to sync the resolution
      });
    }
  }

  /**
   * Perform three-way merge between local, server, and base versions
   */
  static threeWayMerge(
    local: FosNodeContent,
    server: FosNodeContent,
    base: FosNodeContent | null
  ): { resolved: boolean; content?: FosNodeContent; conflicts?: string[] } {
    if (!base) {
      // Without base, we can only check if they're identical
      const differences = diff({ left: local, right: server });
      if (!differences) {
        return { resolved: true, content: local };
      }
      return { resolved: false, conflicts: ['No common base for merge'] };
    }

    // Calculate deltas from base
    const localDelta = diff({ left: base, right: local });
    const serverDelta = diff({ left: base, right: server });

    // If no local changes, accept server
    if (!localDelta) {
      return { resolved: true, content: server };
    }

    // If no server changes, accept local
    if (!serverDelta) {
      return { resolved: true, content: local };
    }

    // Check if changes are compatible (non-overlapping paths)
    const compatible = SyncManager.deltasCompatible(localDelta, serverDelta);

    if (compatible) {
      // Apply both deltas
      let merged = patch({ left: base, delta: localDelta });
      merged = patch({ left: merged, delta: serverDelta });
      return { resolved: true, content: merged };
    }

    // Incompatible changes - need manual resolution
    return {
      resolved: false,
      conflicts: ['Conflicting changes to same fields']
    };
  }

  /**
   * Check if two deltas modify different paths (and can be safely merged)
   */
  private static deltasCompatible(delta1: Delta, delta2: Delta): boolean {
    // Simple heuristic: check if any paths overlap
    const paths1 = SyncManager.getDeltaPaths(delta1);
    const paths2 = SyncManager.getDeltaPaths(delta2);

    for (const p1 of paths1) {
      for (const p2 of paths2) {
        if (p1.startsWith(p2) || p2.startsWith(p1)) {
          return false;
        }
      }
    }

    return true;
  }

  private static getDeltaPaths(delta: Delta): string[] {
    const paths: string[] = [];

    function extract(obj: unknown, path: string = ''): void {
      if (typeof obj !== 'object' || obj === null) {
        return;
      }

      for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
        const newPath = path ? `${path}.${key}` : key;
        paths.push(newPath);
        extract(value, newPath);
      }
    }

    extract(delta);
    return paths;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopAutoSync();

    if (this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler);
      this.onlineHandler = null;
    }

    if (this.offlineHandler) {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
    }

    this.config = null;
  }
}

// Singleton instance
export const syncManager = new SyncManager();
