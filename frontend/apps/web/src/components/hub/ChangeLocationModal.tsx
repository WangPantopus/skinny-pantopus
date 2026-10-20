'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Home as HomeIcon, Briefcase, Clock, MapPin, Pin, PinOff, Check } from 'lucide-react';
import * as api from '@pantopus/api';
import AddressAutocomplete from '../AddressAutocomplete';

type LocationPayload = Awaited<ReturnType<typeof api.location.getLocation>>;
type ViewingLocationType = Parameters<typeof api.location.setLocation>[0]['type'];

interface ChangeLocationModalProps {
  onClose: () => void;
  onLocationChanged: () => void;
}

function hasCoordinates(location: { latitude: number; longitude: number }) {
  return Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90
    && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180;
}

// Row UI helper -------------------------------------------------------------

function OptionRow({
  icon,
  title,
  subtitle,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition text-left ${
        active
          ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20'
          : 'border-app hover:bg-app-hover'
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center flex-shrink-0 text-app-text-secondary">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-app-text truncate">{title}</div>
        {subtitle && (
          <div className="text-xs text-app-text-secondary truncate">{subtitle}</div>
        )}
      </div>
      {active && <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />}
    </button>
  );
}

// Main component ------------------------------------------------------------

export default function ChangeLocationModal({ onClose, onLocationChanged }: ChangeLocationModalProps) {
  const [payload, setPayload] = useState<LocationPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await api.location.getLocation();
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load locations');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const current = payload?.viewingLocation ?? null;

  const commit = async (params: {
    key: string;
    label: string;
    type: ViewingLocationType;
    latitude: number;
    longitude: number;
    sourceId?: string | null;
    city?: string | null;
    state?: string | null;
    zipcode?: string | null;
  }) => {
    if (savingRef.current) return;
    if (!hasCoordinates(params)) {
      setError('This location is unavailable. Choose another saved location or search for an address.');
      return;
    }
    savingRef.current = true;
    setSaving(params.key);
    setError(null);
    try {
      await api.location.setLocation({
        label: params.label,
        type: params.type,
        latitude: params.latitude,
        longitude: params.longitude,
        sourceId: params.sourceId ?? null,
        city: params.city ?? null,
        state: params.state ?? null,
        zipcode: params.zipcode ?? null,
      });
      onLocationChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update location');
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const togglePin = async () => {
    if (!current || savingRef.current) return;
    savingRef.current = true;
    setSaving('pin');
    setError(null);
    try {
      const next = !current.isPinned;
      await api.location.setPinned(next);
      setPayload((p) => (p?.viewingLocation ? { ...p, viewingLocation: { ...p.viewingLocation, isPinned: next } } : p));
      onLocationChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update pin');
    } finally {
      savingRef.current = false;
      setSaving(null);
    }
  };

  const currentKey = (() => {
    if (!current) return '';
    if (current.type === 'home' && current.sourceId) return `home:${current.sourceId}`;
    if (current.type === 'business' && current.sourceId) return `biz:${current.sourceId}`;
    return `label:${current.label}`;
  })();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-app-surface border border-app rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-app-border/50">
          <h2 className="text-base font-bold text-app-text">Change location</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-app-hover transition"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-app-text-secondary" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {error && (
            <div role="alert" className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
              {error}
              {!payload && !loading && (
                <button className="ml-2 font-semibold underline" onClick={() => setLoadAttempt((n) => n + 1)}>
                  Try again
                </button>
              )}
            </div>
          )}

          {loading && (
            <div className="space-y-2">
              <div className="h-12 bg-app-surface-sunken rounded-lg animate-pulse" />
              <div className="h-12 bg-app-surface-sunken rounded-lg animate-pulse" />
              <div className="h-12 bg-app-surface-sunken rounded-lg animate-pulse" />
            </div>
          )}

          {!loading && payload && (
            <>
              {/* Current */}
              {current && (
                <div className="rounded-lg border border-app bg-app-surface-sunken/50 px-3 py-2.5 flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-app-text-secondary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] uppercase tracking-wide text-app-text-muted font-semibold">
                      Current
                    </div>
                    <div className="text-sm font-semibold text-app-text truncate">
                      {current.label}
                    </div>
                  </div>
                  <button
                    onClick={togglePin}
                    disabled={saving !== null}
                    className={`p-1.5 rounded-md transition ${
                      current.isPinned
                        ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'text-app-text-muted hover:bg-app-hover'
                    }`}
                    title={current.isPinned ? 'Unpin' : 'Pin'}
                    aria-label={current.isPinned ? 'Unpin location' : 'Pin location'}
                  >
                    {current.isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                </div>
              )}

              {/* Search */}
              <div>
                <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">
                  Search an address
                </div>
                <AddressAutocomplete
                  value={searchValue}
                  onChange={setSearchValue}
                  onSelectNormalized={(n) => {
                    if (n.latitude == null || n.longitude == null) {
                      setError('This address is missing coordinates');
                      return;
                    }
                    commit({
                      key: 'search',
                      label: [n.address, n.city, n.state].filter(Boolean).join(', '),
                      type: 'searched',
                      latitude: n.latitude,
                      longitude: n.longitude,
                      city: n.city || null,
                      state: n.state || null,
                      zipcode: n.zipcode || null,
                    });
                  }}
                  placeholder="Search a city or address"
                />
              </div>

              {/* Homes */}
              {(payload?.homes?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">
                    Your homes
                  </div>
                  <div className="space-y-2">
                    {payload!.homes.map((h) => {
                      const key = `home:${h.id}`;
                      const active = currentKey === key;
                      const available = hasCoordinates(h);
                      return (
                        <OptionRow
                          key={h.id}
                          icon={<HomeIcon className="w-4 h-4" />}
                          title={h.name}
                          subtitle={available ? [h.city, h.state].filter(Boolean).join(', ') : 'Location unavailable'}
                          active={active}
                          disabled={saving !== null || active || !available}
                          onClick={() => {
                            if (saving || active) return;
                            commit({
                              key,
                              label: h.name,
                              type: 'home',
                              latitude: h.latitude,
                              longitude: h.longitude,
                              sourceId: h.id,
                              city: h.city || null,
                              state: h.state || null,
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Business locations */}
              {(payload?.businessLocations?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">
                    Business locations
                  </div>
                  <div className="space-y-2">
                    {payload!.businessLocations.map((bl) => {
                      const key = `biz:${bl.id}`;
                      const active = currentKey === key;
                      const label = bl.label || bl.businessName;
                      const available = hasCoordinates(bl);
                      return (
                        <OptionRow
                          key={bl.id}
                          icon={<Briefcase className="w-4 h-4" />}
                          title={label}
                          subtitle={available ? [bl.businessName, bl.city, bl.state].filter((v, i) => v && (i === 0 ? v !== label : true)).join(' · ') : 'Location unavailable'}
                          active={active}
                          disabled={saving !== null || active || !available}
                          onClick={() => {
                            if (saving || active) return;
                            commit({
                              key,
                              label,
                              type: 'business',
                              latitude: bl.latitude,
                              longitude: bl.longitude,
                              sourceId: bl.id,
                              city: bl.city || null,
                              state: bl.state || null,
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recents */}
              {(payload?.recentLocations?.length ?? 0) > 0 && (
                <div>
                  <div className="text-xs font-bold text-app-text-muted uppercase tracking-wider mb-2">
                    Recent
                  </div>
                  <div className="space-y-2">
                    {payload!.recentLocations.map((r) => {
                      const key = `recent:${r.id}`;
                      const available = hasCoordinates(r);
                      return (
                        <OptionRow
                          key={r.id}
                          icon={<Clock className="w-4 h-4" />}
                          title={r.label}
                          subtitle={available ? [r.city, r.state].filter(Boolean).join(', ') : 'Location unavailable'}
                          disabled={saving !== null || !available}
                          onClick={() => {
                            if (saving) return;
                            commit({
                              key,
                              label: r.label,
                              type: r.type,
                              latitude: r.latitude,
                              longitude: r.longitude,
                              sourceId: r.sourceId ?? null,
                              city: r.city ?? null,
                              state: r.state ?? null,
                            });
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty fallback */}
              {!current &&
                (payload?.homes?.length ?? 0) === 0 &&
                (payload?.businessLocations?.length ?? 0) === 0 &&
                (payload?.recentLocations?.length ?? 0) === 0 && (
                  <div className="text-sm text-app-text-secondary text-center py-6">
                    Search for an address above to set your location.
                  </div>
                )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
