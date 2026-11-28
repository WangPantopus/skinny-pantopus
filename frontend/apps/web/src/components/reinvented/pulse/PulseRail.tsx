'use client';

// The rail of small round buttons down the map's right edge (Pulse, reinvented, PHASE-6 A2): Filters (a dot with the count
// when any is on), When (the time row's choice in one or two letters), Listen, and My place. A tap opens that control as a
// small card beside its button. It replaces the chips row, the time row, the Ask bar and the Listen button that sat over
// the top of the map. The board fades it to 40% while the map moves (pulse.css, `data-moving`).

import { useEffect, useRef, useState } from 'react';
import { Headphones, LocateFixed, SlidersHorizontal } from 'lucide-react';
import { TimeRow } from './MapDeck';
import { MAP_TIME_WORDS, type MapTime } from './listApi';

const WHEN_SHORT: Record<MapTime, string> = { live: 'Now', today: 'Td', tonight: 'Tn', week: 'Wk', weekend: 'We', all: 'All' };

interface Props {
  /** How many filters are on (the When included when it isn't Now). */
  count: number;
  time: MapTime;
  onTime(t: MapTime): void;
  /** Absent where the filters don't apply (Explore, Atlas). */
  onFilters?(): void;
  /** Listen to the town (CONTRACT 9g); absent where the map has no place sounds (Explore, Atlas). */
  listen?: { on: boolean; note: string | null; toggle(): void };
  /** When, absent where the map has no time row (Explore). */
  showWhen: boolean;
  onMyPlace(): void;
  locating: boolean;
}

export default function PulseRail({ count, time, onTime, onFilters, listen, showWhen, onMyPlace, locating }: Props) {
  const [open, setOpen] = useState<'when' | null>(null);
  const rail = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return undefined;
    const away = (e: PointerEvent) => {
      if (!rail.current?.contains(e.target as Node)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', key);
    };
  }, [open]);

  return (
    <div ref={rail} className="rp-rail" role="toolbar" aria-label="Map controls" aria-orientation="vertical">
      {onFilters && (
        <div className="rp-rail-item">
          <button type="button" className="rp-rail-button" aria-haspopup="dialog" aria-label={count ? `Filters, ${count} on` : 'Filters'} title="Filters" onClick={onFilters}>
            <SlidersHorizontal size={18} aria-hidden />
            {count > 0 && (
              <span className="rp-rail-dot" aria-hidden>
                {count}
              </span>
            )}
          </button>
        </div>
      )}
      {showWhen && (
        <div className="rp-rail-item">
          <button
            type="button"
            className="rp-rail-button rp-rail-when"
            aria-haspopup="true"
            aria-expanded={open === 'when'}
            aria-label={`When: ${MAP_TIME_WORDS[time]}`}
            title={`When: ${MAP_TIME_WORDS[time]}`}
            data-on={time !== 'live' || undefined}
            onClick={() => setOpen((o) => (o === 'when' ? null : 'when'))}
          >
            {WHEN_SHORT[time]}
          </button>
          {open === 'when' && (
            <div className="rp-rail-card rp-rail-card-when">
              <TimeRow
                time={time}
                onTime={(t) => {
                  onTime(t);
                  setOpen(null);
                }}
              />
            </div>
          )}
        </div>
      )}
      {listen && (
        <div className="rp-rail-item">
          <button
            type="button"
            className="rp-rail-button"
            aria-pressed={listen.on}
            aria-label={listen.on ? 'Listening to the town' : 'Listen to the town'}
            title={listen.on ? 'Listening' : 'Listen to the town'}
            data-on={listen.on || undefined}
            onClick={listen.toggle}
          >
            <Headphones size={18} aria-hidden />
          </button>
          {listen.on && listen.note && (
            <p className="rp-rail-card rp-rail-note" role="status">
              {listen.note}
            </p>
          )}
        </div>
      )}
      <div className="rp-rail-item">
        <button type="button" className="rp-rail-button" aria-label="My place" title="My place" aria-busy={locating || undefined} onClick={onMyPlace}>
          <LocateFixed size={18} aria-hidden />
        </button>
      </div>
    </div>
  );
}
