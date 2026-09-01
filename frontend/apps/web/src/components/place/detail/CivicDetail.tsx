// ============================================================
// Place — Civic detail (C8). Informational, never advocacy.
//  • Your districts (evergreen) — the elected levels for your address,
//    always present, shown even off-season.
//  • Your representatives — name · office · contact, by level (only
//    when the companion source has supplied them).
//  • Election — in season: banner, polling, ballot (tap-through leaf);
//    off season: a calm "no upcoming election", districts still shown.
// Reads from civic_districts + civic_election.
// ============================================================

'use client';

import { useState } from 'react';
import type {
  PlaceIntelligence,
  PlaceCivicDistrictsData,
  PlaceCivicDistrict,
  PlaceCivicRepresentative,
  PlaceCivicElectionData,
  PlaceBallotRace,
  CivicLevel,
} from '@pantopus/types';
import { Landmark, Check, Mail, Vote, Phone, Globe, ChevronRight, CalendarCheck, Info } from 'lucide-react';
import Chip from '@/components/archetypes/primitives/Chip';
import { SectionCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { statusToState } from './format';

const LEVEL_GROUP: Record<CivicLevel, 'Federal' | 'State' | 'Local'> = {
  federal: 'Federal',
  state: 'State',
  county: 'Local',
  city: 'Local',
  school: 'Local',
};
const GROUP_ORDER: ('Federal' | 'State' | 'Local')[] = ['Federal', 'State', 'Local'];

function groupBy<T extends { level: CivicLevel }>(rows: T[]): { group: string; rows: T[] }[] {
  const map = new Map<string, T[]>();
  for (const r of rows) {
    const g = LEVEL_GROUP[r.level] ?? 'Local';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(r);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ group: g, rows: map.get(g)! }));
}

