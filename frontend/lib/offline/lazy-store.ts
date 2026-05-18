import { FosStore } from '@fosforescent/shared/dag-implementation/store';
import { FosNode } from '@fosforescent/shared/dag-implementation/node';
import { FosNodeContent, AppStateLoaded } from '@fosforescent/shared/types';
import {
  getNode,
  getNodes,
  putNode,
  putNodes,
  NodeRecord,
  getDirtyNodes,
  markNodesSynced
} from './db';
import { queueMutation } from './sync-queue';

// Interface for Tauri API (to be provided by tauri integration)
export interface TauriAPI {
  readNodeFromFosFile(cid: string): Promise<FosNodeContent | null>;
  writeNodeToFosFile(cid: string, content: FosNodeContent): Promise<void>;
  listFosFileNodes(directory?: string): Promise<string[]>;
}

// Interface for peer-to-peer node resolution
export interface PeerManager {
  requestNode(cid: string): Promise<FosNodeContent | null>;
  broadcastNode(cid: string, content: FosNodeContent): Promise<void>;
  isConnected(): boolean;
}

export interface LazyFosStoreOptions {
  fosCtxData?: AppStateLoaded["data"];
  mutationCallback?: (data: AppStateLoaded["data"]) => void;
  commitCallback?: (data: AppStateLoaded["data"]) => void;
  tauri?: TauriAPI;
  peers?: PeerManager;
  apiBaseUrl?: string;
  authToken?: string;
  sourceDir?: string;
}

export class LazyFosStore extends FosStore {
  private fetchPromises = new Map<string, Promise<FosNode | null>>();
  private tauri: TauriAPI | null = null;
  private peers: PeerManager | null = null;
  private apiBaseUrl: string | null = null;
  private authToken: string | null = null;
  private sourceDir: string | undefined;
  private prefetchQueue: Set<string> = new Set();
  private isPrefetching = false;

  constructor(options: LazyFosStoreOptions = {}) {
    super({
      fosCtxData: options.fosCtxData,
      mutationCallback: options.mutationCallback,
      commitCallback: options.commitCallback
    });

    this.tauri = options.tauri || null;
    this.peers = options.peers || null;
    this.apiBaseUrl = options.apiBaseUrl || null;
    this.authToken = options.authToken || null;
    this.sourceDir = options.sourceDir;
  }

  setTauriAPI(tauri: TauriAPI): void {
    this.tauri = tauri;
  }

  setPeerManager(peers: PeerManager): void {
    this.peers = peers;
  }

  setApiConfig(baseUrl: string, authToken: string): void {
    this.apiBaseUrl = baseUrl;
    this.authToken = authToken;
  }

  /**
   * Async version of getNodeByAddress that can fetch from IndexedDB, .fos files, peers, or backend
   */
  async getNodeByAddressAsync(cid: string): Promise<FosNode | null> {
    // 1. Check in-memory cache (table)
    if (this.table.has(cid)) {
      const existing = super.getNodeByAddress(cid);
      if (existing) {
        // Update access time in IndexedDB (fire and forget)
        this.touchNode(cid);
        return existing;
      }
    }

    // 2. Check IndexedDB cache
    const cached = await getNode(cid);
    if (cached) {
      this.table.set(cid, cached.content);
      // Update access time
      await putNode({ ...cached, accessedAt: Date.now() });
      return super.getNodeByAddress(cid);
    }

    // 3. Deduplicate concurrent fetches for the same CID
    if (!this.fetchPromises.has(cid)) {
      this.fetchPromises.set(cid, this.resolveNode(cid));
    }

    try {
      const result = await this.fetchPromises.get(cid)!;
      return result;
    } finally {
      this.fetchPromises.delete(cid);
    }
  }

