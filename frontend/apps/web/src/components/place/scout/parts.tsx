// ============================================================
// Scout — the pieces. See ScoutView.tsx for how they compose.
//
// Two rules run through all of them:
//
//   1. NEVER "YOUR". The reader does not live at this address; someone
//      else does. The server strips the dashboard composers' possessive
//      voice for exactly this reason and the UI must not put it back.
//   2. NEVER A VERDICT ON THE PRICE. A band position is a position
//      against a public band, and it is only meaningful with the unit
//      size beside it.
// ============================================================

'use client';

import { Check, Info } from 'lucide-react';
import type { ScoutAsk, ScoutRent } from '@pantopus/api';
import Chip, { type ChipVariant } from '@/components/archetypes/primitives/Chip';

// ── One generated question ──────────────────────────────────
//
// `because` is the fact that produced the question and is what makes it
// checkable rather than a checklist off the internet — so it is rendered
// in full, never clamped. `source` is optional: omit the element
// entirely rather than rendering an empty label.

export function AskRow({
  ask,
  checked,
  onToggle,
}: {
  ask: ScoutAsk;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={checked}
        aria-label={checked ? `Mark "${ask.question}" as not asked` : `Mark "${ask.question}" as asked`}
        className={`mt-0.5 w-[22px] h-[22px] rounded-[7px] border-[1.5px] flex items-center justify-center shrink-0 transition ${
          checked
            ? 'bg-app-home border-app-home text-white'
            : 'bg-app-surface border-app-border text-transparent hover:border-app-home'
        }`}
      >
        <Check size={14} strokeWidth={3} />
      </button>
      <div className="min-w-0">
        <p className={`text-[14.5px] font-semibold leading-[20px] -tracking-[0.008em] ${
          checked ? 'text-app-text-muted line-through' : 'text-app-text'
        }`}
        >
          {ask.question}
        </p>
        <p className="text-[13px] leading-[19px] text-app-text-secondary mt-1">{ask.because}</p>
        {ask.source ? (
          <p data-testid="ask-source" className="text-[12.5px] text-app-text-muted mt-1.5">{ask.source}</p>
        ) : null}
      </div>
    </li>
  );
}

// ── A band with a marker on it ──────────────────────────────
//
// Used for both the rent band and the flood-premium spread. The marker
// is clamped into the track so an asking rent far outside the band still
// renders inside the component, and the numbers are always printed as
// well — the bar is an illustration, the figures are the fact.

