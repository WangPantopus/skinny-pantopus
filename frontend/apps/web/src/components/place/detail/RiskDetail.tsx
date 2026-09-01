// ============================================================
// Place — Risk & Readiness detail (C5).
// Flood zone with its plain meaning (FEMA), the health & environment
// screenings (lead/radon, drinking water, EPA facilities — the
// `health_environment` group folds into this page; it has no designed
// screen of its own), the deferred hazards as "coming soon", and an
// informational household-readiness checklist (device-local, never
// instructions).
// ============================================================

'use client';

import type { LucideIcon } from 'lucide-react';
import type {
  PlaceIntelligence,
  PlaceFloodData,
  FloodRiskLevel,
  PlaceSeismicData,
  PlaceWildfireData,
  PlaceLeadRadonData,
  PlaceDrinkingWaterData,
  PlaceEnvironmentalHazardsData,
} from '@pantopus/types';
import {
  Waves,
  ShieldCheck,
  TriangleAlert,
  Activity,
  Flame,
  LifeBuoy,
  Briefcase,
  Phone,
  MapPin,
  Check,
  TestTube,
  GlassWater,
  Factory,
} from 'lucide-react';
import Chip, { type ChipVariant } from '@/components/archetypes/primitives/Chip';
import { SectionCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { statusToState } from './format';
import { useLocalDraft } from './useLocalDraft';

const FLOOD_CHIP: Record<FloodRiskLevel, { label: string; variant: ChipVariant; icon: LucideIcon }> = {
  minimal: { label: 'Minimal risk', variant: 'success', icon: ShieldCheck },
  moderate: { label: 'Moderate risk', variant: 'warning', icon: TriangleAlert },
  high: { label: 'High risk', variant: 'error', icon: TriangleAlert },
};

function FloodCard({ data }: { data: PlaceFloodData }) {
  const chip = FLOOD_CHIP[data.risk_level] ?? { label: data.zone_label, variant: 'neutral' as ChipVariant, icon: Waves };
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-[18px]">
      <div className="flex items-center gap-3">
        <span className="w-[46px] h-[46px] rounded-[13px] bg-app-home-bg border border-app-success-light flex items-center justify-center shrink-0">
          <Waves size={24} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-[20px] font-bold -tracking-[0.015em] text-app-text">{data.zone_label}</span>
            <Chip label={chip.label} variant={chip.variant} icon={chip.icon} />
          </div>
          <div className="text-[13px] text-app-text-secondary mt-0.5">FEMA flood hazard area</div>
        </div>
      </div>
      {data.plain_meaning ? (
        <div className="text-[14px] text-app-text-strong leading-5 mt-[15px] pt-[15px] border-t border-app-border-subtle">
          <span className="font-semibold">What this means:</span> {data.plain_meaning}
        </div>
      ) : null}
    </div>
  );
}

// ── Other hazards — earthquake (USGS) + wildfire (USFS) ─────

function SeismicCard({ data }: { data: PlaceSeismicData }) {
  const high = data.design_category === 'D' || data.design_category === 'E';
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <Activity size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Earthquake</span>
            <Chip label={`Design category ${data.design_category}`} variant={high ? 'warning' : 'success'} />
          </div>
          <div className="text-[13px] text-app-text-secondary leading-[19px] mt-1">{data.summary}</div>
        </div>
      </div>
      <div className="text-[12px] text-app-text-muted leading-[17px] mt-3 pt-3 border-t border-app-border-subtle">{data.disclaimer}</div>
    </div>
  );
}

function WildfireCard({ data }: { data: PlaceWildfireData }) {
  const high = data.hazard_class != null && data.hazard_class >= 4;
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <Flame size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Wildfire</span>
            <Chip label={data.hazard_label} variant={high ? 'warning' : data.burnable ? 'success' : 'neutral'} />
          </div>
          <div className="text-[13px] text-app-text-secondary leading-[19px] mt-1">{data.summary}</div>
        </div>
      </div>
      <div className="text-[12px] text-app-text-muted leading-[17px] mt-3 pt-3 border-t border-app-border-subtle">{data.disclaimer}</div>
    </div>
  );
}

