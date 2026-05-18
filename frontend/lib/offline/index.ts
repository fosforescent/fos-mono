// IndexedDB storage layer
export {
  getDB,
  getNode,
  getNodes,
  putNode,
  putNodes,
  deleteNode,
  getDirtyNodes,
  getNodesBySourceDir,
  getAllNodes,
  getNodeCount,
  addToSyncQueue,
  getPendingMutations,
  getInProgressMutations,
  getFailedMutations,
  getSyncQueueItem,
  updateSyncQueueItem,
  deleteSyncQueueItem,
  deleteSyncQueueItems,
  getSyncMeta,
  setSyncMeta,
  deleteSyncMeta,
  getLastSyncTime,
  setLastSyncTime,
  getRootNodeId,
  setRootNodeId,
  evictOldestNodes,
  markNodesSynced,
  clearAllData,
  type NodeRecord,
  type SyncQueueItem,
  type SyncMetaValue
} from './db';

// Sync queue management
export {
  queueMutation,
  queueMutations,
  getPendingCount,
  hasPendingMutations,
  markInProgress,
  markFailed,
  markComplete,
  getBackoffDelay,
  getItemsReadyForSync,
  deduplicateMutations,
  batchMutations,
  cleanupQueue,
  retryFailedMutations,
  clearSyncQueue,
  getSyncQueueCount,
  type MutationOp,
  type SyncResult,
  type SyncQueueItem as QueueItem
} from './sync-queue';

// Sync manager
export {
  SyncManager,
  syncManager,
  type SyncConfig,
  type ConflictInfo,
  type ConflictResolution
} from './sync-manager';

// Lazy-load store
export {
  LazyFosStore,
  type LazyFosStoreOptions,
  type TauriAPI,
  type PeerManager
} from './lazy-store';
