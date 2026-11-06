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
