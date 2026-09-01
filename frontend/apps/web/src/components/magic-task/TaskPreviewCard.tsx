'use client';

import {
  MapPin,
  Clock,
  DollarSign,
  Tag,
  Eye,
  Zap,
  Edit3,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import type { MagicTaskDraft, ScheduleType, ClarifyingQuestion } from '@pantopus/types';

interface TaskPreviewCardProps {
  draft: MagicTaskDraft;
  confidence: number;
  fieldConfidence: Record<string, number>;
  clarifyingQuestion: ClarifyingQuestion | null;
  onPost: () => void;
  onEdit: () => void;
  onRefine?: () => void;
  onAnswerQuestion?: (field: string, value: string) => void;
  isPosting?: boolean;
}

function scheduleLabel(type: ScheduleType): string {
  switch (type) {
    case 'asap': return '⚡ ASAP';
    case 'today': return '📅 Today';
    case 'scheduled': return '🗓️ Scheduled';
    case 'flexible': return '🕒 Flexible';
    default: return type;
  }
}

function payLabel(draft: MagicTaskDraft): string {
  switch (draft.pay_type) {
    case 'fixed':
      return draft.budget_fixed ? `$${draft.budget_fixed}` : 'Set a price';
    case 'hourly':
      return draft.hourly_rate ? `$${draft.hourly_rate}/hr` : 'Hourly rate';
    case 'offers':
      return 'Open to offers';
    default:
      return 'Open to offers';
  }
}

function confidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600 dark:text-green-400';
  if (confidence >= 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-500 dark:text-red-400';
}

function confidenceIcon(confidence: number) {
  if (confidence >= 0.8) return <CheckCircle className="w-4 h-4" />;
  return <AlertCircle className="w-4 h-4" />;
}

/**
 * Task Preview Card — shows the structured task draft before posting.
 * Includes title, description, schedule, pay, location, visibility.
 * Shows confidence indicator and optional clarifying question.
 */
export default function TaskPreviewCard({
  draft,
  confidence,
  fieldConfidence: _fieldConfidence,
  clarifyingQuestion,
  onPost,
  onEdit,
  onRefine,
  onAnswerQuestion,
  isPosting = false,
}: TaskPreviewCardProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden w-full max-w-md mx-auto">
      {/* Header with confidence indicator */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-500" />
          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Task Preview</span>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${confidenceColor(confidence)}`}>
          {confidenceIcon(confidence)}
          <span>{Math.round(confidence * 100)}% match</span>
        </div>
      </div>

      {/* Task content */}
      <div className="px-5 py-4 space-y-4">
        {/* Title */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
            {draft.title}
          </h3>
          <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
            {draft.description}
          </p>
        </div>

        {/* Chips row */}
        <div className="flex flex-wrap gap-2">
          {/* Schedule */}
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium">
            <Clock className="w-3.5 h-3.5" />
            {scheduleLabel(draft.schedule_type)}
          </span>

          {/* Pay */}
          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium">
            <DollarSign className="w-3.5 h-3.5" />
            {payLabel(draft)}
          </span>

          {/* Category */}
          {draft.category && draft.category !== 'Other' && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-medium">
              <Tag className="w-3.5 h-3.5" />
              {draft.category}
            </span>
          )}

          {/* Urgent */}
          {draft.is_urgent && (
            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs font-medium">
              <Zap className="w-3.5 h-3.5" />
              Urgent
            </span>
          )}
        </div>

        {/* Location & Privacy */}
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <MapPin className="w-3.5 h-3.5" />
          <span>
            {draft.location_mode === 'home' ? 'Near your home' : 'Near your location'}
          </span>
          <span className="mx-1">·</span>
          <Eye className="w-3.5 h-3.5" />
          <span>Visible to verified neighbors and nearby helpers</span>
        </div>

        {/* Tags */}
        {draft.tags && draft.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {draft.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* Privacy note */}
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Your exact address stays private until you approve.
        </p>
      </div>

      {/* Clarifying question */}
      {clarifyingQuestion && onAnswerQuestion && (
        <div className="px-5 py-3 bg-amber-50 dark:bg-amber-900/20 border-t border-amber-100 dark:border-amber-800/30">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
            {clarifyingQuestion.question}
          </p>
          <div className="flex flex-wrap gap-2">
            {clarifyingQuestion.options.map((option) => (
              <button
                key={option}
                onClick={() => onAnswerQuestion(clarifyingQuestion.field, option)}
                className="px-3 py-1.5 rounded-full text-xs font-medium
                  bg-white dark:bg-gray-700 text-amber-700 dark:text-amber-300
                  border border-amber-200 dark:border-amber-700
                  hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors"
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-700 flex items-center gap-3">
        <button
          onClick={onPost}
          disabled={isPosting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl
            bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700
            text-white text-sm font-semibold transition-all
            disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle className="w-4 h-4" />
          {isPosting ? 'Posting...' : 'Post'}
        </button>

        <button
          onClick={onEdit}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl
            bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
            text-gray-700 dark:text-gray-200 text-sm font-medium transition-colors"
        >
          <Edit3 className="w-4 h-4" />
          Edit details
        </button>

        {onRefine && confidence < 0.8 && (
          <button
            onClick={onRefine}
            className="flex items-center gap-1 px-3 py-2.5 rounded-xl
              text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20
              text-sm font-medium transition-colors"
            title="Ask AI to refine"
          >
            <Sparkles className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
