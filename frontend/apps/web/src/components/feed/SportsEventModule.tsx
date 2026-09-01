'use client';

import { Trophy, PencilLine } from 'lucide-react';
import type { ActiveSportsEvent } from '@pantopus/api';

interface SportsEventModuleProps {
  primaryEvent: ActiveSportsEvent | null;
  onStartThread?: () => void;
  onSelectEventMode?: (eventKey: string) => void;
}

/**
 * Compact header card rendered above the Sports feed when a major event is
 * active (NBA Playoffs, World Cup, Super Bowl, etc.). Phase 1 ships a
 * simple "There's a playoff tonight — start a thread" card. Phase 2 expands
 * into the full "Tonight's threads / Where to watch / Most active" UI.
 */
export default function SportsEventModule({
  primaryEvent,
  onStartThread,
  onSelectEventMode,
}: SportsEventModuleProps) {
  if (!primaryEvent) return null;

  return (
    <div className="rounded-xl border border-app bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary-600" />
        <h3 className="text-sm font-semibold text-app truncate">
          {primaryEvent.display_name} is live
        </h3>
      </div>
      <p className="mt-1 text-sm text-app-muted">
        Start a game thread, ask where to watch, or share your take.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {onSelectEventMode && (
          <button
            onClick={() => onSelectEventMode(primaryEvent.event_key)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-app bg-surface text-app-muted hover-bg-app transition"
          >
            See threads
          </button>
        )}
        {onStartThread && (
          <button
            onClick={onStartThread}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 transition"
          >
            <PencilLine className="w-3.5 h-3.5" />
            Start a thread
          </button>
        )}
      </div>
    </div>
  );
}
