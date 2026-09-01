// ============================================================
// LOCATION ENDPOINTS
// Viewing Location management — drives Feed/Gigs/Discover content
// ============================================================

import { get, put, del } from '../client';

// ============ TYPES ============

export type ViewingLocationType = 'gps' | 'home' | 'business' | 'searched' | 'recent';

export interface ViewingLocationData {
  label: string;
  type: ViewingLocationType;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  isPinned: boolean;
  sourceId?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  updatedAt?: string | null;
}

export interface RecentLocationData {
  id: string;
  label: string;
  type: ViewingLocationType;
  latitude: number;
  longitude: number;
  radiusMiles: number;
  sourceId?: string | null;
  city?: string | null;
  state?: string | null;
  usedAt: string;
}

export interface HomeLocationData {
  id: string;
  name: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

export interface BusinessLocationData {
  id: string;
  businessName: string;
  label: string;
  city: string;
  state: string;
  latitude: number;
  longitude: number;
}

export interface LocationPayload {
  viewingLocation: ViewingLocationData | null;
  recentLocations: RecentLocationData[];
  homes: HomeLocationData[];
  businessLocations: BusinessLocationData[];
}

// ============ ENDPOINTS ============

/**
 * GET /api/location
 * Fetch the user's current VL, recent locations, homes, and business locations.
 * This is the primary payload the LocationPickerSheet needs.
 */
export async function getLocation(): Promise<LocationPayload> {
  return get<LocationPayload>('/api/location');
}

/**
 * PUT /api/location
 * Set or update the user's Viewing Location (upsert).
 * Also adds to recent locations (deduped, auto-trimmed to 5).
 */
export async function setLocation(data: {
  label: string;
  type: ViewingLocationType;
  latitude: number;
  longitude: number;
  radiusMiles?: number;
  isPinned?: boolean;
  sourceId?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
}): Promise<{ viewingLocation: ViewingLocationData }> {
  return put<{ viewingLocation: ViewingLocationData }>('/api/location', data);
}

/**
 * PUT /api/location/pin
 * Toggle the pin status of the current VL.
 */
export async function setPinned(isPinned: boolean): Promise<{ isPinned: boolean }> {
  return put<{ isPinned: boolean }>('/api/location/pin', { isPinned });
}

/**
 * PUT /api/location/radius
 * Update the radius of the current VL.
 */
export async function setRadius(radiusMiles: number): Promise<{ radiusMiles: number }> {
  return put<{ radiusMiles: number }>('/api/location/radius', { radiusMiles });
}

/**
 * GET /api/location/recents
 * Get the user's recent locations (up to 5).
 */
export async function getRecentLocations(): Promise<{ recentLocations: RecentLocationData[] }> {
  return get<{ recentLocations: RecentLocationData[] }>('/api/location/recents');
}

/**
 * DELETE /api/location/recents/:id
 * Remove a specific recent location.
 */
export async function deleteRecentLocation(id: string): Promise<{ message: string }> {
  return del<{ message: string }>(`/api/location/recents/${id}`);
}

/**
 * GET /api/location/resolve
 * Resolve the default VL using the server-side fallback chain:
 *   pinned VL → recent VL < 24h → primary home → profile city → null
 */
export async function resolveLocation(): Promise<{ viewingLocation: ViewingLocationData | null }> {
  return get<{ viewingLocation: ViewingLocationData | null }>('/api/location/resolve');
}
