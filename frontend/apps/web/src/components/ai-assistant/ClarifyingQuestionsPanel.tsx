'use client';

import { useState, useCallback } from 'react';
import { HelpCircle, Send, Loader2, X } from 'lucide-react';
import type { ClarifyingQuestionAI } from '@pantopus/types';

interface ClarifyingQuestionsPanelProps {
  questions: ClarifyingQuestionAI[];
  /** Called when user submits answers; receives a map of question id → answer */
  onSubmitAnswers: (answers: Record<string, string>) => void;
  /** Whether the parent is re-generating a draft with the answers */
  loading?: boolean;
  /** Allow dismissing the panel */
  onDismiss?: () => void;
  className?: string;
}

export function ClarifyingQuestionsPanel({
  questions,
  onSubmitAnswers,
  loading = false,
  onDismiss,
  className = '',
}: ClarifyingQuestionsPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const handleChange = useCallback((id: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const hasAnyAnswer = Object.values(answers).some((v) => v.trim().length > 0);

  const handleSubmit = () => {
    if (!hasAnyAnswer || loading) return;
    onSubmitAnswers(answers);
  };

  if (!questions.length) return null;

  return (
    <div className={`rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2.5 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
          <span className="text-xs font-semibold text-amber-800">
            A few questions to improve the draft
          </span>
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="p-0.5 rounded hover:bg-white/60 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        )}
      </div>

      <div className="space-y-2">
        {questions.map((q) => (
          <div key={q.id}>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {q.question}
            </label>
            <input
              type="text"
              value={answers[q.id] || ''}
              onChange={(e) => handleChange(q.id, e.target.value)}
              placeholder="Your answer (optional)"
              disabled={loading}
              className="w-full px-2.5 py-1.5 rounded-md border border-amber-200 bg-white text-xs placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-300 disabled:opacity-50"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!hasAnyAnswer || loading}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-white transition-colors ${
            !hasAnyAnswer || loading
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-amber-600 hover:bg-amber-700'
          }`}
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          Refine Draft
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            disabled={loading}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
