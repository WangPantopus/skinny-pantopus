// @ts-nocheck
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { GigListItem } from '@pantopus/types';
import { ArrowRight, Inbox } from 'lucide-react';
import ErrorState from '@/components/ui/ErrorState';
import { queryKeys } from '@/lib/query-keys';
import { ListArchetype } from '@/components/archetypes';
import { ProBadge } from '@/components/ProBadge';

type DashboardTab = 'all' | 'active' | 'in_progress' | 'completed' | 'cancelled';

const DASHBOARD_TABS: Array<{ key: DashboardTab; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function getBidCount(gig: GigListItem): number {
  return gig.bid_count ?? gig.bidsCount ?? 0;
}

function formatMoney(value: number | string | null | undefined): string | null {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(parsed);
}

function statusLabel(status: GigListItem['status']): string {
  if (status === 'assigned' || status === 'in_progress') return 'In Progress';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  return 'Open';
}

function statusBadgeClasses(status: GigListItem['status']): string {
  if (status === 'assigned' || status === 'in_progress') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-200';
  }
  if (status === 'completed') {
    return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';
  }
  if (status === 'cancelled') {
    return 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200';
  }
  return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200';
}

function matchesTab(gig: GigListItem, tab: DashboardTab): boolean {
  switch (tab) {
    case 'active':
      return gig.status === 'open';
    case 'in_progress':
      return gig.status === 'assigned' || gig.status === 'in_progress';
    case 'completed':
      return gig.status === 'completed';
    case 'cancelled':
      return gig.status === 'cancelled';
    default:
      return true;
  }
}

function getEmptyState(tab: DashboardTab): {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
} {
  if (tab === 'active') {
    return {
      title: 'No active tasks',
      description: 'Post one to start collecting bids.',
      actionLabel: 'Post a Task',
      actionHref: '/app/gigs-v2/new',
    };
  }

  if (tab === 'completed') {
    return {
      title: 'No completed tasks yet',
      description: 'Completed work will show up here once tasks are finished.',
    };
  }

  if (tab === 'cancelled') {
    return {
      title: 'No cancelled tasks',
      description: 'Cancelled posts will show up here if you close one out.',
    };
  }

  if (tab === 'in_progress') {
    return {
      title: 'Nothing in progress yet',
      description: 'Accepted and assigned work will show up here once you choose a bidder.',
    };
  }

  return {
    title: 'No tasks posted yet',
    description: 'Post your first task to start getting bids from nearby workers.',
    actionLabel: 'Post a Task',
    actionHref: '/app/gigs-v2/new',
  };
}

function getThumbnail(gig: GigListItem): string | null {
  if (gig.first_image) return gig.first_image;
  if (!Array.isArray(gig.attachments)) return null;

  return (
    gig.attachments.find((attachment) => /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(attachment)) || null
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: 'default' | 'active' | 'progress' | 'completed';
}) {
  const toneClasses =
    tone === 'active'
      ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900 dark:bg-emerald-950/20'
      : tone === 'progress'
        ? 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20'
        : tone === 'completed'
          ? 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-900/40'
          : 'border-app-border bg-app-surface';

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-sm text-app-text-secondary">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-app-text">{value}</p>
    </div>
  );
}

