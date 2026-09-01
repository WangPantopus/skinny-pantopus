'use client';

/**
 * BroadcastTimeline — read-side companion to AudienceComposer.
 *
 * Lists past audience broadcasts for a channel with their visibility
 * chip + delivered/read counts. Hits the same /api/broadcast endpoint
 * the legacy persona broadcast page uses; nothing here writes to /api/posts.
 */

import { useCallback, useEffect, useImperativeHandle, useState, forwardRef } from 'react';
import * as api from '@pantopus/api';
import type { BroadcastAnalyticsSummary, BroadcastMessage } from '@pantopus/types';
import { BroadcastMediaGrid, renderBodyWithLinks } from './broadcastMedia';

const VISIBILITY_LABELS: Record<string, { label: string; chipClass: string }> = {
  public: {
    label: 'Public',
    chipClass: 'bg-amber-100 text-amber-800',
  },
  followers: {
    label: 'Followers',
    chipClass: 'bg-teal-100 text-teal-800',
  },
  tier_or_above: {
    label: 'Members',
    chipClass: 'bg-violet-100 text-violet-800',
  },
};

function chipFor(message: BroadcastMessage): { label: string; chipClass: string } {
  if (message.visibility === 'tier_or_above') {
    const rank = Number(message.target_tier_rank ?? 2);
    if (rank >= 3) return { label: 'Insiders', chipClass: 'bg-violet-100 text-violet-800' };
    return VISIBILITY_LABELS.tier_or_above;
  }
  return VISIBILITY_LABELS[message.visibility] ?? { label: message.visibility, chipClass: 'bg-app-surface-sunken text-app-text-secondary' };
}

export interface BroadcastTimelineHandle {
  /** Force a re-fetch; called by the composer after a successful publish. */
  refetch: () => Promise<void>;
  /** Optimistic insert (avoids a network round-trip). */
  prepend: (message: BroadcastMessage) => void;
}

interface BroadcastTimelineProps {
  channelId: string;
}

export const BroadcastTimeline = forwardRef<BroadcastTimelineHandle, BroadcastTimelineProps>(
  function BroadcastTimeline({ channelId }, ref) {
    const [messages, setMessages] = useState<BroadcastMessage[]>([]);
    const [analytics, setAnalytics] = useState<BroadcastAnalyticsSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMessages = useCallback(async () => {
      setLoading(true);
      try {
        const res = await api.broadcast.getBroadcastMessages(channelId);
        setMessages(res.messages || []);
        setAnalytics(res.analytics || null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load updates.');
      } finally {
        setLoading(false);
      }
    }, [channelId]);

    useEffect(() => { void fetchMessages(); }, [fetchMessages]);

    useImperativeHandle(ref, () => ({
      refetch: fetchMessages,
      prepend: (message) => {
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [message, ...prev]));
        setAnalytics((prev) => ({
          deliveredCount: Number(prev?.deliveredCount || 0) + Number(message.delivered_count || 0),
          readCount: Number(prev?.readCount || 0) + Number(message.read_count || 0),
        }));
      },
    }), [fetchMessages]);

    return (
      <section
        aria-label="Recent updates"
        data-testid="broadcast-timeline"
        className="rounded-xl border border-app bg-surface p-5"
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-app">Recent updates</h2>
          {analytics ? (
            <span className="text-xs text-app-secondary">
              {Number(analytics.deliveredCount || 0).toLocaleString()} delivered · {Number(analytics.readCount || 0).toLocaleString()} reads
            </span>
          ) : null}
        </div>

        {loading && messages.length === 0 ? (
          <p className="text-sm text-app-secondary">Loading…</p>
        ) : error ? (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-app-secondary">No updates yet.</p>
        ) : (
          <ul className="space-y-4">
            {messages.map((message) => {
              const chip = chipFor(message);
              return (
                <li key={message.id} className="border-t border-app pt-4 first:border-t-0 first:pt-0">
                  <div className="mb-1 flex items-center justify-between gap-3 text-xs text-app-secondary">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${chip.chipClass}`}>
                      {chip.label}
                    </span>
                    <time dateTime={message.created_at}>
                      {new Date(message.created_at).toLocaleString()}
                    </time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-app">{renderBodyWithLinks(message.body || message.teaser || '')}</p>
                  <BroadcastMediaGrid media={message.media} />
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-app-secondary">
                    <span className="rounded-full bg-surface-muted px-2 py-1">
                      {Number(message.delivered_count || 0).toLocaleString()} delivered
                    </span>
                    <span className="rounded-full bg-surface-muted px-2 py-1">
                      {Number(message.read_count || 0).toLocaleString()} reads
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    );
  },
);

export default BroadcastTimeline;
