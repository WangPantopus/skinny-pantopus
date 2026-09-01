// ============================================================
// Place — Money Signals detail (C7). Everything informational, never
// advice. Bill benchmark vs similar homes (peer-relative), DSIRE
// incentives you may qualify for, the HUD rent band with your own
// private rent, and property tax as a post-v1 "coming soon" row.
// Bill benchmark / incentives / rent read from the contract.
// ============================================================

'use client';

import { useState } from 'react';
import type {
  PlaceIntelligence,
  PlaceBillBenchmarkData,
  PlaceIncentivesData,
  PlaceIncentive,
  PlaceRentBandData,
  IncentiveLevel,
  IncentiveType,
  BenchmarkComparison,
} from '@pantopus/types';
import { Zap, BadgePercent, Building2, Landmark, PlusCircle, Lock } from 'lucide-react';
import Chip, { type ChipVariant } from '@/components/archetypes/primitives/Chip';
import { SectionCard, DetailHeader, DetailSectionLabel, SourceNote, ComingSoonRow, InfoNote } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { usd, statusToState } from './format';
import { MoneyField, PrivacyNote, SkyButton, parseMoney, groupDigits } from './fields';
import { useLocalDraft } from './useLocalDraft';

const clampPct = (n: number) => Math.min(100, Math.max(0, n));

const BILL_VERDICT: Record<BenchmarkComparison, { text: string; color: string }> = {
  lower: { text: 'Lower than typical', color: 'text-app-success' },
  typical: { text: 'Typical for your area', color: 'text-app-text-secondary' },
  higher: { text: 'Higher than typical', color: 'text-app-warning' },
};

const UTILITY_LABEL: Record<string, string> = { electric: 'Electric', gas: 'Gas', water: 'Water' };

function BillBenchmark({ data }: { data: PlaceBillBenchmarkData }) {
  const your = data.your_amount;
  const band = data.band_high - data.band_low;
  const trackMin = Math.min(your ?? data.band_low, data.band_low) - band;
  const trackMax = Math.max(your ?? data.band_high, data.band_high) + band;
  const span = Math.max(1, trackMax - trackMin);
  const pos = (v: number) => clampPct(((v - trackMin) / span) * 100);
  const verdict = BILL_VERDICT[data.comparison];

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg border border-app-success-light flex items-center justify-center shrink-0">
          <Zap size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-app-text-secondary">{UTILITY_LABEL[data.utility] ?? 'Utility'} · monthly average</div>
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <span className="text-[30px] font-bold -tracking-[0.02em] text-app-text">{your != null ? usd(your) : `${usd(data.band_low)}–${usd(data.band_high)}`}</span>
            <span className={`text-[14.5px] font-semibold ${verdict.color}`}>{verdict.text}</span>
          </div>
        </div>
      </div>

      <div className="relative h-3.5 mt-5 mb-2.5">
        <div className="absolute top-[3px] left-0 right-0 h-2 rounded-full bg-app-surface-sunken overflow-hidden">
          <div className="absolute inset-y-0 bg-app-success-light" style={{ left: `${pos(data.band_low)}%`, width: `${pos(data.band_high) - pos(data.band_low)}%` }} />
        </div>
        {your != null ? (
          <div className="absolute top-0 w-3.5 h-3.5 rounded-full bg-app-surface border-[3px] border-app-home shadow" style={{ left: `${pos(your)}%`, transform: 'translateX(-50%)' }} />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] font-semibold uppercase tracking-[0.02em] text-app-text-muted">
        <span>Lower</span>
        <span>Typical for your area</span>
        <span>Higher</span>
      </div>

      {data.summary ? (
        <div className="text-[14px] text-app-text-strong leading-5 mt-[15px] pt-[15px] border-t border-app-border-subtle">
          <span className="font-semibold">What this means:</span> {data.summary}
        </div>
      ) : null}
    </div>
  );
}

const LEVEL_LABEL: Record<IncentiveLevel, string> = { federal: 'Federal', state: 'State', utility: 'Utility', local: 'Local' };
const TYPE_LABEL: Record<IncentiveType, string> = { tax_credit: 'tax credit', rebate: 'rebate', discount: 'discount', loan: 'loan' };