function TaskDashboardCard({
  gig,
  onViewBids,
}: {
  gig: GigListItem;
  onViewBids: (gigId: string) => void;
}) {
  const bidCount = getBidCount(gig);
  const highestBid = formatMoney(gig.top_bid_amount);
  const thumbnail = getThumbnail(gig);

  return (
    <article className="rounded-3xl border border-app-border bg-app-surface p-5 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-start">
        {thumbnail ? (
          <div className="h-24 w-full shrink-0 overflow-hidden rounded-2xl border border-app-border-subtle bg-app-surface-sunken md:w-28">
            <div
              role="img"
              aria-label={gig.title}
              className="h-full w-full bg-cover bg-center"
              style={{ backgroundImage: `url("${thumbnail}")` }}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-app-text">{gig.title}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeClasses(gig.status)}`}
                >
                  {statusLabel(gig.status)}
                </span>
              </div>
              {gig.description ? (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-app-text-secondary">
                  {gig.description}
                </p>
              ) : null}
            </div>

            <div className="shrink-0 rounded-2xl bg-primary-50 px-3 py-2 text-right dark:bg-primary-950/30">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700 dark:text-primary-200">
                Bids
              </p>
              <p className="mt-1 text-2xl font-semibold text-primary-700 dark:text-primary-100">
                {bidCount}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-app-text-secondary">
            <span>Posted {formatDate(gig.created_at) || 'recently'}</span>
            {gig.deadline ? <span>Deadline {formatDate(gig.deadline)}</span> : null}
            {gig.category ? <span>{gig.category}</span> : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-app-border-subtle bg-app-surface-raised px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-text-muted">
                Bid activity
              </p>
              <p className="mt-1 text-base font-medium text-app-text">
                {bidCount} bid{bidCount === 1 ? '' : 's'}
              </p>
            </div>

            <div className="rounded-2xl border border-app-border-subtle bg-app-surface-raised px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-app-text-muted">
                Highest bid
              </p>
              <p className="mt-1 text-base font-medium text-app-text">
                {highestBid ? highestBid : 'No bids yet'}
              </p>
            </div>
          </div>

          {bidCount === 0 ? (
            <p className="mt-4 text-sm text-app-text-secondary">
              No bids yet. Share this task to get responses.
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={() => onViewBids(gig.id)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              View Bids
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MyGigsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DashboardTab>('all');

  // Auth guard
  useEffect(() => {
    if (!getAuthToken()) router.push('/login');
  }, [router]);

  const gigsQuery = useQuery<GigListItem[]>({
    queryKey: queryKeys.myGigs(),
    queryFn: async () => {
      const response = await api.gigs.getMyGigs({ limit: 100 });
      return ((response as Record<string, any>).gigs || []) as GigListItem[];
    },
    staleTime: 30_000,
  });

  const gigs = gigsQuery.data ?? [];
  const loading = gigsQuery.isPending;
  const fetchError = gigsQuery.error ? 'Failed to load your tasks. Please try again.' : null;

  const stats = useMemo(
    () => ({
      total: gigs.length,
      active: gigs.filter((gig) => gig.status === 'open').length,
      inProgress: gigs.filter((gig) => gig.status === 'assigned' || gig.status === 'in_progress')
        .length,
      completed: gigs.filter((gig) => gig.status === 'completed').length,
      cancelled: gigs.filter((gig) => gig.status === 'cancelled').length,
    }),
    [gigs]
  );

  const tabCounts = useMemo<Record<DashboardTab, number>>(
    () => ({
      all: stats.total,
      active: stats.active,
      in_progress: stats.inProgress,
      completed: stats.completed,
      cancelled: stats.cancelled,
    }),
    [stats]
  );

  const filteredGigs = useMemo(
    () => gigs.filter((gig) => matchesTab(gig, activeTab)),
    [gigs, activeTab]
  );

  const emptyState = getEmptyState(activeTab);

  return (
    <div className="min-h-[calc(100vh-64px)] bg-app-surface-raised">
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <ListArchetype<GigListItem>
          overline="Poster dashboard"
          title={<span className="inline-flex items-center gap-2">My tasks<ProBadge /></span>}
          subtitle="Track bids, deadlines, and progress across the tasks you've posted."
          primaryAction={{
            label: 'Post a task',
            onClick: () => router.push('/app/gigs-v2/new'),
          }}
          secondaryActions={[
            {
              label: 'Browse tasks',
              onClick: () => router.push('/app/gigs'),
              icon: ArrowRight,
            },
          ]}
          tabs={DASHBOARD_TABS.map((t) => ({
            key: t.key,
            label: t.label,
            count: tabCounts[t.key],
          }))}
          activeTabKey={activeTab}
          onTabChange={(k) => setActiveTab(k as DashboardTab)}
          scrollableTabs
          renderHeader={() => (
            <>
              {fetchError ? (
                <div className="mb-4">
                  <ErrorState
                    message={fetchError}
                    onRetry={() => { void gigsQuery.refetch(); }}
                  />
                </div>
              ) : null}
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <SummaryCard label="Total posted" value={stats.total} />
                <SummaryCard label="Active" value={stats.active} tone="active" />
                <SummaryCard label="In progress" value={stats.inProgress} tone="progress" />
                <SummaryCard label="Completed" value={stats.completed} tone="completed" />
              </section>
            </>
          )}
          loading={loading}
          loadingSlot={
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="animate-pulse rounded-3xl border border-app-border bg-app-surface p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row">
                    <div className="h-24 rounded-2xl bg-app-surface-sunken md:w-28" />
                    <div className="flex-1 space-y-3">
                      <div className="h-6 w-2/3 rounded bg-app-surface-sunken" />
                      <div className="h-4 w-full rounded bg-app-surface-sunken" />
                      <div className="h-4 w-1/2 rounded bg-app-surface-sunken" />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="h-16 rounded-2xl bg-app-surface-sunken" />
                        <div className="h-16 rounded-2xl bg-app-surface-sunken" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          }
          rows={filteredGigs}
          rowSpacing={4}
          keyExtractor={(gig) => gig.id}
          renderRow={(gig) => (
            <TaskDashboardCard
              gig={gig}
              onViewBids={(gigId) => router.push(`/app/gigs/${gigId}`)}
            />
          )}
          emptyState={{
            icon: Inbox,
            headline: emptyState.title,
            subcopy: emptyState.description,
            tone: 'personal',
            ctaLabel: emptyState.actionLabel,
            onCtaClick: emptyState.actionHref
              ? () => router.push(emptyState.actionHref)
              : undefined,
          }}
        />
      </main>
    </div>
  );
}
