'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigation, Share2 } from 'lucide-react';
import * as api from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import type { Socket } from 'socket.io-client';
import { useGigListSession } from '@/hooks/useGigListSession';

interface ETATrackerProps {
  gig: any;
  socket: Socket | null;
}

export default function ETATracker(props: ETATrackerProps) {
  const { gig } = props;
  return <TrackerEntry key={JSON.stringify([gig.id, gig.status, gig.user_id, gig.accepted_by])} {...props} />;
}

function TrackerEntry({ gig, socket }: ETATrackerProps) {
  const { active, isCurrent } = useGigListSession();
  const [live, setLive] = useState<{ eta: number | null; updatedAt: number } | null>(null);
  const [sharing, setSharing] = useState(false);
  const sharingNow = useRef(false);
  const loadedAt = Date.parse(gig.helper_location_updated_at ?? '') || 0;
  const useLive = live !== null && live.updatedAt >= loadedAt;
  const eta = useLive ? live.eta : gig.helper_eta_minutes ?? null;
  const lastUpdated = useLive ? new Date(live.updatedAt).toISOString() : gig.helper_location_updated_at ?? null;

  useEffect(() => {
    if (!active || !socket || !gig.id) return;
    let listening = true;
    const onEtaUpdate = (data: { gigId?: string; eta_minutes?: number | null; timestamp?: number }) => {
      if (!listening || !isCurrent() || data.gigId !== gig.id) return;
      if (data.eta_minutes !== null && (!Number.isFinite(data.eta_minutes) || data.eta_minutes! < 0)) return;
      if (!Number.isFinite(data.timestamp) || data.timestamp! < loadedAt) return;
      const update = { eta: data.eta_minutes ?? null, updatedAt: data.timestamp! };
      setLive(previous => previous && previous.updatedAt > update.updatedAt ? previous : update);
    };
    socket.on('gig:eta-update', onEtaUpdate);
    return () => {
      listening = false;
      socket.off('gig:eta-update', onEtaUpdate);
    };
  }, [active, socket, gig.id, loadedAt, isCurrent]);

  const handleShare = useCallback(async () => {
    if (!isCurrent() || sharingNow.current) return;
    sharingNow.current = true;
    setSharing(true);
    try {
      const result = await api.gigs.shareGigStatus(gig.id);
      if (!isCurrent()) return;
      const expiresAt = Date.parse(result?.expires_at);
      if (typeof result?.share_url !== 'string' || !result.share_url.trim() || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw new Error('Invalid share receipt');
      }
      await navigator.clipboard.writeText(result.share_url);
      if (isCurrent()) toast.success('Link copied!');
    } catch {
      if (isCurrent()) toast.error('Failed to generate share link');
    } finally {
      if (isCurrent()) { sharingNow.current = false; setSharing(false); }
    }
  }, [gig.id, isCurrent]);

  // Calculate staleness
  const staleMins = lastUpdated
    ? Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 60000)
    : null;
  const isStale = staleMins != null && staleMins > 5;

  const status = gig.status;
  if (!active || (status !== 'assigned' && status !== 'in_progress')) return null;

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
