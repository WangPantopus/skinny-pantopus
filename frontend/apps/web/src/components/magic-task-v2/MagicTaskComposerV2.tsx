'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import * as api from '@pantopus/api';
import type {
  MagicDraftResponse,
  MagicPostResponse,
  ScheduleType,
} from '@pantopus/types';

import HeroInput from './HeroInput';
import LiveAIPanel from './LiveAIPanel';
import QuickModifiers, { type SelectedLocation } from './QuickModifiers';
import InspirationPrompts from './InspirationPrompts';
import PostConfirmation from './PostConfirmation';

type ComposerPhase = 'compose' | 'posted';

interface MagicTaskComposerV2Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function MagicTaskComposerV2({ isOpen, onClose }: MagicTaskComposerV2Props) {
  const router = useRouter();

  // ── Core state ──────────────────────────────────────────
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<ComposerPhase>('compose');
  const [draft, setDraft] = useState<MagicDraftResponse | null>(null);
  const [postResult, setPostResult] = useState<MagicPostResponse | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  // ── Modifier state ──────────────────────────────────────
  const [scheduleType, setScheduleType] = useState<ScheduleType>('asap');
  const [selectedLocation, setSelectedLocation] = useState<SelectedLocation | null>(null);
  const [priceOption, setPriceOption] = useState<'ai' | 'custom'>('ai');
  const [customPrice, setCustomPrice] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');

  // ── Derived state ───────────────────────────────────────
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  const canPost = wordCount >= 3 && !isPosting && !!selectedLocation;
  const showInspiration = text.trim().length === 0;

