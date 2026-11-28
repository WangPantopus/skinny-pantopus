// The one Pulse list (Pulse, reinvented, phase 1; coord/CONTRACT.md §6a): Moments that fade and posts that stay, mixed
// by reach, for a reader whose switch is on. Shapes as the server sends them. A post here carries no distance: the only
// distance anywhere in this list is its band.

import { del, get } from '@pantopus/api/client';
import type { Post } from '@pantopus/api';
import type { Moment, Ring } from '@pantopus/api/endpoints/moments';
import type { ShownStamp } from '../stamps/stampTypes';

export type Reach = 'close' | 'around' | 'explore';
export type Chip = 'all' | 'live' | 'learn' | 'spots' | 'ask' | 'plans' | 'sports';
export const CHIPS: readonly Chip[] = ['all', 'live', 'learn', 'spots', 'ask', 'plans', 'sports'];
export const CHIP_WORDS: Record<Chip, string> = {
  all: 'All',
  live: 'Live',
  learn: 'Learn',
  spots: 'Spots',
  ask: 'Ask',
  plans: 'Plans',
  sports: 'Sports',
};
export const isChip = (v: unknown): v is Chip => typeof v === 'string' && (CHIPS as readonly string[]).includes(v);

export type ListMoment = Moment & {
  stamps?: ShownStamp[];
  my_signal?: string | null;
  signal_counts?: { signal: string; count: number }[] | null;
};

export type ListItem =
  | { type: 'moment'; id: string; band: string | null; moment: ListMoment; kept?: boolean }
  | { type: 'post'; id: string; band: string | null; post: Post };

export interface Band {
  band: string;
  label: string;
}

export interface ListPage {
  reach: Reach;
  miles?: number;
  place: { label: string } | null;
  chips: string[] | null;
  bands: Band[];
  items: ListItem[];
  next_cursor: string | null;
  end: string | null;
  needs_place?: boolean;
  /** With the map's box (CONTRACT 11a), on the first page: how many the box holds; `count_more` when the map's cap was met. */
  count?: number | null;
  count_more?: boolean;
}

export interface Point {
  latitude: number;
  longitude: number;
}

export function readList(
  {
    reach,
    miles,
    chip,
    cursor,
    point,
    circle = null,
    filters = null,
    box = null,
    noPlace = false,
  }: {
    reach: Reach;
    miles: number;
    chip: Chip;
    cursor: string | null;
    point: Point | null;
    circle?: string | null;
    /** PHASE-5 B (CONTRACT 10a): `kinds`, `when`, `from`, `state`, `since`; with any of them the chip isn't sent. */
    filters?: Record<string, string> | null;
    /** PHASE-6 B (CONTRACT 11a): the open part of the map; the list is then what the map shows there (Around me only). */
    box?: Box | null;
    /** CONTRACT 11b: posts and Moments without a place follow, under "Without a place". */
    noPlace?: boolean;
  },
  signal?: AbortSignal,
): Promise<ListPage> {
  const params: Record<string, string | number> = filters ? { reach, ...filters, limit: 20 } : { reach, chip, limit: 20 };
  // Close circle can be one of the person's circles (CONTRACT 8d): only its people who are in.
  if (reach === 'close' && circle) params.circle = circle;
  const byBox = reach === 'around' && box ? box : null;
  if (byBox) {
    params.south = byBox.south;
    params.west = byBox.west;
    params.north = byBox.north;
    params.east = byBox.east;
  } else if (reach === 'around') params.miles = miles;
  if (noPlace && reach === 'around') params.no_place = 1;
  if (cursor) params.cursor = cursor;
  if (point && reach === 'around' && !byBox) {
    params.latitude = Math.round(point.latitude * 1e5) / 1e5;
    params.longitude = Math.round(point.longitude * 1e5) / 1e5;
  }
  return get<ListPage>('/api/reinvented/list', params, { signal });
}

/** The time a Moment has left, as the board writes it: "23 h left", "40 min left". Null once it has ended. */
export function timeLeft(expiresAt: string | null | undefined, now: number): string | null {
  const end = Date.parse(expiresAt || '');
  if (!Number.isFinite(end) || end <= now) return null;
  const minutes = Math.ceil((end - now) / 60_000);
  if (minutes < 60) return `${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h left`;
  return `${Math.floor(hours / 24)} days left`;
}

/** "Live from here" holds while the author is still where they took it (today's Live mark: `taken_here`, `live_until`). */
export function isLiveHere(m: Pick<Moment, 'taken_here' | 'live_until'>, now: number): boolean {
  return m.taken_here === true && Date.parse(m.live_until || '') > now;
}

// ── The one map (coord/CONTRACT.md §6b): rings are Moments, marks are posts that stay, tickets are plans ──

export type MapTime = 'all' | 'week' | 'today' | 'live' | 'tonight' | 'weekend';
/** The time row, back on the left and forward on the right, Live between them. */
export const MAP_TIMES: readonly MapTime[] = ['all', 'week', 'today', 'live', 'tonight', 'weekend'];
export const MAP_TIME_WORDS: Record<MapTime, string> = {
  all: 'All time',
  week: 'This week',
  today: 'Today',
  live: 'Live',
  tonight: 'Tonight',
  weekend: 'This weekend',
};

export interface MapMark {
  id: string;
  latitude: number;
  longitude: number;
  heads_up: boolean;
  post: Post;
}

