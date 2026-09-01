'use client';

import { useState, useCallback } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import * as api from '@pantopus/api';
import { ClarifyingQuestionsPanel } from './ClarifyingQuestionsPanel';
import type { ClarifyingQuestionAI } from '@pantopus/types';

interface InlineDraftHelperProps {
  /** What entity type to draft */
  mode: 'listing' | 'post' | 'gig';
  /** Existing user input to refine (title, partial text, etc.) */
  seed?: string;
  /** Extra context passed to the AI (category, listing type, intent, etc.) */
  context?: Record<string, string | boolean | undefined>;
  /** Callback with the AI output fields to fill */
  onDraft: (fields: Record<string, string>) => void;
  /** Optional custom label */
  label?: string;
  /** Compact icon-only mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

export function InlineDraftHelper({
  mode,
  seed = '',
  context = {},
  onDraft,
  label,
  compact = false,
  className = '',
}: InlineDraftHelperProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<ClarifyingQuestionAI[]>([]);
  const [refining, setRefining] = useState(false);

  const colorScheme =
    mode === 'listing'
      ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', hover: 'hover:bg-emerald-100', icon: 'text-emerald-500' }
      : mode === 'gig'
      ? { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', hover: 'hover:bg-violet-100', icon: 'text-violet-500' }
      : { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', hover: 'hover:bg-blue-100', icon: 'text-blue-500' };

  const handleGenerate = useCallback(async () => {
    const userPrompt = prompt.trim() || seed.trim();
    if (!userPrompt && !Object.values(context).some(Boolean)) {
      setError('Enter a description or some details first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (mode === 'gig') {
        const resp = await api.ai.draftGig({
          text: userPrompt || 'Help me create this task',
          context: {
            budgetHint: context.budgetHint as string | undefined,
            timeHint: context.timeHint as string | undefined,
            category: context.category as string | undefined,
          },
        });
        onDraft({
          title: resp.draft.title || '',
          description: resp.draft.description || '',
          ...(resp.draft.price != null ? { price: String(resp.draft.price) } : {}),
          ...(resp.draft.category ? { category: resp.draft.category } : {}),
          ...(resp.draft.is_urgent != null ? { isUrgent: String(resp.draft.is_urgent) } : {}),
          ...(resp.draft.tags?.length ? { tags: JSON.stringify(resp.draft.tags) } : {}),
          ...(resp.draft.schedule_type ? { scheduleType: resp.draft.schedule_type } : {}),
          ...(resp.draft.pay_type ? { payType: resp.draft.pay_type } : {}),
          ...(resp.draft.estimated_duration != null ? { estimatedDuration: String(resp.draft.estimated_duration) } : {}),
          ...(resp.draft.cancellation_policy ? { cancellationPolicy: resp.draft.cancellation_policy } : {}),
        });
        if (resp.clarifying_questions?.length) {
          setClarifyingQuestions(resp.clarifying_questions);
        }
      } else if (mode === 'listing') {
        const resp = await api.ai.draftListing({
          text: userPrompt || 'Help me create this listing',
          context: {
            listingType: context.listingType as string | undefined,
            category: context.category as string | undefined,
            existingTitle: context.existingTitle as string | undefined,
          },
        });
        onDraft({
          title: resp.draft.title || '',
          description: resp.draft.description || '',
          ...(resp.draft.price != null ? { price: String(resp.draft.price) } : {}),
        });
        if (resp.clarifying_questions?.length) {
          setClarifyingQuestions(resp.clarifying_questions);
        }
      } else {
        const resp = await api.ai.draftPost({
          text: userPrompt || 'Help me write this post',
          context: {
            postType: context.postType as string | undefined,
            existingContent: context.existingContent as string | undefined,
          },
        });
        onDraft({
          content: resp.draft.content || '',
          ...(resp.draft.title ? { title: resp.draft.title } : {}),
        });
        if (resp.clarifying_questions?.length) {
          setClarifyingQuestions(resp.clarifying_questions);
        }
      }
      setExpanded(false);
      setPrompt('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Draft failed');
    } finally {
      setLoading(false);
    }
  }, [mode, prompt, seed, context, onDraft]);

  // Re-submit with clarifying question answers appended to the original prompt
  const handleRefineWithAnswers = useCallback(async (answers: Record<string, string>) => {
    setRefining(true);
    setError(null);

    // Build a refined prompt that includes the original prompt + answers
    const answersText = clarifyingQuestions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => `Q: ${q.question}\nA: ${answers[q.id]}`)
      .join('\n');

    const original = prompt.trim() || seed.trim() || 'Help me create this';
    const refinedText = `${original}\n\nAdditional details:\n${answersText}`;

    try {
      if (mode === 'gig') {
        const resp = await api.ai.draftGig({
          text: refinedText,
          context: {
            budgetHint: context.budgetHint as string | undefined,
            timeHint: context.timeHint as string | undefined,
            category: context.category as string | undefined,
          },
        });
        onDraft({
          title: resp.draft.title || '',
          description: resp.draft.description || '',
          ...(resp.draft.price != null ? { price: String(resp.draft.price) } : {}),
          ...(resp.draft.category ? { category: resp.draft.category } : {}),
          ...(resp.draft.is_urgent != null ? { isUrgent: String(resp.draft.is_urgent) } : {}),
          ...(resp.draft.tags?.length ? { tags: JSON.stringify(resp.draft.tags) } : {}),
          ...(resp.draft.schedule_type ? { scheduleType: resp.draft.schedule_type } : {}),
          ...(resp.draft.pay_type ? { payType: resp.draft.pay_type } : {}),
          ...(resp.draft.estimated_duration != null ? { estimatedDuration: String(resp.draft.estimated_duration) } : {}),
          ...(resp.draft.cancellation_policy ? { cancellationPolicy: resp.draft.cancellation_policy } : {}),
        });
      } else if (mode === 'listing') {
        const resp = await api.ai.draftListing({
          text: refinedText,
          context: {
            listingType: context.listingType as string | undefined,
            category: context.category as string | undefined,
            existingTitle: context.existingTitle as string | undefined,
          },
        });
        onDraft({
          title: resp.draft.title || '',
          description: resp.draft.description || '',
          ...(resp.draft.price != null ? { price: String(resp.draft.price) } : {}),
        });
      } else {
        const resp = await api.ai.draftPost({
          text: refinedText,
          context: {
            postType: context.postType as string | undefined,
            existingContent: context.existingContent as string | undefined,
          },
        });
        onDraft({
          content: resp.draft.content || '',
          ...(resp.draft.title ? { title: resp.draft.title } : {}),
        });
      }
      setClarifyingQuestions([]); // Clear after successful refinement
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refinement failed');
    } finally {
      setRefining(false);
    }
  }, [mode, prompt, seed, context, onDraft, clarifyingQuestions]);

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={loading}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${colorScheme.text} ${colorScheme.hover} transition-colors ${className}`}
        title="Draft with AI"
      >
        <Sparkles className={`w-3.5 h-3.5 ${colorScheme.icon}`} />
        {label || 'AI'}
      </button>
    );
  }

  if (!expanded && !compact) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${colorScheme.bg} ${colorScheme.border} border ${colorScheme.text} ${colorScheme.hover} transition-colors ${className}`}
      >
        <Sparkles className={`w-3.5 h-3.5 ${colorScheme.icon}`} />
        {label || 'Draft with AI'}
      </button>
    );
  }

  return (
    <div className={`rounded-lg border ${colorScheme.border} ${colorScheme.bg} p-2.5 space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className={`w-3.5 h-3.5 ${colorScheme.icon}`} />
          <span className={`text-xs font-semibold ${colorScheme.text}`}>
            AI Draft
          </span>
        </div>
        <button
          type="button"
          onClick={() => { setExpanded(false); setError(null); }}
          className="p-0.5 rounded hover:bg-white/60 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-gray-400" />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
          placeholder={
            mode === 'gig'
              ? 'e.g. "need someone to mow my lawn, $40"'
              : mode === 'listing'
              ? 'e.g. "barely used Dyson V15 vacuum, $200"'
              : 'e.g. "looking for hiking buddies this weekend"'
          }
          className="flex-1 px-2.5 py-1.5 rounded-md border border-gray-200 bg-white text-gray-900 text-xs placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-300"
          disabled={loading}
        />
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className={`px-3 py-1.5 rounded-md text-xs font-medium text-white transition-colors ${
            loading
              ? 'bg-gray-300 cursor-not-allowed'
              : mode === 'gig'
              ? 'bg-violet-600 hover:bg-violet-700'
              : mode === 'listing'
              ? 'bg-emerald-600 hover:bg-emerald-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Generate'}
        </button>
      </div>

      {error && (
        <p className="text-[11px] text-red-600">{error}</p>
      )}

      {clarifyingQuestions.length > 0 && (
        <ClarifyingQuestionsPanel
          questions={clarifyingQuestions}
          onSubmitAnswers={handleRefineWithAnswers}
          loading={refining}
          onDismiss={() => setClarifyingQuestions([])}
        />
      )}
    </div>
  );
}