  // ── Reset on close ──────────────────────────────────────
  useEffect(() => {
    if (!isOpen) {
      // Delay reset so animation completes
      const t = setTimeout(() => {
        setText('');
        setPhase('compose');
        setDraft(null);
        setPostResult(null);
        setIsPosting(false);
        setScheduleType('asap');
        setSelectedLocation(null);
        setPriceOption('ai');
        setCustomPrice('');
        setScheduledDate('');
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Escape key closes modal ─────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  // ── Auto-select Remote for remote-task archetypes ───────
  // When the AI classifies the task as remote_task and the user hasn't picked a location
  // themselves, default the Where group to "Remote" so the Post button is enabled without
  // making them click through.
  useEffect(() => {
    if (!draft) return;
    if (selectedLocation) return; // user already picked something
    if (draft.draft.task_archetype === 'remote_task') {
      setSelectedLocation({ mode: 'remote' });
    }
  }, [draft, selectedLocation]);

  // ── Handlers ────────────────────────────────────────────
  const handleDraftReady = useCallback((response: MagicDraftResponse) => {
    setDraft(response);
  }, []);

  const handlePost = useCallback(async () => {
    if (!draft || isPosting) return;
    if (!selectedLocation) {
      // Should be unreachable because the Post button is gated on canPost which requires a location
      // (or the Remote sentinel), but guard anyway.
      return;
    }
    setIsPosting(true);

    // Build location payload. Remote tasks have no physical location, so we send null and the
    // backend skips all geo processing. For physical tasks, backend's normalizeMagicPostLocation()
    // requires { latitude, longitude, address } to be present and finite, or it drops the location.
    const location =
      selectedLocation.mode === 'remote'
        ? null
        : {
            mode: selectedLocation.mode,
            latitude: selectedLocation.latitude,
            longitude: selectedLocation.longitude,
            address: selectedLocation.address,
            city: selectedLocation.city ?? null,
            state: selectedLocation.state ?? null,
            zip: selectedLocation.zip ?? null,
            homeId: selectedLocation.homeId ?? null,
            place_id: selectedLocation.place_id ?? null,
          };

    // Apply modifier overrides to draft
    const finalDraft = { ...draft.draft };
    finalDraft.schedule_type = scheduleType;
    // Only attach a specific time window when the user actually picked a scheduled slot.
    // Otherwise, 'asap'/'today' should leave time_window_start empty.
    if (scheduleType === 'scheduled' && scheduledDate) {
      finalDraft.time_window_start = new Date(scheduledDate).toISOString();
    } else {
      finalDraft.time_window_start = null;
    }
    if (priceOption === 'custom' && customPrice) {
      finalDraft.pay_type = 'fixed';
      finalDraft.budget_fixed = parseFloat(customPrice);
    }

    try {
      const result = await api.magicTask.magicPost({
        text: text.trim(),
        draft: finalDraft,
        location,
        source_flow: 'magic',
        ai_confidence: draft.confidence,
        ai_draft_json: draft.draft as unknown as Record<string, any>,
      });
      setPostResult(result);
      setPhase('posted');
    } catch {
      // If post fails, keep compose phase so user can retry
      setIsPosting(false);
    }
  }, [draft, text, isPosting, scheduleType, selectedLocation, priceOption, customPrice, scheduledDate]);

  const handleEditDetails = useCallback(() => {
    if (!draft) return;

    // Resolve the price the user effectively chose:
    //   1. Custom override → that value
    //   2. AI's fixed budget → use it
    //   3. AI's suggested range → midpoint
    //   4. otherwise → leave empty (destination form will validate)
    let resolvedPrice: number | null = null;
    if (priceOption === 'custom' && customPrice) {
      const n = parseFloat(customPrice);
      if (Number.isFinite(n) && n > 0) resolvedPrice = n;
    }
    if (resolvedPrice == null && draft.draft.budget_fixed) {
      resolvedPrice = draft.draft.budget_fixed;
    }
    if (resolvedPrice == null && draft.draft.budget_range) {
      const min = Number(draft.draft.budget_range.min);
      const max = Number(draft.draft.budget_range.max);
      if (Number.isFinite(min) && Number.isFinite(max) && max >= min && max > 0) {
        resolvedPrice = Math.round((min + max) / 2);
      }
    }

    // Resolve deadline from the user's schedule choice. Only set it for explicit
    // 'scheduled' picks — 'asap'/'today' don't imply a hard deadline.
    let deadlineIso: string | null = null;
    if (scheduleType === 'scheduled' && scheduledDate) {
      const d = new Date(scheduledDate);
      if (!isNaN(d.getTime())) deadlineIso = d.toISOString();
    }

    // Resolve physical location (Remote sentinel intentionally omitted — the
    // destination form requires an address, so leaving it blank surfaces the
    // validation error and lets the user pick).
    const physical = selectedLocation && selectedLocation.mode !== 'remote' ? selectedLocation : null;

    // The destination page reads a single `prefill` query param containing JSON.
    const prefill: Record<string, any> = {
      title: draft.draft.title,
      description: draft.draft.description,
      category: draft.draft.category,
      tags: Array.isArray(draft.draft.tags) ? draft.draft.tags : [],
      is_urgent: !!draft.draft.is_urgent,
      cancellation_policy: draft.draft.cancellation_policy || 'standard',
    };
    if (resolvedPrice != null) prefill.price = resolvedPrice;
    if (draft.draft.estimated_hours != null) prefill.estimated_duration = draft.draft.estimated_hours;
    if (deadlineIso) prefill.deadline = deadlineIso;
    if (physical) {
      prefill.latitude = physical.latitude;
      prefill.longitude = physical.longitude;
      prefill.address = physical.address;
      prefill.city = physical.city ?? null;
      prefill.state = physical.state ?? null;
      prefill.zip = physical.zip ?? null;
      prefill.mode = physical.mode;
      prefill.homeId = physical.homeId ?? null;
      prefill.place_id = physical.place_id ?? null;
    }

    const params = new URLSearchParams({ prefill: JSON.stringify(prefill) });
    router.push(`/app/gigs/new?${params.toString()}`);
    onClose();
  }, [draft, router, onClose, priceOption, customPrice, scheduleType, scheduledDate, selectedLocation]);

  const handleUndo = useCallback(() => {
    setPostResult(null);
    setPhase('compose');
    setIsPosting(false);
  }, []);

  const handleInspirationSelect = useCallback((prompt: string) => {
    setText(prompt);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="v2-overlay" onClick={onClose}>
      <div className="v2-modal" onClick={(e) => e.stopPropagation()}>
        {/* Close button */}
        <button className="v2-close" onClick={onClose}>
          <X size={20} />
        </button>

        {phase === 'compose' && (
          <div className="v2-compose-layout">
            {/* Left side — input area */}
            <div className="v2-left">
              <HeroInput
                value={text}
                onChange={setText}
                disabled={isPosting}
              />

              <QuickModifiers
                scheduleType={scheduleType}
                onScheduleChange={setScheduleType}
                selectedLocation={selectedLocation}
                onSelectedLocationChange={setSelectedLocation}
                priceOption={priceOption}
                onPriceChange={setPriceOption}
                customPrice={customPrice}
                onCustomPriceChange={setCustomPrice}
                scheduledDate={scheduledDate}
                onScheduledDateChange={setScheduledDate}
              />

              <InspirationPrompts
                visible={showInspiration}
                onSelect={handleInspirationSelect}
              />
            </div>

            {/* Right side — AI panel */}
            <div className="v2-right">
              <LiveAIPanel
                text={text}
                onDraftReady={handleDraftReady}
                onPost={handlePost}
                onEditDetails={handleEditDetails}
                draft={draft}
                isPosting={isPosting}
                canPost={canPost}
              />
            </div>
          </div>
        )}

        {phase === 'posted' && postResult && (
          <PostConfirmation
            result={postResult}
            onClose={onClose}
            onUndo={handleUndo}
          />
        )}
      </div>

      <style jsx>{`
        .v2-overlay {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: overlayIn 0.2s ease;
        }
        @keyframes overlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .v2-modal {
          position: relative;
          width: 90vw;
          max-width: 960px;
          height: 85vh;
          max-height: 720px;
          background: rgb(var(--app-surface));
          color: rgb(var(--app-text));
          color-scheme: light dark;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
          animation: modalIn 0.3s ease;
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .v2-close {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 10;
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          background: rgb(var(--app-surface-sunken));
          border-radius: 50%;
          cursor: pointer;
          color: rgb(var(--app-text-secondary));
          transition: background 0.15s, color 0.15s;
        }
        .v2-close:hover {
          background: rgb(var(--app-border));
          color: rgb(var(--app-text));
        }
        .v2-compose-layout {
          display: flex;
          height: 100%;
        }
        .v2-left {
          flex: 0 0 58%;
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 40px 32px;
          overflow-y: auto;
        }
        .v2-right {
          flex: 0 0 42%;
          background: rgb(var(--app-surface-raised));
          border-left: 1px solid rgb(var(--app-border));
          display: flex;
          flex-direction: column;
        }
        /* Responsive: stack on smaller screens */
        @media (max-width: 768px) {
          .v2-modal {
            width: 100vw;
            height: 100vh;
            max-width: none;
            max-height: none;
            border-radius: 0;
          }
          .v2-compose-layout {
            flex-direction: column;
          }
          .v2-left {
            flex: none;
            padding: 32px 20px 16px;
          }
          .v2-right {
            flex: 1;
            border-left: none;
            border-top: 1px solid rgb(var(--app-border));
          }
        }
      `}</style>
    </div>
  );
}
