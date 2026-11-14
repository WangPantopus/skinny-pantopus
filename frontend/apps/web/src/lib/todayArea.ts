'use client';

// ============================================================
// Today before an address (TABCARD 4, founder 2026-11-13): someone with no
// Home, no saved address and no claim in review can let this browser read
// where they are once, and Today shows their city (the sun, weather, air and
// alerts) until they add an address. The "area" is kept in this browser only,
// per account: the point rounded on the device to 2 decimal places (about a
// kilometre), the city's name and when it was read. An exact fix is never sent
// or kept, and the server stores nothing (POST /api/saved-places/area/today).
// ============================================================

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import type { AreaToday } from '@pantopus/api';
import type { HubToday } from '@pantopus/types';
import { queryKeys } from '@/lib/query-keys';
import { claimsInReview, myClaimsQuery, myHomesQuery } from '@/lib/myHomes';
import { findPlaceSection } from '@/components/place/detail/sections';

export interface KeptArea {
  latitude: number;
  longitude: number;
  /** The city as the server named it ("Vancouver, WA"); null until its first answer. */
  label: string | null;
  city: string | null;
  /** When this browser read the point (ISO 8601). */
  read_at: string;
}

/** A kept area older than this is read again quietly, only while the browser already allows it. */
export const AREA_REREAD_MS = 60 * 60 * 1000;

const areaKey = (userId: string) => `pantopus_today_area:${userId}`;
const CHANGED = 'pantopus:today-area';

/** To 2 decimal places, on the device, before a point is sent or kept. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

function parseArea(raw: string | null): KeptArea | null {
  if (!raw) return null;
  try {
    const area = JSON.parse(raw) as Partial<KeptArea>;
    if (typeof area.latitude !== 'number' || typeof area.longitude !== 'number' || typeof area.read_at !== 'string') return null;
    return {
      latitude: roundCoordinate(area.latitude),
      longitude: roundCoordinate(area.longitude),
      label: typeof area.label === 'string' ? area.label : null,
      city: typeof area.city === 'string' ? area.city : null,
      read_at: area.read_at,
    };
  } catch {
    return null;
  }
}

function readRaw(userId: string | null): string | null {
  if (!userId) return null;
  try {
    return window.localStorage.getItem(areaKey(userId));
  } catch {
    return null;
  }
}

/** Keeps the area for this account in this browser (rounded again here). */
export function keepArea(userId: string, area: KeptArea): void {
  const rounded: KeptArea = { ...area, latitude: roundCoordinate(area.latitude), longitude: roundCoordinate(area.longitude) };
  try {
    window.localStorage.setItem(areaKey(userId), JSON.stringify(rounded));
  } catch { /* storage off: the city view lasts for this page */ }
  window.dispatchEvent(new Event(CHANGED));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener('storage', onChange);
  };
}

/** This account's kept area in this browser (null in the server's HTML and while hydrating). */
export function useKeptArea(userId: string | null | undefined): [KeptArea | null, (area: KeptArea) => void] {
  const id = userId ?? null;
  const raw = useSyncExternalStore(subscribe, () => readRaw(id), () => null);
  const area = useMemo(() => parseArea(raw), [raw]);
  const keep = useCallback((next: KeptArea) => { if (id) keepArea(id, next); }, [id]);
  return [area, keep];
}

/**
 * Whether this account has no Home, no saved address and no claim in review: only then does Today start where you
 * are, and Place's address-first page show your area's city. `checking` while that isn't known yet. The reads are the
 * ones Place makes (your homes, your claims, your saved addresses), so they come from the same cache entries.
 */
export function useHasNoPlace(userId: string | null | undefined, enabled: boolean): { noPlace: boolean; checking: boolean } {
  const on = enabled && !!userId;
  const homes = useQuery({ ...myHomesQuery(), enabled: on });
  const claims = useQuery({ ...myClaimsQuery(), enabled: on });
  const saved = useQuery({
    queryKey: ['place-entry', userId ?? null, 'saved'],
    queryFn: () => api.savedPlaces.getSavedPlaces(),
    enabled: on,
    staleTime: 0,
    retry: false,
  });
  const ownSaved = (saved.data?.savedPlaces ?? []).filter((place) => place.user_id === userId);
  // As Place does, claims that can't be read don't hold the page up.
  const checking = on && (homes.isPending || claims.isPending || saved.isPending);
  const noPlace = on && !checking && homes.isSuccess && (homes.data?.homes ?? []).length === 0
    && saved.isSuccess && ownSaved.length === 0 && claimsInReview(claims.data).length === 0;
  return { noPlace, checking };
}

