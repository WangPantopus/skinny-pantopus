'use client';

// Alive right now (Pulse, reinvented, phase 1, board B1): a strip of tall previews over the list. Live from here Moments
// with their weather, plans starting soon, and a ring for each person you know with a live Moment
// (GET /api/reinvented/strip, coord/CONTRACT.md §6c). Convergences join in phase 3.

import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { Ring } from '@pantopus/api/endpoints/moments';
import { MomentFace } from '@/components/moments/MomentFace';
import { colors } from '@/components/moments/momentState';
import { startsIn, type ListMoment, type MapTicket, type StripData } from './listApi';

interface Props {
  strip: StripData;
  bandLabel(band: string | null): string | null;
  now: number;
  onMoments(ids: string[], start: string): void;
  onPlan(t: MapTicket): void;
}

function LiveCard({ moment: m, band, onOpen }: { moment: ListMoment; band: string | null; onOpen(): void }) {
  const picture = m.kind === 'video' ? m.poster_url : m.kind === 'photo' ? m.media_url : null;
  const temp = m.weather && typeof m.weather.temp_f === 'number' ? ` · ${Math.round(m.weather.temp_f)}°F` : '';
  return (
    <button
      type="button"
      className="rp-alive-card rp-alive-live"
      style={!picture ? { background: colors[m.background || 'teal'] } : undefined}
      onClick={onOpen}
      aria-label={`${m.author.name}, live from here${temp ? `, ${Math.round(m.weather!.temp_f)} degrees` : ''}${m.place_label ? `, ${m.place_label}` : ''}`}
    >
      {picture ? <img src={picture} alt="" loading="lazy" /> : m.kind === 'text' ? <span className="rp-alive-text">{m.text}</span> : null}
      <span className="rp-alive-pill">
        <span className="rp-live-dot" aria-hidden />
        Live{temp}
      </span>
      <span className="rp-alive-foot">
        <strong>{m.author.name}</strong>
        <span>{[m.place_label, band].filter(Boolean).join(' · ')}</span>
      </span>
    </button>
  );
}

function PlanCard({ ticket: t, now, onOpen }: { ticket: MapTicket; now: number; onOpen(): void }) {
  const when = startsIn(t, now);
  return (
    <button type="button" className="rp-alive-card rp-alive-plan" onClick={onOpen} aria-label={`Plan ${when}: ${t.title}`}>
      <span className="rp-alive-plan-when">Plan · {when}</span>
      <strong>{t.title}</strong>
      <span className="rp-alive-plan-line">
        {t.going_count ? `${t.going_count} going` : t.spots_left ? `${t.spots_left} spots left` : t.area_label || ''}
      </span>
    </button>
  );
}

function PersonRing({ ring, onOpen }: { ring: Ring; onOpen(): void }) {
  return (
    <button type="button" className="rp-alive-person" onClick={onOpen} aria-label={`${ring.author.name}’s Moments${ring.unseen_count ? `, ${ring.unseen_count} new` : ''}`}>
      <MomentFace author={ring.author} fresh={ring.unseen_count > 0} segments={ring.moments.length} />
      <span>{ring.author.name.split(' ')[0]}</span>
    </button>
  );
}

/**
 * A mouse drags the strip sideways as a finger does (LEAD-7's look, 08:39: a sideways wheel and a finger scrolled it, a mouse
 * drag did nothing). Only a clearly sideways drag of a mouse; a tap stays the card's own, and the click that ends a drag opens
 * nothing. A finger and a pen keep the browser's own scrolling.
 */
function useMouseDragScroll() {
  const row = useRef<HTMLDivElement>(null);
  const dragged = useRef(false);
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = row.current;
    if (e.pointerType !== 'mouse' || e.button !== 0 || !el || el.scrollWidth <= el.clientWidth) return;
    const id = e.pointerId,
      x0 = e.clientX,
      y0 = e.clientY,
      left0 = el.scrollLeft;
    let on = false;
    dragged.current = false;
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      const dx = ev.clientX - x0;
      if (!on && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(ev.clientY - y0)) on = dragged.current = true;
      if (on) {
        ev.preventDefault();
        el.scrollLeft = left0 - dx;
      }
    };
    const end = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };
  const onClickCapture = (e: ReactMouseEvent) => {
    if (!dragged.current) return;
    dragged.current = false;
    e.preventDefault();
    e.stopPropagation();
  };
  return { ref: row, onPointerDown, onClickCapture };
}

export default function AliveStrip({ strip, bandLabel, now, onMoments, onPlan }: Props) {
  const { ref: rowRef, onPointerDown, onClickCapture } = useMouseDragScroll();
  const live = strip.live_here || [];
  const plans = strip.plans_soon || [];
  const people = strip.people || [];
  if (!live.length && !plans.length && !people.length) return null;
  const liveIds = live.map((l) => l.moment.id);
  return (
    <section className="rp-alive" aria-label="Alive right now">
      <h2 className="rp-alive-title">Alive right now</h2>
      <div className="rp-alive-row" ref={rowRef} onPointerDown={onPointerDown} onClickCapture={onClickCapture}>
        {people.map((ring) => (
          <PersonRing
            key={`p:${ring.id}`}
            ring={ring}
            onOpen={() => {
              const ids = ring.moments.map((m) => m.id);
              if (ids.length) onMoments(ids, ring.moments.find((m) => !m.seen)?.id || ids[0]);
            }}
          />
        ))}
        {live.map((l) => (
          <LiveCard key={`l:${l.moment.id}`} moment={l.moment} band={bandLabel(l.band)} onOpen={() => onMoments(liveIds, l.moment.id)} />
        ))}
        {plans.map((t) => (
          <PlanCard key={`t:${t.id}`} ticket={t} now={now} onOpen={() => onPlan(t)} />
        ))}
      </div>
    </section>
  );
}
