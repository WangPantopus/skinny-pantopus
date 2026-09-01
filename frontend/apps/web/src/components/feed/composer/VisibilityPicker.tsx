'use client';

import type { ReactNode } from 'react';
import { Home as HomeIcon, Link2 } from 'lucide-react';
import type { PostVisibility } from '@pantopus/api';

/** Matches mobile feed + backend: nearby / social graph only (no legacy `public`). */
const VISIBILITY_OPTIONS: { value: PostVisibility; label: string; icon: ReactNode; desc: string }[] = [
  { value: 'neighborhood', label: 'Neighborhood', icon: <HomeIcon className="w-4 h-4" />, desc: 'People nearby on Pantopus' },
  { value: 'connections', label: 'Connections', icon: <Link2 className="w-4 h-4" />, desc: 'Your mutual connections' },
];

interface VisibilityPickerProps {
  visibility: PostVisibility;
  showVisibility: boolean;
  onVisibilityChange: (v: PostVisibility) => void;
  onToggle: () => void;
}

export default function VisibilityPicker({
  visibility, showVisibility, onVisibilityChange, onToggle,
}: VisibilityPickerProps) {
  const normalized =
    visibility === 'public' ? 'connections' : visibility;
  const currentVis =
    VISIBILITY_OPTIONS.find((v) => v.value === normalized) ?? VISIBILITY_OPTIONS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-surface border border-app hover-bg-app transition"
      >
        <span>{currentVis.icon}</span>
        <span className="text-app-muted">{currentVis.label}</span>
        <svg className="w-3 h-3 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {showVisibility && (
        <div
          className="absolute bottom-full left-0 mb-1 w-56 bg-surface rounded-xl shadow-xl border border-app py-1 z-50"
          role="listbox"
          aria-label="Who can see this post"
        >
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => onVisibilityChange(opt.value)}
              className={`w-full text-left px-3 py-2 flex items-center gap-2 hover-bg-app ${
                normalized === opt.value ? 'bg-primary-500/10' : ''
              }`}
            >
              <span>{opt.icon}</span>
              <div>
                <div className="text-xs font-medium text-app">{opt.label}</div>
                <div className="text-[10px] text-app-muted">{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