function IncentiveRow({ item, isLast }: { item: PlaceIncentive; isLast: boolean }) {
  return (
    <div className={`flex items-start gap-3 px-3.5 py-3 ${isLast ? '' : 'border-b border-app-border-subtle'}`}>
      <span className="w-9 h-9 rounded-[9px] bg-app-home-bg flex items-center justify-center shrink-0 mt-0.5">
        <BadgePercent size={18} strokeWidth={2} className="text-app-home" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[14.5px] font-semibold text-app-text -tracking-[0.01em]">{item.name}</span>
          <Chip label="You may be eligible" variant="info" />
        </div>
        <div className="text-[12.5px] text-app-text-muted mt-0.5">{LEVEL_LABEL[item.level]} · {TYPE_LABEL[item.incentive_type]}</div>
        {item.summary ? <div className="text-[13px] text-app-text-strong leading-[19px] mt-1">{item.summary}</div> : null}
      </div>
    </div>
  );
}

function IncentivesList({ data }: { data: PlaceIncentivesData }) {
  if (!data.programs || data.programs.length === 0) {
    return <SectionCard icon={BadgePercent} title="Incentives" state="empty" caption="No programs matched your address yet." />;
  }
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      {data.programs.map((p, i) => (
        <IncentiveRow key={p.id} item={p} isLast={i === data.programs.length - 1} />
      ))}
      <div className="flex items-start gap-2 px-3.5 py-3 bg-app-surface-muted border-t border-app-border-subtle">
        <Lock size={14} strokeWidth={2} className="mt-0.5 shrink-0 text-app-text-muted" />
        <span className="text-[12.5px] leading-[18px] text-app-text-secondary">Eligibility is an estimate based on your address and home. Verify the details and amounts with each provider before counting on them.</span>
      </div>
    </div>
  );
}

function RentBand({ data, homeId }: { data: PlaceRentBandData; homeId: string | null }) {
  const [rent, setRent, hydrated] = useLocalDraft(homeId ? `place:rent:${homeId}` : null, '');
  const [editing, setEditing] = useState(false);

  const span = Math.max(1, data.market_high - data.market_low);
  const pos = (v: number) => clampPct(((v - data.market_low) / span) * 100);
  const rnum = parseMoney(rent);
  const showMarker = hydrated && rnum > 0 && !editing;

  const verdict: { text: string; variant: ChipVariant } =
    rnum >= data.band_low && rnum <= data.band_high
      ? { text: 'Within the band', variant: 'success' }
      : rnum < data.band_low
        ? { text: 'Below the band', variant: 'info' }
        : { text: 'Above the band', variant: 'warning' };

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center gap-3 mb-1">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg border border-app-success-light flex items-center justify-center shrink-0">
          <Building2 size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-app-text-secondary">{data.bedrooms}-bedroom market band</div>
          <div className="text-2xl font-bold -tracking-[0.02em] text-app-text mt-0.5">{usd(data.band_low)} – {usd(data.band_high)}</div>
        </div>
      </div>
      <div className="text-[13px] text-app-text-muted">Typical asking rent for your area</div>

      <div className="relative h-3.5 mt-[18px] mb-2.5">
        <div className="absolute top-[3px] left-0 right-0 h-2 rounded-full bg-app-surface-sunken overflow-hidden">
          <div className="absolute inset-y-0 bg-app-success-light" style={{ left: `${pos(data.band_low)}%`, width: `${pos(data.band_high) - pos(data.band_low)}%` }} />
        </div>
        {showMarker ? (
          <div className="absolute top-0 w-3.5 h-3.5 rounded-full bg-app-surface border-[3px] border-primary-600 shadow" style={{ left: `${pos(rnum)}%`, transform: 'translateX(-50%)' }} />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] font-semibold text-app-text-muted">
        <span>{usd(data.market_low)}</span>
        <span>Market band</span>
        <span>{usd(data.market_high)}</span>
      </div>

      {showMarker ? (
        <div className="flex items-center justify-between mt-4 pt-[15px] border-t border-app-border-subtle">
          <div>
            <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-app-text-secondary">
              <Lock size={12} strokeWidth={2} /> Your rent
            </div>
            <div className="text-xl font-bold text-app-text mt-0.5">{usd(rnum)}<span className="text-[13px] font-medium text-app-text-secondary"> /mo</span></div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Chip label={verdict.text} variant={verdict.variant} />
            <button type="button" onClick={() => setEditing(true)} className="text-[13px] font-semibold text-primary-600 hover:text-primary-700 transition">Edit</button>
          </div>
        </div>
      ) : editing || (hydrated && rnum > 0) ? (
        <div className="mt-4 pt-[15px] border-t border-app-border-subtle">
          <MoneyField label="Your monthly rent" prefix="$" value={rent} onChange={(v) => setRent(groupDigits(v))} placeholder="0" />
          <div className="mt-3">
            <SkyButton onClick={() => setEditing(false)}>Show where I fall</SkyButton>
          </div>
          <PrivacyNote>Saved on this device only — never shown to neighbors or on your public place.</PrivacyNote>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="w-full flex items-center gap-3 mt-4 bg-app-surface-muted border border-app-border-subtle rounded-xl px-3 py-3 text-left hover:bg-app-hover transition"
        >
          <PlusCircle size={19} strokeWidth={2} className="text-primary-600 shrink-0" />
          <span className="flex-1 text-[14px] font-semibold text-app-text-strong">Add your rent to see where you fall</span>
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-app-text-muted shrink-0"><Lock size={12} strokeWidth={2} />Private</span>
        </button>
      )}
    </div>
  );
}

