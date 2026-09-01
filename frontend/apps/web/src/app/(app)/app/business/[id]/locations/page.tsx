'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import type { BusinessLocation } from '@pantopus/types';
import { confirmStore } from '@/components/ui/confirm-store';

export default function BusinessLocationsPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [locations, setLocations] = useState<BusinessLocation[]>([]);
  const [form, setForm] = useState({
    label: '',
    address: '',
    city: '',
    state: '',
    zipcode: '',
    country: 'US',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getLocations(businessId);
      setLocations(res.locations || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load locations');
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const addLocation = async () => {
    if (!form.address.trim() || !form.city.trim()) {
      setError('Address and city are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.businesses.createLocation(businessId, {
        label: form.label.trim() || 'Main',
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.trim() || undefined,
        zipcode: form.zipcode.trim() || undefined,
        country: form.country.trim() || 'US',
        is_primary: locations.length === 0,
      });
      setForm({ label: '', address: '', city: '', state: '', zipcode: '', country: 'US' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add location');
    } finally {
      setSaving(false);
    }
  };

  const removeLocation = async (locationId: string) => {
    const yes = await confirmStore.open({ title: 'Deactivate this location?', confirmLabel: 'Deactivate', variant: 'destructive' });
    if (!yes) return;
    try {
      await api.businesses.deleteLocation(businessId, locationId);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove location');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Business Locations</h1>
          <p className="text-sm text-app-text-secondary mt-1">Manage branches and contact details</p>
        </div>
        <Link href={`/app/business/${businessId}/dashboard`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Dashboard
        </Link>
      </div>

      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-5 space-y-3">
        <h2 className="text-sm font-semibold text-app-text">Add Location</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Label" value={form.label} onChange={(v) => setForm((f) => ({ ...f, label: v }))} />
          <Field label="Address *" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
          <Field label="City *" value={form.city} onChange={(v) => setForm((f) => ({ ...f, city: v }))} />
          <Field label="State" value={form.state} onChange={(v) => setForm((f) => ({ ...f, state: v }))} />
          <Field label="Zipcode" value={form.zipcode} onChange={(v) => setForm((f) => ({ ...f, zipcode: v }))} />
          <Field label="Country" value={form.country} onChange={(v) => setForm((f) => ({ ...f, country: v }))} />
        </div>
        <button
          onClick={addLocation}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Add Location'}
        </button>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && <div className="text-app-text-secondary">Loading...</div>}

      {!loading && (
        <div className="space-y-3">
          {locations.length === 0 ? (
            <div className="bg-app-surface border border-app-border rounded-xl p-6 text-center text-app-text-secondary">No locations yet.</div>
          ) : (
            locations.map((loc) => (
              <div key={loc.id} className="bg-app-surface border border-app-border rounded-xl p-4 flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-app-text">{loc.label || 'Main'}</div>
                    {loc.is_primary && <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Primary</span>}
                  </div>
                  <div className="text-sm text-app-text-strong mt-1">{loc.address}</div>
                  <div className="text-xs text-app-text-secondary">{[loc.city, loc.state, loc.zipcode].filter(Boolean).join(', ')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/app/business/${businessId}/locations/${loc.id}/hours`} className="px-2.5 py-1 rounded border border-app-border text-xs text-app-text-strong hover:bg-app-hover">
                    Hours
                  </Link>
                  <button onClick={() => void removeLocation(loc.id)} className="px-2.5 py-1 rounded border border-red-300 text-xs text-red-700 hover:bg-red-50">
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-app-text-strong mb-1">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-app-border px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
      />
    </label>
  );
}
