// ============================================================
// HubArchetype — 9-section hub canvas (spec A02, web).
//
// Slots:
//   actionStrip  — horizontal chip rail
//   setupBanner  — dismissable setup card
//   today        — Today / context card
//   pulse        — Neighborhood pulse card
//   pillars      — 2x2 pillar grid
//   discover     — discovery rail
//   jumpBackIn   — in-progress flows
//   activity     — recent activity
//   extrasTop    — custom banner rendered at top
//   extrasBottom — custom node rendered at bottom
//
// Empty sections render nothing (archetype rule). The web hub
// is typically wider than mobile, so the default layout stacks
// sections vertically on mobile and switches to a 2-column
// layout on `xl:` (pulse + today side-by-side, etc.) — pass a
// `layout` override if you want to customize.
// ============================================================

'use client';

import type { ReactNode } from 'react';

export interface HubArchetypeProps {
  actionStrip?: ReactNode;
  setupBanner?: ReactNode;
  today?: ReactNode;
  pulse?: ReactNode;
  pillars?: ReactNode;
  discover?: ReactNode;
  jumpBackIn?: ReactNode;
  activity?: ReactNode;
  extrasTop?: ReactNode;
  extrasBottom?: ReactNode;
  loading?: boolean;
  loadingSlot?: ReactNode;
  className?: string;
}

export default function HubArchetype({
  actionStrip,
  setupBanner,
  today,
  pulse,
  pillars,
  discover,
  jumpBackIn,
  activity,
  extrasTop,
  extrasBottom,
  loading,
  loadingSlot,
  className = '',
}: HubArchetypeProps) {
  if (loading) {
    return (
      <div className={className}>
        {loadingSlot ?? (
          <div className="space-y-4">
            <div className="h-20 rounded-2xl bg-app-surface-sunken animate-pulse" />
            <div className="h-32 rounded-2xl bg-app-surface-sunken animate-pulse" />
            <div className="h-48 rounded-2xl bg-app-surface-sunken animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {extrasTop}
      {actionStrip}
      {setupBanner}
      {today && pulse ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {today}
          {pulse}
        </div>
      ) : (
        <>
          {today}
          {pulse}
        </>
      )}
      {pillars}
      {discover}
      {jumpBackIn}
      {activity}
      {extrasBottom}
    </div>
  );
}