// ── Your districts — the always-on baseline ─────────────────
function DistrictsCard({ districts }: { districts: PlaceCivicDistrict[] }) {
  const groups = groupBy(districts);
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-[15px] bg-app-home-bg border-b border-app-success-light">
        <span className="w-10 h-10 rounded-[11px] bg-app-surface border border-app-home flex items-center justify-center shrink-0">
          <Landmark size={21} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-bold text-app-text -tracking-[0.01em]">Your districts</div>
          <div className="text-[12.5px] text-app-text-secondary mt-0.5">The elected levels that cover your address</div>
        </div>
        <Chip label="Current" variant="success" icon={Check} />
      </div>
      <div className="px-4 pt-1 pb-2">
        {groups.map((g, gi) => (
          <div key={g.group}>
            <div className={`text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-muted ${gi === 0 ? 'mt-3' : 'mt-3.5'} mb-0.5`}>{g.group}</div>
            {g.rows.map((r, i) => {
              const last = gi === groups.length - 1 && i === g.rows.length - 1;
              return (
                <div key={r.office_label + i} className={`flex items-center justify-between gap-3 py-2.5 ${last ? '' : 'border-b border-app-border-subtle'}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-app-home shrink-0" />
                    <span className="text-[13.5px] text-app-text-secondary truncate">{r.office_label}</span>
                  </div>
                  <span className="text-[14px] font-semibold text-app-text text-right">{r.name}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Your representatives — only when supplied ───────────────
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function ContactBtn({ kind, href }: { kind: 'phone' | 'email' | 'website'; href: string }) {
  const Icon = kind === 'phone' ? Phone : kind === 'email' ? Mail : Globe;
  const label = kind === 'phone' ? 'Call' : kind === 'email' ? 'Email' : 'Website';
  return (
    <a
      href={href}
      target={kind === 'website' ? '_blank' : undefined}
      rel={kind === 'website' ? 'noopener noreferrer' : undefined}
      aria-label={label}
      className="w-[34px] h-[34px] rounded-[9px] border border-app-border bg-app-surface flex items-center justify-center shrink-0 hover:bg-app-hover transition"
    >
      <Icon size={16} strokeWidth={2} className="text-primary-600" />
    </a>
  );
}

function RepRow({ rep, isLast }: { rep: PlaceCivicRepresentative; isLast: boolean }) {
  return (
    <div className={`flex items-center gap-3 px-3.5 py-3 ${isLast ? '' : 'border-b border-app-border-subtle'}`}>
      <span className="w-10 h-10 rounded-full bg-app-surface-sunken border border-app-border text-app-text-strong flex items-center justify-center font-bold text-[14px] shrink-0">{initials(rep.name)}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[14.5px] font-semibold text-app-text -tracking-[0.01em] truncate">{rep.name}</span>
          {rep.party ? <span className="text-[11px] font-bold text-app-text-muted">({rep.party})</span> : null}
        </div>
        <div className="text-[12.5px] text-app-text-muted mt-0.5 truncate">{rep.office}</div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {rep.phone ? <ContactBtn kind="phone" href={`tel:${rep.phone}`} /> : null}
        {rep.email ? <ContactBtn kind="email" href={`mailto:${rep.email}`} /> : null}
        {rep.website ? <ContactBtn kind="website" href={rep.website} /> : null}
      </div>
    </div>
  );
}

function RepsList({ reps }: { reps: PlaceCivicRepresentative[] }) {
  const groups = groupBy(reps);
  return (
    <div className="flex flex-col gap-3.5">
      {groups.map((g) => (
        <div key={g.group}>
          <div className="text-[11px] font-bold tracking-[0.06em] uppercase text-app-text-muted mb-1.5 ml-1">{g.group}</div>
          <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
            {g.rows.map((r, i) => (
              <RepRow key={r.name + i} rep={r} isLast={i === g.rows.length - 1} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Election — in-season block ──────────────────────────────
function monthDay(iso: string): { mon: string; day: string } {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { mon: '', day: '' };
  return { mon: d.toLocaleDateString('en-US', { month: 'short' }), day: String(d.getDate()) };
}

function ElectionBanner({ data }: { data: PlaceCivicElectionData }) {
  const { mon, day } = monthDay(data.date);
  const dateLine = new Date(data.date);
  const dateLabel = Number.isNaN(dateLine.getTime()) ? '' : dateLine.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-[46px] h-[46px] rounded-xl bg-app-info-bg border border-app-info-light flex flex-col items-center justify-center shrink-0 leading-none">
          <span className="text-[9px] font-bold uppercase tracking-[0.04em] text-primary-700">{mon}</span>
          <span className="text-[19px] font-extrabold text-primary-700 mt-0.5">{day}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[15.5px] font-bold text-app-text -tracking-[0.01em]">{data.name}</div>
          {dateLabel ? <div className="text-[12.5px] text-app-text-muted mt-0.5">{dateLabel}</div> : null}
        </div>
        <Chip label={`${data.days_until} days away`} variant="info" />
      </div>
    </div>
  );
}

function PollingCard({ data }: { data: PlaceCivicElectionData }) {
  const p = data.polling_place;
  if (!p) return null;
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-4 py-3.5">
      <div className="flex items-center gap-3">
        <span className="w-[38px] h-[38px] rounded-[10px] bg-app-home-bg flex items-center justify-center shrink-0">
          <Mail size={19} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-[14.5px] font-semibold text-app-text">{p.name}</div>
          {p.detail ? <div className="text-[12.5px] text-app-text-muted mt-0.5">{p.detail}</div> : null}
        </div>
      </div>
    </div>
  );
}

function BallotPreview({ data, onOpen }: { data: PlaceCivicElectionData; onOpen: () => void }) {
  const offices = data.ballot.filter((b) => b.type === 'office').length;
  const measures = data.ballot.filter((b) => b.type === 'measure').length;
  if (data.ballot.length === 0) return null;
  return (
    <button type="button" onClick={onOpen} className="w-full flex items-center gap-3 bg-app-surface border border-app-border rounded-2xl shadow-sm p-4 text-left hover:bg-app-hover transition">
      <span className="w-10 h-10 rounded-[11px] bg-app-home-bg flex items-center justify-center shrink-0">
        <Vote size={20} strokeWidth={2} className="text-app-home" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-app-text">Your ballot</div>
        <div className="text-[12.5px] text-app-text-muted mt-0.5">
          {offices} {offices === 1 ? 'office' : 'offices'} · {measures} {measures === 1 ? 'measure' : 'measures'} · plain-language preview
        </div>
      </div>
      <ChevronRight size={18} strokeWidth={2.25} className="shrink-0 text-app-text-muted" />
    </button>
  );
}

function NoElection() {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-[18px] py-[22px] flex flex-col items-center text-center">
      <span className="w-12 h-12 rounded-[13px] bg-app-surface-sunken flex items-center justify-center mb-3">
        <CalendarCheck size={24} strokeWidth={2} className="text-app-text-muted" />
      </span>
      <div className="text-base font-bold text-app-text -tracking-[0.01em]">No upcoming election</div>
      <div className="text-[13.5px] text-app-text-secondary leading-5 mt-1 max-w-[280px]">There&apos;s nothing on your ballot right now. We&apos;ll surface your polling place and ballot here as soon as a date is set.</div>
    </div>
  );
}

// ── Ballot leaf — full races, plain language ────────────────
function BallotRace({ race }: { race: PlaceBallotRace }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-4 py-3.5">
      <div className="text-[14.5px] font-bold text-app-text -tracking-[0.01em]">{race.title}</div>
      {race.type === 'office' ? (
        <div className="mt-2">
          {race.candidates.map((c, i) => (
            <div key={c + i} className={`flex items-center gap-2.5 py-2 ${i === race.candidates.length - 1 ? '' : 'border-b border-app-border-subtle'}`}>
              <span className="w-4 h-4 rounded border-[1.75px] border-app-border-strong shrink-0" />
              <span className="text-[14px] text-app-text-strong">{c}</span>
            </div>
          ))}
        </div>
      ) : (
        <>
          {race.summary ? <div className="text-[13.5px] text-app-text-strong leading-5 mt-1.5">{race.summary}</div> : null}
          <div className="flex gap-2 mt-2.5">
            {['Yes', 'No'].map((opt) => (
              <div key={opt} className="flex-1 flex items-center gap-2 px-3 py-2.5 border border-app-border rounded-[10px]">
                <span className="w-4 h-4 rounded border-[1.75px] border-app-border-strong shrink-0" />
                <span className="text-[14px] font-semibold text-app-text-strong">{opt}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BallotLeaf({ data, address, onBack }: { data: PlaceCivicElectionData; address: string; onBack: () => void }) {
  const offices = data.ballot.filter((b) => b.type === 'office');
  const measures = data.ballot.filter((b) => b.type === 'measure');
  return (
    <>
      <DetailHeader title="Your ballot" address={data.name || address} onBack={onBack} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm px-4 py-3.5 flex items-center gap-3 mt-2">
          <Info size={17} strokeWidth={2} className="text-primary-600 shrink-0" />
          <span className="text-[13px] text-app-text-strong leading-[19px]">A preview of what you&apos;ll be asked to decide. Candidate order is randomized, the same as on your official ballot.</span>
        </div>

        {offices.length > 0 ? (
          <>
            <DetailSectionLabel>Offices</DetailSectionLabel>
            <div className="flex flex-col gap-2.5">
              {offices.map((r, i) => (
                <BallotRace key={r.title + i} race={r} />
              ))}
            </div>
          </>
        ) : null}

        {measures.length > 0 ? (
          <>
            <DetailSectionLabel>Measures</DetailSectionLabel>
            <div className="flex flex-col gap-2.5">
              {measures.map((r, i) => (
                <BallotRace key={r.title + i} race={r} />
              ))}
            </div>
          </>
        ) : null}

        <SourceNote name="Ballot data · official county elections" asOf={data.name} />
        <InfoNote>
          A neutral preview for reference. Pantopus doesn&apos;t endorse candidates or measures. Your official ballot is the record that counts.
        </InfoNote>
      </div>
    </>
  );
}

export default function CivicDetail({ intelligence }: { intelligence: PlaceIntelligence }) {
  const [ballotOpen, setBallotOpen] = useState(false);
  const districtsEnv = findPlaceSection(intelligence, 'civic_districts');
  const electionEnv = findPlaceSection(intelligence, 'civic_election');
  const address = detailAddress(intelligence.place);

  const districtsReady = districtsEnv && (districtsEnv.status === 'ready' || districtsEnv.status === 'stale' || districtsEnv.status === 'partial') && districtsEnv.data;
  const districtsData = districtsReady ? (districtsEnv!.data as PlaceCivicDistrictsData) : null;
  const reps = districtsData?.representatives ?? [];

  const electionReady = electionEnv && (electionEnv.status === 'ready' || electionEnv.status === 'stale' || electionEnv.status === 'partial') && electionEnv.data;
  const electionData = electionReady ? (electionEnv!.data as PlaceCivicElectionData) : null;

  if (ballotOpen && electionData) {
    return <BallotLeaf data={electionData} address={address} onBack={() => setBallotOpen(false)} />;
  }

  return (
    <>
      <DetailHeader title="Civic" address={address} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Your districts</DetailSectionLabel>
        {districtsData && districtsData.districts.length > 0 ? (
          <DistrictsCard districts={districtsData.districts} />
        ) : (
          <SectionCard icon={Landmark} title="Your districts" state={districtsEnv ? statusToState(districtsEnv.status) : 'unavailable'} caption={districtsEnv?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {districtsEnv?.source ? <SourceNote name={districtsEnv.source} asOf="current" /> : null}

        {reps.length > 0 ? (
          <>
            <DetailSectionLabel>Your representatives</DetailSectionLabel>
            <RepsList reps={reps} />
          </>
        ) : null}

        <DetailSectionLabel>Election</DetailSectionLabel>
        {electionData ? (
          <div className="flex flex-col gap-2.5">
            <ElectionBanner data={electionData} />
            <PollingCard data={electionData} />
            <BallotPreview data={electionData} onOpen={() => setBallotOpen(true)} />
          </div>
        ) : (
          <NoElection />
        )}
        {electionData && electionEnv?.source ? <SourceNote name={electionEnv.source} asOf={electionData.name} /> : null}

        <InfoNote>
          Informational, drawn from public civic records for your address. Pantopus is nonpartisan and doesn&apos;t endorse candidates or measures.
        </InfoNote>
      </div>
    </>
  );
}
