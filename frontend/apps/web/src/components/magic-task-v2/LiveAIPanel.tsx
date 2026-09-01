'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { MagicDraftResponse, MagicTaskDraft, ScheduleType } from '@pantopus/types';
import { PRO_CATEGORIES } from '@pantopus/types';
import { Loader2, Sparkles } from 'lucide-react';

const DEBOUNCE_MS = 800;
const MIN_WORDS = 3;

const ENGAGEMENT_LABELS: Record<string, { icon: string; label: string }> = {
  instant_accept: { icon: '\u26A1', label: 'Instant Accept' },
  curated_offers: { icon: '\uD83D\uDCCB', label: 'Offers' },
  quotes: { icon: '\uD83D\uDCBC', label: 'Quotes' },
};

function inferEngagement(category: string, schedule: ScheduleType): string {
  if (PRO_CATEGORIES.some((c) => c.toLowerCase() === category.toLowerCase())) return 'quotes';
  if (schedule === 'asap') return 'instant_accept';
  return 'curated_offers';
}

function fmtMoney(n: number): string {
  return `$${Math.round(n)}`;
}

/**
 * Decide how to display the price/budget. Always prefer a concrete range when one is
 * available so users don't see a bare "Open to offers" with no guidance.
 */
function computePriceLabel(draft: MagicTaskDraft): string {
  const range = draft.budget_range;
  const hasRange = !!(range && Number.isFinite(range.min) && Number.isFinite(range.max) && range.max >= range.min);

  if (draft.pay_type === 'fixed' && draft.budget_fixed) {
    return fmtMoney(draft.budget_fixed);
  }
  if (draft.pay_type === 'hourly' && draft.hourly_rate) {
    const hourly = `${fmtMoney(draft.hourly_rate)}/hr`;
    return hasRange ? `${hourly} · typical ${fmtMoney(range!.min)}–${fmtMoney(range!.max)}` : hourly;
  }
  // pay_type === 'offers' (or anything else): show suggested range when we have one
  if (hasRange) {
    return `${fmtMoney(range!.min)}–${fmtMoney(range!.max)} suggested`;
  }
  return 'Open to offers';
}

/**
 * Format estimated_hours as a human-friendly duration: "~30 min", "~1 hr", "~1.5 hr".
 * Returns null when the AI didn't provide a value.
 */
function formatEstimatedTime(hoursRaw: number | null | undefined): string | null {
  const hours = typeof hoursRaw === 'number' && Number.isFinite(hoursRaw) ? hoursRaw : null;
  if (hours == null || hours <= 0) return null;
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `~${mins} min`;
  }
  // Round to nearest 0.25 hr for readability
  const rounded = Math.round(hours * 4) / 4;
  const display = Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(2).replace(/\.?0+$/, '');
  return `~${display} hr${rounded === 1 ? '' : 's'}`;
}

/**
 * For delivery_errand archetypes, surface "pickup → dropoff" if the draft has either
 * the structured pickup/dropoff_address fields or anything in location_text.
 */
function computeDeliveryRoute(draft: MagicTaskDraft): { pickup?: string; dropoff?: string } | null {
  if (draft.task_archetype !== 'delivery_errand') return null;
  const pickup = draft.pickup_address || null;
  const dropoff = draft.dropoff_address || null;
  if (!pickup && !dropoff) return null;
  return { pickup: pickup || undefined, dropoff: dropoff || undefined };
}

interface LiveAIPanelProps {
  text: string;
  onDraftReady: (response: MagicDraftResponse) => void;
  onPost: () => void;
  onEditDetails: () => void;
  draft: MagicDraftResponse | null;
  isPosting: boolean;
  canPost: boolean;
}

type PanelState = 'empty' | 'loading' | 'ready' | 'error';

