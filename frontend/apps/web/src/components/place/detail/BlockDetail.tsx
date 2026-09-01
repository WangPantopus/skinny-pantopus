// ============================================================
// Place — Your Block detail (C6).
// The k-anon density bucket, Census neighborhood context (area-level,
// not your home), and permits. Permits aren't in the v1 contract, so
// they render in the honest "not available for your area yet" state.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { BlockStatus } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';
import { queryKeys } from '@/lib/query-keys';
import type { PlaceIntelligence, PlaceBlockDensityData, PlaceCensusContextData } from '@pantopus/types';
import { Map, HardHat, Calendar, Home, Award, Lock, Loader2, Send, Check, Mail } from 'lucide-react';
import { SectionCard, DensityCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { usdK, statusToState, apiErrorText } from './format';

function CensusCard({ data }: { data: PlaceCensusContextData }) {
  const stats: { icon: typeof Calendar; label: string; value: string }[] = [];
  if (data.median_year_built) stats.push({ icon: Calendar, label: 'Median year built', value: String(data.median_year_built) });
  const medVal = usdK(data.median_home_value);
  if (medVal) stats.push({ icon: Home, label: 'Median home value', value: medVal });

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center gap-3 mb-[15px]">
        <span className="w-[38px] h-[38px] rounded-[10px] bg-app-home-bg flex items-center justify-center shrink-0">
          <Map size={20} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold text-app-text -tracking-[0.01em]">This neighborhood</div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5">Census tract around your block</div>
        </div>
      </div>
      {stats.length > 0 ? (
        <div className="flex">
          {stats.map((s, i) => (
            <div key={s.label} className={`flex-1 ${i === 0 ? 'pr-4' : 'pl-4 border-l border-app-border-subtle'}`}>
              <div className="text-[11px] font-semibold tracking-[0.03em] uppercase text-app-text-muted">{s.label}</div>
              <div className="text-2xl font-bold -tracking-[0.02em] text-app-text mt-1">{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}
      {data.summary ? (
        <div className="text-[13.5px] text-app-text-strong leading-5 mt-[15px] pt-[15px] border-t border-app-border-subtle">{data.summary}</div>
      ) : null}
    </div>
  );
}

// ── Block Founders (Wave 3) — the growth mechanic ────────────
// A verified occupant's permanent founding rank on their block, the
// unlock meters counting verified neighbors, and real postcard invites.
// Server contract: hard T4 gate, 3 invites/week, 90-day per-recipient
// dedup, permanent opt-out registry, sender anonymized to street.

function MeterRow({ label, current, needed, unlocked }: { label: string; current: number; needed: number; unlocked: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-app-text-strong flex items-center gap-1.5">
          {unlocked && <Check size={14} strokeWidth={2.5} className="text-app-success" />}
          {label}
        </span>
        <span className={`text-[12px] font-semibold ${unlocked ? 'text-app-success' : 'text-app-text-muted'}`}>
          {unlocked ? 'Unlocked' : `${current} of ${needed}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-app-surface-sunken mt-1.5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${unlocked ? 'bg-app-success' : 'bg-primary-600'}`}
          style={{ width: `${Math.min(100, Math.round((current / needed) * 100))}%` }}
        />
      </div>
    </div>
  );
}

function InviteForm({ homeId, remaining, cap }: { homeId: string; remaining: number; cap: number | null }) {
  const queryClient = useQueryClient();
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  const sendMutation = useMutation({
    mutationFn: () => api.blockFounders.sendBlockInvite(homeId, { line1, city, state, zip }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.blockFounders(homeId) });
      toast.success(`Postcard on its way — ${result.invites_remaining} invite${result.invites_remaining === 1 ? '' : 's'} left this week.`);
      setLine1(''); setCity(''); setState(''); setZip('');
    },
    // Every refusal on this route is a CODED one the founder has to act
    // on differently — 429 WEEKLY_CAP, 502 SEND_FAILED, and the 400
    // BAD_ADDRESS / OPTED_OUT / ALREADY_MEMBER / RECENTLY_INVITED
    // safeguards. The client rejects with a plain object, so an
    // `instanceof Error` gate reads false every time and collapses all
    // seven into one generic line the founder can only retry into.
    onError: (err) => toast.error(apiErrorText(err, 'Could not send the invitation.')),
  });

  const complete = line1.trim() && city.trim() && state.trim().length === 2 && /^\d{5}(-\d{4})?$/.test(zip.trim());
  const inputCls = 'h-[42px] px-3 text-[14px] text-app-text bg-app-surface border-[1.5px] border-app-border rounded-[10px] outline-none transition focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10';

  if (remaining <= 0) {
    return (
      <div className="text-[12.5px] text-app-text-muted leading-[18px] mt-3 pt-3 border-t border-app-border-subtle">
        {/* The cap is the SERVER's number (`invites_weekly_cap`), never a
            word baked into the copy — both mobile clients read it, and a
            hardcoded "three" would lie the moment the route changes. */}
        {cap != null
          ? `You’ve used this week’s ${cap} invitation${cap === 1 ? '' : 's'}. The budget resets a week after your first send.`
          : 'You’ve used this week’s invitations. The budget resets a week after your first send.'}
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-app-border-subtle">
      <div className="text-[12.5px] font-semibold text-app-text-secondary mb-2">
        Invite a neighbor by mail — {remaining} left this week
      </div>
      <div className="grid grid-cols-1 gap-2">
        <input aria-label="Street address" placeholder="Street address" value={line1} onChange={(e) => setLine1(e.target.value)} className={inputCls} />
        <div className="grid grid-cols-[1fr_64px_92px] gap-2">
          <input aria-label="City" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          <input aria-label="State" placeholder="ST" maxLength={2} value={state} onChange={(e) => setState(e.target.value.toUpperCase())} className={`${inputCls} uppercase text-center`} />
          <input aria-label="ZIP code" placeholder="ZIP" value={zip} onChange={(e) => setZip(e.target.value)} className={inputCls} />
        </div>
      </div>
      <button
        type="button"
        onClick={() => sendMutation.mutate()}
        disabled={sendMutation.isPending || !complete}
        className="w-full h-11 mt-2.5 rounded-xl bg-primary-600 text-white text-[14px] font-semibold flex items-center justify-center gap-2 hover:bg-primary-700 transition disabled:opacity-60"
      >
        {sendMutation.isPending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} strokeWidth={2.25} />}
        Mail the invitation
      </button>
      <div className="text-[12px] text-app-text-muted leading-[17px] mt-2">
        Pantopus prints and mails a fixed card — you can&apos;t write the message, and it&apos;s signed only as a neighbor on your street, never your name or address. Each card carries a working opt-out link.
      </div>
    </div>
  );
}

function FoundersCard({ block, homeId }: { block: BlockStatus; homeId: string }) {
  const established = block.established_at
    ? new Date(block.established_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <Award size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">
              {block.rank ? `Founder #${block.rank} of this block` : 'Block founder'}
            </span>
          </div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5">
            {established ? `Verified here since ${established} — this rank is permanent.` : 'Your founding rank on this block.'}
          </div>
        </div>
      </div>
      {/* The two raw insider counts. `rent_reports` is deliberately its
          own reading rather than only a meter fill: it is what the Real
          Rent benchmark is waiting on, and a founder deciding whether to
          spend an invite should be able to read it directly. Both are
          block-level counts — never a per-home figure. */}
      <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-app-border-subtle">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted">Verified homes on your block</div>
          <div className="text-2xl font-bold -tracking-[0.02em] text-app-text mt-1">{block.verified_count ?? 0}</div>
        </div>
        <div>
          <div className="text-[11px] font-semibold tracking-[0.04em] uppercase text-app-text-muted">Rents shared on your block</div>
          <div className="text-2xl font-bold -tracking-[0.02em] text-app-text mt-1">{block.rent_reports ?? 0}</div>
        </div>
      </div>
      {block.meters && block.meters.length > 0 && (
        <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-app-border-subtle">
          {block.meters.map((m) => (
            <MeterRow key={m.id} label={m.label} current={m.current} needed={m.needed} unlocked={m.unlocked} />
          ))}
        </div>
      )}
      <InviteForm homeId={homeId} remaining={block.invites_remaining ?? 0} cap={block.invites_weekly_cap ?? null} />
    </div>
  );
}

function FoundersSection({ homeId, verified }: { homeId: string | null; verified: boolean }) {
  const blockQuery = useQuery({
    queryKey: queryKeys.blockFounders(homeId ?? ''),
    queryFn: () => api.blockFounders.getBlockStatus(homeId!),
    enabled: verified && !!homeId,
  });

  if (!verified || !homeId) {
    return (
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 flex items-center gap-3.5">
        <span className="w-11 h-11 rounded-xl bg-app-surface-sunken flex items-center justify-center shrink-0">
          <Lock size={20} strokeWidth={2} className="text-app-text-muted" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold text-app-text">Block founders</div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5">
            Verify your address to claim a permanent founding rank on your block — the earliest verified homes keep their number forever.
          </div>
        </div>
      </div>
    );
  }
  if (blockQuery.isLoading) {
    return <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-[13.5px] text-app-text-muted">Loading your block…</div>;
  }
  if (blockQuery.isError || !blockQuery.data) {
    return <SectionCard icon={Award} title="Block founders" state="error" onRetry={() => blockQuery.refetch()} />;
  }
  if (!blockQuery.data.available) {
    return (
      <SectionCard
        icon={Mail}
        title="Block founders"
        state="unavailable"
        caption="We couldn't place this home on a block — its map location is missing."
      />
    );
  }
  return <FoundersCard block={blockQuery.data} homeId={homeId} />;
}

export default function BlockDetail({ intelligence, homeId }: { intelligence: PlaceIntelligence; homeId: string | null }) {
  const router = useRouter();
  const density = findPlaceSection(intelligence, 'block_density');
  const census = findPlaceSection(intelligence, 'census_context');

  const densityReady = density && (density.status === 'ready' || density.status === 'stale' || density.status === 'partial') && density.data;
  const censusReady = census && (census.status === 'ready' || census.status === 'stale' || census.status === 'partial') && census.data;

  // The "be first to verify" nudge only makes sense before the viewer is
  // verified; a T4 resident already is, so we drop the CTA for them.
  const verified = intelligence.tier === 'T4';
  const showVerifyCta = !verified && !!homeId;

  return (
    <>
      <DetailHeader title="Your block" address={detailAddress(intelligence.place)} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Verified homes nearby</DetailSectionLabel>
        {densityReady ? (
          <DensityCard
            bucket={(density!.data as PlaceBlockDensityData).bucket}
            showCta={showVerifyCta}
            onCta={() => homeId && router.push(`/app/homes/${homeId}/verify-postcard`)}
          />
        ) : (
          <SectionCard icon={Map} title="Verified homes nearby" state={density ? statusToState(density.status) : 'unavailable'} caption={density?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}

        <DetailSectionLabel>Block founders</DetailSectionLabel>
        <FoundersSection homeId={homeId} verified={verified} />

        <DetailSectionLabel>Neighborhood</DetailSectionLabel>
        {censusReady ? (
          <CensusCard data={census!.data as PlaceCensusContextData} />
        ) : (
          <SectionCard icon={Map} title="This neighborhood" state={census ? statusToState(census.status) : 'unavailable'} caption={census?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {census?.source ? <SourceNote name={census.source} asOf="2020–2024" /> : null}

        <DetailSectionLabel>Recent permits nearby</DetailSectionLabel>
        <SectionCard
          icon={HardHat}
          title="Recent permits"
          state="unavailable"
          caption="Permit records aren't published for your metro yet. Coverage is expanding."
        />

        <InfoNote>
          Neighborhood figures are typical values for your census tract, not your specific home.
        </InfoNote>
      </div>
    </>
  );
}
