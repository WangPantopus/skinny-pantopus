'use client';

import type { ReactNode } from 'react';
import { Home, ArrowRight, Phone, FileText, Leaf, Users, ChevronRight, Sparkles } from 'lucide-react';

interface HealthScoreRingProps {
  score: number;
  topIssue: string | null;
  topAction: { type: string; label: string; route: string } | null;
  loading: boolean;
  /** When true, shows a friendly onboarding state instead of the score ring. */
  isNewHome?: boolean;
  /** Home ID, used for onboarding quick-win routes. */
  homeId?: string;
  onActionPress: (route: string) => void;
  /** Called when user clicks "Complete your seasonal checklist" quick-win. */
  onScrollToChecklist?: () => void;
}

// -- Score -> color mapping ------------------------------------------------

function scoreColor(score: number): { textClass: string; hex: string } {
  if (score >= 75) return { textClass: 'text-emerald-500', hex: '#10b981' };
  if (score >= 50) return { textClass: 'text-amber-500', hex: '#f59e0b' };
  if (score >= 25) return { textClass: 'text-orange-600', hex: '#ea580c' };
  return { textClass: 'text-red-500', hex: '#ef4444' };
}

// -- Ring constants --------------------------------------------------------

const SIZE = 120;
const STROKE_WIDTH = 8;
const CENTER = SIZE / 2;
const RADIUS = CENTER - STROKE_WIDTH / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function HealthScoreRing({
  score,
  topIssue,
  topAction,
  loading,
  isNewHome,
  homeId,
  onActionPress,
  onScrollToChecklist,
}: HealthScoreRingProps) {
  const clampedScore = Math.min(Math.max(score, 0), 100);
  const offset = CIRCUMFERENCE - (clampedScore / 100) * CIRCUMFERENCE;
  const { textClass, hex } = isNewHome
    ? { textClass: 'text-blue-600', hex: '#2563eb' }
    : scoreColor(clampedScore);

  // -- Loading skeleton ----------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center w-40 py-2 gap-2">
        <div className="animate-pulse">
          <svg width={SIZE} height={SIZE}>
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              fill="none"
              stroke="currentColor"
              strokeWidth={STROKE_WIDTH}
              className="text-gray-200 dark:text-gray-700"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="w-12 h-7 rounded-md bg-gray-200 dark:bg-gray-700" />
            <div className="w-6 h-2.5 rounded bg-gray-200 dark:bg-gray-700 mt-1" />
          </div>
        </div>
        <div className="w-24 h-3 rounded bg-gray-200 dark:bg-gray-700" />
      </div>
    );
  }

  // -- Empty / new-home state ---------------------------------------------

  if (isNewHome) {
    const quickWins: { icon: ReactNode; label: string; onClick: () => void }[] = [];
    if (homeId) {
      quickWins.push(
        { icon: <Phone size={16} />, label: 'Add an emergency contact', onClick: () => onActionPress(`/app/homes/${homeId}/dashboard?tab=emergency`) },
        { icon: <FileText size={16} />, label: 'Upload a home document', onClick: () => onActionPress(`/app/homes/${homeId}/dashboard?tab=documents`) },
      );
    }
    if (onScrollToChecklist) {
      quickWins.push(
        { icon: <Leaf size={16} />, label: 'Complete your seasonal checklist', onClick: onScrollToChecklist },
      );
    }
    if (homeId) {
      quickWins.push(
        { icon: <Users size={16} />, label: 'Invite a household member', onClick: () => onActionPress(`/app/homes/${homeId}/dashboard?tab=members`) },
      );
    }

    return (
      <div className="flex flex-col items-center py-3 gap-3 w-full">
        {/* House icon with sparkle */}
        <div className="relative w-[72px] h-[72px] rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
          <Home size={36} className="text-blue-600" />
          <Sparkles size={16} className="absolute top-1 right-0.5 text-amber-500" />
        </div>

        <p className="text-base font-bold text-center text-gray-900 dark:text-gray-100">
          Let&apos;s set up your home
        </p>
        <p className="text-sm text-center text-gray-500 dark:text-gray-400 px-1">
          Complete these steps to see your Home Health Score
        </p>

        {/* Quick-win rows */}
        <div className="w-full space-y-1.5 mt-1">
          {quickWins.map((qw) => (
            <button
              key={qw.label}
              type="button"
              onClick={qw.onClick}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-app-border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
            >
              <span className="text-blue-600 flex-shrink-0">{qw.icon}</span>
              <span className="flex-1 text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{qw.label}</span>
              <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // -- Normal scored state ------------------------------------------------

  return (
    <div className="flex flex-col items-center w-40 py-2 gap-2">
      {/* SVG Ring */}
      <div className="relative">
        <svg width={SIZE} height={SIZE}>
          {/* Track */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE_WIDTH}
            className="text-gray-200 dark:text-gray-700"
          />
          {/* Fill */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke={hex}
            strokeWidth={STROKE_WIDTH}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
            className="transition-all duration-700"
          />
        </svg>

        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-4xl font-extrabold leading-tight ${textClass}`}>
            {clampedScore}
          </span>
          <span className="text-xs font-medium -mt-0.5 text-gray-400 dark:text-gray-500">
            /100
          </span>
        </div>
      </div>

      {/* Top issue */}
      {topIssue && (
        <p className="text-xs text-center leading-snug text-gray-500 dark:text-gray-400 px-1 line-clamp-2">
          {topIssue}
        </p>
      )}

      {/* Action chip */}
      {topAction && (
        <button
          type="button"
          onClick={() => onActionPress(topAction.route)}
          className="inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors hover:opacity-80"
          style={{
            color: hex,
            backgroundColor: `${hex}18`,
            borderColor: `${hex}40`,
          }}
        >
          {topAction.label}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
