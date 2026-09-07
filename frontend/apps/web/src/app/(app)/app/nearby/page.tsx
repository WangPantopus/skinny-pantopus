'use client';

// Social discovery is available before an address or neighborhood density.
// The meter describes local participation; it does not authorize feed access.

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Newspaper,
  Radio,
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

// Leaflet touches `window` at import time; the window is client-only.
const NearbyCellsMap = dynamic(() => import('./NearbyCellsMap'), { ssr: false });

const SURFACES = [
  { icon: ShoppingBag, title: 'Marketplace', subtitle: 'Buy, sell, and give — with people who are verifiably local', route: '/app/marketplace' },
  { icon: Briefcase, title: 'Tasks', subtitle: 'Post and pick up local work, backed by verified addresses', route: '/app/gigs' },
] as const;

const SOCIAL = [
  { icon: Newspaper, title: 'Pulse', subtitle: 'Browse a chosen area or catch up with your connections', route: '/app/feed' },
  { icon: Radio, title: 'Beacons', subtitle: 'Find public profiles and return to the people you follow — no home address needed', route: '/app/beacons' },
  { icon: Users, title: 'Connections', subtitle: 'Keep up with people you know', route: '/app/connections' },
] as const;

function SocialDestinations() {
  const router = useRouter();
  return <nav aria-label="Social discovery" className="space-y-3 mb-6">
    {SOCIAL.map(({ icon: Icon, title, subtitle, route }) => (
      <button key={title} type="button" onClick={() => router.push(route)} className="w-full flex items-center gap-4 p-4 rounded-xl bg-app-surface border border-app-border hover:bg-app-hover transition text-left">
        <span className="w-11 h-11 rounded-xl bg-primary-600 flex items-center justify-center shrink-0"><Icon className="w-5 h-5 text-white" /></span>
        <span className="flex-1"><span className="block text-[15px] font-bold text-app-text">{title}</span><span className="block text-[13px] text-app-text-secondary mt-0.5">{subtitle}</span></span>
        <ChevronRight className="w-5 h-5 text-app-text-muted shrink-0" />
      </button>
    ))}
  </nav>;
}

const SECONDARY = [
  { icon: Compass, label: 'Discover', route: '/app/discover' },
  { icon: MapIcon, label: 'Map', route: '/app/map' },
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
      <div className="h-2.5 rounded-full bg-app-border/60 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={threshold} aria-valuenow={verified_count ?? undefined} aria-valuetext={verified_count == null ? `Fewer than ${k_anon_min} verified households` : undefined} aria-label="Verified households toward local marketplace and tasks">
        <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 text-[13.5px] leading-[19px] text-app-text-secondary">
        {state === 'forming'
          ? `Your area is just forming — be one of the first ${k_anon_min} verified households here. Local marketplace and tasks open at ${threshold}. Pulse and Beacons are available now.`
          : `${verified_count} households have verified their address nearby. Local marketplace and tasks open at ${threshold}. Pulse and Beacons are available now.`}
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
      <div className="grid grid-cols-2 gap-2.5">
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
  // The window (Wedge v2 §4): alive whatever the meter says, once there is a place.
  const cellsQuery = useQuery({
    queryKey: ['nearby', 'cells'],
    queryFn: () => api.getNeighborhoodCells(),
    staleTime: 5 * 60_000,
    enabled: !!meter && meter.state !== 'no_place',
  });
  const cellsMap = cellsQuery.data?.state === 'ready' ? <NearbyCellsMap cells={cellsQuery.data} /> : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold text-app-text leading-tight">Nearby</h1>
        <p className="text-sm text-app-text-secondary mt-2 leading-relaxed">
          Join conversations, find Beacons, and stay connected. Choose an area inside Pulse to browse local posts; following Beacons needs no home address.
        </p>
      </div>

      <SocialDestinations />

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
          <h2 className="text-lg font-bold text-app-text">Add a home for neighborhood context</h2>
          <p className="mt-2 text-sm text-app-text-secondary leading-relaxed max-w-sm mx-auto">
            Adding a home gives you neighborhood context and household tools. You can browse Pulse and follow Beacons before setting it up.
          </p>
          <button
            type="button"
            onClick={() => router.push('/app/place')}
            className="mt-5 inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            Set up a home
          </button>
        </div>
      ) : meter?.unlocked ? (
        <>
          <div className="flex items-center gap-2 mb-5 text-primary-600">
            <Sparkles className="w-4 h-4" />
            <span className="text-[13px] font-semibold">
              Local marketplace and tasks are open — {meter.verified_count} verified households {areaLabel(meter)}.
            </span>
          </div>
          {cellsMap ? <div className="mb-5">{cellsMap}</div> : null}
          <UnlockedSurfaces />
        </>
      ) : meter ? (
        <div className="space-y-5">
          {cellsMap}
          <MeterCard meter={meter} />
          <InviteButton />
          <div>
            <h2 className="text-base font-bold text-app-text mb-3">Local marketplace and tasks</h2>
            <LockedSurfaces />
          </div>
        </div>
      ) : null}
    </div>
  );
}
