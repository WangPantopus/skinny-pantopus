'use client';

// ============================================================
// Nearby — the density-gated door (four-tab IA, wedge Phase 1; renamed
// from "Neighborhood" in Phase 1.5 so the tab is alive from day one:
// this page is the meter and the invite loop, and the window onto what
// opens — never a locked tab).
//
// One honest meter decides what this page is:
//   no_place  → claim prompt (the door needs to know where you are)
//   forming   → "be one of the first N" + invite tools (count withheld
//               below the k-anon floor, mirroring the backend contract)
//   growing   → progress bar toward the unlock threshold + invite tools
//   unlocked  → the neighborhood surfaces (Pulse, Marketplace, Tasks…)
//
// Cold-start rule: locked surfaces render as a *preview of a reward with
// a meter*, never as empty rooms. Every locked state carries the same
// invite affordance, because waiting users are the recruiters.
// ============================================================

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Newspaper,
  ShoppingBag,
  Briefcase,
  Compass,
  Map as MapIcon,
  Users,
  Lock,
  Share2,
  Check,
  Home,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { NeighborhoodMeter } from '@pantopus/api';
import { ShimmerBlock } from '@/components/ui/Shimmer';

const SURFACES = [
  { icon: Newspaper, title: 'Pulse', subtitle: 'What your neighbors are posting, asking, and sharing', route: '/app/feed' },
  { icon: ShoppingBag, title: 'Marketplace', subtitle: 'Buy, sell, and give — with people who are verifiably local', route: '/app/marketplace' },
  { icon: Briefcase, title: 'Tasks', subtitle: 'Post and pick up local work, backed by verified addresses', route: '/app/gigs' },
] as const;

const SECONDARY = [
  { icon: Compass, label: 'Discover', route: '/app/discover' },
  { icon: MapIcon, label: 'Map', route: '/app/map' },
  { icon: Users, label: 'Connections', route: '/app/connections' },
] as const;

function areaLabel(meter: NeighborhoodMeter | undefined): string {
  const city = meter?.area?.city;
  return city ? `near ${city}` : 'near you';
}