/** Today for the kept area's city. Shared by Today and Place's address-first page. */
export function areaTodayQuery(userId: string | null | undefined, area: Pick<KeptArea, 'latitude' | 'longitude'> | null) {
  return {
    queryKey: queryKeys.todayArea(userId ?? null, area?.latitude ?? null, area?.longitude ?? null),
    queryFn: () => api.savedPlaces.getAreaToday({ latitude: area!.latitude, longitude: area!.longitude }),
    // Today's briefing window.
    staleTime: 120_000,
    retry: 1,
  };
}

/**
 * A fix from this browser, rounded here to 2 decimal places. Asks for permission only if the browser never asked;
 * rejects when location is refused, off or unavailable.
 */
export function readRoundedLocation(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Location is unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const point = { latitude: roundCoordinate(position.coords.latitude), longitude: roundCoordinate(position.coords.longitude) };
        // 0,0 is what a browser without a fix reports, not a place.
        if (point.latitude === 0 && point.longitude === 0) reject(new Error('Location is unavailable'));
        else resolve(point);
      },
      reject,
      // A city needs no precision; a fix from the last ten minutes will do.
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 10 * 60_000 },
    );
  });
}

/** Whether this browser already lets the site read the location. Never asks. */
export async function locationAlreadyAllowed(): Promise<boolean> {
  try {
    const status = await navigator.permissions?.query({ name: 'geolocation' as PermissionName });
    return status?.state === 'granted';
  } catch {
    return false;
  }
}

/** The answer's section data when it can be shown (as Place's detail pages read a section). */
function readySection<Id extends Parameters<typeof findPlaceSection>[1]>(answer: AreaToday, id: Id) {
  const section = findPlaceSection(answer, id);
  return section && (section.status === 'ready' || section.status === 'stale' || section.status === 'partial') && section.data
    ? section
    : undefined;
}

export function areaSunData(answer: AreaToday | null | undefined) {
  return answer ? readySection(answer, 'sunrise_sunset')?.data ?? null : null;
}

// The briefing's footer names a section that couldn't be read by its own word for it.
const FAILED_NAMES: Record<string, string> = { weather: 'weather', air_quality: 'aqi', alerts: 'alerts' };

/**
 * The area's answer as Today's briefing, so the page shows it exactly as it shows a saved address's (the weather box,
 * rain coming, air worth a word, alerts), with the city where the address goes. The area has no summary, signals or
 * actions of its own: those are about a place of yours.
 */
export function briefingFromArea(answer: AreaToday): HubToday {
  const weather = readySection(answer, 'weather')?.data ?? null;
  const sun = readySection(answer, 'sunrise_sunset')?.data ?? null;
  const air = readySection(answer, 'air_quality')?.data ?? null;
  const alerts = readySection(answer, 'alerts')?.data ?? null;
  // As the briefing reads it: a better-than-even chance in the next six hours.
  const wet = (weather?.hourly ?? []).slice(0, 6).find((hour) => (hour.precip_chance ?? 0) > 50);
  const sections = answer.groups.flatMap((group) => group.sections);
  const providers = Array.from(new Set(
    sections
      .filter((s) => ['weather', 'air_quality', 'alerts', 'sunrise_sunset'].includes(s.id) && s.source && s.data)
      .map((s) => String(s.source).split(' · ')[0]),
  ));
  return {
    location: {
      label: answer.area.label,
      source: 'none',
      latitude: answer.area.latitude,
      longitude: answer.area.longitude,
      timezone: answer.time_zone ?? sun?.time_zone ?? 'UTC',
      confidence: 1,
    },
    summary: '',
    display_mode: 'full',
    weather: weather ? {
      current_temp_f: weather.current_temp_f,
      condition_code: weather.condition_code,
      condition_label: weather.condition_label,
      high_f: weather.high_f,
      low_f: weather.low_f,
      sunrise_utc: sun?.sunrise_utc ?? null,
      sunset_utc: sun?.sunset_utc ?? null,
      precipitation_next_6h: !!wet,
      precipitation_start_at: wet?.time ?? null,
    } : null,
    aqi: air ? { index: air.index, category: air.category_label, is_noteworthy: air.index > 100 } : null,
    alerts: (alerts?.active ?? []).map((alert) => ({
      id: alert.id,
      severity: alert.severity,
      title: alert.event || alert.headline,
      starts_at: alert.onset ?? '',
      ends_at: alert.ends ?? '',
    })),
    signals: [],
    seasonal: null,
    actions: [],
    fetched_at: answer.generated_at,
    expires_at: answer.generated_at,
    meta: {
      providers_used: providers,
      partial_failures: sections.filter((s) => FAILED_NAMES[s.id] && s.status === 'error').map((s) => FAILED_NAMES[s.id]),
      cache_hits: 0,
      total_latency_ms: 0,
    },
  };
}