  /**
   * Resolve a node from external sources
   */
  private async resolveNode(cid: string): Promise<FosNode | null> {
    // 3. Try .fos file via Tauri (if native app)
    if (this.tauri) {
      const fromFile = await this.tauri.readNodeFromFosFile(cid);
      if (fromFile) {
        return this.cacheAndReturn(cid, fromFile, 'file');
      }
    }

    // 4. Try DHT peers via WebRTC
    if (this.peers?.isConnected()) {
      const fromPeer = await this.peers.requestNode(cid);
      if (fromPeer) {
        return this.cacheAndReturn(cid, fromPeer, 'peer');
      }
    }

    // 5. Try backend API (if online and authenticated)
    if (navigator.onLine && this.apiBaseUrl && this.authToken) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/user/data/nodes/${cid}`, {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const { content } = await response.json();
          return this.cacheAndReturn(cid, content, 'server');
        }
      } catch (error) {
        console.warn(`Failed to fetch node ${cid} from server:`, error);
      }
    }

    return null;
  }

  /**
   * Cache the node in memory and IndexedDB, then return a FosNode
   */
  private async cacheAndReturn(
    cid: string,
    content: FosNodeContent,
    source: 'file' | 'peer' | 'server'
  ): Promise<FosNode> {
    // Add to in-memory table
    this.table.set(cid, content);

    // Add to IndexedDB
    await putNode({
      cid,
      content,
      accessedAt: Date.now(),
      syncedAt: Date.now(),
      dirty: false,
      sourceDir: this.sourceDir
    });

    // Prefetch children in background
    this.schedulePrefetch(content);

    return super.getNodeByAddress(cid)!;
  }

  /**
   * Schedule prefetching of child nodes
   */
  private schedulePrefetch(content: FosNodeContent): void {
    // Add children to prefetch queue
    for (const [instrCid, targetCid] of content.children) {
      if (!this.table.has(instrCid)) {
        this.prefetchQueue.add(instrCid);
      }
      if (!this.table.has(targetCid)) {
        this.prefetchQueue.add(targetCid);
      }
    }

    // Start prefetching if not already running
    if (!this.isPrefetching && this.prefetchQueue.size > 0) {
      this.startPrefetching();
    }
  }

  /**
   * Background prefetching of nodes
   */
  private startPrefetching(): void {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => this.processPrefetchQueue(), { timeout: 2000 });
    } else {
      setTimeout(() => this.processPrefetchQueue(), 100);
    }
  }

  private async processPrefetchQueue(): Promise<void> {
    if (this.prefetchQueue.size === 0) {
      this.isPrefetching = false;
      return;
    }

    this.isPrefetching = true;

    // Process in batches
    const batch = Array.from(this.prefetchQueue).slice(0, 10);
    this.prefetchQueue = new Set(
      Array.from(this.prefetchQueue).slice(10)
    );

    // Fetch nodes that aren't already in memory
    const toFetch = batch.filter(cid => !this.table.has(cid));

    if (toFetch.length > 0) {
      // First check IndexedDB batch
      const cached = await getNodes(toFetch);
      for (const [cid, record] of cached) {
        this.table.set(cid, record.content);
      }

      // Fetch remaining from network
      const remaining = toFetch.filter(cid => !this.table.has(cid));
      for (const cid of remaining) {
        // Use getNodeByAddressAsync but don't block
        this.getNodeByAddressAsync(cid).catch(() => {
          // Ignore prefetch failures
        });
      }
    }

    // Continue with remaining queue
    if (this.prefetchQueue.size > 0) {
      this.startPrefetching();
    } else {
      this.isPrefetching = false;
    }
  }

  /**
   * Touch a node to update its access time (fire and forget)
   */
  private touchNode(cid: string): void {
    getNode(cid).then(record => {
      if (record) {
        putNode({ ...record, accessedAt: Date.now() }).catch(() => {
          // Ignore touch failures
        });
      }
    }).catch(() => {
      // Ignore failures
    });
  }

  /**
   * Override create to also persist to IndexedDB and queue for sync
   */
  override create(value: FosNodeContent, alias?: string): FosNode {
    const node = super.create(value, alias);
    const cid = node.getId();

    // Persist to IndexedDB asynchronously
    putNode({
      cid,
      content: value,
      accessedAt: Date.now(),
      syncedAt: 0, // Not synced yet
      dirty: true,
      sourceDir: this.sourceDir
    }).then(() => {
      // Queue for sync
      return queueMutation({
        operation: 'create',
        cid,
        content: value
      });
    }).catch(err => {
      console.error('Failed to persist node to IndexedDB:', err);
    });

    return node;
  }

  /**
   * Override insert to also persist to IndexedDB
   */
  override insert(nodeContent: FosNodeContent, alias?: string): string {
    const cid = super.insert(nodeContent, alias);

    // Persist to IndexedDB asynchronously
    putNode({
      cid,
      content: nodeContent,
      accessedAt: Date.now(),
      syncedAt: 0,
      dirty: true,
      sourceDir: this.sourceDir
    }).then(() => {
      return queueMutation({
        operation: 'create',
        cid,
        content: nodeContent
      });
    }).catch(err => {
      console.error('Failed to persist node to IndexedDB:', err);
    });

    return cid;
  }

  /**
   * Batch fetch multiple nodes
   */
  async getNodesByAddressAsync(cids: string[]): Promise<Map<string, FosNode | null>> {
    const results = new Map<string, FosNode | null>();

    // Check in-memory first
    const toFetch: string[] = [];
    for (const cid of cids) {
      if (this.table.has(cid)) {
        results.set(cid, super.getNodeByAddress(cid));
      } else {
        toFetch.push(cid);
      }
    }

    if (toFetch.length === 0) {
      return results;
    }

    // Check IndexedDB
    const cached = await getNodes(toFetch);
    const stillMissing: string[] = [];

    for (const cid of toFetch) {
      const record = cached.get(cid);
      if (record) {
        this.table.set(cid, record.content);
        results.set(cid, super.getNodeByAddress(cid));
        // Update access time
        putNode({ ...record, accessedAt: Date.now() }).catch(() => {});
      } else {
        stillMissing.push(cid);
      }
    }

    // Batch fetch from server
    if (stillMissing.length > 0 && navigator.onLine && this.apiBaseUrl && this.authToken) {
      try {
        const response = await fetch(
          `${this.apiBaseUrl}/user/data/nodes?cids=${stillMissing.join(',')}`,
          {
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (response.ok) {
          const { nodes } = await response.json();
          const toPersist: NodeRecord[] = [];

          for (const [cid, content] of Object.entries(nodes) as [string, FosNodeContent][]) {
            this.table.set(cid, content);
            results.set(cid, super.getNodeByAddress(cid));
            toPersist.push({
              cid,
              content,
              accessedAt: Date.now(),
              syncedAt: Date.now(),
              dirty: false,
              sourceDir: this.sourceDir
            });
          }

          // Batch persist to IndexedDB
          await putNodes(toPersist);
        }
      } catch (error) {
        console.warn('Failed to batch fetch nodes from server:', error);
      }
    }

    // Fill in nulls for missing nodes
    for (const cid of stillMissing) {
      if (!results.has(cid)) {
        results.set(cid, null);
      }
    }

    return results;
  }

  /**
   * Persist all dirty nodes and mark them as synced
   */
  async syncDirtyNodes(): Promise<{ synced: string[]; failed: string[] }> {
    const dirty = await getDirtyNodes();
    const synced: string[] = [];
    const failed: string[] = [];

    if (dirty.length === 0 || !navigator.onLine) {
      return { synced, failed };
    }

    // Sync to server in batches
    const batchSize = 50;
    for (let i = 0; i < dirty.length; i += batchSize) {
      const batch = dirty.slice(i, i + batchSize);
      const nodes = Object.fromEntries(
        batch.map(record => [record.cid, record.content])
      );

      if (this.apiBaseUrl && this.authToken) {
        try {
          const response = await fetch(`${this.apiBaseUrl}/user/data/sync`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nodes })
          });

          if (response.ok) {
            const batchCids = batch.map(r => r.cid);
            await markNodesSynced(batchCids, Date.now());
            synced.push(...batchCids);
          } else {
            failed.push(...batch.map(r => r.cid));
          }
        } catch (error) {
          console.error('Failed to sync batch:', error);
          failed.push(...batch.map(r => r.cid));
        }
      }
    }

    // Also write to .fos file if Tauri is available
    if (this.tauri) {
      for (const record of dirty) {
        try {
          await this.tauri.writeNodeToFosFile(record.cid, record.content);
        } catch (error) {
          console.warn(`Failed to write node ${record.cid} to .fos file:`, error);
        }
      }
    }

    return { synced, failed };
  }

  /**
   * Load all nodes from IndexedDB into memory
   */
  async loadFromIndexedDB(): Promise<number> {
    const { getAllNodes } = await import('./db');
    const records = await getAllNodes();

    for (const record of records) {
      if (!this.table.has(record.cid)) {
        this.table.set(record.cid, record.content);
      }
    }

    return records.length;
  }

  /**
   * Export all in-memory nodes to IndexedDB
   */
  async persistToIndexedDB(): Promise<number> {
    const records: NodeRecord[] = [];

    for (const [cid, content] of this.table.entries()) {
      const existing = await getNode(cid);
      records.push({
        cid,
        content,
        accessedAt: existing?.accessedAt || Date.now(),
        syncedAt: existing?.syncedAt || 0,
        dirty: existing?.dirty ?? true,
        sourceDir: existing?.sourceDir || this.sourceDir
      });
    }

    await putNodes(records);
    return records.length;
  }
}
