// ============================================================
// Place — Your Home detail (C4).
// Property facts, the value estimate with its range, and the
// assessment — all from the Band-B `your_home` section, which is the
// same ATTOM record behind /app/homes/[id]/property-details (linked
// below for the full public record). A private, device-local mortgage
// input turns into an equity figure only the resident can see.
// ============================================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import type { PlaceIntelligence, PlaceYourHomeData } from '@pantopus/types';
import {
  Calendar,
  Ruler,
  Bed,
  Trees,
  House,
  Landmark,
  Calculator,
  Pencil,
  Lock,
  FileText,
  ChevronRight,
} from 'lucide-react';
import { SectionCard, LockedCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { usd, fmtMonthYear, statusToState } from './format';
import { MoneyField, PrivacyNote, SkyButton, parseMoney, groupDigits } from './fields';
import { useLocalDraft } from './useLocalDraft';

// ── Property facts — 2×2 grid ───────────────────────────────
function FactRow({ icon: Icon, label, value, border }: { icon: LucideIcon; label: string; value: string; border: string }) {
  return (
    <div className={`flex items-center gap-3 px-3 py-3.5 ${border}`}>
      <span className="w-[34px] h-[34px] rounded-[9px] bg-app-home-bg flex items-center justify-center shrink-0">
        <Icon size={18} strokeWidth={2} className="text-app-home" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold tracking-[0.03em] uppercase text-app-text-muted">{label}</div>
        <div className="text-[15px] font-semibold text-app-text mt-0.5 truncate">{value}</div>
      </div>
    </div>
  );
}

function FactsCard({ data }: { data: PlaceYourHomeData }) {
  const beds = data.bedrooms != null ? `${data.bedrooms} bd` : null;
  const baths = data.bathrooms != null ? `${data.bathrooms} ba` : null;
  const facts: { icon: LucideIcon; label: string; value: string }[] = [];
  facts.push({ icon: Calendar, label: 'Year built', value: data.year_built ? String(data.year_built) : '—' });
  facts.push({ icon: Ruler, label: 'Living area', value: data.sqft ? `${data.sqft.toLocaleString('en-US')} sqft` : '—' });
  facts.push({ icon: Bed, label: 'Bed · bath', value: [beds, baths].filter(Boolean).join(' · ') || '—' });
  facts.push({ icon: Trees, label: 'Lot size', value: data.lot_sqft ? `${data.lot_sqft.toLocaleString('en-US')} sqft` : '—' });
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-1.5">
      <div className="grid grid-cols-2">
        {facts.map((f, i) => (
          <FactRow
            key={f.label}
            icon={f.icon}
            label={f.label}
            value={f.value}
            border={`${i % 2 === 0 ? 'border-r border-app-border-subtle' : ''} ${i < 2 ? 'border-b border-app-border-subtle' : ''}`}
          />
        ))}
      </div>
    </div>
  );
}

