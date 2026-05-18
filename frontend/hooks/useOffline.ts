import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager, SyncResult, ConflictInfo, ConflictResolution } from '../lib/offline/sync-manager';
import { getPendingMutations, getSyncQueueCount } from '../lib/offline/sync-queue';
import { getNodeCount, getDirtyNodes } from '../lib/offline/db';

export interface OfflineState {
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  pendingCount: number;
  dirtyCount: number;
  cachedNodeCount: number;
  lastSyncTime: number | null;
  lastError: Error | null;
}

export interface UseOfflineOptions {
  apiBaseUrl: string;
  authToken?: string;
  autoSync?: boolean;
  syncIntervalMs?: number;
  onConflict?: (conflicts: ConflictInfo[]) => Promise<ConflictResolution[]>;
}

export interface UseOfflineReturn extends OfflineState {
  forceSync: () => Promise<SyncResult>;
  configure: (authToken: string) => void;
  isConfigured: boolean;
}

export function useOffline(options: UseOfflineOptions): UseOfflineReturn {
  const [state, setState] = useState<OfflineState>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    syncStatus: 'idle',
    pendingCount: 0,
    dirtyCount: 0,
    cachedNodeCount: 0,
    lastSyncTime: null,
    lastError: null
  });

  const [isConfigured, setIsConfigured] = useState(false);
  const pollIntervalRef = useRef<number | null>(null);

  // Configure sync manager when auth token is available
  const configure = useCallback((authToken: string) => {
    syncManager.configure({
      apiBaseUrl: options.apiBaseUrl,
      authToken,
      onConflict: options.onConflict,
      onSyncStart: () => {
        setState(prev => ({ ...prev, syncStatus: 'syncing', lastError: null }));
      },
      onSyncEnd: (result: SyncResult) => {
        setState(prev => ({
          ...prev,
          syncStatus: result.status === 'failed' ? 'error' : 'idle',
          lastSyncTime: Date.now(),
          lastError: result.errors?.[0] || null
        }));
      },
      onOnline: () => {
        setState(prev => ({ ...prev, isOnline: true }));
      },
      onOffline: () => {
        setState(prev => ({ ...prev, isOnline: false }));
      }
    });

    setIsConfigured(true);

    // Start auto-sync if enabled
    if (options.autoSync !== false) {
      syncManager.startAutoSync(options.syncIntervalMs || 30000);
    }
  }, [options.apiBaseUrl, options.onConflict, options.autoSync, options.syncIntervalMs]);

  // Configure on mount if auth token is provided
  useEffect(() => {
    if (options.authToken) {
      configure(options.authToken);
    }

    return () => {
      syncManager.stopAutoSync();
    };
  }, [options.authToken, configure]);

  // Online/offline event handlers
  useEffect(() => {
    const handleOnline = () => {
      setState(prev => ({ ...prev, isOnline: true }));
      // Trigger sync when coming online
      if (isConfigured) {
        syncManager.syncNow();
      }
    };

    const handleOffline = () => {
      setState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConfigured]);

  // Poll for pending/dirty counts
  useEffect(() => {
    const updateCounts = async () => {
      try {
        const [pendingCount, dirtyNodes, cachedNodeCount] = await Promise.all([
          getSyncQueueCount(),
          getDirtyNodes(),
          getNodeCount()
        ]);

        setState(prev => ({
          ...prev,
          pendingCount,
          dirtyCount: dirtyNodes.length,
          cachedNodeCount
        }));
      } catch (error) {
        console.warn('Failed to update offline counts:', error);
      }
    };

    // Initial update
    updateCounts();

    // Poll every 5 seconds
    pollIntervalRef.current = window.setInterval(updateCounts, 5000);

    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // Force sync function
  const forceSync = useCallback(async (): Promise<SyncResult> => {
    if (!isConfigured) {
      return { status: 'skipped', processed: 0, failed: 0 };
    }
    return syncManager.syncNow();
  }, [isConfigured]);

  return {
    ...state,
    forceSync,
    configure,
    isConfigured
  };
}

/**
 * Simplified hook that just tracks online/offline status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook to track pending mutations count
 */
export function usePendingMutations(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = async () => {
      try {
        const pending = await getPendingMutations();
        setCount(pending.length);
      } catch {
        // Ignore errors
      }
    };

    updateCount();
    const interval = window.setInterval(updateCount, 5000);

    return () => window.clearInterval(interval);
  }, []);

  return count;
}
