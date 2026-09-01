'use client';

import type { MailTask } from '@/types/mailbox';

type TaskCardProps = {
  task: MailTask;
  onComplete?: () => void;
  onEscalate?: () => void;
  onClick?: () => void;
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  low: 'bg-app-surface-sunken text-app-text-secondary dark:text-app-text-muted',
};

export default function TaskCard({
  task,
  onComplete,
  onEscalate,
  onClick,
}: TaskCardProps) {
  const isCompleted = task.status === 'completed';

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
        isCompleted
          ? 'border-app-border-subtle opacity-60'
          : 'border-app-border hover:bg-app-hover dark:hover:bg-gray-800'
      }`}
    >
      {/* Checkbox */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onComplete?.(); }}
        className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isCompleted
            ? 'border-green-400 bg-green-400 text-white'
            : 'border-app-border hover:border-primary-400'
        }`}
      >
        {isCompleted && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      {/* Content */}
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <p className={`text-sm ${isCompleted ? 'line-through text-app-text-muted' : 'font-medium text-app-text'}`}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            priorityColors[task.priority] ?? priorityColors.low
          }`}>
            {task.priority}
          </span>
          {task.due_at && (
            <span className="text-xs text-app-text-muted">
              Due {new Date(task.due_at).toLocaleDateString()}
            </span>
          )}
          {task.mail_id && (
            <span className="text-xs text-primary-500">from mail</span>
          )}
        </div>
      </button>

      {/* Escalate to gig */}
      {!isCompleted && onEscalate && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onEscalate(); }}
          className="flex-shrink-0 px-2 py-1 text-[10px] font-semibold text-amber-600 border border-amber-200 dark:border-amber-800 rounded hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors"
          title="Convert to task"
        >
          Task
        </button>
      )}
    </div>
  );
}
