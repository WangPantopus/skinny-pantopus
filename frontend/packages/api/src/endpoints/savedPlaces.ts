import { get, post, del } from '../client';
import type { PlaceIntelligence } from '@pantopus/types';
import type { PlacePreview } from './place';

export interface SavedPlace {
  id: string;
  user_id: string;
  label: string;
  latitude: number;
  longitude: number;
  city: string | null;
  state: string | null;
  place_type: string;
}

export async function getSavedPlaces() {
  return get<{ savedPlaces: SavedPlace[] }>('/api/saved-places');
}

export async function create(data: {
  label: string;
  placeType?: string;
  latitude: number;
  longitude: number;
  city?: string | null;
  state?: string | null;
  sourceId?: string | null;
  /** Refuse a save if the browser changed accounts while confirming. */
  expectedUserId?: string;
}) {
  return post<{ savedPlace: SavedPlace }>('/api/saved-places', data);
}

/** The public address preview for the saved point (not a lookup of its label). */
export async function getPreview(id: string) {
  return get<PlacePreview>(`/api/saved-places/${encodeURIComponent(id)}/preview`);
}

export async function remove(id: string) {
  return del(`/api/saved-places/${encodeURIComponent(id)}`);
}

/** The city or town around a point, named by the server; `city` and `state` are null when it found none ("Near you"). */
export interface TodayArea {
  label: string;
  city: string | null;
  state: string | null;
  latitude: number;
  longitude: number;
}

/** Today for the area around a point (tier T1, as a saved address shows it), with the area it named. */
export type AreaToday = PlaceIntelligence & {
  area: TodayArea;
  /** The area's IANA time zone. */
  time_zone?: string;
};

/**
 * POST /api/saved-places/area/today: Today for the city around a point, for someone with no address yet. Send the
 * point already rounded to 2 decimal places (the server rounds again); nothing is stored on the server.
 */
export async function getAreaToday(point: { latitude: number; longitude: number }) {
  return post<AreaToday>('/api/saved-places/area/today', { latitude: point.latitude, longitude: point.longitude });
}