// ── Health & environment (folded group) ─────────────────────

const LEAD_CHIP: Record<PlaceLeadRadonData['lead_paint_risk'], { label: string; variant: ChipVariant }> = {
  unlikely: { label: 'Lead unlikely', variant: 'success' },
  possible: { label: 'Lead possible', variant: 'warning' },
  likely: { label: 'Lead likely', variant: 'warning' },
};

function LeadRadonCard({ data }: { data: PlaceLeadRadonData }) {
  const chip = LEAD_CHIP[data.lead_paint_risk];
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <TestTube size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">Lead & radon</span>
            <Chip label={chip.label} variant={chip.variant} />
            {data.radon_zone ? <Chip label={`Radon zone ${data.radon_zone}`} variant={data.radon_zone === 1 ? 'warning' : 'neutral'} /> : null}
          </div>
          <div className="text-[13px] text-app-text-secondary leading-[19px] mt-1">{data.summary}</div>
        </div>
      </div>
      <div className="text-[12px] text-app-text-muted leading-[17px] mt-3 pt-3 border-t border-app-border-subtle">{data.disclaimer}</div>
    </div>
  );
}

function DrinkingWaterCard({ data }: { data: PlaceDrinkingWaterData }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <GlassWater size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em] truncate">{data.utility_name}</span>
            <Chip
              label={data.recent_health_violations ? `${data.violation_count} health violation${data.violation_count === 1 ? '' : 's'}` : 'No health violations'}
              variant={data.recent_health_violations ? 'warning' : 'success'}
              icon={data.recent_health_violations ? TriangleAlert : ShieldCheck}
            />
          </div>
          <div className="text-[13px] text-app-text-secondary leading-[19px] mt-1">{data.summary}</div>
        </div>
      </div>
    </div>
  );
}

