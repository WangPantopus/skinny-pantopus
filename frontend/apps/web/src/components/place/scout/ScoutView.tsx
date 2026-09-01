// ============================================================
// ScoutView — the report for an address you do NOT live at.
//
// The QUESTION LIST LEADS. Everything below it exists to justify a
// question; the facts are the evidence, not the product. That ordering
// is the difference between this page and the dashboard, which answers
// "what is true about my home" for someone who lives there.
//
// Every fact block renders INDEPENDENTLY. `flood` and `flood_cost` come
// from different sources and either can be null while the other is
// present — gating the cost on the zone would hide a real dollar figure
// whenever FEMA is down. A payload with every block null still renders
// the questions and the scope note, and nothing else: no zeroes, no
// "unknown" placeholders, no empty cards.
// ============================================================

'use client';

import { useState } from 'react';
import { Waves, House, Wind, Droplets } from 'lucide-react';
import type { ScoutReport } from '@pantopus/api';
import { DetailHeader } from '@/components/archetypes/place';
import {
  AskRow, BandTrack, Card, FactRow, RentVerdict, ScopeNote, SectionLabel, money,
} from './parts';

/**
 * THREE ANSWERS, NOT TWO. `in_sfha: false` means either "FEMA looked and
 * this is outside the floodplain" or "FEMA has made no determination
 * here" — and rendering the boolean as two branches turned the second
 * into "Outside the high-risk area", a reassurance about land nobody has
 * assessed. That is the same defect the backend fixed for
 * "AREA NOT INCLUDED", reintroduced one layer up, and the reassuring
 * direction is the more dangerous one to get wrong.
 *
 * An unrecognised value falls to `undetermined`, which claims nothing.
 */
const FLOOD_MEANING: Record<string, string> = {
  high_risk: 'A Special Flood Hazard Area — a federally backed mortgage requires flood insurance here.',
  low_risk:
    'Outside the high-risk area, where flood insurance is usually optional — which also means it is often absent.',
  undetermined:
    'FEMA has not published a flood-risk finding for this location. That is not the same as low risk — it means '
    + 'nobody has assessed it either way.',
};

const RADON_ZONE_NOTE: Record<number, string> = {
  1: 'Highest predicted indoor level',
  2: 'Moderate predicted level',
  3: 'Lowest predicted level',
};

