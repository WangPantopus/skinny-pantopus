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

export async function autocomplete(q: string): Promise<{ suggestions: GeoSuggestion[] }> {
  return get<{ suggestions: GeoSuggestion[] }>(`/api/geo/autocomplete?q=${encodeURIComponent(q)}`);
}

export async function autocompleteWithAbort(q: string, signal: AbortSignal): Promise<{ suggestions: GeoSuggestion[] }> {
  return apiRequest<{ suggestions: GeoSuggestion[] }>('GET', `/api/geo/autocomplete?q=${encodeURIComponent(q)}`, undefined, { signal });
}

export async function resolve(suggestionId: string): Promise<{ normalized: NormalizedAddress }> {
  return post<{ normalized: NormalizedAddress }>('/api/geo/resolve', { suggestion_id: suggestionId });
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<{
  normalized: NormalizedAddress;
}> {
  return get(`/api/geo/reverse`, { lat: latitude, lon: longitude });
}
