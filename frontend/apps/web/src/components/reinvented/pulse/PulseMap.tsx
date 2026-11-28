'use client';

// The one map behind the Pulse list (phase 1, board B4, flat). It draws its own read for the box in view and the time
// row's choice (GET /api/reinvented/map, coord/CONTRACT.md §6b), each at the point everyone sees: a ring is a Moment,
// a mark on the ground is a post that stays, a ticket is a plan, and a Heads-up is red, pulsing and always on top.
// Before its first read it fits the list's first page, so one request still draws the first screen.
// The living map (phase 4, board B4; `float_on` and `heights_on` from the read, as on today's Moments map): a Moment with
// a height floats at it, with a sun-true shadow by day and as a lantern on a thread after sunset; a Moment shown as an
// area is a soft cloud; plans glow as beacons; night falls on the map when it falls there; live beams (CONTRACT 9h)
// cross where several people were looking.
// The map is a globe zoomed all the way out, as today's maps are (Mapbox GL, pulseMapEngine.ts), or the flat Leaflet map
// where the globe can't load. Leaflet touches `window` at import: this file is loaded with next/dynamic and `ssr: false` only.

import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import { MAP_PUBLIC_TOKEN } from '@/components/map/constants';
import { colors } from '@/components/moments/momentState';
import { ticketWhen, type Box, type ListItem, type Point } from './listApi';
import type { Pin } from './pins';
import { liftOf, lightOf, nightOf, shadowOf, sunPosition, type Beam, type PlaceSound, type Sun } from './mapLight';
import type { Lit } from './AskTheMap';
import { globePossible, openFlat, openGlobe, type Mark, type MapEngine, type Spot } from './pulseMapEngine';
import './sky.css';

export interface FlyTarget extends Point {
  serial: number;
  /** Pan without zooming in (the peek deck gliding from pin to pin). */
  keepZoom?: boolean;
}

interface Props {
  pins: Pin[];
  /** The list's first page, for the map's first view only. */
  listItems: ListItem[];
  /** Changes when the list is read afresh (reach, chip, place): the map fits the list once more. */
  fitKey: string;
  /** Where to look when nothing in the list has a point: the person's home. */
  fallback: Point | null;
  /** Changes when the list's height or the layout changes: the map keeps what was in view centred in the part left open. */
  layoutKey: string;
  flyTo: FlyTarget | null;
  selected: string | null;
  /** The box in view (the map's own reads) and the box of the part left open by the top line and the list (the list's). */
  onBox(box: Box, open: Box): void;
  onPick(key: string): void;
  /** Heights and floating are on for this reader (the read's `heights_on` and `float_on`). */
  float?: boolean;
  /** Live beams in the box (CONTRACT 9h). */
  beams?: Beam[];
  /** Ask the map (CONTRACT 9b): these pins light up with the words they matched; the rest dim. */
  lit?: Lit | null;
  /** Listen to the town (CONTRACT 9g): the place sounds in view, heard by moving across the map. */
  sounds?: PlaceSound[] | null;
  /** The map started moving (true) and came to rest (false): the rail fades meanwhile (PHASE-6 A2). */
  onMoving?(moving: boolean): void;
  /**
   * Back from a page opened from here (PHASE-6 G): the view the person left. While it is given, the map shows it instead of
   * fitting the list, once.
   */
  restore?: MapView | null;
  /** Filled with a reader of the view now, so the page can keep it before it opens another page. */
  view?: MutableRefObject<(() => MapView | null) | null>;
}

export interface MapView {
  center: Point;
  zoom: number;
}

// How near, in pixels, the pointer must come to a place sound to hear it; it is louder nearer.
const HEAR_PX = 80;

/** What the sky does to a ring: its height and the sun over the map. */
interface Sky {
  float: boolean;
  sun: Sun | null;
}

