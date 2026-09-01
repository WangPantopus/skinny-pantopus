'use client';

import { useState, useCallback, useEffect } from 'react';
import * as api from '@pantopus/api';

export interface AreaPickerState {
  userLat: number | null;
  userLng: number | null;
  gpsTimestamp: string | null;
  viewingLat: number | null;
  viewingLng: number | null;
  viewingLabel: string;
  radiusMiles: number | null;
  showAreaPicker: boolean;
  areaQuery: string;
  areaSearching: boolean;
  areaSuggestions: Record<string, any>[];
}

export function useAreaPicker(showToast: (msg: string) => void) {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [gpsTimestamp, setGpsTimestamp] = useState<string | null>(null);
  const [viewingLat, setViewingLat] = useState<number | null>(null);
  const [viewingLng, setViewingLng] = useState<number | null>(null);
  const [viewingLabel, setViewingLabel] = useState('Set area');
  const [radiusMiles, setRadiusMiles] = useState<number | null>(null);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');
  const [areaSearching, setAreaSearching] = useState(false);
  const [areaSuggestions, setAreaSuggestions] = useState<Record<string, any>[]>([]);

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

  // Primary: resolve server-side viewing location; fallback: browser GPS
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let resolved = false;
      try {
        const res = await api.location.resolveLocation();
        if (cancelled) return;
        const vl = res?.viewingLocation;
        if (vl && vl.latitude != null && vl.longitude != null) {
          setViewingLat(vl.latitude);
          setViewingLng(vl.longitude);
          setViewingLabel(vl.label || 'Set area');
          setRadiusMiles(vl.radiusMiles ?? null);
          resolved = true;
        }
      } catch {
        // resolveLocation unavailable; fall through to GPS
      }
      // Always request device GPS in background for eligibility checks
      if (!cancelled) {
        const loc = await refreshDeviceLocation();
        if (!cancelled && loc && !resolved) {
          setViewingLat((prev) => (prev == null ? loc.latitude : prev));
          setViewingLng((prev) => (prev == null ? loc.longitude : prev));
        }
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    setViewingLabel('Set area');
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
      setViewingLabel('Set area');
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
    setViewingLabel('Set area');
    setRadiusMiles(null);
  }, [refreshDeviceLocation, showToast]);

  /** Apply a server-returned ViewingLocation (from FeedLocationSheet) */
  const applyViewingLocation = useCallback((vl: { label: string; latitude: number; longitude: number; radiusMiles: number }) => {
    setViewingLat(vl.latitude);
    setViewingLng(vl.longitude);
    setViewingLabel(vl.label || 'Set area');
    setRadiusMiles(vl.radiusMiles ?? null);
  }, []);

  return {
    userLat,
    userLng,
    gpsTimestamp,
    viewingLat,
    viewingLng,
    viewingLabel,
    radiusMiles,
    setRadiusMiles,
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