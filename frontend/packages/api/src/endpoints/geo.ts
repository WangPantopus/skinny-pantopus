import { get, post, apiRequest } from '../client';

export type GeoSuggestion = {
  suggestion_id: string;
  primary_text: string;
  secondary_text: string;
  label: string;
  center: { lat: number; lng: number };
  kind: string;
};

export type NormalizedAddress = {
  address: string;
  city: string;
  state: string;
  zipcode: string;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;
  verified: boolean;
  source: string;
  geocode_mode?: 'temporary' | 'permanent' | 'verified';
};

type RawGeoSuggestion = Omit<GeoSuggestion, 'center'> & {
  center?: { lat: number; lng: number } | [number, number] | null;
};

/**
 * `/api/geo/autocomplete` answers each suggestion's `center` in its legacy
 * `[lng, lat]` shape (kept for the native apps), while every web caller
 * reads `center.lat` / `center.lng`. Normalize here so a picked suggestion
 * carries real coordinates (otherwise they are undefined and, for example,
 * the /start preview cannot be kept for saving).
 */
function withObjectCenters(res: { suggestions?: RawGeoSuggestion[] }): { suggestions: GeoSuggestion[] } {
  const suggestions = (res?.suggestions ?? []).map((s) => {
    const c = s.center;
    const center = Array.isArray(c) ? { lat: c[1], lng: c[0] } : c ?? undefined;
    return { ...s, center } as GeoSuggestion;
  });
  return { ...res, suggestions };
}

/**
 * `near` favors suggestions close to a point (the server rounds it to about a
 * kilometer); `streetOnly` keeps street addresses, for house-number-and-street
 * fields. Both are optional; a server without them ignores them.
 */
export type AutocompleteOptions = {
  near?: { lat: number; lng: number } | null;
  streetOnly?: boolean;
};

function autocompletePath(q: string, options?: AutocompleteOptions): string {
  let path = `/api/geo/autocomplete?q=${encodeURIComponent(q)}`;
  const near = options?.near;
  if (near && Number.isFinite(near.lat) && Number.isFinite(near.lng)) {
    path += `&lat=${near.lat.toFixed(2)}&lng=${near.lng.toFixed(2)}`;
  }
  if (options?.streetOnly) path += '&kind=address';
  return path;
}

export async function autocomplete(q: string, options?: AutocompleteOptions): Promise<{ suggestions: GeoSuggestion[] }> {
  return withObjectCenters(await get<{ suggestions: RawGeoSuggestion[] }>(autocompletePath(q, options)));
}

export async function autocompleteWithAbort(
  q: string,
  signal: AbortSignal,
  options?: AutocompleteOptions,
): Promise<{ suggestions: GeoSuggestion[] }> {
  return withObjectCenters(
    await apiRequest<{ suggestions: RawGeoSuggestion[] }>('GET', autocompletePath(q, options), undefined, { signal }),
  );
}

export async function resolve(suggestionId: string): Promise<{ normalized: NormalizedAddress }> {
  return post<{ normalized: NormalizedAddress }>('/api/geo/resolve', { suggestion_id: suggestionId });
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<{
  normalized: NormalizedAddress;
}> {
  return get(`/api/geo/reverse`, { lat: latitude, lon: longitude });
}

/** A row of the post place picker: an OpenStreetMap venue (`osm:way/…`) or a Mapbox town, address or point of interest. */
export type GeoPlace = {
  place_id: string | null;
  name: string;
  /** A venue's kind ("Barbecue restaurant"). */
  category: string | null;
  /** A venue's icon key (`restaurant`, `park`…); Mapbox rows have none. */
  icon?: string | null;
  address: string | null;
  full_address: string | null;
  center: { lat: number; lng: number };
  /** `poi`, `place` or `address`. */
  kind: string;
  distance_m: number | null;
  /** The asked-about point is inside the venue's outline. */
  contains?: boolean;
};

/**
 * Named venues around a point and the town it's in. `loading` means a new area's venues are still on their way, so
 * ask again in a moment; `attribution` is the credit to show under OpenStreetMap rows.
 */
export async function nearbyPlaces(latitude: number, longitude: number, signal?: AbortSignal): Promise<{
  places: GeoPlace[];
  locality: GeoPlace | null;
  loading?: boolean;
  attribution?: string | null;
}> {
  return get('/api/geo/places/nearby', { lat: latitude, lng: longitude }, { signal });
}

/** Venues near the point whose name matches, then Mapbox's towns, addresses and points of interest. Without a point only Mapbox answers. */
export async function searchPlaces(
  q: string,
  near?: { latitude: number; longitude: number } | null,
  signal?: AbortSignal,
): Promise<{ places: GeoPlace[]; attribution?: string | null }> {
  return get('/api/geo/places/search', { q, lat: near?.latitude, lng: near?.longitude }, { signal });
}