/** A ring with a height floats at it; one shown as an area is a cloud over it. Shadows by day, lanterns by night. */
function floatRing(el: HTMLElement, ring: { altitude_ft?: number | null; flying?: boolean; floating?: boolean }, sky: Sky) {
  if (!sky.float) return;
  if (ring.floating) el.classList.add('rp-ring-cloud');
  const height = ring.altitude_ft;
  if (height == null || !Number.isFinite(height)) return;
  const lift = liftOf(height, !!ring.flying);
  const day = (sky.sun?.elevation_deg ?? 30) > 0;
  el.classList.add(day ? 'rp-ring-float' : 'rp-ring-lantern');
  el.style.setProperty('--rp-lift', `${Math.round(6 + 26 * lift)}px`);
  if (day && sky.sun) {
    const shadow = shadowOf(sky.sun, lift);
    el.style.setProperty('--rp-sun-x', `${shadow.x.toFixed(1)}px`);
    el.style.setProperty('--rp-sun-y', `${shadow.y.toFixed(1)}px`);
  }
  const ground = document.createElement('span');
  ground.className = 'rp-ring-ground';
  ground.setAttribute('aria-hidden', 'true');
  el.prepend(ground);
  const meter = document.createElement('span');
  meter.className = 'rp-ring-height';
  meter.textContent = `${ring.floating ? '≈ ' : ''}${ring.flying ? '✈ ' : ''}${Math.round(height).toLocaleString('en-US')} ft`;
  el.appendChild(meter);
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);

/** The point everyone sees, as the list sent it; null for a Moment with no place. */
export function itemPoint(item: ListItem): Point | null {
  if (item.type === 'moment') {
    const m = item.moment;
    if (m.no_location) return null;
    const lat = num(m.latitude), lng = num(m.longitude);
    return lat === null || lng === null ? null : { latitude: lat, longitude: lng };
  }
  const p = item.post as unknown as Record<string, unknown>;
  const lat = num(p.effective_latitude) ?? num(p.latitude), lng = num(p.effective_longitude) ?? num(p.longitude);
  return lat === null || lng === null ? null : { latitude: lat, longitude: lng };
}

const TICKET_PATH = 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4z';

function pinElement(pin: Pin, now: number, sky: Sky): { el: HTMLElement; size: [number, number] | null } {
  if (pin.type === 'ring') {
    const r = pin.ring;
    const el = document.createElement('span');
    const live = Date.parse(r.live_until || '') > now;
    el.className = 'rp-ring' + (live ? ' rp-ring-live' : r.unseen_count > 0 ? '' : ' rp-ring-seen');
    const inner = document.createElement('span');
    inner.className = 'rp-ring-face';
    if (r.author.avatar_url) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = r.author.avatar_url;
      img.onerror = () => {
        img.remove();
        inner.textContent = r.author.initials || '';
      };
      inner.appendChild(img);
    } else inner.textContent = r.author.initials || '';
    el.appendChild(inner);
    if (live) {
      const tag = document.createElement('span');
      tag.className = 'rp-ring-tag';
      tag.textContent = 'Live';
      el.appendChild(tag);
    }
    floatRing(el, r, sky);
    return { el, size: [44, 44] };
  }
  if (pin.type === 'kept' || pin.type === 'explore') {
    const m = pin.moment;
    const el = document.createElement('span');
    el.className = 'rp-ring rp-ring-kept';
    const inner = document.createElement('span');
    inner.className = 'rp-ring-face';
    const src = m.kind === 'video' ? m.poster_url : m.kind === 'photo' ? m.media_url : null;
    if (src) {
      const img = document.createElement('img');
      img.alt = '';
      img.src = src;
      inner.appendChild(img);
    } else inner.style.background = colors[m.background || 'teal'];
    el.appendChild(inner);
    return { el, size: [44, 44] };
  }
  if (pin.type === 'mark') {
    const el = document.createElement('span');
    const headsUp = pin.mark.heads_up;
    el.className = 'rp-mark' + (headsUp ? ' rp-mark-heads-up' : '');
    el.dataset.kind = String(pin.mark.post.post_type || 'general');
    el.textContent = headsUp ? '!' : '';
    return { el, size: headsUp ? [34, 34] : [18, 18] };
  }
  const t = pin.ticket;
  const el = document.createElement('span');
  el.className = 'rp-ticket' + (sky.float ? ' rp-ticket-beacon' : '');
  el.innerHTML = `<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="${TICKET_PATH}"/></svg>`;
  const words = document.createElement('span');
  const going = t.going_count ? ` · ${t.going_count} going` : '';
  words.textContent = `${ticketWhen(t, now)}${going}`;
  el.appendChild(words);
  return { el, size: null };
}

function pinTitle(pin: Pin): string {
  if (pin.type === 'kept') return 'Your Moment';
  if (pin.type === 'explore') return `${pin.moment.author.name}’s Moment`;
  if (pin.type === 'ring') return `${pin.ring.author.name}’s Moments`;
  if (pin.type === 'mark') return pin.mark.heads_up ? 'Heads-up' : pin.mark.post.title || 'Post';
  return `Plan: ${pin.ticket.title}`;
}

