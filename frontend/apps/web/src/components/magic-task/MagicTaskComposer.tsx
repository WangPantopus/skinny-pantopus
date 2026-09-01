'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Mic,
  Paperclip,
  Sparkles,
  Loader2,
  ArrowRight,
  FileText,
  MessageCircle,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type {
  MagicDraftResponse,
  SmartTemplate,
  ScheduleType,
  PayType,
} from '@pantopus/types';
import TaskPreviewCard from './TaskPreviewCard';
import UndoToast from './UndoToast';

type ComposerStep = 'input' | 'drafting' | 'preview' | 'posted';

interface MagicTaskComposerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-locked context for context shortcuts */
  context?: {
    homeId?: string | null;
    locationMode?: 'home' | 'current' | 'address' | 'map_pin';
    latitude?: number;
    longitude?: number;
    businessId?: string | null;
  };
  /** Pre-filled location for the post */
  prefilledLocation?: {
    mode: 'home' | 'address' | 'current' | 'custom';
    latitude: number;
    longitude: number;
    address: string;
    city?: string;
    state?: string;
    zip?: string;
    homeId?: string;
  };
}

/**
 * Full-screen Magic Task Composer.
 *
 * Flow:
 * 1. User types/speaks a sentence
 * 2. AI drafts structured task (optimistic skeleton)
 * 3. Preview card shown (with edit/post/refine)
 * 4. Post → Undo toast
 */