export default function LiveAIPanel({
  text,
  onDraftReady,
  onPost,
  onEditDetails,
  draft,
  isPosting,
  canPost,
}: LiveAIPanelProps) {
  const [state, setState] = useState<PanelState>('empty');
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTextRef = useRef('');

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  // Live draft updates as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (wordCount < MIN_WORDS) {
      if (state !== 'empty' && !draft) setState('empty');
      return;
    }

    const trimmed = text.trim();
    if (trimmed === lastTextRef.current) return;

    debounceRef.current = setTimeout(async () => {
      lastTextRef.current = trimmed;
      setState('loading');
      setError('');
      try {
        const response = await api.magicTask.getMagicDraft({ text: trimmed });
        onDraftReady(response);
        setState('ready');
      } catch {
        setError('AI unavailable \u2014 you can still post manually');
        setState('error');
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [text, wordCount]);

  // Reset when text is cleared
  useEffect(() => {
    if (text.trim().length === 0) {
      setState('empty');
      lastTextRef.current = '';
    }
  }, [text]);

  const engagement = draft
    ? inferEngagement(draft.draft.category, draft.draft.schedule_type)
    : null;
  const engInfo = engagement ? ENGAGEMENT_LABELS[engagement] || ENGAGEMENT_LABELS.curated_offers : null;

  const priceLabel = draft ? computePriceLabel(draft.draft) : null;

  // Delivery tasks: show pickup → dropoff from module fields when present.
  const deliveryRoute = draft ? computeDeliveryRoute(draft.draft) : null;

  // Short description preview (2 lines max).
  const descriptionPreview = draft?.draft.description?.trim() || null;

  // Estimated time: show whenever AI provided a number, formatted smartly.
  const timeLabel = draft ? formatEstimatedTime(draft.draft.estimated_hours) : null;

  const confidenceColor = draft
    ? draft.confidence >= 0.8 ? '#22c55e' : '#f59e0b'
    : '#9ca3af';

  return (
    <div className="ai-panel">
      {/* Empty state */}
      {state === 'empty' && !draft && (
        <div className="ai-empty">
          <Sparkles size={24} className="ai-empty-icon" />
          <p>Start typing and AI will build your task...</p>
        </div>
      )}

      {/* Loading skeleton */}
      {state === 'loading' && !draft && (
        <div className="ai-loading">
          <Loader2 size={20} className="ai-spinner" />
          <div className="skeleton-line w80" />
          <div className="skeleton-line w60" />
          <div className="skeleton-line w40" />
        </div>
      )}

      {/* Loading overlay when re-drafting */}
      {state === 'loading' && draft && (
        <div className="ai-updating-badge">
          <Loader2 size={14} className="ai-spinner" /> Updating...
        </div>
      )}

      {/* Draft ready */}
      {(state === 'ready' || (state === 'loading' && draft)) && draft && (
        <div className="ai-content">
          <div className="ai-header">
            <span className="ai-label">AI Interpretation</span>
            <span className="confidence-dot" style={{ background: confidenceColor }} />
          </div>

          {draft.draft.title && (
            <div className="ai-title">{draft.draft.title}</div>
          )}

          {descriptionPreview && (
            <p className="ai-description">{descriptionPreview}</p>
          )}

          <div className="ai-field">
            <span className="ai-field-label">Category</span>
            <span className="ai-chip">{draft.draft.category || 'General'}</span>
          </div>

          <div className="ai-field">
            <span className="ai-field-label">Price</span>
            <span className="ai-value">{priceLabel}</span>
          </div>

          {timeLabel && (
            <div className="ai-field">
              <span className="ai-field-label">Time</span>
              <span className="ai-value">{timeLabel}</span>
            </div>
          )}

          {engInfo && (
            <div className="ai-field">
              <span className="ai-field-label">Mode</span>
              <span className="ai-engagement-chip">{engInfo.icon} {engInfo.label}</span>
            </div>
          )}

          {deliveryRoute && (deliveryRoute.pickup || deliveryRoute.dropoff) && (
            <div className="ai-route">
              <span className="ai-field-label">Route</span>
              <span className="ai-route-text">
                {deliveryRoute.pickup || '?'} <span className="ai-route-arrow">→</span> {deliveryRoute.dropoff || '?'}
              </span>
            </div>
          )}

          {Array.isArray(draft.draft.tags) && draft.draft.tags.length > 0 && (
            <div className="ai-tags">
              {draft.draft.tags.slice(0, 3).map((t) => (
                <span key={t} className="ai-tag">#{t}</span>
              ))}
            </div>
          )}

          <div className="ai-helpers">
            Helpers available in your area
          </div>

          <div className="ai-privacy">
            📍 Exact address shared after acceptance
          </div>
        </div>
      )}

      {/* Error state */}
      {state === 'error' && (
        <div className="ai-error">
          <p>{error}</p>
        </div>
      )}

      {/* Action buttons - always visible */}
      <div className="ai-actions">
        <button
          className="ai-post-btn"
          onClick={onPost}
          disabled={!canPost || isPosting}
        >
          {isPosting ? (
            <Loader2 size={18} className="ai-spinner" />
          ) : (
            <>Post Task ✨</>
          )}
        </button>
        <button
          className="ai-edit-btn"
          onClick={onEditDetails}
          disabled={wordCount < MIN_WORDS}
        >
          Edit details →
        </button>
      </div>

      <style jsx>{`
        .ai-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          position: relative;
        }
        .ai-empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          color: rgb(var(--app-text-muted));
          text-align: center;
          padding: 40px 20px;
        }
        .ai-empty p {
          margin: 0;
          font-size: 15px;
          line-height: 1.5;
        }
        .ai-loading {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 24px;
        }
        .ai-spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .skeleton-line {
          height: 16px;
          background: rgb(var(--app-surface-sunken));
          border-radius: 8px;
          animation: shimmer 1.5s ease-in-out infinite;
        }
        .w80 { width: 80%; }
        .w60 { width: 60%; }
        .w40 { width: 40%; }
        @keyframes shimmer {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
        .ai-updating-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: rgb(var(--app-text-secondary));
          padding: 8px 24px 0;
        }
        .ai-content {
          flex: 1;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          animation: fadeIn 0.3s ease;
          overflow-y: auto;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ai-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .ai-label {
          font-size: 13px;
          font-weight: 600;
          color: rgb(var(--app-text-secondary));
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .ai-title {
          font-size: 16px;
          font-weight: 600;
          color: rgb(var(--app-text));
          line-height: 1.3;
          margin-bottom: 2px;
        }
        .ai-description {
          margin: 0 0 6px;
          font-size: 13px;
          line-height: 1.45;
          color: rgb(var(--app-text-secondary));
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .ai-route {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 8px 10px;
          background: rgba(2, 132, 199, 0.08);
          border: 1px solid rgba(2, 132, 199, 0.25);
          border-radius: 10px;
        }
        .ai-route-text {
          font-size: 13px;
          color: rgb(var(--app-text));
          line-height: 1.4;
        }
        .ai-route-arrow {
          color: var(--color-primary-600);
          font-weight: 600;
          margin: 0 4px;
        }
        .ai-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .ai-tag {
          font-size: 12px;
          color: rgb(var(--app-text-secondary));
          background: rgb(var(--app-surface-sunken));
          padding: 2px 8px;
          border-radius: 9999px;
        }
        .confidence-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .ai-field {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .ai-field-label {
          font-size: 14px;
          color: rgb(var(--app-text-secondary));
        }
        .ai-chip {
          font-size: 13px;
          font-weight: 500;
          background: rgba(2, 132, 199, 0.12);
          color: var(--color-primary-700);
          padding: 4px 12px;
          border-radius: 9999px;
        }
        .ai-value {
          font-size: 14px;
          font-weight: 600;
          color: rgb(var(--app-text));
        }
        .ai-engagement-chip {
          font-size: 13px;
          font-weight: 500;
          background: rgba(2, 132, 199, 0.12);
          color: var(--color-primary-700);
          padding: 4px 12px;
          border-radius: 9999px;
          border: 1px solid rgba(2, 132, 199, 0.3);
        }
        @media (prefers-color-scheme: dark) {
          .ai-chip,
          .ai-engagement-chip {
            color: var(--color-primary-300);
          }
        }
        .ai-helpers {
          font-size: 13px;
          color: var(--color-success);
          font-weight: 500;
          padding: 8px 0;
        }
        @media (prefers-color-scheme: dark) {
          .ai-helpers {
            color: #34d399;
          }
        }
        .ai-privacy {
          font-size: 12px;
          color: rgb(var(--app-text-muted));
          padding-top: 8px;
          border-top: 1px solid rgb(var(--app-border-subtle));
        }
        .ai-error {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .ai-error p {
          margin: 0;
          font-size: 14px;
          color: var(--color-warning);
          text-align: center;
        }
        .ai-actions {
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          border-top: 1px solid rgb(var(--app-border));
        }
        .ai-post-btn {
          width: 100%;
          padding: 14px;
          font-size: 16px;
          font-weight: 600;
          color: #ffffff;
          background: linear-gradient(135deg, var(--color-primary-600), var(--color-primary-700));
          border: none;
          border-radius: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: opacity 0.2s, transform 0.1s;
        }
        .ai-post-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-1px);
        }
        .ai-post-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .ai-edit-btn {
          width: 100%;
          padding: 12px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-primary-600);
          background: transparent;
          border: 1px solid rgb(var(--app-border));
          border-radius: 12px;
          cursor: pointer;
          transition: background 0.2s, color 0.2s;
        }
        .ai-edit-btn:hover:not(:disabled) {
          background: rgb(var(--app-surface-raised));
        }
        .ai-edit-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        @media (prefers-color-scheme: dark) {
          .ai-edit-btn {
            color: var(--color-primary-300);
          }
        }
      `}</style>
    </div>
  );
}