export default function MoneyDetail({ intelligence, homeId }: { intelligence: PlaceIntelligence; homeId: string | null }) {
  const bill = findPlaceSection(intelligence, 'bill_benchmark');
  const incentives = findPlaceSection(intelligence, 'incentives');
  const rent = findPlaceSection(intelligence, 'rent_band');

  const billReady = bill && (bill.status === 'ready' || bill.status === 'stale' || bill.status === 'partial') && bill.data;
  const incReady = incentives && (incentives.status === 'ready' || incentives.status === 'stale' || incentives.status === 'partial') && incentives.data;
  const rentReady = rent && (rent.status === 'ready' || rent.status === 'stale' || rent.status === 'partial') && rent.data;

  return (
    <>
      <DetailHeader title="Money signals" address={detailAddress(intelligence.place)} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Bill benchmark</DetailSectionLabel>
        {billReady ? (
          <BillBenchmark data={bill!.data as PlaceBillBenchmarkData} />
        ) : (
          <SectionCard icon={Zap} title="Bill benchmark" state={bill ? statusToState(bill.status) : 'unavailable'} caption={bill?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {bill?.source ? <SourceNote name={bill.source} asOf="12-month average" /> : null}

        <DetailSectionLabel>Incentives you may qualify for</DetailSectionLabel>
        {incReady ? (
          <IncentivesList data={incentives!.data as PlaceIncentivesData} />
        ) : (
          <SectionCard icon={BadgePercent} title="Incentives" state={incentives ? statusToState(incentives.status) : 'unavailable'} caption={incentives?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {incentives?.source ? <SourceNote name={incentives.source} /> : null}

        <DetailSectionLabel>Rent</DetailSectionLabel>
        {rentReady ? (
          <RentBand data={rent!.data as PlaceRentBandData} homeId={homeId} />
        ) : (
          <SectionCard icon={Building2} title="Rent band" state={rent ? statusToState(rent.status) : 'unavailable'} caption={rent?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {rent?.source ? <SourceNote name={rent.source} asOf="FY 2026" /> : null}

        <DetailSectionLabel>Property tax</DetailSectionLabel>
        <ComingSoonRow icon={Landmark} title="Property tax check" sub="Your assessment vs nearby comps + how appeals work" />

        <InfoNote>
          Everything here is informational, drawn from public data and your own entries. It isn&apos;t financial, tax, or legal advice, and amounts aren&apos;t guarantees.
        </InfoNote>
      </div>
    </>
  );
}
