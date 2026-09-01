'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, Share2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import type { Socket } from 'socket.io-client';

interface ETATrackerProps {
  gig: any;
  socket: Socket | null;
}

export default function ETATracker({ gig, socket }: ETATrackerProps) {
  const [eta, setEta] = useState<number | null>(gig.helper_eta_minutes ?? null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(
    gig.helper_location_updated_at ?? null,
  );
  const [sharing, setSharing] = useState(false);

  // Listen for real-time ETA updates
  useEffect(() => {
    if (!socket || !gig.id) return;

    const onEtaUpdate = (data: any) => {
      if (data.eta_minutes != null) setEta(data.eta_minutes);
      setLastUpdated(new Date().toISOString());
    };

    socket.on('gig:eta-update', onEtaUpdate);
    return () => {
      socket.off('gig:eta-update', onEtaUpdate);
    };
  }, [socket, gig.id]);

  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await api.gigs.shareGigStatus(gig.id);
      await navigator.clipboard.writeText(result.share_url);
      toast.success('Link copied!');
    } catch {
      toast.error('Failed to generate share link');
    } finally {
      setSharing(false);
    }
  }, [gig.id, sharing]);

  // Calculate staleness
  const staleMins = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000)
    : null;
  const isStale = staleMins != null && staleMins > 5;

  const status = gig.status;
  if (status !== 'assigned' && status !== 'in_progress') return null;

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
          <Navigation className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-app-text">
            {eta != null
              ? `Helper is on the way — ETA: ~${eta} min`
              : 'Helper accepted — waiting for location update'}
          </p>
          {isStale && (
            <p className="text-xs text-app-text-muted mt-0.5">
              Last updated {staleMins} min ago
            </p>
          )}
        </div>
      </div>

      <button
        onClick={handleShare}
        disabled={sharing}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-emerald-600 border border-emerald-300 bg-white rounded-full hover:bg-emerald-50 disabled:opacity-50 transition"
      >
        <Share2 className="w-4 h-4" />
        {sharing ? 'Sharing\u2026' : 'Share Status'}
      </button>
    </div>
  );
}
