'use client';

import { useState } from 'react';
import { CheckCircle2, Circle, X, Check, Hammer, Snowflake, Sun, Leaf, Flower2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import type { SeasonalChecklist as SeasonalChecklistData, SeasonalChecklistItem } from '@pantopus/types';

interface SeasonalChecklistProps {
  checklist: SeasonalChecklistData | null;
  loading: boolean;
  onComplete: (itemId: string) => void;
  onSkip: (itemId: string) => void;
  onHireHelp: (item: SeasonalChecklistItem) => void;
  /** Called to generate a checklist for a new home with no existing items. */
  onGenerate?: () => void;
}

// ── Current season label ──────────────────────────────────────
function currentSeasonLabel(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'Spring';
  if (m >= 5 && m <= 7) return 'Summer';
  if (m >= 8 && m <= 10) return 'Fall';
  return 'Winter';
}

// ── Season icon mapping ────────────────────────────────────────

function SeasonIcon({ seasonKey, className }: { seasonKey: string; className?: string }) {
  if (seasonKey.includes('winter') || seasonKey.includes('ice')) {
    return <Snowflake className={className} />;
  }
  if (seasonKey.includes('summer') || seasonKey.includes('dry')) {
    return <Sun className={className} />;
  }
  if (seasonKey.includes('fall') || seasonKey.includes('autumn')) {
    return <Leaf className={className} />;
  }
  return <Flower2 className={className} />;
}

// ── Progress bar color ─────────────────────────────────────────

function progressColor(percentage: number): string {
  if (percentage === 100) return 'bg-green-500';
  if (percentage >= 50) return 'bg-yellow-500';
  return 'bg-primary';
}

// ── Shared item renderer ──────────────────────────────────────

function ChecklistItemRow({
  item,
  isCarryover,
  onComplete,
  onSkip,
  onHireHelp,
}: {
  item: SeasonalChecklistItem;
  isCarryover?: boolean;
  onComplete: (id: string) => void;
  onSkip: (id: string) => void;
  onHireHelp: (item: SeasonalChecklistItem) => void;
}) {
  const done = item.status === 'completed' || item.status === 'skipped' || item.status === 'hired';

  return (
    <div className="flex items-center gap-2 py-1.5">
      {/* Checkbox icon */}
      <button
        type="button"
        onClick={() => { if (!done) onComplete(item.id); }}
        disabled={done}
        className="flex-shrink-0 disabled:cursor-default"
      >
        {item.status === 'completed' ? (
          <CheckCircle2 className="h-5 w-5 text-green-500" />
        ) : item.status === 'skipped' ? (
          <CheckCircle2 className="h-5 w-5 text-app-text-secondary" />
        ) : (
          <Circle className="h-5 w-5 text-app-border hover:text-primary transition-colors" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium truncate ${
            done
              ? 'line-through text-app-text-secondary'
              : isCarryover
                ? 'text-app-text-secondary'
                : 'text-app-text'
          }`}
        >
          {item.title}
        </p>
        {item.description && !done && (
          <p className="text-xs text-app-text-secondary truncate">
            {item.description}
          </p>
        )}
      </div>

      {/* Action buttons for pending items */}
      {item.status === 'pending' && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={() => onComplete(item.id)}
            className="p-1 rounded hover:bg-green-500/10 text-app-text-secondary hover:text-green-500 transition-colors"
            title="Mark done"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onSkip(item.id)}
            className="p-1 rounded hover:bg-app-border/50 text-app-text-secondary hover:text-app-text transition-colors"
            title="Skip"
          >
            <X className="h-4 w-4" />
          </button>
          {item.gig_category && (
            <button
              type="button"
              onClick={() => onHireHelp(item)}
              className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary text-white text-xs font-bold hover:bg-primary/90 transition-colors"
              title="Hire help"
            >
              <Hammer className="h-3 w-3" />
              Hire
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────

export default function SeasonalChecklist({
  checklist,
  loading,
  onComplete,
  onSkip,
  onHireHelp,
  onGenerate,
}: SeasonalChecklistProps) {
  const [carryoverExpanded, setCarryoverExpanded] = useState(false);

  // ── Loading skeleton ─────────────────────────────────────────
  if (loading) {
    return (
      <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-full bg-app-border" />
          <div className="h-4 w-1/2 rounded bg-app-border" />
        </div>
        <div className="h-1 rounded-full bg-app-border" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 py-1.5">
            <div className="h-5 w-5 rounded-full bg-app-border flex-shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-3/4 rounded bg-app-border" />
              <div className="h-2.5 w-1/2 rounded bg-app-border" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Empty state with generate button ─────────────────────────
  if (!checklist || checklist.items.length === 0) {
    const seasonLabel = currentSeasonLabel();
    return (
      <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-4">
        <div className="flex flex-col items-center gap-2 py-6">
          <Leaf className="h-8 w-8 text-primary" />
          <p className="text-sm font-semibold text-app-text mt-1">
            Your {seasonLabel} checklist is ready
          </p>
          <p className="text-xs text-app-text-secondary text-center">
            Get personalized seasonal tasks for your home
          </p>
          {onGenerate && (
            <button
              type="button"
              onClick={onGenerate}
              className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate checklist
            </button>
          )}
        </div>
      </div>
    );
  }

  const { season, items, progress, carryover } = checklist;

  return (
    <div className="rounded-xl border border-app-border bg-app-surface shadow-sm p-4 space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <SeasonIcon seasonKey={season.key} className="h-4.5 w-4.5 text-primary flex-shrink-0" />
        <h3 className="flex-1 text-sm font-bold text-app-text truncate">{season.label}</h3>
        <span className="text-xs font-semibold text-app-text-secondary flex-shrink-0">
          {progress.completed}/{progress.total} done
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 rounded-full bg-app-border overflow-hidden">
        <div
          className={`h-1 rounded-full transition-all ${progressColor(progress.percentage)}`}
          style={{ width: `${progress.percentage}%` }}
        />
      </div>

      {/* Current season items */}
      <div className="space-y-0.5">
        {items.map((item) => (
          <ChecklistItemRow
            key={item.id}
            item={item}
            onComplete={onComplete}
            onSkip={onSkip}
            onHireHelp={onHireHelp}
          />
        ))}
      </div>

      {/* Carryover from previous season */}
      {carryover && carryover.items.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setCarryoverExpanded(!carryoverExpanded)}
            className="w-full flex items-center gap-1.5 pt-2 mt-1 border-t border-app-border text-left"
          >
            {carryoverExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-app-text-secondary flex-shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-app-text-secondary flex-shrink-0" />
            )}
            <span className="flex-1 text-xs font-semibold text-app-text-secondary">
              From last season ({carryover.season.label})
            </span>
            <span className="text-[11px] text-app-text-muted">
              {carryover.items.length} remaining
            </span>
          </button>
          {carryoverExpanded && (
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 px-1 py-0.5 space-y-0.5">
              {carryover.items.map((item) => (
                <ChecklistItemRow
                  key={item.id}
                  item={item}
                  isCarryover
                  onComplete={onComplete}
                  onSkip={onSkip}
                  onHireHelp={onHireHelp}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
