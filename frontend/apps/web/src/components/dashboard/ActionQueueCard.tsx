'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import type { User, GigListItem } from '@pantopus/types';

type Priority = 'high' | 'medium' | 'low';

/** Which inputs couldn't be read; their items are skipped rather than guessed. */
type Failed = { profile?: boolean; gigs?: boolean; bids?: boolean; stripe?: boolean };

function statusOf(err: unknown): number | undefined {
  const e = err as { statusCode?: number; status?: number } | null;
  return e?.statusCode ?? e?.status;
}

function ActionQueueItem({
  icon,
  title,
  subtitle,
  cta,
  priority,
  onClick,
}: {
  icon: string;
  title: string;
  subtitle: string;
  cta: string;
  priority: Priority;
  onClick: () => void;
}) {
  const badgeClass =
    priority === 'high'
      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      : priority === 'medium'
        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
        : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300';
  const badgeLabel = priority === 'high' ? 'High' : priority === 'medium' ? 'Medium' : 'Low';

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-lg border border-app-border-subtle hover:border-app-border hover:bg-app-hover p-2.5 transition"
    >
      <div className="flex items-start gap-2">
        <span className="text-base leading-5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-app-text">{title}</p>
            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
              {badgeLabel}
            </span>
          </div>
          <p className="text-xs text-app-text-secondary mt-0.5">{subtitle}</p>
        </div>
        <span className="text-xs font-semibold text-primary-600">{cta} →</span>
      </div>
    </button>
  );
}

