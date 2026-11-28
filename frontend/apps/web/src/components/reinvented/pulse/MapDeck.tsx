'use client';

// Under the one map (phase 1, board B4): the time row (back: All time, This week, Today; Live; forward: Tonight, This
// weekend) and, at the Map height, the peek deck: one card per pin, swiped with one thumb while the map glides from pin
// to pin.

import { useEffect, useRef } from 'react';
import { useMouseDragScroll } from './mouseDragScroll';
import { MomentFace } from '@/components/moments/MomentFace';
import { colors } from '@/components/moments/momentState';
import { statusLine } from './PostRow';
import { MAP_TIMES, MAP_TIME_WORDS, ticketWhen, type MapTime } from './listApi';
import type { Pin } from './pins';

export function TimeRow({ time, onTime }: { time: MapTime; onTime(t: MapTime): void }) {
  // A mouse drags the strip sideways and a plain wheel scrolls it sideways too (LEAD-8's look, 10:3x: only a sideways wheel
  // moved it); a finger keeps the browser's own scrolling.
  const { ref: row, onPointerDown, onClickCapture } = useMouseDragScroll<HTMLDivElement>();
  useEffect(() => {
    const r = row.current;
    if (!r) return undefined;
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX) || r.scrollWidth <= r.clientWidth) return;
      const before = r.scrollLeft;
      r.scrollLeft += e.deltaY;
      if (r.scrollLeft !== before) e.preventDefault();
    };
    r.addEventListener('wheel', wheel, { passive: false });
    return () => r.removeEventListener('wheel', wheel);
  }, [row]);
  // The chosen time stays in sight on a narrow row (Live sits in the middle of it).
  useEffect(() => {
    const r = row.current, on = r?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!r || !on || r.scrollWidth <= r.clientWidth) return;
    const a = on.getBoundingClientRect(), b = r.getBoundingClientRect();
    r.scrollLeft += a.left + a.width / 2 - (b.left + b.width / 2);
  }, [time, row]);
  return (
    <div ref={row} className="rp-time" role="group" aria-label="When" onPointerDown={onPointerDown} onClickCapture={onClickCapture}>
      {MAP_TIMES.map((t) => (
        <button key={t} type="button" aria-pressed={time === t} onClick={() => onTime(t)}>
          {t === 'live' && <span className="rp-live-dot" aria-hidden />}
          {MAP_TIME_WORDS[t]}
        </button>
      ))}
    </div>
  );
}

function Card({ pin, now }: { pin: Pin; now: number }) {
  if (pin.type === 'kept' || pin.type === 'explore') {
    const m = pin.moment;
    const src = m.kind === 'video' ? m.poster_url : m.kind === 'photo' ? m.media_url : null;
    return (
      <>
        <span className="rp-card-thumb" style={src ? undefined : { background: colors[m.background || 'teal'] }}>
          {src && <img src={src} alt="" loading="lazy" />}
        </span>
        <span className="rp-card-words">
          <strong>
            {pin.type === 'explore'
              ? m.author.name
              : new Date(m.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </strong>
          {m.place_label && <span className="rp-card-line">{m.place_label}</span>}
          {m.caption && <span className="rp-card-line">{m.caption}</span>}
        </span>
      </>
    );
  }
  if (pin.type === 'ring') {
    const r = pin.ring;
    const live = Date.parse(r.live_until || '') > now;
    const preview = r.preview;
    return (
      <>
        <span className="rp-card-thumb" style={preview?.kind === 'text' || !preview?.thumb_url ? { background: colors[preview?.background || 'teal'] } : undefined}>
          {preview?.thumb_url ? <img src={preview.thumb_url} alt="" loading="lazy" /> : <MomentFace author={r.author} />}
        </span>
        <span className="rp-card-words">
          <strong>{r.author.name}</strong>
          {r.place_label && <span className="rp-card-line">{r.place_label}</span>}
          <span className="rp-card-tags">
            {live && <span className="rp-card-tag rp-card-live">Live</span>}
            <span className="rp-card-tag">
              {r.moments.length === 1 ? '1 Moment' : `${r.moments.length} Moments`}
              {r.unseen_count > 0 ? ` · ${r.unseen_count} new` : ''}
            </span>
          </span>
        </span>
      </>
    );
  }
  if (pin.type === 'mark') {
    const post = pin.mark.post;
    const status = pin.mark.heads_up ? { words: 'Heads-up', tone: 'alert' } : statusLine(post);
    const words = (post.title || post.content || '').trim();
    return (
      <span className="rp-card-words rp-card-wide">
        {status && (
          <span className="rp-status" data-tone={status.tone}>
            {status.words}
          </span>
        )}
        <strong className="rp-card-clamp">{words || 'Post'}</strong>
        {post.location_name && <span className="rp-card-line">{post.location_name}</span>}
      </span>
    );
  }
  const t = pin.ticket;
  return (
    <span className="rp-card-words rp-card-wide">
      <span className="rp-status" data-tone="plan">
        Plan · {ticketWhen(t, now)}
      </span>
      <strong className="rp-card-clamp">{t.title}</strong>
      <span className="rp-card-line">
        {[t.area_label, t.going_count ? `${t.going_count} going` : null, t.is_full ? 'Full' : t.spots_left ? `${t.spots_left} spots left` : null]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </span>
  );
}

/**
 * The peek deck. The card in the middle is the chosen one: swiping to another chooses it (the map follows), choosing
 * a pin on the map brings its card here, and a tap on a card opens it.
 */
export function PeekDeck({
  pins,
  selected,
  now,
  onSelect,
  onOpen,
}: {
  pins: Pin[];
  selected: string | null;
  now: number;
  onSelect(key: string): void;
  onOpen(pin: Pin): void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const settle = useRef(0);
  const latest = useRef({ selected, onSelect });
  latest.current = { selected, onSelect };

  // A pin chosen on the map: bring its card to the middle.
  useEffect(() => {
    const el = selected ? row.current?.querySelector<HTMLElement>(`[data-card="${CSS.escape(selected)}"]`) : null;
    if (!el || !row.current) return;
    const box = row.current.getBoundingClientRect(), card = el.getBoundingClientRect();
    if (Math.abs(card.left + card.width / 2 - (box.left + box.width / 2)) > 4)
      el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selected]);

  const onScroll = () => {
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const r = row.current;
      if (!r) return;
      const mid = r.getBoundingClientRect().left + r.clientWidth / 2;
      let best: { key: string; d: number } | null = null;
      r.querySelectorAll<HTMLElement>('[data-card]').forEach((el) => {
        const b = el.getBoundingClientRect();
        const d = Math.abs(b.left + b.width / 2 - mid);
        if (!best || d < best.d) best = { key: el.dataset.card!, d };
      });
      const chosen = best as { key: string; d: number } | null;
      if (chosen && chosen.key !== latest.current.selected) latest.current.onSelect(chosen.key);
    }, 140);
  };
  useEffect(() => () => window.clearTimeout(settle.current), []);

  if (!pins.length) return <p className="rp-deck-empty">Nothing on the map here for this time. Move the map, or pick another time.</p>;
  return (
    <div ref={row} className="rp-deck" onScroll={onScroll} aria-label="On the map">
      {pins.map((pin) => (
        <button
          key={pin.key}
          type="button"
          data-card={pin.key}
          aria-current={pin.key === selected || undefined}
          className="rp-card"
          onClick={() => {
            if (pin.key !== selected) onSelect(pin.key);
            onOpen(pin);
          }}
        >
          <Card pin={pin} now={now} />
        </button>
      ))}
    </div>
  );
}
