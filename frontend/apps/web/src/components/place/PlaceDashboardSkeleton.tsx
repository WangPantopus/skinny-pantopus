// ============================================================
// PlaceDashboardSkeleton — the shimmer state while the dashboard
// loads. Mirrors the assembled layout (header, hero, two groups of
// section cards) so the page doesn't jump. Shimmer, never "Loading…".
// ============================================================

'use client';

import { Group } from '@/components/archetypes/place';
import { ShimmerBlock } from '@/components/ui/Shimmer';

function CardSkeleton() {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3 mb-3">
        <ShimmerBlock className="w-[34px] h-[34px] rounded-[9px]" />
        <ShimmerBlock className="h-[15px] w-28" />
      </div>
      <div className="flex flex-col gap-2.5 pt-0.5">
        <ShimmerBlock className="h-[15px] w-3/5" />
        <ShimmerBlock className="h-3 w-5/6" />
      </div>
    </div>
  );
}

function HeroSkeleton() {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <ShimmerBlock className="h-3 w-24" />
        <ShimmerBlock className="h-5 w-20 rounded-full" />
      </div>
      <div className="flex items-start gap-3">
        <ShimmerBlock className="w-[42px] h-[42px] rounded-xl" />
        <div className="flex-1 flex flex-col gap-2 pt-1">
          <ShimmerBlock className="h-4 w-11/12" />
          <ShimmerBlock className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

export default function PlaceDashboardSkeleton() {
  return (
    <div className="flex flex-col" role="status">
      <span className="sr-only">Loading your place…</span>
      <div aria-hidden="true" className="contents">
      {/* header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <ShimmerBlock className="h-7 w-40" />
          <ShimmerBlock className="h-4 w-56" />
        </div>
        <ShimmerBlock className="w-10 h-10 rounded-full" />
      </div>

      <div className="mt-4">
        <HeroSkeleton />
      </div>

      <div className="mt-6">
        <Group label="Today">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </Group>
        <Group label="Your home">
          <CardSkeleton />
        </Group>
      </div>
      </div>
    </div>
  );
}
