import { get, post, del } from '../client';

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

export async function remove(id: string) {
  return del(`/api/saved-places/${encodeURIComponent(id)}`);
}
