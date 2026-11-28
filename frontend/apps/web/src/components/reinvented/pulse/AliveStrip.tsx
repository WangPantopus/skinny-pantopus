'use client';

// Alive right now (Pulse, reinvented, phase 1, board B1): a strip of tall previews over the list. Live from here Moments
// with their weather, plans starting soon, and a ring for each person you know with a live Moment
// (GET /api/reinvented/strip, coord/CONTRACT.md §6c). Convergences join in phase 3.

import type { Ring } from '@pantopus/api/endpoints/moments';
import { MomentFace } from '@/components/moments/MomentFace';
import { colors } from '@/components/moments/momentState';
import { startsIn, type ListMoment, type MapTicket, type StripData } from './listApi';
import { useMouseDragScroll } from './mouseDragScroll';

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

export default function AliveStrip({ strip, bandLabel, now, onMoments, onPlan }: Props) {
  const { ref: rowRef, onPointerDown, onClickCapture } = useMouseDragScroll<HTMLDivElement>();
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