export default function MagicTaskComposer({
  isOpen,
  onClose,
  context,
  prefilledLocation,
}: MagicTaskComposerProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // ── State ──────────────────────────────────────────────────
  const [step, setStep] = useState<ComposerStep>('input');
  const [text, setText] = useState('');
  const [draftResult, setDraftResult] = useState<MagicDraftResponse | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [templates, setTemplates] = useState<SmartTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Undo state
  const [undoGig, setUndoGig] = useState<{ id: string; title: string; windowMs: number } | null>(null);

  // ── Load templates on mount ────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      api.magicTask.getTemplateLibrary()
        .then((res) => setTemplates(res.templates || []))
        .catch(() => {});

      // Auto-focus input
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setText('');
      setStep('input');
      setDraftResult(null);
      setError(null);
      setIsPosting(false);
    }
  }, [isOpen]);

  // ── Generate AI draft ──────────────────────────────────────
  const handleDraft = useCallback(async () => {
    if (!text.trim() || text.trim().length < 3) return;
    setStep('drafting');
    setError(null);

    try {
      const result = await api.magicTask.getMagicDraft({
        text: text.trim(),
        context: context || {},
      });
      setDraftResult(result);
      setStep('preview');
    } catch (_err) {
      // Fallback to basic draft
      try {
        const basic = await api.magicTask.getBasicDraft({
          text: text.trim(),
          context: context || {},
        });
        setDraftResult(basic);
        setStep('preview');
      } catch {
        setError('Failed to generate draft. You can still post manually.');
        setStep('input');
      }
    }
  }, [text, context]);

  // ── Post Basic (no AI, instant) ────────────────────────────
  const handlePostBasic = useCallback(async () => {
    if (!text.trim() || text.trim().length < 3) return;

    try {
      const basic = await api.magicTask.getBasicDraft({
        text: text.trim(),
        context: context || {},
      });
      setDraftResult(basic);
      setStep('preview');
    } catch {
      setError('Failed to generate basic draft');
    }
  }, [text, context]);

  // ── Post task ──────────────────────────────────────────────
  const handlePost = useCallback(async () => {
    if (!draftResult?.draft) return;
    setIsPosting(true);
    setError(null);

    const draft = draftResult.draft;

    // Build location — use prefilled or default
    const location = prefilledLocation || {
      mode: (draft.location_mode === 'map_pin' ? 'current' : draft.location_mode || 'current') as 'home' | 'address' | 'current' | 'custom',
      latitude: 0,
      longitude: 0,
      address: draft.location_text || 'Current location',
    };

    try {
      const result = await api.magicTask.magicPost({
        text,
        draft,
        location,
        source_flow: 'magic',
        ai_confidence: draftResult.confidence,
        ai_draft_json: draftResult.draft as Record<string, any>,
      });

      // Show undo toast
      setUndoGig({
        id: result.gig.id,
        title: result.gig.title,
        windowMs: result.gig.undo_window_ms,
      });
      setStep('posted');
      setIsPosting(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post task');
      setIsPosting(false);
    }
  }, [draftResult, text, prefilledLocation]);

  // ── Undo ───────────────────────────────────────────────────
  const handleUndo = useCallback(async (gigId: string) => {
    await api.magicTask.undoTask(gigId);
    setUndoGig(null);
    setStep('input');
    setText('');
    setDraftResult(null);
  }, []);

  // ── Template selection ─────────────────────────────────────
  const handleTemplateSelect = useCallback((template: SmartTemplate) => {
    const draft = template.template;
    setText(draft.title || template.label);

    // Build a full draft response from the template
    setDraftResult({
      draft: {
        title: draft.title || template.label,
        description: draft.title || template.label,
        category: draft.category || 'Other',
        tags: draft.tags || [],
        pay_type: draft.pay_type || 'offers',
        budget_fixed: null,
        hourly_rate: null,
        estimated_hours: null,
        schedule_type: draft.schedule_type || 'asap',
        location_mode: draft.location_mode || 'home',
        privacy_level: 'exact_after_accept',
        is_urgent: draft.is_urgent || false,
      },
      confidence: 0.7,
      fieldConfidence: {},
      clarifyingQuestion: null,
      source: 'basic',
      elapsed: 0,
    });
    setStep('preview');
  }, []);

  // ── Answer clarifying question ─────────────────────────────
  const handleAnswerQuestion = useCallback((field: string, value: string) => {
    if (!draftResult) return;

    const updated = { ...draftResult };
    const draft = { ...updated.draft };

    // Map the answer to the appropriate field
    switch (field) {
      case 'schedule_type': {
        const map: Record<string, string> = {
          'ASAP': 'asap',
          'Today': 'today',
          'Pick a time': 'scheduled',
          'Flexible': 'flexible',
        };
        draft.schedule_type = (map[value] || 'asap') as ScheduleType;
        break;
      }
      case 'pay_type': {
        const map: Record<string, string> = {
          'Set a price': 'fixed',
          'Hourly rate': 'hourly',
          'Open to offers': 'offers',
        };
        draft.pay_type = (map[value] || 'offers') as PayType;
        break;
      }
      default:
        break;
    }

    updated.draft = draft;
    updated.clarifyingQuestion = null;
    updated.confidence = Math.min(updated.confidence + 0.15, 0.95);
    setDraftResult(updated);
  }, [draftResult]);

  // ── Edit details → classic form ────────────────────────────
  const handleEditDetails = useCallback(() => {
    if (!draftResult?.draft) return;

    // Encode draft as URL params and navigate to classic form
    const params = new URLSearchParams();
    params.set('prefill', JSON.stringify({
      title: draftResult.draft.title,
      description: draftResult.draft.description,
      category: draftResult.draft.category,
      price: draftResult.draft.budget_fixed || draftResult.draft.hourly_rate || undefined,
      tags: draftResult.draft.tags,
      is_urgent: draftResult.draft.is_urgent,
    }));

    onClose();
    router.push(`/app/gigs/new?${params.toString()}`);
  }, [draftResult, router, onClose]);

  // ── Render ─────────────────────────────────────────────────

  if (!isOpen) return null;

  return (
    <>
      {/* Full-screen modal backdrop */}
      <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal content */}
      <div className="fixed inset-x-0 bottom-0 top-0 z-[101] flex flex-col items-center justify-start pt-[10vh] px-4 pointer-events-none">
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden pointer-events-auto
            animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {step === 'posted' ? 'Task Posted!' : 'Magic Task'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* ── Step: Input ────────────────────────────────── */}
          {step === 'input' && (
            <div className="px-5 py-5 space-y-4">
              {/* Prompt */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tell Pantopus what you need done.
                </p>
                <button
                  type="button"
                  onClick={() => { onClose(); router.push('/app/chat/ai-assistant'); }}
                  className="inline-flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
                >
                  <MessageCircle className="w-3 h-3" />
                  Chat with AI
                </button>
              </div>

              {/* Text input */}
              <div className="relative">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={'e.g. "Help moving my couch today, around $50"'}
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700
                    bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white
                    placeholder:text-gray-400 dark:placeholder:text-gray-500
                    focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                    resize-none text-sm leading-relaxed"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleDraft();
                    }
                  }}
                />

                {/* Action buttons below textarea */}
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                        dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                      title="Attach photo/file"
                    >
                      <Paperclip className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100
                        dark:hover:bg-gray-800 dark:hover:text-gray-300 transition-colors"
                      title="Voice dictation"
                    >
                      <Mic className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePostBasic}
                      disabled={!text.trim() || text.trim().length < 3}
                      className="px-3 py-2 rounded-lg text-xs font-medium
                        text-gray-500 hover:text-gray-700 hover:bg-gray-100
                        dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800
                        disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                      Post Basic
                    </button>
                    <button
                      onClick={handleDraft}
                      disabled={!text.trim() || text.trim().length < 3}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl
                        bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
                        text-white text-sm font-semibold transition-all
                        disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-4 h-4" />
                      Draft
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <p className="text-sm text-red-500 dark:text-red-400">{error}</p>
              )}

              {/* Smart Templates */}
              {templates.length > 0 && !text.trim() && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 font-medium uppercase tracking-wide">
                    Quick tasks
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => handleTemplateSelect(tmpl)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-full
                          bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700
                          text-gray-700 dark:text-gray-300 text-xs font-medium transition-colors"
                      >
                        <span>{tmpl.icon}</span>
                        <span>{tmpl.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Classic form link */}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={() => {
                    onClose();
                    router.push('/app/gigs/new');
                  }}
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600
                    dark:hover:text-gray-300 transition-colors"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Use classic form instead
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Drafting (skeleton) ──────────────────── */}
          {step === 'drafting' && (
            <div className="px-5 py-8 space-y-4">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                  Drafting your task…
                </p>
              </div>

              {/* Skeleton preview */}
              <div className="space-y-3 animate-pulse">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-full" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-5/6" />
                <div className="flex gap-2 pt-2">
                  <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-20" />
                  <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-24" />
                  <div className="h-7 bg-gray-200 dark:bg-gray-700 rounded-full w-16" />
                </div>
              </div>

              {/* Post Basic fallback */}
              <div className="pt-4 flex justify-center">
                <button
                  onClick={handlePostBasic}
                  className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
                >
                  AI taking too long? Post basic instead
                </button>
              </div>
            </div>
          )}

          {/* ── Step: Preview ─────────────────────────────── */}
          {step === 'preview' && draftResult && (
            <div className="p-4">
              <TaskPreviewCard
                draft={draftResult.draft}
                confidence={draftResult.confidence}
                fieldConfidence={draftResult.fieldConfidence}
                clarifyingQuestion={draftResult.clarifyingQuestion}
                onPost={handlePost}
                onEdit={handleEditDetails}
                onRefine={draftResult.source === 'basic' || draftResult.confidence < 0.8 ? handleDraft : undefined}
                onAnswerQuestion={handleAnswerQuestion}
                isPosting={isPosting}
              />

              {error && (
                <p className="text-sm text-red-500 dark:text-red-400 mt-3 text-center">{error}</p>
              )}
            </div>
          )}

          {/* ── Step: Posted ──────────────────────────────── */}
          {step === 'posted' && (
            <div className="px-5 py-8 text-center space-y-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Task posted!
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Nearby neighbors and helpers will see your task shortly.
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => {
                    if (undoGig) {
                      router.push(`/app/gigs/${undoGig.id}`);
                    }
                    onClose();
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700
                    text-white text-sm font-medium transition-colors"
                >
                  View task
                </button>
                <button
                  onClick={() => {
                    onClose();
                    setStep('input');
                    setText('');
                    setDraftResult(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800
                    hover:bg-gray-200 dark:hover:bg-gray-700
                    text-gray-700 dark:text-gray-300 text-sm font-medium transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Undo Toast */}
      {undoGig && (
        <UndoToast
          gigId={undoGig.id}
          gigTitle={undoGig.title}
          undoWindowMs={undoGig.windowMs}
          onUndo={handleUndo}
          onExpire={() => setUndoGig(null)}
          onDismiss={() => setUndoGig(null)}
        />
      )}
    </>
  );
}
