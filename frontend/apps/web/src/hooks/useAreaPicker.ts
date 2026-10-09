'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@pantopus/api';
import { queryKeys } from '@/lib/query-keys';

type ResolvedArea = Awaited<ReturnType<typeof api.location.resolveLocation>>;

// Your saved viewing area, kept in the session's cache (contract §4, Nearby: fresh 2 minutes), so
// coming back to the feed knows its area at once instead of waiting for /api/location/resolve.
const AREA_FRESH_MS = 2 * 60 * 1000;

/** 'resolving' until the saved viewing area has been read; 'failed' when that read failed. */
export type AreaStatus = 'resolving' | 'ready' | 'failed';

export interface AreaPickerState {
  userLat: number | null;
  userLng: number | null;
  gpsTimestamp: string | null;
  viewingLat: number | null;
  viewingLng: number | null;
  viewingLabel: string;
  radiusMiles: number | null;
  areaStatus: AreaStatus;
  showAreaPicker: boolean;
  areaQuery: string;
  areaSearching: boolean;
  areaSuggestions: Record<string, any>[];
}

export function useAreaPicker(showToast: (msg: string) => void) {
  const queryClient = useQueryClient();
  const [kept] = useState(() => {
    const data = queryClient.getQueryData<ResolvedArea>(queryKeys.viewingArea());
    return data ? { area: data.viewingLocation, at: queryClient.getQueryState(queryKeys.viewingArea())?.dataUpdatedAt ?? 0 } : null;
  });
  const keptArea = kept?.area && kept.area.latitude != null && kept.area.longitude != null ? kept.area : null;
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [gpsTimestamp, setGpsTimestamp] = useState<string | null>(null);
  const [viewingLat, setViewingLat] = useState<number | null>(keptArea?.latitude ?? null);
  const [viewingLng, setViewingLng] = useState<number | null>(keptArea?.longitude ?? null);
  const [viewingLabel, setViewingLabel] = useState(keptArea?.label || 'Set area');
  const [radiusMiles, setRadiusMiles] = useState<number | null>(keptArea?.radiusMiles ?? null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaSearching, setAreaSearching] = useState(false);
  const [areaSuggestions, setAreaSuggestions] = useState<Record<string, any>[]>([]);
  // A failed read of the saved area is not the same as having no area.
  const [areaStatus, setAreaStatus] = useState<AreaStatus>(keptArea ? 'ready' : 'resolving');
  const resolveGeneration = useRef(0);
  // The first resolve of a visit is skipped while the kept area is fresh.
  const keptFreshUntil = useRef(keptArea && kept ? kept.at + AREA_FRESH_MS : 0);

  const refreshDeviceLocation = useCallback(async () => {
    if (!navigator.geolocation) return null;
    return await new Promise<{ latitude: number; longitude: number; timestamp: string } | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const latitude = pos.coords.latitude;
          const longitude = pos.coords.longitude;
          const timestamp = new Date(pos.timestamp || Date.now()).toISOString();
          setUserLat(latitude);
          setUserLng(longitude);
          setGpsTimestamp(timestamp);
          resolve({ latitude, longitude, timestamp });
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    });
  }, []);

  // Primary: resolve server-side viewing location; fallback: browser GPS. With a kept area the
  // feed shows it at once: a fresh one isn't asked again, an older one is refreshed behind it.
  const resolveArea = useCallback(async (isCancelled: () => boolean = () => false) => {
    const generation = ++resolveGeneration.current;
    const stale = () => isCancelled() || generation !== resolveGeneration.current;
    const fresh = Date.now() < keptFreshUntil.current;
    keptFreshUntil.current = 0;
    if (!keptArea) setAreaStatus('resolving');
    let resolved = !!keptArea;
    if (!fresh) try {
      const res = await api.location.resolveLocation();
      if (stale()) return;
      queryClient.setQueryData(queryKeys.viewingArea(), res);
      const vl = res?.viewingLocation;
      if (vl && vl.latitude != null && vl.longitude != null) {
        setViewingLat(vl.latitude);
        setViewingLng(vl.longitude);
        setViewingLabel(vl.label || 'Set area');
        setRadiusMiles(vl.radiusMiles ?? null);
        resolved = true;
      }
      setAreaStatus('ready');
    } catch {
      // resolveLocation unavailable; say so (unless a kept area is showing), then fall through to GPS
      if (stale()) return;
      if (!keptArea) setAreaStatus('failed');
    }
    // Always request device GPS in background for eligibility checks
    const loc = await refreshDeviceLocation();
    if (!stale() && loc && !resolved) {
      setViewingLat((prev) => (prev == null ? loc.latitude : prev));
      setViewingLng((prev) => (prev == null ? loc.longitude : prev));
    }
  }, [refreshDeviceLocation, keptArea, queryClient]);

  useEffect(() => {
    let cancelled = false;
    void resolveArea(() => cancelled);
    return () => { cancelled = true; };
  }, [resolveArea]);

  const retryResolveArea = useCallback(() => { void resolveArea(); }, [resolveArea]);

  // Area search autocomplete
  useEffect(() => {
    if (!showAreaPicker) {
      setAreaSuggestions([]);
      return;
    }
    const q = areaQuery.trim();
    if (q.length < 2) {
      setAreaSuggestions([]);
      return;
    }
    let cancelled = false;
    setAreaSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await api.geo.autocomplete(q);
        if (!cancelled) setAreaSuggestions(res?.suggestions || []);
      } catch {
        if (!cancelled) setAreaSuggestions([]);
      } finally {
        if (!cancelled) setAreaSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [areaQuery, showAreaPicker]);

  const useCurrentArea = useCallback(async () => {
    const loc = await refreshDeviceLocation();
    if (!loc) {
      showToast('Could not get your location. Check browser location permission.');
      return;
    }
    setViewingLat(loc.latitude);
    setViewingLng(loc.longitude);
    setViewingLabel('Current location');
    setRadiusMiles(null);
    setShowAreaPicker(false);
    setAreaQuery('');
    setAreaSuggestions([]);
  }, [refreshDeviceLocation, showToast]);

  const selectAreaSuggestion = useCallback((suggestion: Record<string, any>) => {
    // Backend returns center as [lng, lat]; API type uses { lat, lng }. Accept both.
    const raw = suggestion?.center;
    let lat: number | undefined;
    let lng: number | undefined;
    if (Array.isArray(raw) && raw.length >= 2) {
      lng = Number(raw[0]);
      lat = Number(raw[1]);
    } else if (raw && typeof raw === 'object' && 'lat' in raw && 'lng' in raw) {
      lat = Number((raw as { lat: number; lng: number }).lat);
      lng = Number((raw as { lat: number; lng: number }).lng);
    }
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setViewingLat(lat);
    setViewingLng(lng);
    setViewingLabel((suggestion?.primary_text as string) || (suggestion?.text as string) || (suggestion?.label as string) || 'selected area');
    setRadiusMiles(typeof suggestion?.radiusMiles === 'number' ? suggestion.radiusMiles : null);
    setShowAreaPicker(false);
    setAreaQuery('');
    setAreaSuggestions([]);
  }, []);

  const handleMapUseCurrentLocation = useCallback(async (coords?: { latitude: number; longitude: number }) => {
    if (coords) {
      setUserLat(coords.latitude);
      setUserLng(coords.longitude);
      setGpsTimestamp(new Date().toISOString());
      setViewingLat(coords.latitude);
      setViewingLng(coords.longitude);
      setViewingLabel('Current location');
      setRadiusMiles(null);
      return;
    }
    const loc = await refreshDeviceLocation();
    if (!loc) {
      showToast('Could not get your location. Check browser location permission.');
      return;
    }
    setViewingLat(loc.latitude);
    setViewingLng(loc.longitude);
    setViewingLabel('Current location');
    setRadiusMiles(null);
  }, [refreshDeviceLocation, showToast]);

  /** Apply a server-returned ViewingLocation (from FeedLocationSheet) */
  const applyViewingLocation = useCallback((vl: { label: string; latitude: number; longitude: number; radiusMiles: number }) => {
    setViewingLat(vl.latitude);
    setViewingLng(vl.longitude);
    setViewingLabel(vl.label || 'Set area');
    setRadiusMiles(vl.radiusMiles ?? null);
    // The saved area is what the next visit opens on (or, with nothing kept, what it asks for).
    const old = queryClient.getQueryData<ResolvedArea>(queryKeys.viewingArea());
    if (old?.viewingLocation) queryClient.setQueryData<ResolvedArea>(queryKeys.viewingArea(), { ...old, viewingLocation: { ...old.viewingLocation, ...vl } });
    else queryClient.removeQueries({ queryKey: queryKeys.viewingArea(), exact: true });
  }, [queryClient]);

  return {
    userLat,
    userLng,
    gpsTimestamp,
    viewingLat,
    viewingLng,
    viewingLabel,
    radiusMiles,
    setRadiusMiles,
    areaStatus,
    retryResolveArea,
    showAreaPicker,
    setShowAreaPicker,
    areaQuery,
    setAreaQuery,
    areaSearching,
    areaSuggestions,
    useCurrentArea,
    selectAreaSuggestion,
    handleMapUseCurrentLocation,
    refreshDeviceLocation,
    applyViewingLocation,
  };
}