'use client';

// Filters on the new Pulse (PHASE-5 piece B; coord/CONTRACT.md §10a): one row under the header (a Filters button with a
// count, then the kinds as quick taps), a sheet from the bottom with What, When, From and State, and one plain line that
// says what is on, with one tap to clear. The same filters hold on List and on Map; the map's time row is the When. The
// choice is kept on this device for this person; "New since your last visit" is the time this person last opened Pulse
// here. Heads-ups always show, whatever is filtered (the server keeps them in).

import { useEffect, useRef, useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { CHIP_WORDS, type Chip, type MapTime } from './listApi';

export type Kind = Exclude<Chip, 'all'>;
export const KINDS: readonly Kind[] = ['live', 'learn', 'spots', 'ask', 'plans', 'sports'];
export type FilterState = 'unanswered' | 'room';

export interface Filters {
  kinds: Kind[];
  from: 'everyone' | 'connections';
  state: FilterState[];
  /** New since your last visit. */
  fresh: boolean;
}
export const NO_FILTERS: Filters = { kinds: [], from: 'everyone', state: [], fresh: false };

/** The sheet's When: the map's time row's four that the list can follow too ("When" and the time row are one setting). */
const WHENS: { time: MapTime; label: string }[] = [
  { time: 'live', label: 'Now' },
  { time: 'today', label: 'Today' },
  { time: 'tonight', label: 'Tonight' },
  { time: 'weekend', label: 'This weekend' },
];
const STATE_WORDS: Record<FilterState, string> = { unanswered: 'Unanswered Asks', room: 'Plans with room' };

const isKind = (v: unknown): v is Kind => typeof v === 'string' && (KINDS as readonly string[]).includes(v);
const TIMES: readonly MapTime[] = ['all', 'week', 'today', 'live', 'tonight', 'weekend'];

/** How many filters are on, the When included when it isn't Now. */
export function filterCount(f: Filters, time: MapTime) {
  return f.kinds.length + (f.from === 'connections' ? 1 : 0) + f.state.length + (f.fresh ? 1 : 0) + (time !== 'live' ? 1 : 0);
}

/** The list's own `when` for the time row's choice; the list has none for This week and All time. */
function listWhen(time: MapTime): string | null {
  return time === 'today' || time === 'tonight' || time === 'weekend' ? time : null;
}

/** §10a's fields for the list (`list`) or the map (no `when`: its time row is its `time`). Null when nothing is on. */
export function filterParams(f: Filters, time: MapTime, since: string | null, on: 'list' | 'map'): Record<string, string> | null {
  const p: Record<string, string> = {};
  if (f.kinds.length) p.kinds = f.kinds.join(',');
  const when = on === 'list' ? listWhen(time) : null;
  if (when) p.when = when;
  if (f.from === 'connections') p.from = 'connections';
  if (f.state.length) p.state = f.state.join(',');
  if (f.fresh && since) p.since = since;
  return Object.keys(p).length ? p : null;
}

/** The one plain line that says what is on. */
export function filterWords(f: Filters, time: MapTime): string {
  const parts: string[] = [];
  if (f.kinds.length) parts.push(f.kinds.map((k) => CHIP_WORDS[k]).join(', '));
  if (time !== 'live') parts.push(WHENS.find((w) => w.time === time)?.label ?? (time === 'week' ? 'This week' : 'All time'));
  if (f.from === 'connections') parts.push('Connections only');
  for (const s of f.state) parts.push(STATE_WORDS[s]);
  if (f.fresh) parts.push('New since your last visit');
  return parts.join(' · ');
}

const store = {
  read(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  write(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* a private window or blocked storage: the choice lasts this visit only */
    }
  },
};

/**
 * The filters and the When, kept on this device for this person, and the time they last opened Pulse here (read once,
 * then this visit is written as the next "last visit").
 */
export function useKeptFilters(account: string | null, time: MapTime, setTime: (t: MapTime) => void) {
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [since, setSince] = useState<string | null>(null);
  // Whose kept choice has been read: the list and the map wait for it, so the tab's first reads already carry it.
  const [readFor, setReadFor] = useState<string | null>(null);
  const loaded = useRef<string | null>(null);
  useEffect(() => {
    if (!account || loaded.current === account) return;
    loaded.current = account;
    const last = store.read(`pantopus.pulse.visit.${account}`);
    const lastVisit = last && Number.isFinite(Date.parse(last)) ? last : null;
    try {
      const kept = JSON.parse(store.read(`pantopus.pulse.filters.${account}`) || 'null') as Partial<Filters & { time: MapTime }> | null;
      if (kept && typeof kept === 'object') {
        setFilters({
          kinds: Array.isArray(kept.kinds) ? kept.kinds.filter(isKind) : [],
          from: kept.from === 'connections' ? 'connections' : 'everyone',
          state: Array.isArray(kept.state) ? kept.state.filter((s): s is FilterState => s === 'unanswered' || s === 'room') : [],
          // "New since your last visit" is on only while a last visit is kept here (it sends that time as `since`).
          fresh: kept.fresh === true && !!lastVisit,
        });
        if (kept.time && TIMES.includes(kept.time)) setTime(kept.time);
      }
    } catch {
      /* nothing kept, or unreadable: no filters */
    }
    setSince(lastVisit);
    store.write(`pantopus.pulse.visit.${account}`, new Date().toISOString());
    setReadFor(account);
  }, [account, setTime]);
  useEffect(() => {
    if (!account || loaded.current !== account) return;
    store.write(`pantopus.pulse.filters.${account}`, JSON.stringify({ ...filters, time }));
  }, [account, filters, time]);
  return { filters, setFilters, since, ready: !!account && readFor === account };
}

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** The one row: Filters (with its count), then the kinds this place has as quick taps; and the plain line under it. */
export function FilterRow({
  filters,
  time,
  chips,
  hidden,
  onFilters,
  onClear,
  onOpen,
}: {
  filters: Filters;
  time: MapTime;
  /** The kinds the server says this place has (its first page's `chips`). */
  chips: Chip[];
  /** The list scrolled down: the row steps aside until it scrolls up. */
  hidden: boolean;
  onFilters(f: Filters): void;
  onClear(): void;
  onOpen(): void;
}) {
  const count = filterCount(filters, time);
  // The quick taps: the place's kinds, and any kind already on (so it can be taken off here too).
  const quick = KINDS.filter((k) => chips.includes(k) || filters.kinds.includes(k));
  const words = filterWords(filters, time);
  return (
    <div className="rp-filters" data-hidden={hidden || undefined}>
      <div className="rp-chips" role="group" aria-label="Show">
        <button type="button" className="rp-filter-button" aria-haspopup="dialog" data-on={count > 0 || undefined} onClick={onOpen}>
          <SlidersHorizontal size={15} aria-hidden />
          Filters
          {count > 0 && <span className="rp-filter-count">{count}</span>}
        </button>
        {quick.map((k) => (
          <button
            key={k}
            type="button"
            aria-pressed={filters.kinds.includes(k)}
            onClick={() => onFilters({ ...filters, kinds: toggle(filters.kinds, k) })}
          >
            {CHIP_WORDS[k]}
          </button>
        ))}
      </div>
      {words && (
        <p className="rp-filter-line">
          <span>{words}</span>
          <button type="button" onClick={onClear}>
            Clear
          </button>
        </p>
      )}
    </div>
  );
}

/** The sheet from the bottom: What (several at once), When, From, State. */
export function FilterSheet({
  filters,
  time,
  since,
  onFilters,
  onTime,
  onClose,
}: {
  filters: Filters;
  time: MapTime;
  since: string | null;
  onFilters(f: Filters): void;
  onTime(t: MapTime): void;
  onClose(): void;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  useEffect(() => {
    sheet.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  const chip = (on: boolean, label: string, act: () => void, disabled = false) => (
    <button key={label} type="button" aria-pressed={on} disabled={disabled} onClick={act}>
      <span>{label}</span>
    </button>
  );
  return (
    <>
      <div className="rp-filter-scrim" aria-hidden onClick={onClose} />
      <div ref={sheet} className="rp-filter-sheet" role="dialog" aria-modal="true" aria-label="Filters" tabIndex={-1}>
        <header>
          <h2>Filters</h2>
          <button type="button" className="rp-filter-close" aria-label="Close filters" onClick={onClose}>
            <X size={18} aria-hidden />
          </button>
        </header>
        <section role="group" aria-label="What">
          <h3>What</h3>
          <div className="rp-filter-chips">
            {KINDS.map((k) => chip(filters.kinds.includes(k), CHIP_WORDS[k], () => onFilters({ ...filters, kinds: toggle(filters.kinds, k) })))}
          </div>
        </section>
        <section role="group" aria-label="When">
          <h3>When</h3>
          <div className="rp-filter-chips">{WHENS.map((w) => chip(time === w.time, w.label, () => onTime(w.time)))}</div>
        </section>
        <section role="group" aria-label="From">
          <h3>From</h3>
          <div className="rp-filter-chips">
            {chip(filters.from === 'everyone', 'Everyone', () => onFilters({ ...filters, from: 'everyone' }))}
            {chip(filters.from === 'connections', 'Connections only', () => onFilters({ ...filters, from: 'connections' }))}
          </div>
        </section>
        <section role="group" aria-label="State">
          <h3>State</h3>
          <div className="rp-filter-chips">
            {chip(filters.state.includes('unanswered'), STATE_WORDS.unanswered, () => onFilters({ ...filters, state: toggle(filters.state, 'unanswered') }))}
            {chip(filters.state.includes('room'), STATE_WORDS.room, () => onFilters({ ...filters, state: toggle(filters.state, 'room') }))}
            {chip(filters.fresh, 'New since your last visit', () => onFilters({ ...filters, fresh: !filters.fresh }), !since && !filters.fresh)}
          </div>
          {!since && <small>This is your first visit on this device, so everything is new.</small>}
        </section>
        <footer>
          <button
            type="button"
            className="rp-button rp-button-quiet"
            disabled={!filterCount(filters, time)}
            onClick={() => {
              onFilters(NO_FILTERS);
              onTime('live');
            }}
          >
            Clear all
          </button>
          <button type="button" className="rp-button" onClick={onClose}>
            Show results
          </button>
        </footer>
      </div>
    </>
  );
}