interface Cover {
  top: number;
  bottom: number;
  left: number;
}

/**
 * How far the top line over the map, the sheet over its bottom (a phone's width) and the floating panel over its left (a
 * wide screen, PHASE-6 E) reach into it, in pixels: the map counts only the part left open.
 */
function coveredInsets(mapEl: HTMLElement | null): Cover {
  const board = mapEl?.closest('.rp-board');
  if (!mapEl || !board) return { top: 0, bottom: 0, left: 0 };
  const m = mapEl.getBoundingClientRect();
  const overlaps = (r: DOMRect) => r.width > 0 && r.left < m.right - 1 && r.right > m.left + 1;
  let top = 0, bottom = 0, left = 0;
  const above = board.querySelector('.rp-top');
  if (above) {
    const r = above.getBoundingClientRect();
    if (overlaps(r)) top = Math.max(0, Math.min(m.height, r.bottom - m.top));
  }
  const sheet = board.querySelector<HTMLElement>('.rp-sheet');
  if (sheet) {
    const r = sheet.getBoundingClientRect();
    if (sheet.dataset.wide !== undefined) {
      if (overlaps(r)) left = Math.max(0, Math.min(m.width, r.right - m.left));
    } else if (overlaps(r) && r.top < m.bottom) bottom = Math.max(0, Math.min(m.height, m.bottom - r.top));
  }
  return { top, bottom, left };
}

