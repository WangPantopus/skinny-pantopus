// ============================================================
// Place — Your Block detail (C6).
// The k-anon density bucket, Census neighborhood context (area-level,
// not your home), and permits. Permits aren't in the v1 contract, so
// they render in the honest "not available for your area yet" state.
// ============================================================

'use client';

import { useRouter } from 'next/navigation';
import type { PlaceIntelligence, PlaceBlockDensityData, PlaceCensusContextData } from '@pantopus/types';
import { Map, HardHat, Calendar, Home } from 'lucide-react';
import { SectionCard, DensityCard, DetailHeader, DetailSectionLabel, SourceNote, InfoNote } from '@/components/archetypes/place';
import { findPlaceSection, detailAddress } from './sections';
import { usdK, statusToState } from './format';

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
