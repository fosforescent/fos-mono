import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { FosNodeContent } from '@fosforescent/shared/types';

export interface NodeRecord {
  cid: string;              // Primary key - content hash
  content: FosNodeContent;
  accessedAt: number;       // For LRU eviction
  syncedAt: number;         // Last synced (to server or .fos file)
  dirty: boolean;           // Modified locally, not synced
  sourceDir?: string;       // Directory path this node belongs to (e.g., "~/ex1")
}

export interface SyncQueueItem {
  id?: number;              // Auto-increment
  operation: 'create' | 'update' | 'delete';
  cid: string;
  content?: FosNodeContent;
  timestamp: number;
  retries: number;
  status: 'pending' | 'in-progress' | 'failed';
}

export interface SyncMetaValue {
  key: string;
  value: unknown;
}

interface FosOfflineDB extends DBSchema {
  nodes: {
    key: string;
    value: NodeRecord;
    indexes: { 'by-accessed': number; 'by-dirty': number; 'by-source-dir': string };
  };
  syncQueue: {
    key: number;
    value: SyncQueueItem;
    indexes: { 'by-status': string; 'by-cid': string };
  };
  syncMeta: {
    key: string;
    value: SyncMetaValue;
  };
}

let dbPromise: Promise<IDBPDatabase<FosOfflineDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<FosOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<FosOfflineDB>('fosforescent-offline', 1, {
      upgrade(db) {
        // Nodes store
        const nodeStore = db.createObjectStore('nodes', { keyPath: 'cid' });
        nodeStore.createIndex('by-accessed', 'accessedAt');
        // Use number 1/0 for dirty boolean to enable proper indexing
        nodeStore.createIndex('by-dirty', 'dirty');
        nodeStore.createIndex('by-source-dir', 'sourceDir');

        // Sync queue store
        const queueStore = db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
        queueStore.createIndex('by-status', 'status');
        queueStore.createIndex('by-cid', 'cid');

        // Metadata store
        db.createObjectStore('syncMeta', { keyPath: 'key' });
      }
    });
  }
  return dbPromise;
}

// Node operations
export async function getNode(cid: string): Promise<NodeRecord | undefined> {
  const db = await getDB();
  return db.get('nodes', cid);
}

export async function getNodes(cids: string[]): Promise<Map<string, NodeRecord>> {
  const db = await getDB();
  const tx = db.transaction('nodes', 'readonly');
  const results = new Map<string, NodeRecord>();

  await Promise.all(
    cids.map(async (cid) => {
      const record = await tx.store.get(cid);
      if (record) {
        results.set(cid, record);
      }
    })
  );

  await tx.done;
  return results;
}

export async function putNode(record: NodeRecord): Promise<void> {
  const db = await getDB();
  await db.put('nodes', record);
}

export async function putNodes(records: NodeRecord[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('nodes', 'readwrite');
  await Promise.all([
    ...records.map(record => tx.store.put(record)),
    tx.done
  ]);
}

export async function deleteNode(cid: string): Promise<void> {
  const db = await getDB();
  await db.delete('nodes', cid);
}

export async function getDirtyNodes(): Promise<NodeRecord[]> {
  const db = await getDB();
  // Get all nodes where dirty is truthy
  const allNodes = await db.getAll('nodes');
  return allNodes.filter(node => node.dirty);
}

export async function getNodesBySourceDir(sourceDir: string): Promise<NodeRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('nodes', 'by-source-dir', sourceDir);
}

export async function getAllNodes(): Promise<NodeRecord[]> {
  const db = await getDB();
  return db.getAll('nodes');
}

export async function getNodeCount(): Promise<number> {
  const db = await getDB();
  return db.count('nodes');
}

// Sync queue operations
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id'>): Promise<number> {
  const db = await getDB();
  return db.add('syncQueue', item as SyncQueueItem);
}

export async function getPendingMutations(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'pending');
}

export async function getInProgressMutations(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'in-progress');
}

export async function getFailedMutations(): Promise<SyncQueueItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('syncQueue', 'by-status', 'failed');
}

export async function getSyncQueueItem(id: number): Promise<SyncQueueItem | undefined> {
  const db = await getDB();
  return db.get('syncQueue', id);
}

export async function updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
  const db = await getDB();
  if (item.id === undefined) {
    throw new Error('Cannot update sync queue item without id');
  }
  await db.put('syncQueue', item);
}

export async function deleteSyncQueueItem(id: number): Promise<void> {
  const db = await getDB();
  await db.delete('syncQueue', id);
}

export async function deleteSyncQueueItems(ids: number[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('syncQueue', 'readwrite');
  await Promise.all([
    ...ids.map(id => tx.store.delete(id)),
    tx.done
  ]);
}

export async function clearSyncQueue(): Promise<void> {
  const db = await getDB();
  await db.clear('syncQueue');
}

export async function getSyncQueueCount(): Promise<number> {
  const db = await getDB();
  return db.count('syncQueue');
}

// Sync metadata operations
export async function getSyncMeta<T = unknown>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const result = await db.get('syncMeta', key);
  return result?.value as T | undefined;
}

export async function setSyncMeta<T = unknown>(key: string, value: T): Promise<void> {
  const db = await getDB();
  await db.put('syncMeta', { key, value });
}

export async function deleteSyncMeta(key: string): Promise<void> {
  const db = await getDB();
  await db.delete('syncMeta', key);
}

// Convenience methods for common sync meta values
export async function getLastSyncTime(): Promise<number | undefined> {
  return getSyncMeta<number>('lastSyncTime');
}

export async function setLastSyncTime(time: number): Promise<void> {
  return setSyncMeta('lastSyncTime', time);
}

export async function getRootNodeId(): Promise<string | undefined> {
  return getSyncMeta<string>('rootNodeId');
}

export async function setRootNodeId(cid: string): Promise<void> {
  return setSyncMeta('rootNodeId', cid);
}

// Cache eviction - remove oldest accessed nodes when cache is too large
export async function evictOldestNodes(maxNodes: number): Promise<number> {
  const db = await getDB();
  const count = await db.count('nodes');

  if (count <= maxNodes) {
    return 0;
  }

  const toRemove = count - maxNodes;
  const tx = db.transaction('nodes', 'readwrite');
  const index = tx.store.index('by-accessed');

  let cursor = await index.openCursor();
  let removed = 0;

  while (cursor && removed < toRemove) {
    // Don't evict dirty nodes
    if (!cursor.value.dirty) {
      await cursor.delete();
      removed++;
    }
    cursor = await cursor.continue();
  }

  await tx.done;
  return removed;
}

// Mark nodes as synced
export async function markNodesSynced(cids: string[], syncTime: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('nodes', 'readwrite');

  await Promise.all(
    cids.map(async (cid) => {
      const record = await tx.store.get(cid);
      if (record) {
        await tx.store.put({
          ...record,
          dirty: false,
          syncedAt: syncTime
        });
      }
    })
  );

  await tx.done;
}

// Clear all data (useful for logout or reset)
export async function clearAllData(): Promise<void> {
  const db = await getDB();
  await Promise.all([
    db.clear('nodes'),
    db.clear('syncQueue'),
    db.clear('syncMeta')
  ]);
}
