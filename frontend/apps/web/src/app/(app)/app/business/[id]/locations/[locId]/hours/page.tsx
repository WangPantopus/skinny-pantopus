'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type WeeklyHour = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
};

export default function BusinessLocationHoursPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const locationId = String(params.locId || '');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hours, setHours] = useState<WeeklyHour[]>([]);
  const [specialHours, setSpecialHours] = useState<api.businesses.BusinessSpecialHours[]>([]);
  const [specialForm, setSpecialForm] = useState({
    date: '',
    open_time: '',
    close_time: '',
    is_closed: false,
    label: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [hoursRes, specialRes] = await Promise.all([
        api.businesses.getLocationHours(businessId, locationId),
        api.businesses.getSpecialHours(businessId, locationId),
      ]);
      const weekly = Array.from({ length: 7 }, (_, i) => {
        const found = (hoursRes.hours || []).find((h) => h.day_of_week === i);
        return {
          day_of_week: i,
          open_time: found?.open_time || '09:00',
          close_time: found?.close_time || '17:00',
          is_closed: found?.is_closed ?? (i === 0),
        };
      });
      setHours(weekly);
      setSpecialHours(specialRes.specialHours || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load hours');
    } finally {
      setLoading(false);
    }
  }, [businessId, locationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateHour = (idx: number, patch: Partial<WeeklyHour>) => {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  const saveWeekly = async () => {
    setSaving(true);
    setError('');
    try {
      await api.businesses.setLocationHours(businessId, locationId, {
        hours: hours.map((h) => ({
          day_of_week: h.day_of_week,
          open_time: h.is_closed ? undefined : h.open_time || undefined,
          close_time: h.is_closed ? undefined : h.close_time || undefined,
          is_closed: h.is_closed,
        })),
      });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save weekly hours');
    } finally {
      setSaving(false);
    }
  };

  const addSpecial = async () => {
    if (!specialForm.date) return;
    setSaving(true);
    setError('');
    try {
      await api.businesses.addSpecialHours(businessId, locationId, {
        date: specialForm.date,
        label: specialForm.label || undefined,
        open_time: specialForm.is_closed ? undefined : specialForm.open_time || undefined,
        close_time: specialForm.is_closed ? undefined : specialForm.close_time || undefined,
        is_closed: specialForm.is_closed,
      });
      setSpecialForm({ date: '', open_time: '', close_time: '', is_closed: false, label: '' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add special hours');
    } finally {
      setSaving(false);
    }
  };

  const removeSpecial = async (id: string) => {
    try {
      await api.businesses.deleteSpecialHours(businessId, locationId, id);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove special hours');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-app-text">Location Hours</h1>
          <p className="text-sm text-app-text-secondary mt-1">Weekly schedule and special date overrides</p>
        </div>
        <Link href={`/app/business/${businessId}/locations`} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover">
          Back to Locations
        </Link>
      </div>

      {error && <div className="text-sm text-red-600 mb-3">{error}</div>}
      {loading && <div className="text-app-text-secondary">Loading...</div>}

      {!loading && (
        <div className="space-y-5">
          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-3">Weekly Hours</h2>
            <div className="space-y-2">
              {hours.map((h, idx) => (
                <div key={h.day_of_week} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 text-sm text-app-text-strong">{DAY_NAMES[h.day_of_week]}</div>
                  <label className="col-span-2 text-xs inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={h.is_closed}
                      onChange={(e) => updateHour(idx, { is_closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type="time"
                    disabled={h.is_closed}
                    value={h.open_time || ''}
                    onChange={(e) => updateHour(idx, { open_time: e.target.value })}
                    className="col-span-3 rounded border border-app-border px-2 py-1 text-sm disabled:bg-app-surface-sunken"
                  />
                  <input
                    type="time"
                    disabled={h.is_closed}
                    value={h.close_time || ''}
                    onChange={(e) => updateHour(idx, { close_time: e.target.value })}
                    className="col-span-3 rounded border border-app-border px-2 py-1 text-sm disabled:bg-app-surface-sunken"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={saveWeekly}
              disabled={saving}
              className="mt-4 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Weekly Hours'}
            </button>
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-3">Special Hours</h2>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
              <input type="date" value={specialForm.date} onChange={(e) => setSpecialForm((f) => ({ ...f, date: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm" />
              <input type="text" placeholder="Label" value={specialForm.label} onChange={(e) => setSpecialForm((f) => ({ ...f, label: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm" />
              <input type="time" disabled={specialForm.is_closed} value={specialForm.open_time} onChange={(e) => setSpecialForm((f) => ({ ...f, open_time: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm disabled:bg-app-surface-sunken" />
              <input type="time" disabled={specialForm.is_closed} value={specialForm.close_time} onChange={(e) => setSpecialForm((f) => ({ ...f, close_time: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm disabled:bg-app-surface-sunken" />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" checked={specialForm.is_closed} onChange={(e) => setSpecialForm((f) => ({ ...f, is_closed: e.target.checked }))} />
                Closed
              </label>
            </div>
            <button onClick={addSpecial} disabled={saving} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover disabled:opacity-50">
              Add Special Hour
            </button>

            <div className="mt-4 space-y-2">
              {specialHours.length === 0 ? (
                <div className="text-sm text-app-text-secondary">No special-hour overrides.</div>
              ) : (
                specialHours.map((sh) => (
                  <div key={sh.id} className="flex items-center justify-between text-sm border border-app-border rounded px-3 py-2">
                    <div>
                      <span className="font-medium text-app-text">{sh.date}</span>
                      {sh.label ? <span className="text-app-text-secondary"> · {sh.label}</span> : null}
                      <span className="text-app-text-secondary ml-2">{sh.is_closed ? 'Closed' : `${sh.open_time} - ${sh.close_time}`}</span>
                    </div>
                    <button onClick={() => void removeSpecial(sh.id)} className="text-xs text-red-600 hover:underline">
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