export default function ActionQueueCard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [gigs, setGigs] = useState<GigListItem[]>([]);
  const [myBidsByGigId, setMyBidsByGigId] = useState<Record<string, Record<string, any>>>({});
  const [loadingStripeStatus, setLoadingStripeStatus] = useState(true);
  const [stripeReady, setStripeReady] = useState(false);
  const [failed, setFailed] = useState<Failed>({});
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    // Middleware handles auth — no client-side token check needed.
    const failures: Failed = {};
    setLoadingStripeStatus(true);
    Promise.all([
      api.users.getMyProfile().then(setUser).catch((err) => {
        console.warn('[ActionQueueCard] Failed to load profile:', err?.message);
        failures.profile = true;
      }),
      // The viewer's own open tasks. The public list (`getGigs`) leaves the
      // viewer's tasks out, so deadline / no-offer items could never appear.
      api.gigs.getMyGigs({ limit: 100, status: ['open'] }).then((r) => setGigs((r?.gigs || []) as GigListItem[])).catch((err) => {
        console.warn('[ActionQueueCard] Failed to load gigs:', err?.message);
        failures.gigs = true;
        setGigs([]);
      }),
      api.gigs.getMyBids({ limit: 200, status: ['pending', 'accepted', 'rejected'] }).then((r: Record<string, any>) => {
        const bids = (r?.bids || []) as Record<string, any>[];
        const map: Record<string, Record<string, any>> = {};
        for (const b of bids) {
          if (b?.gig_id) map[String(b.gig_id)] = b;
        }
        setMyBidsByGigId(map);
      }).catch((err) => {
        console.warn('[ActionQueueCard] Failed to load bids:', err?.message);
        failures.bids = true;
        setMyBidsByGigId({});
      }),
      api.payments.getStripeAccount().then((result: Record<string, any>) => {
        const account = result?.account as Record<string, any> | undefined;
        setStripeReady(Boolean(account?.payouts_enabled && account?.charges_enabled));
      }).catch((err) => {
        console.warn('[ActionQueueCard] Failed to load Stripe status:', err?.message);
        // 404: no payout account yet — that is the to-do. Anything else is unknown.
        if (statusOf(err) !== 404) failures.stripe = true;
        setStripeReady(false);
      }),
    ]).finally(() => {
      setFailed(failures);
      setLoadingStripeStatus(false);
    });
  }, [reloadKey]);

  const myPendingOffers = useMemo(() => {
    return Object.values(myBidsByGigId).filter((b: Record<string, any>) => String(b?.status || '').toLowerCase() === 'pending').length;
  }, [myBidsByGigId]);

  const actionQueue = useMemo(() => {
    // `gigs` holds only the viewer's own tasks (my-gigs).
    const openMine = gigs.filter((g) => String(g.status || 'open') === 'open');
    const openMineNoOffers = openMine.filter((g) => Number((g as Record<string, any>).bidsCount || 0) === 0).length;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const urgentMine = openMine.filter((g) => {
      const raw = g?.deadline;
      const t = raw ? new Date(String(raw)).getTime() : NaN;
      return Number.isFinite(t) && t >= now && (t - now) <= dayMs;
    }).length;

    const missingPhoto = !failed.profile && !(
      user?.profile_picture_url ||
      user?.profilePicture ||
      user?.profile_picture ||
      user?.avatar_url
    );

    const items: Array<{ id: string; icon: string; title: string; subtitle: string; cta: string; priority: Priority; onClick: () => void }> = [];

    if (missingPhoto) {
      items.push({
        id: 'photo',
        icon: '🖼️',
        title: 'Add profile photo',
        subtitle: 'People reply faster when your profile is complete.',
        cta: 'Complete',
        priority: 'medium',
        onClick: () => router.push('/app/profile/edit'),
      });
    }
    if (!loadingStripeStatus && !failed.stripe && !stripeReady) {
      items.push({
        id: 'payout',
        icon: '💳',
        title: 'Set up payouts',
        subtitle: 'Connect Stripe to receive gig earnings.',
        cta: 'Setup',
        priority: 'high',
        onClick: () => router.push('/app/settings/payments'),
      });
    }
    if (myPendingOffers > 0) {
      items.push({
        id: 'offers',
        icon: '⏳',
        title: `${myPendingOffers} pending offer${myPendingOffers === 1 ? '' : 's'}`,
        subtitle: 'Check status and follow up on active bids.',
        cta: 'Review',
        priority: 'medium',
        onClick: () => router.push('/app/my-bids'),
      });
    }
    if (urgentMine > 0) {
      items.push({
        id: 'urgent',
        icon: '⚠️',
        title: `${urgentMine} deadline${urgentMine === 1 ? '' : 's'} within 24h`,
        subtitle: 'Prioritize urgent tasks now.',
        cta: 'View',
        priority: 'high',
        onClick: () => router.push('/app/my-gigs'),
      });
    }
    if (openMineNoOffers > 0) {
      items.push({
        id: 'boost',
        icon: '📣',
        title: `${openMineNoOffers} task${openMineNoOffers === 1 ? '' : 's'} with no offers`,
        subtitle: 'Update details or budget to improve responses.',
        cta: 'Manage',
        priority: 'medium',
        onClick: () => router.push('/app/my-gigs'),
      });
    }
    const anyFailed = Boolean(failed.profile || failed.gigs || failed.bids || failed.stripe);
    if (items.length === 0 && anyFailed) {
      // Don't claim "caught up" when part of the queue couldn't be checked.
      items.push({
        id: 'unchecked',
        icon: '⚠️',
        title: "Couldn't check everything",
        subtitle: 'Some of your updates didn\'t load.',
        cta: 'Retry',
        priority: 'low',
        onClick: () => setReloadKey((k) => k + 1),
      });
    } else if (items.length === 0) {
      items.push({
        id: 'caught-up',
        icon: '✅',
        title: 'You are caught up',
        subtitle: 'No urgent actions right now.',
        cta: 'Post',
        priority: 'low',
        onClick: () => router.push('/app/gigs-v2/new'),
      });
    }

    const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
    return items.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]).slice(0, 4);
  }, [user, gigs, loadingStripeStatus, stripeReady, failed, myPendingOffers, router]);

  return (
    <div className="bg-app-surface rounded-xl p-4 border border-app-border shadow-sm">
      <h3 className="font-semibold text-sm text-app-text mb-3">✅ Action Queue</h3>
      <div className="space-y-2">
        {actionQueue.map((item) => (
          <ActionQueueItem
            key={item.id}
            icon={item.icon}
            title={item.title}
            subtitle={item.subtitle}
            cta={item.cta}
            priority={item.priority}
            onClick={item.onClick}
          />
        ))}
      </div>
    </div>
  );
}
