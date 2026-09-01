// @ts-nocheck
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { Home } from '@pantopus/types';
import { toast } from '@/components/ui/toast-store';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const HOME_TYPES = [
  { value: 'house', label: 'House' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'condo', label: 'Condo' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'studio', label: 'Studio' },
  { value: 'rv', label: 'RV' },
  { value: 'mobile_home', label: 'Mobile Home' },
  { value: 'multi_unit', label: 'Multi-unit' },
  { value: 'other', label: 'Other' },
];

const VISIBILITY_OPTIONS = [
  { value: 'private', label: 'Private', desc: 'Only members can see details' },
  { value: 'members', label: 'Members', desc: 'Members and invited guests' },
  { value: 'public_preview', label: 'Public Preview', desc: 'Basic info visible to others' },
];

function parseLocation(loc: Record<string, any> | string | null | undefined): { latitude: number | null; longitude: number | null } {
  if (!loc) return { latitude: null, longitude: null };
  if (loc?.coordinates?.length >= 2) {
    const [lng, lat] = loc.coordinates;
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
  }
  if (typeof loc === 'string') {
    const m = loc.match(/POINT\(([^ ]+) ([^ ]+)\)/i);
    if (m) {
      const lng = parseFloat(m[1]), lat = parseFloat(m[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { latitude: lat, longitude: lng };
    }
  }
  return { latitude: null, longitude: null };
}

export default function EditHomePage() {
  const router = useRouter();
  const params = useParams();
  const homeId = String((params as Record<string, any>)?.id || '');

  const [home, setHome] = useState<Home | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Form fields
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [homeType, setHomeType] = useState('house');
  const [bedrooms, setBedrooms] = useState('');
  const [bathrooms, setBathrooms] = useState('');
  const [sqft, setSqft] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [moveInDate, setMoveInDate] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [description, setDescription] = useState('');
  const [entryInstructions, setEntryInstructions] = useState('');
  const [parkingInstructions, setParkingInstructions] = useState('');
  const [visibility, setVisibility] = useState('private');

  // Location
  const [hasCoords, setHasCoords] = useState(false);
  const [coordLat, setCoordLat] = useState('');
  const [coordLng, setCoordLng] = useState('');
  const [geocoding, setGeocoding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const token = getAuthToken();
    if (!token) { router.push('/login'); return; }
    try {
      const res = await api.homes.getHome(homeId);
      const h = (res as Record<string, any>)?.home as Record<string, any> | undefined;
      setHome(h);

      setName(h?.name || '');
      setUnit(h?.address2 || h?.unit_number || '');
      setHomeType(h?.home_type || 'house');
      setBedrooms(h?.bedrooms != null ? String(h.bedrooms) : '');
      setBathrooms(h?.bathrooms != null ? String(h.bathrooms) : '');
      setSqft(h?.sq_ft != null ? String(h.sq_ft) : h?.square_feet != null ? String(h.square_feet) : '');
      setYearBuilt(h?.year_built != null ? String(h.year_built) : '');
      setMoveInDate(h?.move_in_date || '');
      setIsOwner(h?.is_owner || false);
      setDescription(h?.description || '');
      setEntryInstructions(h?.entry_instructions || '');
      setParkingInstructions(h?.parking_instructions || '');
      setVisibility(h?.visibility || 'private');

      const { latitude, longitude } = parseLocation(h?.location);
      if (latitude != null && longitude != null) {
        setHasCoords(true);
        setCoordLat(String(latitude));
        setCoordLng(String(longitude));
      } else {
        setHasCoords(false);
        setCoordLat('');
        setCoordLng('');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load home');
      router.push('/app/homes');
    } finally {
      setLoading(false);
    }
  }, [homeId, router]);

  useEffect(() => { load(); }, [load]);

  const geocodeAddress = async () => {
    if (!home) return;
    const addr = [home.address, home.address2, home.city, home.state, home.zipcode].filter(Boolean).join(', ');
    if (!addr) { toast.warning('No address to geocode'); return; }

    setGeocoding(true);
    try {
      const token = getAuthToken();
      const r = await fetch(
        `${API_BASE}/api/geo/autocomplete?q=${encodeURIComponent(addr)}`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      const data = await r.json().catch(() => ({}));
      const best = (data?.suggestions || [])[0];
      if (best?.center) {
        setCoordLng(String(best.center.lng));
        setCoordLat(String(best.center.lat));
        setHasCoords(true);
      } else {
        toast.warning('Could not find coordinates for this address.');
      }
    } catch {
      toast.error('Geocoding failed. Check your connection.');
    } finally {
      setGeocoding(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg('');
    try {
      const payload: Record<string, any> = {
        name: name.trim() || null,
        unit_number: unit.trim() || null,
        home_type: homeType,
        description: description.trim() || null,
        entry_instructions: entryInstructions.trim() || null,
        parking_instructions: parkingInstructions.trim() || null,
        visibility,
        is_owner: isOwner,
      };

      const bd = parseInt(bedrooms, 10);
      payload.bedrooms = Number.isFinite(bd) ? bd : null;
      const bt = parseFloat(bathrooms);
      payload.bathrooms = Number.isFinite(bt) ? bt : null;
      const sf = parseInt(sqft, 10);
      payload.sq_ft = Number.isFinite(sf) ? sf : null;
      const yb = parseInt(yearBuilt, 10);
      payload.year_built = Number.isFinite(yb) ? yb : null;
      if (moveInDate) payload.move_in_date = moveInDate;

      const lat = parseFloat(coordLat);
      const lng = parseFloat(coordLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        payload.location = { latitude: lat, longitude: lng };
      }

      await api.homes.updateHome(homeId, payload);
      setSuccessMsg('Saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-gray-600 mx-auto" />
      </div>
    );
  }

  const addressLine = [home?.address, home?.address2].filter(Boolean).join(' ');
  const cityLine = [home?.city, home?.state, home?.zipcode].filter(Boolean).join(', ');

  return (
    <div className="bg-app-surface-raised">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => router.back()} className="text-sm text-app-text-secondary hover:text-app-text-strong mb-1 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h1 className="text-xl font-semibold text-app-text">Home Settings</h1>
          </div>
        </div>

        {/* Address card */}
        <div className="rounded-xl border border-app-border bg-app-surface p-5 mb-6">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🏠</span>
            <div>
              <div className="text-base font-semibold text-app-text">{addressLine}</div>
              <div className="text-sm text-app-text-secondary">{cityLine}</div>
              {hasCoords ? (
                <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                  Coordinates set
                </div>
              ) : (
                <div className="text-xs text-amber-600 mt-1">⚠ No coordinates — tasks can&apos;t pin to this home on the map</div>
              )}
            </div>
          </div>
        </div>

        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800 flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
            {successMsg}
          </div>
        )}

        <form onSubmit={save} className="space-y-6">
          {/* ── Location / Coordinates ── */}
          <div className="rounded-xl border border-app-border bg-app-surface p-5">
            <h2 className="text-base font-semibold text-app-text mb-1">📍 Location</h2>
            <p className="text-xs text-app-text-secondary mb-4">Coordinates are used to show tasks on the map.</p>
            {hasCoords ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-app-text-strong mb-1.5">Latitude</label>
                    <input type="number" step="any" value={coordLat} onChange={(e) => setCoordLat(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="45.123456" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-app-text-strong mb-1.5">Longitude</label>
                    <input type="number" step="any" value={coordLng} onChange={(e) => setCoordLng(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="-122.654321" />
                  </div>
                </div>
                <button type="button" onClick={geocodeAddress} disabled={geocoding} className="text-xs text-blue-600 hover:text-blue-800">
                  {geocoding ? 'Detecting...' : '🔄 Re-detect from address'}
                </button>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-app-text-secondary mb-3">This home has no coordinates set yet.</p>
                <button
                  type="button"
                  onClick={geocodeAddress}
                  disabled={geocoding}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm"
                >
                  {geocoding ? 'Finding coordinates...' : '📍 Auto-detect from address'}
                </button>
              </div>
            )}
          </div>

          {/* ── Basic Info ── */}
          <div className="rounded-xl border border-app-border bg-app-surface p-5">
            <h2 className="text-base font-semibold text-app-text mb-4">🏡 Basic Info</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1.5">Home nickname (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., My Camas Home" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" maxLength={120} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Home type</label>
                  <select value={homeType} onChange={(e) => setHomeType(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    {HOME_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Unit / Apt #</label>
                  <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Apt 12B" className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Bedrooms</label>
                  <input type="number" min="0" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Bathrooms</label>
                  <input type="number" min="0" step="0.5" value={bathrooms} onChange={(e) => setBathrooms(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Sq ft</label>
                  <input type="number" min="0" value={sqft} onChange={(e) => setSqft(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Year built</label>
                  <input type="number" min="1600" max="2100" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" placeholder="2017" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-app-text-strong mb-1.5">Move-in date</label>
                  <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 mt-2 cursor-pointer">
                <input type="checkbox" checked={isOwner} onChange={(e) => setIsOwner(e.target.checked)} className="w-4 h-4 rounded border-app-border text-blue-600 focus:ring-blue-500" />
                <span className="text-sm text-app-text-strong">I own this home</span>
              </label>
            </div>
          </div>

          {/* ── Description ── */}
          <div className="rounded-xl border border-app-border bg-app-surface p-5">
            <h2 className="text-base font-semibold text-app-text mb-4">📝 Description</h2>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Anything notable about your home..."
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* ── Instructions ── */}
          <div className="rounded-xl border border-app-border bg-app-surface p-5">
            <h2 className="text-base font-semibold text-app-text mb-4">🚪 Instructions</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1.5">Entry instructions</label>
                <textarea
                  value={entryInstructions}
                  onChange={(e) => setEntryInstructions(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="e.g., Front door code is 1234, ring bell twice..."
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-app-text-strong mb-1.5">Parking instructions</label>
                <textarea
                  value={parkingInstructions}
                  onChange={(e) => setParkingInstructions(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="e.g., Park in driveway, street parking available..."
                  className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* ── Visibility ── */}
          <div className="rounded-xl border border-app-border bg-app-surface p-5">
            <h2 className="text-base font-semibold text-app-text mb-4">👁 Visibility</h2>
            <div className="space-y-2">
              {VISIBILITY_OPTIONS.map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                    visibility === opt.value ? 'border-blue-500 bg-blue-50' : 'border-app-border hover:border-app-border'
                  }`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={opt.value}
                    checked={visibility === opt.value}
                    onChange={() => setVisibility(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-sm font-medium text-app-text">{opt.label}</div>
                    <div className="text-xs text-app-text-secondary">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Save */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 text-white py-3 rounded-lg hover:bg-gray-800 font-semibold disabled:opacity-50 transition"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </main>
    </div>
  );
}