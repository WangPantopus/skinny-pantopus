'use client';

import { useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import type { CommunityMailItem, ReactionType } from '@/types/mailbox';
import {
  useCommunityItems,
  usePublishToCommunity,
  useReactToCommunityItem,
  useRsvpCommunityEvent,
} from '@/lib/mailbox-queries';
import { CommunityCard, TrustBadge } from '@/components/mailbox';

// ── Stub: home context ───────────────────────────────────────
function useHomeProfile() {
  return { homeId: 'home_1', neighborhood: 'Camas, WA' };
}

// ── Reaction config ──────────────────────────────────────────

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'acknowledged', emoji: '✓', label: 'Acknowledge' },
  { type: 'concerned', emoji: '⚠', label: 'Concerned' },
  { type: 'thumbs_up', emoji: '👍', label: 'Helpful' },
];

// ── Publish Confirmation Modal ───────────────────────────────

function PublishModal({
  item,
  neighborCount,
  onConfirm,
  onClose,
  publishing,
}: {
  item: CommunityMailItem;
  neighborCount: number;
  onConfirm: (scope: 'building' | 'neighborhood' | 'city') => void;
  onClose: () => void;
  publishing: boolean;
}) {
  const [scope, setScope] = useState<'building' | 'neighborhood' | 'city'>(
    item.community_type === 'civic_notice' ? 'neighborhood' : 'neighborhood',
  );
  const isGov = item.community_type === 'civic_notice';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-5">
        <h3 className="text-sm font-semibold text-app-text mb-1">
          Share with your neighborhood?
        </h3>
        <p className="text-sm text-app-text-secondary mb-4">
          Share with ~{neighborCount} households within 0.5mi?
        </p>

        {/* Scope selector */}
        <div className="space-y-2 mb-4">
          {(['building', 'neighborhood', ...(isGov ? ['city' as const] : [])] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                scope === s
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'border-app-border text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800'
              }`}
            >
              {s === 'building' ? 'Building only' : s === 'neighborhood' ? 'Neighborhood' : 'City'}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(scope)}
            disabled={publishing}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              publishing
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {publishing ? 'Sharing...' : 'Confirm & Share'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function MailCommunityPage() {
  const home = useHomeProfile();
  const { data: items, isLoading } = useCommunityItems({ homeId: home.homeId });
  const publishMutation = usePublishToCommunity();
  const reactMutation = useReactToCommunityItem();
  const rsvpMutation = useRsvpCommunityEvent();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [publishTarget, setPublishTarget] = useState<CommunityMailItem | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [dismissedPublish, setDismissedPublish] = useState<Set<string>>(new Set());

  const sortedItems = useMemo(() => {
    if (!items) return [];
    return [...items].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [items]);

  const selectedItem = useMemo(() => {
    if (!selectedId || !sortedItems) return null;
    return sortedItems.find(i => i.id === selectedId) ?? null;
  }, [selectedId, sortedItems]);

  // Items eligible for publish prompt (recently added, not yet published by user)
  const eligibleForPublish = useMemo(() => {
    if (!sortedItems) return null;
    return sortedItems.find(
      i => i.neighbors_received === 0 && !dismissedPublish.has(i.id),
    ) ?? null;
  }, [sortedItems, dismissedPublish]);

  const handleReact = useCallback((itemId: string, reaction: ReactionType) => {
    reactMutation.mutate({ itemId, reaction });
  }, [reactMutation]);

  const handleRsvp = useCallback((itemId: string) => {
    rsvpMutation.mutate(itemId);
  }, [rsvpMutation]);

  const handlePublish = useCallback((scope: 'building' | 'neighborhood' | 'city') => {
    if (!publishTarget?.mail_id) return;
    publishMutation.mutate(
      { itemId: publishTarget.mail_id, scope },
      {
        onSuccess: () => {
          setPublishSuccess(`Shared with ~47 households`);
          setPublishTarget(null);
          setTimeout(() => setPublishSuccess(null), 4000);
        },
      },
    );
  }, [publishTarget, publishMutation]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left: Community item list ────────────────────────── */}
      <div
        className={`flex flex-col h-full flex-shrink-0 border-r border-app-border bg-app-surface ${
          selectedId ? 'hidden md:flex md:w-[360px]' : 'w-full md:w-[360px]'
        }`}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-app-border-subtle flex-shrink-0">
          <h1 className="text-base font-semibold text-app-text">
            Neighborhood Mail
          </h1>
          <p className="text-xs text-app-text-secondary mt-0.5">
            {sortedItems.length} item{sortedItems.length !== 1 ? 's' : ''} · {home.neighborhood}
          </p>
        </div>

        {/* Publish prompt banner */}
        {eligibleForPublish && !publishSuccess && (
          <div className="px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border-b border-primary-100 dark:border-primary-800 flex-shrink-0">
            <p className="text-sm text-app-text-strong mb-2">
              A <span className="font-semibold">{eligibleForPublish.community_type.replace(/_/g, ' ')}</span> notice from{' '}
              <span className="font-semibold">{eligibleForPublish.sender_display || 'a sender'}</span> is eligible to share with your neighborhood.
              Reach ~47 households.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPublishTarget(eligibleForPublish)}
                className="px-3 py-1.5 text-xs font-semibold bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
              >
                Share with Neighborhood
              </button>
              <button
                type="button"
                onClick={() =>
                  setDismissedPublish(prev => new Set(prev).add(eligibleForPublish.id))
                }
                className="px-3 py-1.5 text-xs font-medium text-app-text-secondary dark:text-app-text-muted border border-app-border rounded-md hover:bg-app-hover dark:hover:bg-gray-800 transition-colors"
              >
                Keep private
              </button>
            </div>
          </div>
        )}

        {/* Publish success toast */}
        {publishSuccess && (
          <div className="px-4 py-2.5 bg-green-50 dark:bg-green-900/20 border-b border-green-100 dark:border-green-800 flex-shrink-0">
            <p className="text-sm font-medium text-green-700 dark:text-green-300">
              {publishSuccess}
            </p>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="py-3 px-3">
                  <div className="h-3 w-16 bg-app-surface-sunken rounded animate-pulse mb-2" />
                  <div className="h-4 w-48 bg-app-surface-sunken rounded animate-pulse mb-1" />
                  <div className="h-3 w-32 bg-app-surface-sunken rounded animate-pulse" />
                </div>
              ))}
            </div>
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-app-text-secondary">No community items yet</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {sortedItems.map((item) => (
                <div
                  key={item.id}
                  className={selectedId === item.id ? 'ring-2 ring-primary-400 rounded-lg' : ''}
                >
                  <CommunityCard
                    item={item}
                    onClick={() => setSelectedId(item.id)}
                    onReact={(r) => handleReact(item.id, r)}
                    onRsvp={
                      item.community_type === 'neighborhood_event'
                        ? () => handleRsvp(item.id)
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Right: Detail panel ──────────────────────────────── */}
      <div
        className={`flex-1 min-w-0 overflow-hidden ${
          selectedId ? '' : 'hidden md:block'
        }`}
      >
        {selectedItem ? (
          <CommunityDetailPanel
            item={selectedItem}
            onReact={(r) => handleReact(selectedItem.id, r)}
            onRsvp={() => handleRsvp(selectedItem.id)}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center px-4">
              <svg className="w-10 h-10 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm text-app-text-secondary">Select a community item to view details</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Publish Confirmation Modal ────────────────────────── */}
      {publishTarget && (
        <PublishModal
          item={publishTarget}
          neighborCount={47}
          onConfirm={handlePublish}
          onClose={() => setPublishTarget(null)}
          publishing={publishMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Community Detail Panel ───────────────────────────────────

const TRUST_MAP: Record<string, 'verified_gov' | 'verified_utility' | 'verified_business' | 'pantopus_user' | 'unknown'> = {
  verified_gov: 'verified_gov',
  verified_utility: 'verified_utility',
  verified_business: 'verified_business',
  pantopus_user: 'pantopus_user',
};

const TYPE_STYLES: Record<string, string> = {
  civic_notice: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  neighborhood_event: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
  local_business: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  building_announcement: 'bg-app-surface-sunken text-app-text-strong',
};

function CommunityDetailPanel({
  item,
  onReact,
  onRsvp,
  onBack,
}: {
  item: CommunityMailItem;
  onReact: (r: ReactionType) => void;
  onRsvp: () => void;
  onBack: () => void;
}) {
  const reactionMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of item.reactions) {
      map[r.reaction_type] = r.count;
    }
    return map;
  }, [item.reactions]);

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      {/* Back button (mobile) */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-app-border-subtle md:hidden">
        <button
          type="button"
          onClick={onBack}
          className="p-1 text-app-text-secondary hover:text-app-text-strong"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-sm font-medium text-app-text-strong">Back</span>
      </div>

      <div className="p-6 max-w-2xl">
        {/* Type badge */}
        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mb-3 ${
          TYPE_STYLES[item.community_type] || TYPE_STYLES.building_announcement
        }`}>
          {item.community_type.replace(/_/g, ' ')}
        </span>

        {/* Title */}
        <h2 className="text-lg font-semibold text-app-text mb-2">
          {item.title}
        </h2>

        {/* Sender + trust */}
        <div className="flex items-center gap-2 mb-4">
          {item.verified_sender && (
            <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-sm text-app-text-secondary dark:text-app-text-muted">
            {item.sender_display || 'Anonymous'}
          </span>
          {item.sender_trust && TRUST_MAP[item.sender_trust] && (
            <TrustBadge trust={TRUST_MAP[item.sender_trust]} />
          )}
        </div>

        {/* Reach count */}
        <div className="flex items-center gap-4 mb-4 text-xs text-app-text-secondary">
          <span>{item.neighbors_received} households received this</span>
          <span>Published to {item.published_to}</span>
          <span>{new Date(item.created_at).toLocaleDateString()}</span>
        </div>

        {/* Body */}
        {item.body && (
          <div className="mb-6">
            <p className="text-sm text-app-text-strong whitespace-pre-wrap leading-relaxed">
              {item.body}
            </p>
          </div>
        )}

        {/* Event details */}
        {item.community_type === 'neighborhood_event' && item.event_date && (
          <div className="mb-6 px-4 py-3 bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg">
            <p className="text-sm font-medium text-purple-800 dark:text-purple-300">
              Event: {new Date(item.event_date).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </p>
            {item.rsvp_count > 0 && (
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {item.rsvp_count} RSVP{item.rsvp_count !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Map pin link */}
        {item.map_pin_id && (
          <Link
            href="/app/mailbox/map"
            className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 mb-6"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            View on map
          </Link>
        )}

        {/* Reaction bar */}
        <div className="border-t border-app-border-subtle pt-4">
          <div className="flex items-center gap-3">
            {REACTIONS.map((r) => {
              const count = reactionMap[r.type] || 0;
              const isActive = item.user_reactions?.includes(r.type);
              return (
                <button
                  key={r.type}
                  type="button"
                  onClick={() => onReact(r.type)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isActive
                      ? 'border-primary-300 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                      : 'border-app-border text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800'
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span>{r.label}</span>
                  {count > 0 && (
                    <span className="text-xs text-app-text-muted ml-1">{count}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* RSVP button for events */}
          {item.community_type === 'neighborhood_event' && (
            <button
              type="button"
              onClick={onRsvp}
              className="mt-4 w-full py-2.5 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              RSVP
            </button>
          )}
        </div>

        {/* View full mail link */}
        {item.mail_id && (
          <div className="mt-6 pt-4 border-t border-app-border-subtle">
            <a
              href={`/app/mailbox/home/${item.mail_id}`}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              View full mail item →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