export interface MapTicket {
  layer_type: 'plan';
  id: string;
  kind: string;
  latitude: number;
  longitude: number;
  precision?: string;
  title: string;
  starts_at: string;
  ends_at?: string | null;
  timezone?: string | null;
  area_label?: string | null;
  going_count?: number;
  spots_left?: number | null;
  is_full?: boolean;
  state?: string;
}

export interface MapData {
  time: MapTime;
  rings: Ring[];
  marks: MapMark[];
  tickets: MapTicket[];
  /** As on today's Moments map: heights are shown, and Moments float at them (phase 4's living map). */
  heights_on?: boolean;
  float_on?: boolean;
}

export interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** The map for a box and the time row's choice, with the list's filters (CONTRACT 10a; the map takes no `when`). */
export function readMap(box: Box, time: MapTime, signal?: AbortSignal, filters: Record<string, string> | null = null): Promise<MapData> {
  return get<MapData>('/api/reinvented/map', { ...box, time, ...(filters || {}) }, { signal });
}

/** A plan's time as its ticket says it: "Now", "Tonight 6", "Today 10", "Sat 9". */
export function ticketWhen(t: MapTicket, now: number): string {
  const start = Date.parse(t.starts_at);
  const end = Date.parse(t.ends_at || '');
  if (!Number.isFinite(start)) return 'Plan';
  if (start <= now && (!Number.isFinite(end) || end > now)) return 'Now';
  const zone = t.timezone || undefined;
  const day = (ms: number) => new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', minute: '2-digit', weekday: 'short', hour12: true }).formatToParts(start);
  const part = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const hour24 = Number(new Intl.DateTimeFormat('en-US', { timeZone: zone, hour: 'numeric', hourCycle: 'h23' }).format(start));
  const clock = part('minute') === '00' ? part('hour') : `${part('hour')}:${part('minute')}`;
  if (day(start) === day(now)) return `${hour24 >= 17 ? 'Tonight' : 'Today'} ${clock}`;
  return `${part('weekday')} ${clock}`;
}

// ── Alive right now (coord/CONTRACT.md §6c): Live from here Moments, plans starting soon, people you know ──

export interface StripData {
  live_here: { band: string | null; moment: ListMoment }[];
  plans_soon: MapTicket[];
  people: Ring[];
}

export function readStrip(point: Point | null, signal?: AbortSignal): Promise<StripData> {
  const params: Record<string, number> = {};
  if (point) {
    params.latitude = Math.round(point.latitude * 1e5) / 1e5;
    params.longitude = Math.round(point.longitude * 1e5) / 1e5;
  }
  return get<StripData>('/api/reinvented/strip', params, { signal });
}

/** When a plan in the strip starts: "Now", "in 40 min", "in 2 h". */
export function startsIn(t: MapTicket, now: number): string {
  const start = Date.parse(t.starts_at);
  if (!Number.isFinite(start) || start <= now) return 'Now';
  const minutes = Math.ceil((start - now) / 60_000);
  return minutes < 60 ? `in ${minutes} min` : `in ${Math.round(minutes / 60)} h`;
}

// ── My Atlas (coord/CONTRACT.md §6e): the person's own kept Moments, private to them ──

export interface AtlasPage {
  moments: ListMoment[];
  next_cursor?: string | null;
}

export function readAtlas(cursor: string | null, signal?: AbortSignal): Promise<AtlasPage> {
  return get<AtlasPage>('/api/reinvented/atlas', cursor ? { cursor, limit: 30 } : { limit: 30 }, { signal });
}

export function readAtlasBox(box: Box, signal?: AbortSignal): Promise<AtlasPage> {
  return get<AtlasPage>('/api/reinvented/atlas', box, { signal });
}

/** Delete for good: ends it if live, removes its files at once, and it leaves the Atlas. */
export function deleteForGood(id: string): Promise<unknown> {
  return del(`/api/reinvented/atlas/${encodeURIComponent(id)}`);
}

// ── Explore (coord/CONTRACT.md §6f): Moments their makers chose to show anywhere, never from the reader's own town ──

/**
 * A Moment, or a post made in the Studio whose maker chose "Also show in Explore" (§6f, with 6d). `why`: "Picked today:
 * 14 people marked it", "New from Kyoto", "New elsewhere".
 */
export type ExploreItem =
  | { type: 'moment'; id: string; moment: ListMoment; why: string }
  | { type: 'post'; id: string; post: Post; why: string };

export interface ExplorePage {
  /** "Today, elsewhere": up to ten, on the first page only (null after). */
  picked: ExploreItem[] | null;
  /** Near the places the reader follows (CONTRACT 9c): up to ten, on the first page only (null after; absent before 9c). */
  followed?: ExploreItem[] | null;
  items: ExploreItem[];
  next_cursor: string | null;
  /** "Keep exploring?" while there is more; null at the end. */
  pause: string | null;
}

export function readExplore({ cursor, point }: { cursor: string | null; point: Point | null }, signal?: AbortSignal): Promise<ExplorePage> {
  const params: Record<string, string | number> = {};
  if (cursor) params.cursor = cursor;
  if (point) {
    params.latitude = Math.round(point.latitude * 1e5) / 1e5;
    params.longitude = Math.round(point.longitude * 1e5) / 1e5;
  }
  return get<ExplorePage>('/api/reinvented/explore', params, { signal });
}
