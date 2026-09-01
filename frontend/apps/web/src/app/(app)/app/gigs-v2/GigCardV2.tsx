// @ts-nocheck
'use client';

import React from 'react';
import { formatTimeAgo, formatPrice, GIG_STATUS_STYLES, statusClasses, statusLabel } from '@pantopus/ui-utils';
import type { GigListItem } from '@pantopus/types';

// ─── EngagementChip ─────────────────────────────────────────
function EngagementChip({ mode }: { mode: string | null | undefined }) {
  if (!mode) return null;
  const config: Record<string, { label: string; cls: string }> = {
    instant_accept: { label: '⚡ Instant', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    curated_offers: { label: '📋 Offers', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    quotes: { label: '💼 Quotes', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  };
  const c = config[mode];
  if (!c) return null;
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded border ${c.cls}`}>
      {c.label}
    </span>
  );
}

// ─── Props ──────────────────────────────────────────────────
interface GigCardV2Props {
  gig: GigListItem & Record<string, any>;
  onClick: () => void;
  viewerUserId: string | null;
  acceptingGigId: string | null;
  onInstantAccept: (gigId: string) => void;
}

// ─── Component ──────────────────────────────────────────────
function GigCardV2({
  gig,
  onClick,
  viewerUserId,
  acceptingGigId,
  onInstantAccept,
}: GigCardV2Props) {
  const ownerId = gig.user_id ? String(gig.user_id) : null;
  const creatorId = gig.created_by ? String(gig.created_by) : null;
  const isOwner = !!viewerUserId && (viewerUserId === ownerId || viewerUserId === creatorId);
  const engagementMode = (gig as any).engagement_mode as string | undefined;
  const isInstant = engagementMode === 'instant_accept';
  const isAccepting = acceptingGigId === gig.id;

  return (
    <div className="bg-app-surface rounded-xl border border-app-border p-4 hover:shadow-md transition cursor-pointer" onClick={onClick}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {gig.is_urgent && (
              <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" /></svg>
                URGENT
              </span>
            )}
            <EngagementChip mode={engagementMode} />
          </div>
          <h3 className="text-sm font-semibold text-app-text truncate">{gig.title}</h3>
          {gig.category && <p className="text-xs text-app-text-secondary mt-0.5">{gig.category}</p>}
        </div>
        <span className="text-lg font-bold text-green-600 whitespace-nowrap">{formatPrice(Number(gig.price) || 0)}</span>
      </div>

      {/* Description */}
      {gig.description && (
        <p className="text-sm text-app-text-secondary line-clamp-2 mb-3 leading-relaxed">{gig.description}</p>
      )}

      {/* Tags */}
      {(gig.tags || []).length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {gig.tags.slice(0, 3).map((tag: string) => (
            <span key={tag} className="text-[11px] text-primary-600 bg-blue-50 px-1.5 py-0.5 rounded font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Meta */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {gig.status && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusClasses(GIG_STATUS_STYLES, gig.status)}`}>
              {statusLabel(GIG_STATUS_STYLES, gig.status)}
            </span>
          )}
          {isOwner && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
              Your Task
            </span>
          )}
        </div>
        <span className="text-xs text-app-text-muted">
          {gig.created_at ? formatTimeAgo(gig.created_at) : ''}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="flex-1 py-2 rounded-lg border border-primary-600 text-primary-600 text-sm font-semibold hover:bg-primary-50 transition"
        >
          View Details
        </button>
        {isInstant && !isOwner ? (
          <button
            onClick={(e) => { e.stopPropagation(); onInstantAccept(gig.id); }}
            disabled={isAccepting}
            className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700 disabled:opacity-60 transition"
          >
            {isAccepting ? 'Accepting...' : 'I Can Help!'}
          </button>
        ) : isOwner ? (
          <div className="flex-1 py-2 rounded-lg bg-app-surface-raised border border-app-border text-app-text-secondary text-sm font-semibold text-center">
            Posted by you
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className="flex-1 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition"
          >
            Place Bid
          </button>
        )}
      </div>
    </div>
  );
}

export default React.memo(GigCardV2);