export default function PulseMap({ pins, listItems, fitKey, fallback, layoutKey, flyTo, selected, onBox, onPick, float = false, beams, lit = null, sounds = null, onMoving, restore = null, view }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  // The globe where it can load, else the flat map (also when the globe's basemap errors or is slow).
  const [flat, setFlat] = useState(() => !globePossible());
  const [map, setMap] = useState<MapEngine | null>(null);
  const mapNow = useRef<MapEngine | null>(null);
  mapNow.current = map;
  // The sun over the map's centre, read again as the map moves and every minute.
  const [sun, setSun] = useState<Sun | null>(null);
  const elements = useRef(new Map<string, HTMLElement>());
  const fitted = useRef<string | null>(null);
  const latest = useRef({ onPick, onBox, selected, onMoving });
  latest.current = { onPick, onBox, selected, onMoving };
  const insets = useRef<Cover>({ top: 0, bottom: 0, left: 0 });
  const [tilesMissing, setTilesMissing] = useState(!MAP_PUBLIC_TOKEN);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let active = true,
      engine: MapEngine | null = null,
      clock = 0,
      timer = 0,
      relight: (() => void) | null = null;
    const resize = new ResizeObserver(() => engine?.resize());
    // PHASE-5 D: the map is dark while the browser is set to dark, or where it is night where the map is looking; bright
    // otherwise. It turns at once when the browser's setting changes.
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const onDark = () => relight?.();
    dark.addEventListener('change', onDark);
    const start = (m: MapEngine) => {
      engine = m;
      const light = () => {
        const c = m.center();
        const next = sunPosition(c.latitude, c.longitude);
        // The globe takes the basemap's own light; the flat map's tiles are dimmed (fully while the browser is dark).
        el.style.setProperty('--rp-night', (dark.matches ? 1 : nightOf(next)).toFixed(2));
        m.light(lightOf(next, dark.matches));
        // A new sun only when it moved enough to change a shadow, so the pins aren't drawn again each minute.
        setSun((prev) =>
          prev && Math.abs(prev.azimuth_deg - next.azimuth_deg) < 3 && Math.abs(prev.elevation_deg - next.elevation_deg) < 1.5 && prev.elevation_deg > 0 === next.elevation_deg > 0
            ? prev
            : next,
        );
      };
      m.onSettled(light);
      clock = window.setInterval(light, 60_000);
      relight = light;
      light();
      // The box in view, once the map has its first view; the map reads it again after each move.
      m.onMoveStart(() => latest.current.onMoving?.(true));
      m.onSettled(() => {
        latest.current.onMoving?.(false);
        if (!fitted.current) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => latest.current.onBox(m.box(), m.openBox({ ...coveredInsets(el), right: 0 })), 250);
      });
      resize.observe(el);
      // A fresh map fits the list again.
      fitted.current = null;
      setMap(m);
    };
    if (flat) start(openFlat(el, setTilesMissing));
    else
      // Its first light from the sun where it opens (the first fit then moves it and the light follows).
      openGlobe(el, () => active && setFlat(true), lightOf(sunPosition(39.5, -98.35), dark.matches))
        .then((m) => {
          if (!active) m?.remove();
          else if (m) start(m);
          else setFlat(true);
        })
        .catch(() => active && setFlat(true));
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.clearInterval(clock);
      resize.disconnect();
      dark.removeEventListener('change', onDark);
      engine?.remove();
      setMap(null);
    };
  }, [flat]);

  // The page can read the view now (to come Back to it).
  useEffect(() => {
    if (!view) return undefined;
    view.current = () => (mapNow.current ? { center: mapNow.current.center(), zoom: mapNow.current.zoom() } : null);
    return () => {
      view.current = null;
    };
  }, [view]);

  // Back to a view the person left: shown once, and no fit while it is given.
  const restored = useRef(false);
  useEffect(() => {
    if (!map || !restore) return;
    fitted.current = fitKey;
    if (restored.current) return;
    restored.current = true;
    insets.current = coveredInsets(ref.current);
    map.show(restore.center, restore.zoom);
    map.settle();
  }, [map, restore, fitKey]);

  // The first view: the list's points (or home), once per fresh list.
  useEffect(() => {
    if (!map || restore || fitted.current === fitKey) return;
    const points = listItems.map(itemPoint).filter((p): p is Point => !!p);
    if (!points.length && !fallback && !listItems.length) return;
    fitted.current = fitKey;
    const cover = (insets.current = coveredInsets(ref.current));
    if (points.length) {
      map.fit(points, { top: 40 + Math.round(cover.top), bottom: 40 + Math.round(cover.bottom), side: 40, left: Math.round(cover.left) }, 14);
    } else if (fallback) {
      map.show(fallback, 12);
      map.panBy(-cover.left / 2, (cover.bottom - cover.top) / 2);
    }
    map.settle();
  }, [map, listItems, fitKey, fallback, restore]);

  // The pins: tickets under marks under rings, and Heads-ups over everything.
  useEffect(() => {
    if (!map) return;
    const marks: Mark[] = [];
    elements.current.clear();
    const now = Date.now();
    const sky: Sky = { float, sun };
    // Ask the map: dim the rest only when something drawn is lit.
    const lighting = !!lit && pins.some((p) => lit.pins.has(p.key));
    for (const pin of pins) {
      const { el, size } = pinElement(pin, now, sky);
      el.dataset.pin = pin.key;
      if (pin.key === latest.current.selected) el.classList.add('rp-pin-selected');
      const words = lit?.pins.get(pin.key);
      if (lighting) el.classList.add(words ? 'rp-pin-lit' : 'rp-pin-dim');
      if (words?.length) {
        const label = document.createElement('span');
        label.className = 'rp-pin-words';
        label.textContent = words.slice(0, 2).join(', ');
        el.appendChild(label);
      }
      elements.current.set(pin.key, el);
      const headsUp = pin.type === 'mark' && pin.mark.heads_up;
      marks.push({
        point: pin.point,
        el,
        size,
        className: 'rp-leaflet-icon' + (size ? '' : ' rp-leaflet-free'),
        z: lit?.pins.has(pin.key) ? 4000 : headsUp ? 3000 : pin.type === 'ring' || pin.type === 'kept' || pin.type === 'explore' ? 2000 : pin.type === 'mark' ? 1000 : 0,
        title: pinTitle(pin),
        onClick: () => latest.current.onPick(pin.key),
      });
    }
    map.draw('pins', marks);
  }, [map, pins, float, sun, lit]);

  // Listen to the town: a small mark at each place sound; moving across the map plays the nearest one, louder nearer,
  // one at a time, and stops when the pointer leaves it. On a phone, where nothing moves without a finger down, a tap on
  // a mark (drawn as a badge at the top right of its Moment's pin, above the pins) or near it plays that sound once, and
  // a second tap stops it. Nothing plays until the reader turned Listen on.
  useEffect(() => {
    if (!map) return undefined;
    map.draw('sounds', []);
    if (!sounds?.length) return undefined;
    let playing: { id: string; audio: HTMLAudioElement; tapped?: boolean } | null = null;
    const stop = () => {
      playing?.audio.pause();
      playing = null;
      ref.current?.removeAttribute('data-hearing');
    };
    const play = (s: PlaceSound, tapped: boolean, volume = 1) => {
      stop();
      const audio = new Audio(s.url);
      audio.volume = volume;
      audio.loop = !tapped;
      playing = { id: s.moment_id, audio, tapped };
      if (tapped) audio.addEventListener('ended', () => playing?.audio === audio && stop());
      ref.current?.setAttribute('data-hearing', s.moment_id);
      // A sound refused, or cut off by the next one starting, stops only itself.
      void audio.play().catch(() => playing?.audio === audio && stop());
    };
    const tapOn = (s: PlaceSound) => (playing?.tapped && playing.id === s.moment_id ? stop() : play(s, true));
    map.draw(
      'sounds',
      sounds.map((s) => {
        const el = document.createElement('span');
        el.className = 'rp-sound';
        el.setAttribute('aria-hidden', 'true');
        el.textContent = '♪';
        return {
          point: { latitude: s.latitude, longitude: s.longitude },
          el,
          size: [26, 26] as [number, number],
          anchor: [-6, 32] as [number, number],
          className: 'rp-leaflet-icon',
          // Above every pin, lit ones included (they go up to 4000), so a tap on the badge always reaches it.
          z: 5000,
          title: 'Hear this place',
          onClick: () => tapOn(s),
        };
      }),
    );
    const nearest = (at: Spot) => {
      let best: { s: PlaceSound; d: number } | null = null;
      for (const s of sounds) {
        const p = map.spot({ latitude: s.latitude, longitude: s.longitude });
        if (!p) continue;
        const d = Math.hypot(p.x - at.x, p.y - at.y);
        if (d <= HEAR_PX && (!best || d < best.d)) best = { s, d };
      }
      return best;
    };
    const hear = (at: Spot) => {
      const best = nearest(at);
      if (!best) return stop();
      const volume = Math.max(0.15, 1 - best.d / HEAR_PX);
      if (playing?.id === best.s.moment_id) {
        playing.audio.volume = volume;
        return undefined;
      }
      play(best.s, false, volume);
      return undefined;
    };
    const tap = (at: Spot) => {
      const best = nearest(at);
      return best ? tapOn(best.s) : stop();
    };
    const off = map.onPointer(hear, stop, tap);
    return () => {
      off();
      stop();
    };
  }, [map, sounds]);

  // Live beams: a faint line from each capture to where they all looked, and a glow there. Not tappable.
  useEffect(() => {
    if (!map) return;
    const night = (sun?.elevation_deg ?? 30) <= 0;
    map.beams(beams || [], night ? '#fde68a' : '#38bdf8');
  }, [map, beams, sun]);

  useEffect(() => {
    elements.current.forEach((el, key) => el.classList.toggle('rp-pin-selected', key === selected));
  }, [selected]);

  // The list moved to another height (or the window to another layout): what was in the middle of the open part of the
  // map stays in the middle of the open part, once the list has finished moving.
  // Read again when the sheet or the panel ends its slide, so a slow frame never leaves the map a step behind (LEAD-8's look,
  // 10:3x: a fold re-centred the wrong way when the panel had not moved yet at 300 ms); each reading pans only what changed.
  useEffect(() => {
    const settle = () => {
      const map = mapNow.current;
      if (!map || !fitted.current) return;
      const before = insets.current, after = coveredInsets(ref.current);
      insets.current = after;
      const dy = (after.bottom - after.top - (before.bottom - before.top)) / 2;
      const dx = -(after.left - before.left) / 2;
      if (Math.abs(dy) > 2 || Math.abs(dx) > 2) map.panBy(dx, dy);
    };
    const timer = window.setTimeout(settle, 300);
    const sheet = ref.current?.closest('.rp-board')?.querySelector<HTMLElement>('.rp-sheet') ?? null;
    const ended = (e: TransitionEvent) => {
      if (e.target === sheet) settle();
    };
    sheet?.addEventListener('transitionend', ended);
    const stop = window.setTimeout(() => sheet?.removeEventListener('transitionend', ended), 3000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(stop);
      sheet?.removeEventListener('transitionend', ended);
    };
  }, [layoutKey]);

  useEffect(() => {
    const map = mapNow.current;
    if (!flyTo || !map) return;
    // Centre the place in the part of the map left open.
    const cover = coveredInsets(ref.current);
    map.flyTo(flyTo, Math.max(map.zoom(), 15), (cover.bottom - cover.top) / 2, !!flyTo.keepZoom, cover.left / 2);
  }, [flyTo]);

  return (
    <div className="rp-map" aria-label="Map">
      <div ref={ref} className="rp-leaflet" role="application" aria-label="Map" />
      {tilesMissing && <p className="rp-map-note">Map pictures can’t load here</p>}
    </div>
  );
}
