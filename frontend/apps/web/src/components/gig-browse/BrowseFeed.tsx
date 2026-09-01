'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { BrowseResponse, GigListItem } from '@pantopus/types';
import { useDismissGig } from '@/hooks/useDismissGig';
import SectionHeader from './SectionHeader';
import FeaturedTaskCard from './FeaturedTaskCard';
import CategoryCluster from './CategoryCluster';
import TaskRow from './TaskRow';
import { ShimmerLine, ShimmerBlock } from '../ui/Shimmer';

// ─── Density helpers ─────────────────────────────────────────

type DensityTier = 'sparse' | 'moderate' | 'full';

function getDensity(totalActive: number): DensityTier {
  if (totalActive <= 7) return 'sparse';
  if (totalActive <= 25) return 'moderate';
  return 'full';
}

function dedupeGigs(lists: GigListItem[][]): GigListItem[] {
  const seen = new Set<string>();
  const result: GigListItem[] = [];
  for (const list of lists) {
    for (const gig of list) {
      if (!seen.has(gig.id)) {
        seen.add(gig.id);
        result.push(gig);
      }
    }
  }
  return result;
}

// ─── Empty State ──────────────────────────────────────────────

function EmptyNeighborhood() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <span className="text-5xl mb-4" role="img" aria-label="neighborhood">
        🏘️
      </span>
      <h2 className="text-xl font-bold text-app-text-strong mb-2">No tasks yet in your area</h2>
      <p className="text-sm text-app-text-muted mb-6 max-w-sm">
        Be the first to post a task and kickstart your neighborhood!
      </p>
      <Link
        href="/app/gigs-v2/new"
        className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition"
      >
        Post a Task
      </Link>
    </div>
  );
}

// ─── Sparse Layout ────────────────────────────────────────────

function SparseFeed({
  allGigs,
  total,
  onDismiss,
}: {
  allGigs: GigListItem[];
  total: number;
  onDismiss: (gigId: string, category: string) => void;
}) {
  return (
    <div>
      <div
        className="motion-safe:animate-section-in opacity-0 px-1 py-4 text-center"
        style={{ animationFillMode: 'forwards' }}
      >
        <p className="text-sm text-app-text-muted leading-relaxed">
          Your neighborhood is just getting started! Here {total === 1 ? 'is' : 'are'} the{' '}
          <strong className="text-app-text-strong">{total}</strong> task{total !== 1 ? 's' : ''}{' '}
          nearby. Post one to help your neighborhood grow.
        </p>
      </div>
      <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
        {allGigs.map((gig) => (
          <TaskRow key={gig.id} gig={gig} onDismiss={onDismiss} />
        ))}
      </div>
      <div className="flex justify-center mt-8 mb-4">
        <Link
          href="/app/gigs-v2/new"
          className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition"
        >
          Post a Task
        </Link>
      </div>
    </div>
  );
}

// ─── Skeleton ──────────────────────────────────────────────

function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-6 first:mt-0">
      <ShimmerLine width="w-40" className="h-5 mb-3" />
      <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-app-border-subtle last:border-b-0"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex justify-between">
                <ShimmerLine width="w-48" />
                <ShimmerLine width="w-12" />
              </div>
              <div className="flex gap-2">
                <ShimmerLine width="w-16" className="h-3" />
                <ShimmerLine width="w-12" className="h-3" />
              </div>
              <ShimmerLine width="w-64" className="h-3" />
            </div>
            <ShimmerBlock className="h-12 w-12 rounded-lg shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Hide Similar Prompt ───────────────────────────────────

