import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useOffline, UseOfflineOptions } from '@/hooks/useOffline';
import { Wifi, WifiOff, RefreshCw, AlertCircle, Cloud, CloudOff } from 'lucide-react';

interface OfflineStatusIndicatorProps {
  options: UseOfflineOptions;
  showAlways?: boolean;
  compact?: boolean;
}

export function OfflineStatusIndicator({
  options,
  showAlways = false,
  compact = false
}: OfflineStatusIndicatorProps) {
  const {
    isOnline,
    syncStatus,
    pendingCount,
    lastError,
    forceSync,
    isConfigured
  } = useOffline(options);

  // Don't show anything if online, synced, and no pending changes (unless showAlways)
  if (!showAlways && isOnline && syncStatus === 'idle' && pendingCount === 0) {
    return null;
  }

  const handleForceSync = async () => {
    if (isConfigured && isOnline) {
      await forceSync();
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {!isOnline && (
          <Badge variant="destructive" className="gap-1 px-1.5 py-0.5">
            <WifiOff className="h-3 w-3" />
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge
            variant="secondary"
            className="gap-1 px-1.5 py-0.5 cursor-pointer"
            onClick={handleForceSync}
          >
            {syncStatus === 'syncing' ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <Cloud className="h-3 w-3" />
            )}
            <span className="text-xs">{pendingCount}</span>
          </Badge>
        )}
        {syncStatus === 'error' && (
          <Badge variant="destructive" className="gap-1 px-1.5 py-0.5">
            <AlertCircle className="h-3 w-3" />
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Online/Offline status */}
      {!isOnline ? (
        <Badge variant="destructive" className="gap-1">
          <WifiOff className="h-3 w-3" />
          <span>Offline</span>
        </Badge>
      ) : (
        showAlways && (
          <Badge variant="outline" className="gap-1 text-green-600 border-green-600">
            <Wifi className="h-3 w-3" />
            <span>Online</span>
          </Badge>
        )
      )}

      {/* Sync status */}
      {syncStatus === 'syncing' && (
        <Badge variant="secondary" className="gap-1">
          <RefreshCw className="h-3 w-3 animate-spin" />
          <span>Syncing...</span>
        </Badge>
      )}

      {/* Pending changes */}
      {pendingCount > 0 && syncStatus !== 'syncing' && (
        <Badge
          variant="secondary"
          className="gap-1 cursor-pointer hover:bg-secondary/80"
          onClick={handleForceSync}
          title={isOnline ? 'Click to sync now' : 'Will sync when online'}
        >
          {isOnline ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
          <span>{pendingCount} pending</span>
        </Badge>
      )}

      {/* Error indicator */}
      {syncStatus === 'error' && lastError && (
        <Badge
          variant="destructive"
          className="gap-1 cursor-pointer"
          onClick={handleForceSync}
          title={lastError.message}
        >
          <AlertCircle className="h-3 w-3" />
          <span>Sync error</span>
        </Badge>
      )}
    </div>
  );
}

/**
 * Minimal offline indicator for tight spaces
 */
export function OfflineIndicatorDot({ apiBaseUrl, authToken }: { apiBaseUrl: string; authToken?: string }) {
  const { isOnline, syncStatus, pendingCount } = useOffline({ apiBaseUrl, authToken });

  // Determine color based on status
  let color = 'bg-green-500'; // Online and synced
  let title = 'Online - All changes synced';

  if (!isOnline) {
    color = 'bg-red-500';
    title = 'Offline - Changes will sync when reconnected';
  } else if (syncStatus === 'syncing') {
    color = 'bg-yellow-500 animate-pulse';
    title = 'Syncing...';
  } else if (syncStatus === 'error') {
    color = 'bg-red-500';
    title = 'Sync error';
  } else if (pendingCount > 0) {
    color = 'bg-yellow-500';
    title = `${pendingCount} changes pending sync`;
  }

  return (
    <div
      className={`w-2 h-2 rounded-full ${color}`}
      title={title}
    />
  );
}

export default OfflineStatusIndicator;
