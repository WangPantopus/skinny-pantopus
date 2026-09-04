// ============================================================
// StartFunnel — the signed-out Place funnel at /start.
//
// A2 hero (sentence-case, "free, no account" on the demonstration only)
// → address autocomplete (public api.geo) → the taste → the wall.
//
// The taste (Wedge v2, D1): the AHA card first — the one most non-obvious
// fact for this spot, ranked server-side — then EVERY free Band-A layer
// as a one-shot snapshot (today's air / weather / alerts, wildfire, flood,
// seismic, radon, water, EPA facilities, block, rent band, civic),
// rendered through the same `renderSection` the claimed dashboard uses.
// Only Band B (ATTOM exact record) is a LockedCard. The privacy promise
// sits above the wall. The preview persists nothing — the resolved
// address is only stashed (sessionStorage) to save once the account
// exists.
// ============================================================

'use client';

import { Fragment, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react';
import {
  MapPinned,
  Globe,
  Lock as LockIcon,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Mailbox,
  Smartphone,
  Share2,
  Home,
  Bell,
  Wind,
  Waves,
  Flame,
  Activity,
  TestTube,
  Droplets,
  Factory,
  BadgePercent,
  Vote,
  Landmark,
  House,
} from 'lucide-react';
import * as api from '@pantopus/api';
import type { PlacePreview, PlacePreviewLockedSection, PlacePreviewMoneyLead } from '@pantopus/api';
import type { PlaceBlockDensityData, PlaceSection } from '@pantopus/types';
import { Group, SectionCard, LockedCard, DensityCard, PlaceHeader, TextButton, AhaCard } from '@/components/archetypes/place';
import { PantopusLockup } from '@/components/brand/PantopusMark';
import { renderSection } from '@/components/place/presentation';
import { ShimmerBlock } from '@/components/ui/Shimmer';
import { getStoreDownloadCta } from '@/lib/publicShare';
import { stashPendingPlace } from './pendingPlace';
import PrivacyPromise from './PrivacyPromise';
import AddressAutocomplete, { type SelectedAddress } from './AddressAutocomplete';

const REGISTER_HREF = '/register?redirectTo=%2Fapp%2Fplace';

// ── Brand lockup + static region pill ───────────────────────
function TopBar() {
  return (
    <div className="flex items-center justify-between pt-2">
      <PantopusLockup size={30} />
      <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-app-text-muted">
        <Globe size={13} strokeWidth={2} />
        <span className="text-[12px] font-medium -tracking-[0.01em]">United States</span>
      </span>
    </div>
  );
}

// ── The hero step ───────────────────────────────────────────
//
// One job: get a stranger from a postcard, a share card or a search to
// type their address. The field is the hero; the example card shows what
// comes back (a glimpse, not a second page); the proof line answers the
// privacy objection before it is raised. Two columns from lg, one below.
function HeroStep({
  onSelect,
  onClear,
  onSubmit,
  canSubmit,
  onBrowse,
  fromCard,
}: {
  onSelect: (p: SelectedAddress) => void;
  onClear: () => void;
  onSubmit: () => void;
  canSubmit: boolean;
  onBrowse: () => void;
  /** Opened from a mailed card (`/start?r=…`). */
  fromCard: boolean;
}) {
  return (
    <div className="flex flex-col min-h-screen pb-8">
      <TopBar />
      <div className="flex-1 flex flex-col justify-center py-8 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center lg:gap-14">
        <div>
          {fromCard ? (
            <span
              data-testid="start-from-card"
              className="inline-flex items-center gap-1.5 rounded-full bg-app-home-bg px-2.5 py-1 text-[12.5px] font-semibold text-app-home"
            >
              <Mailbox size={14} strokeWidth={2.25} />
              From the card in your mailbox
            </span>
          ) : null}
          <h1
            className={`text-[31px] leading-[37px] sm:text-[36px] sm:leading-[43px] lg:text-[42px] lg:leading-[48px] font-bold -tracking-[0.028em] text-app-text text-balance ${fromCard ? 'mt-4' : ''}`}
          >
            See what&apos;s true about your address.
          </h1>
          <p className="mt-3.5 max-w-[46ch] text-[15.5px] leading-[23px] text-app-text-secondary -tracking-[0.005em]">
            Wildfire and flood risk, today&apos;s air, radon, water, who represents you, and the neighbors who&apos;ve
            proven they&apos;re real. Free, no account.
          </p>

          <div className="mt-6 flex flex-col gap-2.5">
            <AddressAutocomplete onSelect={onSelect} onClear={onClear} onSubmit={onSubmit} autoFocus />
            <button
              type="button"
              onClick={onSubmit}
              disabled={!canSubmit}
              className="h-[54px] w-full flex items-center justify-center gap-1.5 rounded-2xl bg-primary-600 text-white text-base font-semibold -tracking-[0.01em] shadow-[var(--shadow-primary)] enabled:hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              See your place
              <ArrowRight size={17} strokeWidth={2.5} />
            </button>
          </div>

          <PrivacyProof />
        </div>

        <ExampleReadings className="mt-8 lg:mt-0" />
      </div>

      <div className="flex flex-col items-center gap-0.5">
        <button
          type="button"
          onClick={onBrowse}
          className="inline-flex items-center gap-1.5 py-2 px-1 text-[13.5px] font-medium text-app-text-secondary -tracking-[0.005em]"
        >
          Just here to follow someone or browse?
          <ArrowRight size={14} strokeWidth={2.25} className="text-primary-600" />
        </button>
        {/*
          The "you are a different kind of user than this funnel assumes"
          affordance, for the shopper. This funnel asks people to claim
          the address they live at; Scout's reader is standing outside an
          open house with twenty minutes before a showing and has no
          place to save. Routing them by INTENT rather than dropping them
          into the claim flow is also the only way to find out whether
          that intent exists — never carry the typed address in the URL.

          `redirectTo`, NOT `intent`: the register page reads redirectTo
          (via readAuthRedirectQuery) and nothing anywhere reads `intent`,
          so the first version of this link dropped the shopper into the
          default /app/place claim flow — the exact funnel it exists to
          route around.
        */}
        <Link
          href="/register?redirectTo=%2Fapp%2Fplace%2Fscout"
          className="inline-flex items-center gap-1.5 py-2 px-1 text-[13.5px] font-medium text-app-text-secondary -tracking-[0.005em]"
        >
          Considering a place you don&apos;t live at yet?
          <ArrowRight size={14} strokeWidth={2.25} className="text-primary-600" />
        </Link>
      </div>
    </div>
  );
}

// The privacy answer, in the one place a stranger is deciding whether to
// type their address. Specific beats reassuring: it names what a neighbor
// sees and what they never see.
function PrivacyProof() {
  return (
    <div className="mt-4 flex items-start gap-2 px-1" data-testid="start-privacy-proof">
      <ShieldCheck size={15} strokeWidth={2.1} className="mt-[3px] text-app-home shrink-0" />
      <span className="text-[13px] leading-[19px] text-app-text-secondary">
        Neighbors see a first name and a street.{' '}
        <span className="font-semibold text-app-text">Never your house number.</span>
      </span>
    </div>
  );
}

// A glimpse of the answer, using the dashboard's own row grammar so the
// real preview feels like more of the same. Static and clearly labeled
// as an example: no network, no synthesized "your" data.
const EXAMPLE_READINGS: { icon: LucideIcon; label: string; value: string; tone: 'good' | 'watch' | 'neutral' }[] = [
  { icon: Wind, label: 'Air today', value: 'Good · AQI 24', tone: 'good' },
  { icon: Waves, label: 'Flood zone', value: 'X · minimal', tone: 'good' },
  { icon: TestTube, label: 'Radon', value: 'Zone 1 · test it', tone: 'watch' },
  { icon: Trash2, label: 'Next pickup', value: 'Tue · garbage + recycling', tone: 'neutral' },
];

const TONE_DOT: Record<'good' | 'watch' | 'neutral', string> = {
  good: 'bg-app-home-solid',
  watch: 'bg-app-warning-solid',
  neutral: 'bg-app-text-muted',
};

function ExampleReadings({ className = '' }: { className?: string }) {
  return (
    <aside
      aria-label="Example of what an address shows"
      data-testid="start-example"
      className={`rounded-2xl border border-app-border bg-app-surface shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between px-4 pt-3.5 pb-2">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-app-text-muted">Example</span>
        <span className="text-[12px] font-medium text-app-text-muted">A home in Camas, WA</span>
      </div>
      <ul className="divide-y divide-app-border-subtle">
        {EXAMPLE_READINGS.map(({ icon: Icon, label, value, tone }) => (
          <li key={label} className="flex items-center gap-3 px-4 py-2.5">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-app-bg text-app-text-secondary">
              <Icon size={16} strokeWidth={2} />
            </span>
            <span className="flex-1 text-[14px] font-medium text-app-text">{label}</span>
            <span className="inline-flex items-center gap-1.5 text-[13.5px] text-app-text-secondary">
              <span className={`h-1.5 w-1.5 rounded-full ${TONE_DOT[tone]}`} aria-hidden />
              {value}
            </span>
          </li>
        ))}
      </ul>
      <p className="px-4 pt-2 pb-3.5 text-[12px] leading-[17px] text-app-text-muted">
        Yours takes about three seconds and stays on this page until you save it.
      </p>
    </aside>
  );
}

// ── Preview hero card ("here's what's public…") ─────────────
function PreviewHeroCard() {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">Public preview</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-app-home-bg text-app-home text-[11px] font-semibold px-2 py-0.5">
          <ShieldCheck size={12} strokeWidth={2.25} />
          Free · one-time look
        </span>
      </div>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center shrink-0 w-[42px] h-[42px] rounded-xl bg-app-home-bg text-app-home">
          <MapPinned size={22} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-app-text leading-[23px] -tracking-[0.012em]">
            Here&apos;s what&apos;s public about your address — a free, one-time look.
          </p>
          <p className="text-[13.5px] text-app-text-secondary leading-[19px] mt-1.5">
            Claim it to save this page and get it every morning.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── The money lead — the preview's headline figure (Wave 4) ──
//
// A real, free, public benchmark for the AREA: an NFIP tract premium
// band or a HUD county fair market rent. The server composes the
// sentence AND the figure — nothing here is computed or rounded client
// side, because a dollar figure is the most believable thing on the page
// and the easiest to overclaim.
//
// `money_lead: null` means no figure was genuinely available. The tiles
// then carry the page exactly as they did before this existed: no
// placeholder, no gap, no invented number.
// A truthy-but-empty lead object took the hero slot AND rendered nothing
// in it, leaving a blank card where the page's whole argument goes. The
// headline is the card, so no headline means fall back to the hero.
function isRenderableLead(lead: PlacePreviewMoneyLead | null | undefined): lead is PlacePreviewMoneyLead {
  return !!lead && typeof lead.headline === 'string' && lead.headline.trim().length > 0;
}

function MoneyLeadCard({ lead }: { lead: PlacePreviewMoneyLead }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-secondary">Public preview</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-app-home-bg text-app-home text-[11px] font-semibold px-2 py-0.5">
          <ShieldCheck size={12} strokeWidth={2.25} />
          Free · one-time look
        </span>
      </div>
      <div className="flex items-start gap-3">
        <span className="inline-flex items-center justify-center shrink-0 w-[42px] h-[42px] rounded-xl bg-app-home-bg text-app-home">
          {lead.kind === 'flood_premium'
            ? <Waves size={22} strokeWidth={2} />
            : <House size={22} strokeWidth={2} />}
        </span>
        <div className="min-w-0">
          <p className="text-[20px] font-bold text-app-text leading-[26px] -tracking-[0.018em]">{lead.headline}</p>
          <p className="text-[13.5px] text-app-text-secondary leading-[19px] mt-1.5">{lead.detail}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-app-border-subtle text-[12px] text-app-text-muted">
        <span className="font-medium">{lead.source}</span>
        <span className="opacity-50">·</span>
        <span>{lead.scope}-level, not this home</span>
      </div>
    </div>
  );
}

// ── The taste: aha → every free layer → the one locked layer ──
const GROUP_ORDER = ['today', 'risk_readiness', 'health_environment', 'your_block', 'money_signals', 'civic'] as const;
const GROUP_LABEL: Record<(typeof GROUP_ORDER)[number], string> = {
  today: 'Right now',
  risk_readiness: 'Risk & readiness',
  health_environment: 'Health & environment',
  your_block: 'Your block',
  money_signals: 'Money signals',
  civic: 'Civic',
};

const AHA_ICON: Partial<Record<string, LucideIcon>> = {
  alerts: Bell,
  air_quality: Wind,
  flood: Waves,
  wildfire: Flame,
  seismic: Activity,
  lead_radon: TestTube,
  drinking_water: Droplets,
  environmental_hazards: Factory,
  rent_band: BadgePercent,
  civic_election: Vote,
  civic_districts: Landmark,
  census_context: House,
};

// ── Legacy tiles: a payload with no `sections` (an older backend, or a
// client fixture) still carries the sanitized `free` subset, so the page
// renders that instead of nothing. Same three tiles the funnel showed
// before the snapshot existed.
function floodChip(zone?: string): { label: string; variant: 'success' | 'warning' | 'error' } {
  const z = (zone || '').toUpperCase();
  if (z.startsWith('A') || z.startsWith('V')) return { label: 'High risk', variant: 'error' };
  if (z.includes('0.2') || z.includes('X500') || z.includes('SHADED')) return { label: 'Moderate risk', variant: 'warning' };
  return { label: 'Minimal risk', variant: 'success' };
}
function money(n?: number | null): string | null {
  if (n == null || !Number.isFinite(n)) return null;
  return `$${Math.round(n).toLocaleString('en-US')}`;
}
function LegacyFreeTiles({ preview, onWall }: { preview: PlacePreview; onWall: () => void }) {
  const free = preview.free;
  if (!free) return null;
  return (
    <>
      <Group label="Risk & readiness">
        {free.flood.status === 'ready' ? (
          <SectionCard
            icon={Waves}
            title="Flood"
            value={`Zone ${free.flood.zone} — ${floodChip(free.flood.zone).label.toLowerCase()}`}
            chip={floodChip(free.flood.zone)}
            caption="FEMA flood zone, area-level"
          />
        ) : (
          <SectionCard icon={Waves} title="Flood" state="unavailable" />
        )}
      </Group>
      <Group label="Your block">
        <DensityCard bucket={free.density.bucket} label={free.density.label} ctaLabel="Claim this address and be one of the first here" onCta={onWall} />
        {free.area.status === 'ready' ? (
          <SectionCard
            icon={House}
            title="Homes here"
            value={
              free.area.median_year_built
                ? `Median built ${free.area.median_year_built}`
                : money(free.area.median_home_value)
                  ? `Typical value ${money(free.area.median_home_value)}`
                  : 'Area facts'
            }
            caption="Census, area-level — not your home"
          />
        ) : (
          <SectionCard icon={House} title="Homes here" state="unavailable" />
        )}
      </Group>
    </>
  );
}

// Exported for the /dev/start-preview fixture page (design QA + the aha
// audit without a live backend).
export function PreviewBody({ preview, onWall }: { preview: PlacePreview; onWall: () => void }) {
  const sections: PlaceSection[] = preview.sections ?? [];
  const locked = preview.locked ?? [];
  const aha = preview.aha;
  const ahaSection = aha?.section_id ? sections.find((s) => s.id === aha.section_id) : undefined;

  const groups = GROUP_ORDER
    .map((g) => ({ g, items: sections.filter((s) => s.group === g) }))
    .filter((x) => x.items.length > 0);

  return (
    <div className="mt-5">
      {aha ? (
        <AhaCard
          tone={aha.tone}
          grade={aha.grade}
          headline={aha.headline}
          detail={aha.detail}
          followUp={aha.follow_up}
          onFollowUp={onWall}
          icon={aha.section_id ? AHA_ICON[aha.section_id] : undefined}
          source={ahaSection?.source ?? null}
          className="mb-6"
        />
      ) : null}

      {sections.length === 0 ? <LegacyFreeTiles preview={preview} onWall={onWall} /> : null}

      {groups.map(({ g, items }) => (
        <Group key={g} label={GROUP_LABEL[g]}>
          {items.map((env) => {
            if (env.id === 'block_density') {
              const d = env.data as PlaceBlockDensityData | null;
              return (
                <DensityCard
                  key={env.id}
                  bucket={d?.bucket ?? preview.free?.density.bucket ?? 'none'}
                  label={d?.label ?? preview.free?.density.label}
                  ctaLabel="Claim this address and be one of the first here"
                  onCta={onWall}
                />
              );
            }
            return <Fragment key={env.id}>{renderSection(env)}</Fragment>;
          })}
        </Group>
      ))}

      {locked.length > 0 ? (
        <Group label="Claim it to see">
          {locked.map((s: PlacePreviewLockedSection) => (
            <LockedCard key={s.id} icon={Home} title={s.title} reason={s.reason} cta="Claim this address" onCta={onWall} />
          ))}
        </Group>
      ) : null}

      <PrivacyPromise compact className="mb-4" />
    </div>
  );
}

// ── App-download link (platform-aware; the QR-scanner's other path) ──
// The store URLs ship with real fallbacks, so this is never a dead link;
// computed on the client from the user agent to point at the right store.
function AppDownloadLink() {
  const [cta, setCta] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    try {
      setCta(getStoreDownloadCta(navigator.userAgent));
    } catch {
      setCta(null);
    }
  }, []);
  if (!cta) return null;
  return (
    <a
      href={cta.href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-600 hover:text-primary-700"
    >
      <Smartphone size={14} strokeWidth={2} />
      Prefer the app? Get it
      <ArrowRight size={13} strokeWidth={2.25} />
    </a>
  );
}

// ── Share this address (Wedge v2 D5: the share card) ─────────
// The link is the preview of THIS address; the card image is rendered
// on the fly by /api/og/place (nothing is stored). Web Share where it
// exists, copy-to-clipboard elsewhere.
function ShareAddressLink({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (typeof window === 'undefined') return;
    // The link is the preview of THIS address; the browser URL is left alone.
    const url = `${window.location.origin}/start?address=${encodeURIComponent(address)}`;
    const title = "What's true about this address";
    // Funnel: the share rate (D5). Method only — never the address.
    api.recordFunnelEvent('t0_share_clicked', { method: navigator.share ? 'share' : 'copy' });
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* dismissed */
    }
  };
  return (
    <button type="button" onClick={share} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary-600 hover:text-primary-700">
      <Share2 size={14} strokeWidth={2} />
      {copied ? 'Link copied' : 'Share this address'}
    </button>
  );
}

// ── Sticky wall bar ─────────────────────────────────────────
function WallBar({ onWall, shareAddress }: { onWall: () => void; shareAddress: string }) {
  return (
    <div className="sticky bottom-[var(--fab-lift,0px)] left-0 right-0 -mx-5 px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-app-surface/95 backdrop-blur border-t border-app-border sm:rounded-t-2xl sm:border-x sm:shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-[14.5px] font-semibold text-app-text leading-[19px] -tracking-[0.01em]">
            This address has one page. Claim it, free.
          </p>
          <p className="text-[12.5px] text-app-text-secondary mt-0.5">Save it, get it every morning, see everything.</p>
        </div>
        <button
          type="button"
          onClick={onWall}
          className="shrink-0 rounded-xl bg-primary-600 text-white px-4 py-3 text-[15px] font-semibold -tracking-[0.01em] shadow-[var(--shadow-primary)] hover:bg-primary-700 transition-colors whitespace-nowrap"
        >
          Claim it
        </button>
      </div>
      <div className="mt-2 flex items-center justify-center gap-4">
        <ShareAddressLink address={shareAddress} />
        <AppDownloadLink />
      </div>
    </div>
  );
}

// ── Preview loading skeleton ────────────────────────────────
function PreviewSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="mt-2 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <ShimmerBlock className="h-7 w-36" />
          <ShimmerBlock className="h-4 w-52" />
        </div>
        <ShimmerBlock className="h-5 w-12" />
      </div>
      <div className="mt-4 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
        <ShimmerBlock className="h-4 w-11/12 mb-2" />
        <ShimmerBlock className="h-4 w-2/3" />
      </div>
      <div className="mt-5 flex flex-col gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
            <div className="flex items-center gap-3 mb-3">
              <ShimmerBlock className="w-[34px] h-[34px] rounded-[9px]" />
              <ShimmerBlock className="h-[15px] w-28" />
            </div>
            <ShimmerBlock className="h-[15px] w-3/5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Unsupported region (non-US) ─────────────────────────────
/**
 * "We could not read that address" — NOT the geographic denial below.
 *
 * `geocodeUsAddress` fails four ways and only one means "outside the US".
 * Collapsing them showed a US visitor the U.S.-only hand-off during any
 * geocoder outage, and offered them nothing to do about it. The retry is
 * the point: adding a city and state usually resolves it.
 */
function CouldNotPlace({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center px-2">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-app-surface-sunken text-app-text-muted mb-5">
        <MapPinned size={30} strokeWidth={2} />
      </span>
      <h2 className="text-xl font-bold -tracking-[0.02em] text-app-text">We couldn&apos;t find that address</h2>
      <p className="mt-2 text-sm text-app-text-secondary leading-relaxed max-w-sm">
        Adding the city and state usually does it — &ldquo;1421 SE Oak St, Portland, OR&rdquo;.
      </p>
      <div className="mt-5">
        <TextButton arrow={false} onClick={onRetry}>Try another address</TextButton>
      </div>
    </div>
  );
}

function UnsupportedRegion({ onBrowse }: { onBrowse: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center text-center px-2">
      <span className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-app-home-bg text-app-home mb-5">
        <MapPinned size={30} strokeWidth={2} />
      </span>
      <h2 className="text-xl font-bold -tracking-[0.02em] text-app-text">Home features are U.S.-only for now</h2>
      <p className="mt-2 text-sm text-app-text-secondary leading-relaxed max-w-sm">
        Records, risks, and home details come from U.S. public-data sources. Following, fanning, and messaging
        verified people work everywhere today.
      </p>
      <div className="mt-5">
        <TextButton onClick={onBrowse}>Create a free account to follow people and places</TextButton>
      </div>
    </div>
  );
}

// ── The funnel ──────────────────────────────────────────────
export default function StartFunnel() {
  const router = useRouter();
  const [fromCard, setFromCard] = useState(false);
  const [selected, setSelected] = useState<SelectedAddress | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Deep links (Wedge v2 D5): `?r=<route>` from an EDDM card or invite
  // postcard is remembered for every funnel beacon; `?address=` (a share
  // card, a postcard QR) resolves the first suggestion and shows the
  // preview straight away.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const route = params.get('r') || params.get('route');
    if (route) {
      api.rememberFunnelRoute(route);
      setFromCard(true);
    }
    const address = (params.get('address') || '').trim();
    if (!address) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.geo.autocompleteWithAbort(address, new AbortController().signal);
        const first = res?.suggestions?.[0];
        if (cancelled || !first) return;
        const lat = first.center?.lat;
        const lng = first.center?.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number') return;
        setSelected({ label: first.label, latitude: lat, longitude: lng });
        setSubmitted(first.label);
      } catch {
        /* a bad deep link simply lands on the hero */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const previewQuery = useQuery({
    queryKey: ['place', 'public-preview', submitted],
    queryFn: () => api.place.getPublicPlacePreview(submitted as string),
    enabled: !!submitted,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Funnel: T0 preview rendered — client-reported, because the preview
  // endpoint itself persists nothing by contract. Once per submit.
  const previewStatus = previewQuery.data?.status ?? null;
  useEffect(() => {
    if (submitted && previewStatus) {
      api.recordFunnelEvent('t0_preview_viewed', { status: previewStatus });
    }
  }, [submitted, previewStatus]);

  // Funnel: the aha rate (D1) — which card led, and whether it was the
  // calm fallback. Section id, tone and grade only; never the address.
  const aha = previewQuery.data?.aha ?? null;
  useEffect(() => {
    if (submitted && previewStatus === 'ready' && aha) {
      api.recordFunnelEvent('t0_aha_viewed', {
        section_id: aha.section_id ?? '',
        tone: aha.tone,
        grade: aha.grade,
      });
    }
  }, [submitted, previewStatus, aha]);

  const goBrowse = () => router.push(REGISTER_HREF);

  const goWall = () => {
    // Funnel: the soft wall converted a preview into intent.
    api.recordFunnelEvent('t0_wall_viewed');
    if (selected) {
      const place = previewQuery.data?.place;
      stashPendingPlace({
        label: selected.label,
        latitude: selected.latitude,
        longitude: selected.longitude,
        city: place?.city ?? null,
        state: place?.state ?? null,
      });
    }
    router.push(REGISTER_HREF);
  };

  const submit = () => {
    if (selected) setSubmitted(selected.label);
  };

  // Hero step.
  if (!submitted) {
    return (
      <div className="min-h-screen bg-app-bg">
        <div className="mx-auto w-full max-w-[480px] sm:max-w-[540px] lg:max-w-[1000px] px-5">
          <HeroStep
            onSelect={setSelected}
            onClear={() => setSelected(null)}
            onSubmit={submit}
            canSubmit={!!selected}
            onBrowse={goBrowse}
            fromCard={fromCard}
          />
        </div>
      </div>
    );
  }

  // Preview step.
  const preview = previewQuery.data;
  const addressLabel = preview?.place?.address
    ? [preview.place.address, preview.place.city].filter(Boolean).join(', ')
    : selected?.label ?? 'Your address';

  return (
    <div className="min-h-screen bg-app-bg">
      <div className="mx-auto w-full max-w-[480px] sm:max-w-[540px] px-5 pt-3 flex flex-col min-h-screen">
        {previewQuery.isPending ? (
          <PreviewSkeleton />
        ) : previewQuery.isError ? (
          <div className="mt-10 text-center">
            <p className="text-sm text-app-text-secondary">We couldn&apos;t look up that address. Try again.</p>
            <div className="mt-3 flex justify-center">
              <TextButton arrow={false} onClick={() => previewQuery.refetch()}>Try again</TextButton>
            </div>
          </div>
        ) : preview && preview.status === 'could_not_place' ? (
          <CouldNotPlace onRetry={() => { setSelected(null); setSubmitted(null); }} />
        ) : preview && preview.status === 'unsupported_region' ? (
          <UnsupportedRegion onBrowse={goBrowse} />
        ) : preview ? (
          <>
            <div className="flex-1 motion-safe:animate-[fadeInUp_0.3s_ease-out_both]">
              <PlaceHeader
                address={addressLabel}
                status="none"
                rightSlot={
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-sm font-semibold text-primary-600 hover:text-primary-700"
                  >
                    Sign in
                  </button>
                }
              />
              <div className="mt-4">
                {/* The dollar figure leads when there is a real one;
                    otherwise the original hero carries the page exactly
                    as before — never a placeholder in its place. */}
                {isRenderableLead(preview.money_lead)
                  ? <MoneyLeadCard lead={preview.money_lead} />
                  : <PreviewHeroCard />}
              </div>
              <PreviewBody preview={preview} onWall={goWall} />
              <div className="h-4" />
            </div>
            <WallBar onWall={goWall} shareAddress={selected?.label ?? submitted ?? ''} />
          </>
        ) : null}
      </div>
    </div>
  );
}
