'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * useOnlineStatus — tracks browser online/offline state.
 * Returns { isOnline, lastOnlineAt }.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(null);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(null);
    };
    const goOffline = () => {
      setIsOnline(false);
      setLastOnlineAt(new Date());
    };

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline, lastOnlineAt };
}

/**
 * OfflineIndicator — subtle bar shown at the top of a map when offline.
 *
 *  Props:
 *  - isOffline: whether the device is offline
 *  - servingCachedTiles: whether offline tiles are being served from cache
 *  - lastFetchedAt: timestamp of the last successful data fetch (for stale pins message)
 */

interface OfflineIndicatorProps {
  isOffline: boolean;
  servingCachedTiles?: boolean;
  lastFetchedAt?: Date | null;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return 'just now';
  const mins = Math.floor(secs / 60);
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs === 1) return '1 hour ago';
  return `${hrs} hours ago`;
}

export function OfflineIndicator({ isOffline, servingCachedTiles, lastFetchedAt }: OfflineIndicatorProps) {
  const [ago, setAgo] = useState('');

  // Update "X minutes ago" every 30 seconds
  useEffect(() => {
    if (!isOffline || !lastFetchedAt) return;
    setAgo(timeAgo(lastFetchedAt));
    const id = setInterval(() => setAgo(timeAgo(lastFetchedAt)), 30_000);
    return () => clearInterval(id);
  }, [isOffline, lastFetchedAt]);

  if (!isOffline) return null;

  return (
    <div className="absolute top-0 left-0 right-0 z-[1001] flex items-center justify-center gap-2 bg-amber-500/95 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>
        Offline
        {servingCachedTiles ? ' – showing cached map' : ''}
        {lastFetchedAt ? ` · Data from ${ago}` : ''}
      </span>
    </div>
  );
}