export function BandTrack({
  low,
  high,
  marker,
  markerLabel,
  format,
}: {
  low: number;
  high: number;
  marker?: number | null;
  markerLabel?: string;
  format: (n: number) => string;
}) {
  // `low === high` is the COMMON case, not an edge one: HUD prices most
  // counties at a single figure. Without the guard the span collapses and
  // every marker pins to one end.
  const degenerate = high <= low;
  const span = degenerate ? 1 : high - low;
  const rawPct = marker == null ? null : ((marker - low) / span) * 100;
  const pct = rawPct == null ? null : Math.min(100, Math.max(0, rawPct));
  // An asking rent outside the band was CLAMPED into it and then printed
  // between the two endpoints, so a rent well over the top of the band
  // rendered as though it sat inside. Say which side it fell off.
  const outside = rawPct == null ? null : rawPct < 0 ? 'below' : rawPct > 100 ? 'above' : null;

  return (
    <div className="mt-3">
      <div className="relative h-[7px] rounded-full bg-app-surface-sunken">
        <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-app-home/25" />
        {pct != null ? (
          <span
            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[13px] h-[13px] rounded-full border-2 border-app-surface shadow-sm ${
              outside ? 'bg-app-warning' : 'bg-app-home'
            }`}
            style={{ left: `${pct}%` }}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between mt-1.5 text-[12.5px] text-app-text-muted tabular-nums">
        <span>{format(low)}</span>
        {marker != null && markerLabel ? (
          <span className="font-semibold text-app-text">
            {markerLabel}
            {outside === 'above' ? ' — above this band' : outside === 'below' ? ' — below this band' : ''}
          </span>
        ) : null}
        <span>{format(high)}</span>
      </div>
    </div>
  );
}

// ── The rent verdict ────────────────────────────────────────
//
// `position` NEVER renders without the bedroom count. The verdict is
// computed against one HUD band and is meaningless against a different
// unit size: a studio at $1,400 sits below a 2-bedroom band of
// $1,600–$1,920, and "below band" reads as a good deal when it is not.
//
// When the server defaulted the count rather than the reader choosing
// it, say so — presenting our assumption as their input is the same
// class of overclaim as the rest of this product's failure modes.

const POSITION_COPY: Record<string, { label: string; variant: ChipVariant }> = {
  above_band: { label: 'Above the band', variant: 'warning' },
  in_band: { label: 'Inside the band', variant: 'success' },
  below_band: { label: 'Below the band', variant: 'home' },
};

export function bedroomsLabel(bedrooms: number): string {
  if (bedrooms === 0) return 'studio';
  return `${bedrooms}-bedroom`;
}

export function RentVerdict({ rent }: { rent: ScoutRent }) {
  const meta = rent.position ? POSITION_COPY[rent.position] : null;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {meta ? <Chip label={meta.label} variant={meta.variant} /> : null}
        <span className="text-[12.5px] text-app-text-muted">
          {bedroomsLabel(rent.bedrooms)} · {rent.scope}-wide, not this unit
        </span>
      </div>

      {!rent.bedrooms_stated ? (
        <p className="text-[12.5px] leading-[18px] text-app-text-muted mt-2">
          We assumed {bedroomsLabel(rent.bedrooms)} because you did not say. Set the number of bedrooms to compare
          against the right band — the answer changes.
        </p>
      ) : null}

      <BandTrack
        low={rent.band_low}
        high={rent.band_high}
        marker={rent.asking_rent}
        markerLabel={rent.asking_rent != null ? `Asking ${money(rent.asking_rent)}` : undefined}
        format={money}
      />

      <p className="text-[12.5px] text-app-text-muted mt-2">
        HUD fair market rent, {rent.period}.
      </p>
    </div>
  );
}

export function money(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

// ── A labelled fact ─────────────────────────────────────────

export function FactRow({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-[13.5px] text-app-text-secondary">{label}</span>
      <span className="text-right min-w-0">
        <span className="block text-[13.5px] font-semibold text-app-text">{value}</span>
        {note ? <span className="block text-[12.5px] text-app-text-muted mt-0.5">{note}</span> : null}
      </span>
    </div>
  );
}

// ── The scope note ──────────────────────────────────────────
//
// Rendered VERBATIM and UNCLAMPED. It is the page's account of where the
// typed address went, and it has been wrong twice — once claiming nobody
// was told, once claiming a single third party. Truncating it, hiding it
// behind a disclosure, or paraphrasing it all defeat the point.

export function ScopeNote({ note }: { note: string }) {
  return (
    <div
      data-testid="scout-scope-note"
      className="flex items-start gap-2.5 mt-6 px-3.5 py-3 rounded-xl bg-app-surface-muted border border-app-border-subtle"
    >
      <Info size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-app-text-muted" />
      <p className="text-[12.5px] leading-[18px] text-app-text-secondary">{note}</p>
    </div>
  );
}

/**
 * A real heading, not a styled div. The report is a long single column of
 * labelled sections, and with bare divs the entire page had exactly one
 * heading — so a screen-reader user had no way to move between "What to
 * ask", "Flood", "Rent" and the rest except by reading it all. The
 * sibling Unlisted surface already uses real headings.
 */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-app-text-muted mt-7 mb-2 px-1">
      {children}
    </h2>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-app-surface border border-app-border rounded-2xl shadow-sm p-4">{children}</div>
  );
}