// ── Value vs block — decorative qualitative trend (not data-bound) ──
function ValueSparkline() {
  const home = '0,30 24,28 48,26 72,21 96,18 120,12 144,9 168,4';
  const block = '0,33 24,32 48,31 72,29 96,28 120,26 144,25 168,23';
  return (
    <svg width="100%" height="62" viewBox="0 0 168 40" preserveAspectRatio="none" className="overflow-visible text-app-home" aria-hidden="true">
      <defs>
        <linearGradient id="place-home-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.14" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,40 ${home} 168,40`} fill="url(#place-home-fill)" />
      <polyline points={block} fill="none" stroke="rgb(var(--app-border-strong))" strokeWidth="1.6" strokeDasharray="3 3" strokeLinecap="round" />
      <polyline points={home} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="168" cy="4" r="3" fill="currentColor" stroke="rgb(var(--app-surface))" strokeWidth="1.5" />
    </svg>
  );
}

function ValueCard({ data }: { data: PlaceYourHomeData }) {
  const value = usd(data.estimated_value);
  const low = usd(data.value_low);
  const high = usd(data.value_high);
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="text-[13px] font-semibold text-app-text-secondary">Estimated market value</div>
      <div className="text-[34px] leading-10 font-bold -tracking-[0.02em] text-app-text mt-1">{value ?? 'Not estimated yet'}</div>
      {low && high ? <div className="text-[13px] text-app-text-muted mb-3.5">Range {low}–{high}</div> : <div className="mb-3.5" />}
      <ValueSparkline />
      <div className="flex gap-[18px] mt-3 pt-3 border-t border-app-border-subtle">
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-[3px] rounded-full bg-app-home" />
          <span className="text-[12.5px] font-medium text-app-text-strong">Your home</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-[3px] rounded-full bg-app-border-strong" />
          <span className="text-[12.5px] font-medium text-app-text-secondary">Block median</span>
        </div>
      </div>
    </div>
  );
}

// Assessment + the tax-appeal INFORMATIONAL layer (#2). Strictly
// educational by design (legal gate): it compares the county's
// assessment with the market estimate and explains that appeals
// exist — never a savings figure, never advice.
function AssessmentCard({ data }: { data: PlaceYourHomeData }) {
  const assessed = usd(data.assessed_value);
  if (!assessed) return null;

  const hasBoth =
    data.assessed_value != null &&
    data.estimated_value != null &&
    data.estimated_value > 0;
  const diffPct = hasBoth
    ? Math.round(((data.assessed_value! - data.estimated_value!) / data.estimated_value!) * 100)
    : 0;
  const comparison = !hasBoth
    ? null
    : Math.abs(diffPct) <= 5
      ? 'Your assessment is in line with the market estimate above.'
      : diffPct > 0
        ? `Your assessment runs about ${diffPct}% above the market estimate — assessments above market are the usual basis for an appeal.`
        : `Your assessment runs about ${Math.abs(diffPct)}% below the market estimate.`;

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-app-home-bg flex items-center justify-center shrink-0">
          <Landmark size={18} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-app-text">Assessed value</div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5">Latest county tax roll</div>
        </div>
        <div className="text-base font-semibold text-app-text">{assessed}</div>
      </div>
      {comparison ? (
        <div className="text-[13px] text-app-text-strong leading-[19px] mt-3 pt-3 border-t border-app-border-subtle">
          {comparison}
        </div>
      ) : null}
      <div className="text-[12px] text-app-text-muted leading-[17px] mt-2.5">
        Every county lets homeowners appeal an assessment they believe is too high — usually a form and an
        evidence window each year. Search &ldquo;{'assessment appeal'}&rdquo; with your county&apos;s name for the process.
        Informational only, not tax advice.
      </div>
    </div>
  );
}

// ── Full public record entry — reuses property-details ──────
function PropertyRecordEntry({ homeId }: { homeId: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => router.push(`/app/homes/${homeId}/property-details`)}
      className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-left hover:bg-app-hover transition"
    >
      <span className="w-10 h-10 rounded-[11px] bg-primary-100 flex items-center justify-center shrink-0">
        <FileText size={20} strokeWidth={2} className="text-primary-600" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-app-text">See full property records</div>
        <div className="text-[12.5px] text-app-text-muted mt-0.5">Every public-record field for this address</div>
      </div>
      <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
    </button>
  );
}

// ── Mortgage → equity — private, device-local input ─────────
function MortgageEquity({ homeId, homeValue }: { homeId: string | null; homeValue: number }) {
  const [draft, setDraft, hydrated] = useLocalDraft(homeId ? `place:equity:${homeId}` : null, { balance: '', rate: '' });
  const [editing, setEditing] = useState(false);

  const balanceNum = parseMoney(draft.balance);
  const equity = Math.max(0, homeValue - balanceNum);
  const equityPct = Math.min(100, Math.max(0, (equity / homeValue) * 100));
  const hasResult = hydrated && !!draft.balance && !editing;

  if (!hydrated) {
    return <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm h-[78px]" aria-hidden="true" />;
  }

  // Prompt — nothing entered yet.
  if (!draft.balance && !editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-left hover:bg-app-hover transition"
      >
        <span className="w-10 h-10 rounded-[11px] bg-primary-100 flex items-center justify-center shrink-0">
          <Calculator size={21} strokeWidth={2} className="text-primary-600" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-semibold text-app-text">Add your mortgage to see your equity</div>
          <div className="text-[12.5px] text-app-text-muted mt-0.5">Private to you — never shown to neighbors</div>
        </div>
        <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
      </button>
    );
  }

  // Form — entering / editing.
  if (editing) {
    return (
      <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
        <div className="flex items-center gap-2.5 mb-4">
          <Calculator size={19} strokeWidth={2} className="text-primary-600" />
          <div className="text-base font-bold text-app-text -tracking-[0.01em]">Your mortgage</div>
        </div>
        <div className="flex flex-col gap-3.5">
          <MoneyField label="Current loan balance" prefix="$" value={draft.balance} onChange={(v) => setDraft({ ...draft, balance: groupDigits(v) })} placeholder="0" />
          <MoneyField label="Interest rate" suffix="%" value={draft.rate} onChange={(v) => setDraft({ ...draft, rate: v.replace(/[^0-9.]/g, '') })} placeholder="0.0" />
        </div>
        <div className="mt-4">
          <SkyButton onClick={() => setEditing(false)}>Calculate my equity</SkyButton>
        </div>
        <PrivacyNote>Saved on this device only and never shared with neighbors or shown on your public place.</PrivacyNote>
      </div>
    );
  }

  // Result.
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]" aria-hidden={!hasResult}>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-app-text-secondary">
            <Lock size={13} strokeWidth={2} />
            Your estimated equity
          </div>
          <div className="text-[34px] leading-10 font-bold -tracking-[0.02em] text-app-home mt-1">{usd(equity)}</div>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1.5 bg-app-surface-sunken rounded-full px-3 py-1.5 text-[13px] font-semibold text-app-text-strong hover:bg-app-hover transition"
        >
          <Pencil size={13} strokeWidth={2.25} />
          Edit
        </button>
      </div>
      <div className="text-[13px] text-app-text-muted mt-1 mb-3.5">{usd(equity)} of {usd(homeValue)} estimated value</div>
      <div className="flex h-3 rounded-full overflow-hidden bg-app-surface-sunken">
        <div className="bg-app-home" style={{ width: `${equityPct}%` }} />
        <div className="flex-1 bg-app-border-strong" />
      </div>
      <div className="flex justify-between mt-2.5">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-app-home" />
          <span className="text-[12.5px] font-medium text-app-text-strong">Equity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded bg-app-border-strong" />
          <span className="text-[12.5px] font-medium text-app-text-secondary">Loan {usd(balanceNum)}{draft.rate ? ` · ${draft.rate}%` : ''}</span>
        </div>
      </div>
      <PrivacyNote>Private to you. Calculated from the value estimate minus the balance you entered — not an appraisal or an offer.</PrivacyNote>
    </div>
  );
}

export default function YourHomeDetail({ intelligence, homeId }: { intelligence: PlaceIntelligence; homeId: string | null }) {
  const router = useRouter();
  const home = findPlaceSection(intelligence, 'your_home');
  const ready = home && (home.status === 'ready' || home.status === 'stale' || home.status === 'partial') && home.data;
  const data = ready ? (home!.data as PlaceYourHomeData) : null;
  const locked = home?.access === 'locked';

  return (
    <>
      <DetailHeader title="Your home" address={detailAddress(intelligence.place)} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        {locked ? (
          <div className="mt-2">
            <LockedCard
              icon={House}
              title="Home details & value"
              reason={home?.unavailable_reason ?? "Claim your place to see your home's exact details and value."}
              cta="Claim home"
              onCta={() => homeId && router.push(`/app/homes/${homeId}/dashboard`)}
            />
          </div>
        ) : (
          <>
            <DetailSectionLabel>Property</DetailSectionLabel>
            {data ? (
              <FactsCard data={data} />
            ) : (
              <SectionCard icon={House} title="Property facts" state={home ? statusToState(home.status) : 'unavailable'} caption={home?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
            )}

            <DetailSectionLabel>Value</DetailSectionLabel>
            {data ? (
              <div className="flex flex-col gap-2.5">
                <ValueCard data={data} />
                <AssessmentCard data={data} />
              </div>
            ) : (
              <SectionCard icon={Landmark} title="Estimated value" state={home ? statusToState(home.status) : 'unavailable'} caption={home?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
            )}
            {home?.source ? <SourceNote name={home.source} asOf={fmtMonthYear(home.as_of) ? `as of ${fmtMonthYear(home.as_of)}` : undefined} /> : null}

            {homeId ? (
              <>
                <DetailSectionLabel>Public records</DetailSectionLabel>
                <PropertyRecordEntry homeId={homeId} />
              </>
            ) : null}

            {data?.estimated_value ? (
              <>
                <DetailSectionLabel>Equity</DetailSectionLabel>
                <MortgageEquity homeId={homeId} homeValue={data.estimated_value} />
              </>
            ) : null}
          </>
        )}

        <InfoNote>
          Values are informational, drawn from public records and a pricing model. They aren&apos;t an appraisal, a guarantee, or an offer to buy or lend.
        </InfoNote>
      </div>
    </>
  );
}