// ── Invite affordance — the /start funnel is the payload ─────
function InviteButton() {
  const [copied, setCopied] = useState(false);
  const inviteUrl = 'https://pantopus.com/start';
  const inviteText =
    'See what’s true about your address — records, risks, and who’s verified nearby. Free, no account:';

  const share = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Pantopus', text: inviteText, url: inviteUrl });
        return;
      }
    } catch {
      // fall through to clipboard
    }
    try {
      await navigator.clipboard.writeText(`${inviteText} ${inviteUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing else to do
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary-600 text-white text-[15px] font-semibold hover:bg-primary-700 transition-colors"
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      {copied ? 'Link copied' : 'Invite your neighbors'}
    </button>
  );
}

// ── The meter card ───────────────────────────────────────────
function MeterCard({ meter }: { meter: NeighborhoodMeter }) {
  const { state, verified_count, threshold, k_anon_min } = meter;
  const pct =
    state === 'forming'
      ? 8 // below the k-anon floor the exact count is withheld — show a sliver
      : Math.max(8, Math.min(100, Math.round(((verified_count ?? 0) / threshold) * 100)));

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">
          Verified neighbors {areaLabel(meter)}
        </span>
        <span className="text-[13px] font-bold text-app-text tabular-nums">
          {state === 'forming' ? `< ${k_anon_min}` : verified_count} / {threshold}
        </span>
      </div>
      <div className="h-2.5 rounded-full bg-app-border/60 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={verified_count ?? 0} aria-label="Verified neighbors toward unlocking the neighborhood">
        <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-[13.5px] leading-[19px] text-app-text-secondary">
        {state === 'forming'
          ? `Your area is just forming — be one of the first ${k_anon_min} verified households here. The neighborhood opens at ${threshold}.`
          : `${verified_count} households have verified their address nearby. At ${threshold}, the neighborhood opens for everyone.`}
      </p>
    </div>
  );
}

// ── Locked / unlocked surface lists ──────────────────────────
function LockedSurfaces() {
  return (
    <div className="space-y-3">
      {SURFACES.map((s) => {
        const Icon = s.icon;
        return (
          <div key={s.title} className="flex items-center gap-4 p-4 rounded-xl bg-app-surface border border-app-border opacity-80">
            <div className="w-11 h-11 rounded-xl bg-app-border/50 flex items-center justify-center flex-shrink-0">
              <Icon className="w-5 h-5 text-app-text-muted" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[15px] font-bold text-app-text">{s.title}</p>
              <p className="text-xs text-app-text-secondary mt-0.5">{s.subtitle}</p>
            </div>
            <Lock className="w-4 h-4 text-app-text-muted flex-shrink-0" aria-label="Locked" />
          </div>
        );
      })}
    </div>
  );
}

function UnlockedSurfaces() {
  const router = useRouter();
  return (
    <>
      <div className="space-y-3 mb-6">
        {SURFACES.map((s) => {
          const Icon = s.icon;
          return (
            <button
              key={s.title}
              onClick={() => router.push(s.route)}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-app-surface border border-app-border hover:bg-app-hover transition text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center flex-shrink-0">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[15px] font-bold text-app-text">{s.title}</p>
                <p className="text-xs text-app-text-secondary mt-0.5">{s.subtitle}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-app-text-muted flex-shrink-0" />
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {SECONDARY.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => router.push(a.route)}
              className="flex flex-col items-center gap-2 py-4 bg-app-surface border border-app-border rounded-xl hover:bg-app-hover transition"
            >
              <Icon className="w-5 h-5 text-primary-600" />
              <span className="text-xs font-semibold text-app-text">{a.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── The page ─────────────────────────────────────────────────
export default function NearbyPage() {
  const router = useRouter();
  const meterQuery = useQuery({
    queryKey: ['nearby', 'meter'],
    queryFn: () => api.getNeighborhoodMeter(),
    staleTime: 60_000,
  });

  const meter = meterQuery.data;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-app-text leading-tight">Nearby</h1>
        <p className="text-sm text-app-text-secondary mt-2 leading-relaxed">
          Who&apos;s verified {areaLabel(meter)}, and what opens when enough households have: the feed, the
          marketplace, and local tasks. Day one here is real neighbors, not empty rooms.
        </p>
      </div>

      {meterQuery.isPending ? (
        <div className="space-y-3" aria-hidden="true">
          <ShimmerBlock className="h-28 w-full rounded-2xl" />
          <ShimmerBlock className="h-20 w-full rounded-xl" />
          <ShimmerBlock className="h-20 w-full rounded-xl" />
        </div>
      ) : meterQuery.isError ? (
        <div className="text-center py-10">
          <p className="text-sm text-app-text-secondary">We couldn&apos;t load your neighborhood meter.</p>
          <button
            type="button"
            onClick={() => meterQuery.refetch()}
            className="mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700"
          >
            Try again
          </button>
        </div>
      ) : meter?.state === 'no_place' ? (
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-8 text-center">
          <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-app-home-bg text-app-home mb-4">
            <Home className="w-7 h-7" />
          </span>
          <h2 className="text-lg font-bold text-app-text">First, tell us where home is</h2>
          <p className="mt-2 text-sm text-app-text-secondary leading-relaxed max-w-sm mx-auto">
            Your neighborhood is measured around your place. Claim your address and this page becomes your
            block&apos;s progress meter.
          </p>
          <button
            type="button"
            onClick={() => router.push('/app/place')}
            className="mt-5 inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            Claim your address
          </button>
        </div>
      ) : meter?.unlocked ? (
        <>
          <div className="flex items-center gap-2 mb-5 text-primary-600">
            <Sparkles className="w-4 h-4" />
            <span className="text-[13px] font-semibold">
              Your neighborhood is open — {meter.verified_count} verified households {areaLabel(meter)}.
            </span>
          </div>
          <UnlockedSurfaces />
        </>
      ) : meter ? (
        <div className="space-y-5">
          <MeterCard meter={meter} />
          <InviteButton />
          <div>
            <h2 className="text-base font-bold text-app-text mb-3">What opens at {meter.threshold}</h2>
            <LockedSurfaces />
          </div>
        </div>
      ) : null}
    </div>
  );
}