function HideSimilarBanner({
  category,
  onConfirm,
  onDismiss,
}: {
  category: string;
  onConfirm: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mx-4 my-3 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
      <p className="text-sm text-amber-800 dark:text-amber-200">
        You&apos;ve hidden several <strong>{category}</strong> tasks. Hide all {category}?
      </p>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={onConfirm}
          className="px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-md hover:bg-amber-700 transition"
        >
          Yes, hide {category}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/50"
        >
          No thanks
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────

interface BrowseFeedProps {
  lat: number | null;
  lng: number | null;
  radiusMeters?: number;
  onCategoryClick: (category: string) => void;
  onSeeAllClick: () => void;
  onError: () => void;
  onDataLoaded?: (data: BrowseResponse) => void;
  onLoadingChange?: (loading: boolean) => void;
  refreshKey?: number;
}

export default function BrowseFeed({
  lat,
  lng,
  radiusMeters,
  onCategoryClick,
  onSeeAllClick,
  onError,
  onDataLoaded,
  onLoadingChange,
  refreshKey,
}: BrowseFeedProps) {
  const [data, setData] = useState<BrowseResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const {
    dismissGig,
    dismissedIds,
    hideSimilarPrompt,
    confirmHideSimilar,
    dismissHideSimilarPrompt,
  } = useDismissGig();
  const requestIdRef = useRef(0);

  const fetchBrowse = useCallback(async () => {
    if (lat == null || lng == null) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setLoading(true);
    onLoadingChange?.(true);
    try {
      const result = await api.gigs.getBrowseSections({
        lat,
        lng,
        ...(radiusMeters != null ? { radius: radiusMeters } : {}),
      });
      if (requestId !== requestIdRef.current) return;
      setData(result);
      onDataLoaded?.(result);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.warn('Browse feed fetch failed:', err);
      onError();
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        onLoadingChange?.(false);
      }
    }
  }, [lat, lng, radiusMeters, onDataLoaded, onLoadingChange, onError]);

  useEffect(() => {
    fetchBrowse();
    return () => {
      requestIdRef.current += 1;
      onLoadingChange?.(false);
    };
  }, [fetchBrowse, refreshKey, onLoadingChange]);

  const handleDismiss = useCallback(
    (gigId: string, category: string) => {
      dismissGig(gigId, category);
    },
    [dismissGig]
  );

  // Filter dismissed gigs from sections
  const filterGigs = useCallback(
    (gigs: GigListItem[]) => gigs.filter((g) => !dismissedIds.has(g.id)),
    [dismissedIds]
  );

  // ── Loading state ──
  if (loading && !data) {
    return (
      <div>
        <SectionSkeleton rows={3} />
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={3} />
      </div>
    );
  }

  if (!data) return null;

  const { sections, total_active } = data;
  const density = getDensity(total_active);

  const bestMatches = filterGigs(sections.best_matches);
  const urgent = filterGigs(sections.urgent);
  const highPaying = filterGigs(sections.high_paying);
  const newToday = filterGigs(sections.new_today);
  const quickJobs = filterGigs(sections.quick_jobs);

  // ── Empty state ──
  if (total_active === 0) {
    return <EmptyNeighborhood />;
  }

  // Screen reader announcement
  const srAnnouncement = `${total_active} task${total_active !== 1 ? 's' : ''} loaded`;

  // ── Sparse: flat list with encouraging message ──
  if (density === 'sparse') {
    const allGigs = dedupeGigs([bestMatches, urgent, highPaying, newToday, quickJobs]);
    const sorted = [...allGigs].sort((a, b) => {
      const da = a.created_at ? new Date(a.created_at).getTime() : 0;
      const db = b.created_at ? new Date(b.created_at).getTime() : 0;
      return db - da;
    });
    return (
      <div role="feed" aria-label="Task browse feed" id="task-feed">
        <div role="status" aria-live="polite" className="sr-only">
          {srAnnouncement}
        </div>
        {hideSimilarPrompt && (
          <HideSimilarBanner
            category={hideSimilarPrompt.category}
            onConfirm={confirmHideSimilar}
            onDismiss={dismissHideSimilarPrompt}
          />
        )}
        <SparseFeed allGigs={sorted} total={total_active} onDismiss={handleDismiss} />
      </div>
    );
  }

  // ── Moderate: 3 sections max ──
  if (density === 'moderate') {
    const moreTasks = dedupeGigs([urgent, highPaying, newToday, quickJobs]).filter(
      (g) => !bestMatches.some((bm) => bm.id === g.id)
    );

    return (
      <div role="feed" aria-label="Task browse feed" id="task-feed">
        <div role="status" aria-live="polite" className="sr-only">
          {srAnnouncement}
        </div>
        {hideSimilarPrompt && (
          <HideSimilarBanner
            category={hideSimilarPrompt.category}
            onConfirm={confirmHideSimilar}
            onDismiss={dismissHideSimilarPrompt}
          />
        )}

        {/* Growing neighborhood indicator */}
        <div className="px-1 py-2 mb-2">
          <p className="text-xs text-app-text-muted">
            {total_active} task{total_active !== 1 ? 's' : ''} nearby and growing — check back soon!
          </p>
        </div>

        {/* Best Matches */}
        {bestMatches.length > 0 && (
          <section
            aria-labelledby="section-best-matches"
            className="motion-safe:animate-section-in opacity-0"
            style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader
              id="section-best-matches"
              title="Best Matches For You"
              subtitle={`${total_active} active tasks nearby`}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {bestMatches.map((gig) => (
                <FeaturedTaskCard key={gig.id} gig={gig} />
              ))}
            </div>
          </section>
        )}

        {/* Clusters */}
        {sections.clusters.length >= 2 && (
          <section
            aria-labelledby="section-clusters"
            className="motion-safe:animate-section-in opacity-0"
            style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader id="section-clusters" title="By Category" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sections.clusters.map((cluster) => (
                <CategoryCluster
                  key={cluster.category}
                  cluster={cluster}
                  onClick={onCategoryClick}
                />
              ))}
            </div>
          </section>
        )}

        {/* More Tasks (merged) */}
        {moreTasks.length > 0 && (
          <section
            aria-labelledby="section-more-tasks"
            className="motion-safe:animate-section-in opacity-0"
            style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader id="section-more-tasks" title="More Tasks" />
            <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
              {moreTasks.map((gig) => (
                <TaskRow key={gig.id} gig={gig} onDismiss={handleDismiss} />
              ))}
            </div>
          </section>
        )}

        <div className="flex justify-center mt-8 mb-4">
          <button
            onClick={onSeeAllClick}
            className="px-6 py-2.5 bg-app-surface border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            See all tasks
          </button>
        </div>
      </div>
    );
  }

  // ── Full: all 6 sections ──
  return (
    <div role="feed" aria-label="Task browse feed" id="task-feed">
      <div role="status" aria-live="polite" className="sr-only">
        {srAnnouncement}
      </div>

      {/* ── Hide Similar Prompt ── */}
      {hideSimilarPrompt && (
        <HideSimilarBanner
          category={hideSimilarPrompt.category}
          onConfirm={confirmHideSimilar}
          onDismiss={dismissHideSimilarPrompt}
        />
      )}

      {/* ── Best Matches ── */}
      {bestMatches.length > 0 && (
        <section
          aria-labelledby="section-best-matches"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: '0ms', animationFillMode: 'forwards' }}
        >
          <SectionHeader
            id="section-best-matches"
            title="Best Matches For You"
            subtitle={`${total_active} active tasks nearby`}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bestMatches.map((gig) => (
              <FeaturedTaskCard key={gig.id} gig={gig} />
            ))}
          </div>
        </section>
      )}

      {/* ── Urgent ── */}
      {urgent.length > 0 && (
        <section
          aria-labelledby="section-urgent"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: '100ms', animationFillMode: 'forwards' }}
        >
          <SectionHeader id="section-urgent" title="Needs Help Soon" />
          <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
            {urgent.map((gig) => (
              <TaskRow key={gig.id} gig={gig} onDismiss={handleDismiss} />
            ))}
          </div>
        </section>
      )}

      {/* ── Clusters ── */}
      {sections.clusters.length > 0 && (
        <section
          aria-labelledby="section-clusters"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: '200ms', animationFillMode: 'forwards' }}
        >
          <SectionHeader id="section-clusters" title="By Category" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {sections.clusters.map((cluster) => (
              <CategoryCluster key={cluster.category} cluster={cluster} onClick={onCategoryClick} />
            ))}
          </div>
        </section>
      )}

      {/* ── High Paying ── */}
      {highPaying.length > 0 && (
        <section
          aria-labelledby="section-high-paying"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
        >
          <SectionHeader id="section-high-paying" title="High Paying Nearby" />
          <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
            {highPaying.map((gig) => (
              <TaskRow key={gig.id} gig={gig} onDismiss={handleDismiss} />
            ))}
          </div>
        </section>
      )}

      {/* ── New Today ── */}
      {newToday.length > 0 && (
        <section
          aria-labelledby="section-new-today"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: '400ms', animationFillMode: 'forwards' }}
        >
          <SectionHeader id="section-new-today" title="New In Your Area" />
          <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
            {newToday.map((gig) => (
              <TaskRow key={gig.id} gig={gig} onDismiss={handleDismiss} />
            ))}
          </div>
        </section>
      )}

      {/* ── Quick Jobs ── */}
      {quickJobs.length > 0 && (
        <section
          aria-labelledby="section-quick-jobs"
          className="motion-safe:animate-section-in opacity-0"
          style={{ animationDelay: '500ms', animationFillMode: 'forwards' }}
        >
          <SectionHeader id="section-quick-jobs" title="Quick Jobs Under $100" />
          <div className="rounded-xl border border-app-border bg-app-surface overflow-hidden">
            {quickJobs.map((gig) => (
              <TaskRow key={gig.id} gig={gig} onDismiss={handleDismiss} />
            ))}
          </div>
        </section>
      )}

      {/* ── See All link ── */}
      <div className="flex justify-center mt-8 mb-4">
        <button
          onClick={onSeeAllClick}
          className="px-6 py-2.5 bg-app-surface border border-app-border rounded-lg text-sm font-medium text-app-text-strong hover:bg-app-hover transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          See all tasks
        </button>
      </div>
    </div>
  );
}