function EnvironmentalHazardsCard({ data }: { data: PlaceEnvironmentalHazardsData }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">
      <div className="flex items-center gap-3">
        <span className="w-11 h-11 rounded-xl bg-app-home-bg flex items-center justify-center shrink-0">
          <Factory size={22} strokeWidth={2} className="text-app-home" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[15.5px] font-semibold text-app-text -tracking-[0.01em]">EPA-regulated nearby</span>
            <Chip
              label={`${data.facilities_within_mile} within ${data.radius_mi} mi`}
              variant={data.facilities_within_mile === 0 ? 'success' : 'neutral'}
            />
          </div>
          <div className="text-[13px] text-app-text-secondary leading-[19px] mt-1">{data.summary}</div>
        </div>
      </div>
      {data.facilities.length > 0 ? (
        <div className="mt-3 pt-1 border-t border-app-border-subtle">
          {data.facilities.map((f, i) => (
            <div key={`${f.name}-${i}`} className={`flex items-center justify-between gap-3 py-2 ${i === data.facilities.length - 1 ? '' : 'border-b border-app-border-subtle'}`}>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-app-text truncate">{f.name}</div>
                <div className="text-[12px] text-app-text-muted">{f.program}</div>
              </div>
              <span className="text-[12.5px] text-app-text-secondary shrink-0">{f.distance_mi} mi</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="text-[12px] text-app-text-muted leading-[17px] mt-3 pt-3 border-t border-app-border-subtle">{data.disclaimer}</div>
    </div>
  );
}

// ── Emergency readiness — informational, device-local checklist ──
interface PlanItem {
  id: string;
  title: string;
  sub: string;
}
interface PlanGroup {
  label: string;
  icon: LucideIcon;
  items: PlanItem[];
}

const PLAN_GROUPS: PlanGroup[] = [
  {
    label: 'Go-bag essentials',
    icon: Briefcase,
    items: [
      { id: 'water', title: 'Water', sub: 'One gallon per person per day, 3-day supply' },
      { id: 'food', title: 'Non-perishable food', sub: '3-day supply that needs no cooking' },
      { id: 'light', title: 'Flashlight & spare batteries', sub: 'One per person' },
      { id: 'aid', title: 'First-aid kit', sub: 'Stocked and in-date' },
      { id: 'meds', title: '7-day medication supply', sub: 'Plus copies of prescriptions' },
      { id: 'docs', title: 'Copies of key documents', sub: 'ID, insurance, deed — sealed in a bag' },
    ],
  },
  {
    label: 'Key contacts',
    icon: Phone,
    items: [
      { id: 'outarea', title: 'Out-of-area contact', sub: 'A friend or relative in another city' },
      { id: 'utility', title: 'Utility shutoff info', sub: 'Gas, water, and electric main locations' },
      { id: 'insure', title: 'Insurance & policy number', sub: 'Saved where you can reach it offline' },
    ],
  },
  {
    label: 'Meeting point',
    icon: MapPin,
    items: [
      { id: 'near', title: 'A spot near home', sub: 'Somewhere just outside, easy to reach' },
      { id: 'far', title: 'A spot outside the neighborhood', sub: 'In case you can’t get back home' },
    ],
  },
];

const ALL_ITEMS = PLAN_GROUPS.flatMap((g) => g.items);

function CheckRow({ item, checked, onToggle, isLast }: { item: PlanItem; checked: boolean; onToggle: () => void; isLast: boolean }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className={`flex items-center gap-3 w-full text-left px-3.5 py-2.5 ${isLast ? '' : 'border-b border-app-border-subtle'} hover:bg-app-hover transition`}
    >
      <span className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center transition ${checked ? 'bg-app-home border border-app-home' : 'bg-app-surface border-[1.75px] border-app-border-strong'}`}>
        {checked ? <Check size={14} strokeWidth={3} className="text-white" /> : null}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-[14.5px] font-semibold -tracking-[0.01em] ${checked ? 'text-app-text' : 'text-app-text-strong'}`}>{item.title}</div>
        <div className="text-[12.5px] text-app-text-muted mt-0.5">{item.sub}</div>
      </div>
    </button>
  );
}

function EmergencyPlan({ homeId }: { homeId: string | null }) {
  const [checked, setChecked, hydrated] = useLocalDraft<Record<string, boolean>>(homeId ? `place:emergency:${homeId}` : null, {});
  const doneCount = ALL_ITEMS.filter((it) => checked[it.id]).length;
  const total = ALL_ITEMS.length;
  const pct = (doneCount / total) * 100;
  const toggle = (id: string) => setChecked({ ...checked, [id]: !checked[id] });

  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-[15px] border-b border-app-border-subtle">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <LifeBuoy size={19} strokeWidth={2} className="text-app-home" />
            <span className="text-base font-bold -tracking-[0.01em] text-app-text">Your household plan</span>
          </div>
          <span className={`text-[13px] font-semibold ${hydrated && doneCount === total ? 'text-app-success' : 'text-app-text-secondary'}`}>{hydrated ? `${doneCount} of ${total} ready` : `${total} steps`}</span>
        </div>
        <div className="h-[7px] rounded-full bg-app-surface-sunken overflow-hidden">
          <div className="h-full rounded-full bg-app-home transition-[width] duration-200" style={{ width: `${hydrated ? pct : 0}%` }} />
        </div>
      </div>
      {PLAN_GROUPS.map((g, gi) => {
        const GroupIcon = g.icon;
        return (
          <div key={g.label} className={gi === PLAN_GROUPS.length - 1 ? '' : 'border-b border-app-border-subtle'}>
            <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
              <GroupIcon size={14} strokeWidth={2} className="text-app-text-muted" />
              <span className="text-[11.5px] font-bold tracking-[0.06em] uppercase text-app-text-muted">{g.label}</span>
            </div>
            {g.items.map((it, i) => (
              <CheckRow key={it.id} item={it} checked={!!checked[it.id]} onToggle={() => toggle(it.id)} isLast={i === g.items.length - 1} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

const isReady = (s: { status: string; data: unknown } | null | undefined) =>
  Boolean(s && (s.status === 'ready' || s.status === 'stale' || s.status === 'partial') && s.data);

export default function RiskDetail({ intelligence, homeId }: { intelligence: PlaceIntelligence; homeId: string | null }) {
  const flood = findPlaceSection(intelligence, 'flood');
  const floodReady = isReady(flood);
  const seismic = findPlaceSection(intelligence, 'seismic');
  const wildfire = findPlaceSection(intelligence, 'wildfire');
  const leadRadon = findPlaceSection(intelligence, 'lead_radon');
  const water = findPlaceSection(intelligence, 'drinking_water');
  const hazards = findPlaceSection(intelligence, 'environmental_hazards');

  return (
    <>
      <DetailHeader title="Risk & readiness" address={detailAddress(intelligence.place)} />
      <div className="px-4 sm:px-5 pt-1 pb-16">
        <DetailSectionLabel>Flood</DetailSectionLabel>
        {floodReady ? (
          <FloodCard data={flood!.data as PlaceFloodData} />
        ) : (
          <SectionCard icon={Waves} title="Flood" state={flood ? statusToState(flood.status) : 'unavailable'} caption={flood?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
        )}
        {flood?.source ? <SourceNote name={flood.source} asOf="as of 2024" /> : null}

        <DetailSectionLabel>Health & environment</DetailSectionLabel>
        <div className="flex flex-col gap-2.5">
          {isReady(leadRadon) ? (
            <LeadRadonCard data={leadRadon!.data as PlaceLeadRadonData} />
          ) : (
            <SectionCard icon={TestTube} title="Lead & radon" state={leadRadon ? statusToState(leadRadon.status) : 'unavailable'} caption={leadRadon?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
          )}
          {isReady(water) ? (
            <DrinkingWaterCard data={water!.data as PlaceDrinkingWaterData} />
          ) : (
            <SectionCard icon={GlassWater} title="Drinking water" state={water ? statusToState(water.status) : 'unavailable'} caption={water?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
          )}
          {isReady(hazards) ? (
            <EnvironmentalHazardsCard data={hazards!.data as PlaceEnvironmentalHazardsData} />
          ) : (
            <SectionCard icon={Factory} title="EPA-regulated nearby" state={hazards ? statusToState(hazards.status) : 'unavailable'} caption={hazards?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
          )}
        </div>
        {[leadRadon, water, hazards].some(isReady) ? (
          <SourceNote name="EPA radon zones · HUD lead rules · EPA SDWIS · EPA ECHO" />
        ) : null}

        <DetailSectionLabel>Other hazards</DetailSectionLabel>
        <div className="flex flex-col gap-2.5">
          {isReady(seismic) ? (
            <SeismicCard data={seismic!.data as PlaceSeismicData} />
          ) : (
            <SectionCard icon={Activity} title="Earthquake" state={seismic ? statusToState(seismic.status) : 'unavailable'} caption={seismic?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
          )}
          {isReady(wildfire) ? (
            <WildfireCard data={wildfire!.data as PlaceWildfireData} />
          ) : (
            <SectionCard icon={Flame} title="Wildfire" state={wildfire ? statusToState(wildfire.status) : 'unavailable'} caption={wildfire?.unavailable_reason ?? undefined} onRetry={() => window.location.reload()} />
          )}
        </div>
        {[seismic, wildfire].some(isReady) ? (
          <SourceNote name="USGS seismic design values · USFS Wildfire Hazard Potential" />
        ) : null}

        <DetailSectionLabel>Emergency plan</DetailSectionLabel>
        <EmergencyPlan homeId={homeId} />
        <SourceNote name="Recommended items from Ready.gov & American Red Cross" />

        <InfoNote>
          Informational, not emergency instructions. In a real emergency, call 911 and follow guidance from local officials.
        </InfoNote>
      </div>
    </>
  );
}
