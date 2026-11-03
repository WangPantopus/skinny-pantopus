'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Bookmark, Briefcase, ChevronRight, CircleHelp, ClipboardList, HandHeart, Home, LogOut, Settings, UserPlus, Users,
  Wallet, X,
} from 'lucide-react';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';
import { toast } from '@/components/ui/toast-store';
import { launchFeatures } from '@/lib/featureFlags';
import { signOut } from '@/lib/signOut';

// Your own numbers on your own profile (Instant Screens contract §4, "You").
const OWN_FRESH_MS = 2 * 60 * 1000;

// ── Tips only you see ──

export interface OwnerTip {
  key: string;
  icon: ReactNode;
  title: string;
  detail: string;
  onOpen: () => void;
}

const tipsKey = (accountId: string) => `pantopus:profile-tips-hidden:${accountId}`;

function readHiddenTips(accountId: string): string[] {
  try {
    const value = JSON.parse(window.localStorage.getItem(tipsKey(accountId)) || '[]');
    return Array.isArray(value) ? value.filter((v) => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Up to two tips only you see (a photo, a tagline, what you help with…). Hiding one is remembered in this browser;
 * the next one, if any, takes its place.
 */
export function OwnerTips({ accountId, tips }: { accountId: string; tips: OwnerTip[] }) {
  // Read after mount: the server has no browser storage, so the first frame draws no tips rather than wrong ones.
  const [hidden, setHidden] = useState<string[] | null>(null);
  useEffect(() => setHidden(readHiddenTips(accountId)), [accountId]);
  if (!hidden) return null;
  const shown = tips.filter((tip) => !hidden.includes(tip.key)).slice(0, 2);
  if (shown.length === 0) return null;

  const hide = (key: string) => {
    const next = [...hidden, key];
    setHidden(next);
    try {
      window.localStorage.setItem(tipsKey(accountId), JSON.stringify(next));
    } catch {
      // Private windows can refuse storage: the tip stays hidden until the page reloads.
    }
  };

  return (
    <ul aria-label="Tips only you see" className="mt-4 flex flex-col gap-2.5">
      {shown.map((tip) => (
        <li key={tip.key} className="rounded-2xl border border-dashed border-app-strong bg-surface flex items-center">
          <button
            type="button"
            onClick={tip.onOpen}
            className="flex-1 min-w-0 py-3 pl-3.5 pr-1 flex items-center gap-3 text-left rounded-l-2xl hover-bg-app"
          >
            <span aria-hidden="true" className="w-10 h-10 shrink-0 rounded-full bg-primary-50 text-app-link flex items-center justify-center">
              {tip.icon}
            </span>
            <span className="min-w-0 flex flex-col gap-px">
              <span className="text-[0.9375rem] leading-5 font-semibold text-app">{tip.title}</span>
              <span className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{tip.detail}</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => hide(tip.key)}
            aria-label={`Hide this tip: ${tip.title}`}
            className="w-11 h-11 shrink-0 mr-1 rounded-full flex items-center justify-center text-app-muted hover-bg-app"
          >
            <X aria-hidden="true" className="w-[1.125rem] h-[1.125rem]" strokeWidth={2.25} />
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Your month ──

/** The month before this one, as the monthly receipt counts it. */
function lastMonth(now = new Date()): { year: number; month: number } {
  const month = now.getMonth(); // 0-based this month = 1-based last month
  return month === 0 ? { year: now.getFullYear() - 1, month: 12 } : { year: now.getFullYear(), month };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Your October · 2 neighbors helped · 3 posts": last month from your monthly receipt, shown only when something
 * happened, with Share. Money stays off your profile.
 */
export function MonthLine() {
  const period = lastMonth();
  const query = useQuery({
    queryKey: ['me', 'monthly-receipt', period.year, period.month],
    queryFn: () => api.users.getMonthlyReceipt(period.year, period.month),
    staleTime: OWN_FRESH_MS,
    retry: false,
  });
  const receipt = query.data;
  if (!receipt) return null;
  const community = receipt.community || ({} as Record<string, number>);
  const facts = [
    community.neighbors_helped > 0 ? plural(community.neighbors_helped, 'neighbor helped', 'neighbors helped') : null,
    community.posts_created > 0 ? plural(community.posts_created, 'post', 'posts') : null,
    community.connections_made > 0 ? plural(community.connections_made, 'new connection', 'new connections') : null,
  ].filter(Boolean) as string[];
  if (facts.length === 0) return null;
  const monthName = new Date(period.year, period.month - 1, 1).toLocaleDateString('en-US', { month: 'long' });

  const share = async () => {
    const text = `My ${monthName} on Pantopus: ${facts.join(', ')}.`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
    } catch (err) {
      if ((err as { name?: string } | null)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Couldn’t share this. Try again.');
    }
  };

  return (
    <section aria-label={`Your ${monthName}`} className="rounded-2xl border border-app bg-surface py-3 pl-3.5 pr-3 flex items-center gap-3">
      <span aria-hidden="true" className="w-9 h-9 shrink-0 rounded-full bg-app-home-bg text-app-home flex items-center justify-center">
        <HandHeart className="w-[1.125rem] h-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.9375rem] leading-5 font-semibold text-app">Your {monthName}</p>
        <p className="text-[0.8125rem] leading-[1.125rem] text-app-muted">{facts.join(' · ')}</p>
      </div>
      <button
        type="button"
        onClick={() => void share()}
        className="min-h-[2.75rem] shrink-0 px-4 rounded-full border border-app-strong text-[0.9375rem] font-semibold text-app hover-bg-app"
      >
        Share
      </button>
    </section>
  );
}

// ── Your account ──

function AccountRow({ icon, label, value, onClick }: { icon: ReactNode; label: string; value?: string | null; onClick: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="w-full min-h-[3.25rem] pl-4 pr-3.5 py-2 flex items-center gap-3 text-left hover-bg-app"
      >
        <span aria-hidden="true" className="shrink-0 text-app-strong">{icon}</span>
        <span className="flex-1 min-w-0 text-base leading-[1.3125rem] text-app">{label}</span>
        {value ? <span className="shrink-0 text-[0.9375rem] leading-5 text-app-muted">{value}</span> : null}
        <ChevronRight aria-hidden="true" className="w-4 h-4 shrink-0 text-app-muted" strokeWidth={2} />
      </button>
    </li>
  );
}

/**
 * Your account: the places the old profile dashboard opened, as one short list (Connections with a count, Support
 * Trains, My tasks, Wallet, Saved places, My homes, Invite neighbors, Settings & privacy, Help), then Log out.
 */
export function AccountSection() {
  const router = useRouter();
  const iconClass = 'w-5 h-5';
  const connections = useQuery({
    queryKey: ['me', 'connections', 'count'],
    queryFn: () => api.relationships.getConnections({ limit: 100 }),
    staleTime: OWN_FRESH_MS,
    retry: false,
  });
  const invites = useQuery({
    queryKey: ['me', 'invite-progress'],
    queryFn: () => api.users.getInviteProgress(),
    staleTime: OWN_FRESH_MS,
    retry: false,
  });
  const connectionCount = connections.data
    ? (connections.data.relationships || []).length
    : null;
  const joined = invites.data?.total_converted ?? 0;

  const invite = async () => {
    try {
      const { invite_url: url } = await api.users.getInviteCode();
      const text = 'Join me on Pantopus, the app for our neighborhood.';
      if (navigator.share) {
        try {
          await navigator.share({ text, url });
          return;
        } catch (err) {
          if ((err as { name?: string } | null)?.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(url);
      toast.success('Invite link copied');
    } catch {
      toast.error('Couldn’t get your invite link. Try again.');
    }
  };

  const logOut = async () => {
    const yes = await confirmStore.open({
      title: 'Log out of Pantopus?',
      description: 'You can sign in again any time.',
      confirmLabel: 'Log out',
      variant: 'destructive',
    });
    if (yes) await signOut();
  };

  return (
    <section aria-labelledby="profile-your-account">
      <h2 id="profile-your-account" className="mb-2.5 text-xl leading-[1.5625rem] font-bold text-app">Your account</h2>
      <ul className="rounded-2xl border border-app bg-surface divide-y divide-app overflow-hidden">
        <AccountRow
          icon={<Users className={iconClass} />}
          label="Connections"
          value={connectionCount == null ? null : connectionCount >= 100 ? '100+' : String(connectionCount)}
          onClick={() => router.push('/app/connections')}
        />
        <AccountRow icon={<HandHeart className={iconClass} />} label="Support trains" onClick={() => router.push('/app/support-trains')} />
        <AccountRow icon={<ClipboardList className={iconClass} />} label="My tasks" onClick={() => router.push('/app/my-gigs')} />
        {/* Launch cuts #4 and #3: bids and listings come back with their features. */}
        {launchFeatures.openGigs && (
          <AccountRow icon={<Briefcase className={iconClass} />} label="My bids" onClick={() => router.push('/app/my-bids')} />
        )}
        {launchFeatures.marketplace && (
          <AccountRow icon={<Briefcase className={iconClass} />} label="My listings" onClick={() => router.push('/app/my-listings')} />
        )}
        <AccountRow icon={<Wallet className={iconClass} />} label="Wallet" onClick={() => router.push('/app/wallet')} />
        <AccountRow icon={<Bookmark className={iconClass} />} label="Saved places" onClick={() => router.push('/app/place?savedPlace=all')} />
        <AccountRow icon={<Home className={iconClass} />} label="My homes" onClick={() => router.push('/app/homes')} />
        <AccountRow
          icon={<UserPlus className={iconClass} />}
          label="Invite neighbors"
          value={joined > 0 ? `${joined} joined` : null}
          onClick={() => void invite()}
        />
        <AccountRow icon={<Settings className={iconClass} />} label="Settings & privacy" onClick={() => router.push('/app/profile/settings')} />
        <AccountRow icon={<CircleHelp className={iconClass} />} label="Help" onClick={() => router.push('/contact')} />
      </ul>
      <button
        type="button"
        onClick={() => void logOut()}
        className="mt-4 w-full min-h-[3.25rem] px-4 rounded-2xl border border-app bg-surface flex items-center gap-3 text-left text-base font-semibold text-red-700 hover-bg-app"
      >
        <LogOut aria-hidden="true" className="w-5 h-5" />
        Log out
      </button>
    </section>
  );
}