export default function ScoutView({ report, onNewSearch }: { report: ScoutReport; onNewSearch: () => void }) {
  // Which questions have been asked, this session only. Deliberately not
  // persisted: a stored list of addresses someone scouted is exactly the
  // record this surface promises not to keep.
  const [asked, setAsked] = useState<Record<string, boolean>>({});

  const { place, flood, flood_cost: floodCost, environment, rent, ask_before_you_sign: asks } = report;
  const radon = environment?.radon ?? null;
  const water = environment?.water ?? null;

  const addressLine = [place.address, place.city].filter(Boolean).join(' · ') || null;
  const askedCount = asks.filter((a) => asked[a.id]).length;

  return (
    <>
      <DetailHeader title="Before you sign" address={addressLine ?? undefined} backHref="/app/place" />

      <div className="px-4 sm:px-5 pt-1 pb-16">
        <button
          type="button"
          onClick={onNewSearch}
          className="text-[13px] font-semibold text-app-home hover:underline mt-3"
        >
          Check a different address
        </button>

        {/* ── The product ───────────────────────────────── */}
        <SectionLabel>What to ask</SectionLabel>
        <Card>
          {asks.length > 0 ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-3 mb-1 border-b border-app-border-subtle">
                <span className="text-[13px] font-semibold text-app-text-secondary">
                  {askedCount} of {asks.length} asked
                </span>
              </div>
              <ul className="divide-y divide-app-border-subtle">
                {asks.map((ask) => (
                  <AskRow
                    key={ask.id}
                    ask={ask}
                    checked={!!asked[ask.id]}
                    onToggle={() => setAsked((prev) => ({ ...prev, [ask.id]: !prev[ask.id] }))}
                  />
                ))}
              </ul>
            </>
          ) : (
            <p className="text-[13.5px] text-app-text-secondary">
              {/*
                "The questions below" pointed at an empty list — the ask
                list IS this card. In practice askBeforeYouSign always
                returns at least one question, so this branch is
                unreachable today; it stays as a guard against a payload
                this client did not compose, and now describes the page.
              */}
              Nothing stood out in the public records for this address. The facts below are still worth reading
              before you commit.
            </p>
          )}
        </Card>

        {/* ── Flood zone. Independent of the cost block. ── */}
        {flood ? (
          <>
            <SectionLabel>Flood</SectionLabel>
            <Card>
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-xl bg-app-home-bg text-app-home">
                  <Waves size={19} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-app-text">FEMA zone {flood.zone}</p>
                  <p className="text-[13px] leading-[19px] text-app-text-secondary mt-1">
                    {FLOOD_MEANING[flood.determination] ?? FLOOD_MEANING.undetermined}
                  </p>
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {/* ── What insurance costs. Independent of the zone. ── */}
        {floodCost ? (
          <>
            <SectionLabel>What flood insurance costs here</SectionLabel>
            <Card>
              <BandTrack
                low={floodCost.premium_p25}
                high={floodCost.premium_p75}
                marker={floodCost.premium_median}
                markerLabel={`Median ${money(floodCost.premium_median)}`}
                format={money}
              />
              <p className="text-[12.5px] leading-[18px] text-app-text-muted mt-3">
                Across {floodCost.policy_count.toLocaleString('en-US')} real policies in this {floodCost.scope}.
                {' '}
                {floodCost.note}
              </p>
            </Card>
          </>
        ) : null}

        {/* ── Rent. The verdict never renders without its unit size. ── */}
        {rent ? (
          <>
            <SectionLabel>Rent</SectionLabel>
            <Card>
              <div className="flex items-start gap-3">
                <span className="inline-flex items-center justify-center shrink-0 w-[38px] h-[38px] rounded-xl bg-app-home-bg text-app-home">
                  <House size={19} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <RentVerdict rent={rent} />
                </div>
              </div>
            </Card>
          </>
        ) : null}

        {/* ── Environment ───────────────────────────────── */}
        {(radon?.radon_zone != null || water) ? (
          <>
            <SectionLabel>Environment</SectionLabel>
            <Card>
              <div className="divide-y divide-app-border-subtle">
                {radon?.radon_zone != null ? (
                  <div className="flex items-start gap-3 pb-3">
                    <span className="inline-flex items-center justify-center shrink-0 w-[34px] h-[34px] rounded-[10px] bg-app-surface-sunken text-app-text-muted">
                      <Wind size={17} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <FactRow
                        label="EPA radon zone"
                        value={String(radon.radon_zone)}
                        note={RADON_ZONE_NOTE[radon.radon_zone] ?? null}
                      />
                    </div>
                  </div>
                ) : null}
                {water ? (
                  <div className="flex items-start gap-3 pt-3 first:pt-0">
                    <span className="inline-flex items-center justify-center shrink-0 w-[34px] h-[34px] rounded-[10px] bg-app-surface-sunken text-app-text-muted">
                      <Droplets size={17} strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      {/*
                        NOT "the water system for this address".
                        composeDrinkingWater picks the county's system whose
                        name matches the city, ELSE THE LARGEST in the county
                        — the dashboard marks that `coverage: 'partial'`, and
                        Scout's projection dropped the nuance. Naming a
                        utility and attaching "no violations" to it as a fact
                        about this building is a false all-clear when the
                        guess is wrong, told to someone deciding whether to
                        sign. So the label says what it actually is, and the
                        caveat turns it into the question it should be.
                      */}
                      <FactRow
                        label="Main water system in this county"
                        value={water.utility_name || 'Not identified'}
                        note={water.violation_count > 0
                          ? `${water.violation_count} health-based violation${water.violation_count === 1 ? '' : 's'} in the last 5 years`
                          : 'No health-based violations in the last 5 years'}
                      />
                      <p className="text-[12.5px] leading-[18px] text-app-text-muted pb-2.5">
                        Counties often have several. Worth asking which one actually serves this address.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          </>
        ) : null}

        <ScopeNote note={report.scope_note} />
      </div>
    </>
  );
}
