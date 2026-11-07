'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import * as api from '@pantopus/api';
import { businessAccessQuery } from '@/components/business/useBusinessData';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
type WeeklyHour = {
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_closed: boolean;
  notes?: string;
  present: boolean;
};

// A time input can't hold a saved 24:00 or a mistyped value; those stay text so the owner sees them.
const timeInputType = (value: string) => (!value || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d(\.\d+)?)?$/.test(value) ? 'time' : 'text');

function editableHours(saved: api.businesses.BusinessHours[]): WeeklyHour[] {
  return DAY_NAMES.flatMap((_, day) => {
    const intervals = saved.filter((h) => h.day_of_week === day);
    if (intervals.length) {
      return intervals.map((h) => ({
        day_of_week: day,
        // A closed row has no times saved; unchecking Closed starts from the usual draft again.
        open_time: h.open_time || (h.is_closed ? '09:00' : ''),
        close_time: h.close_time || (h.is_closed ? '17:00' : ''),
        is_closed: h.is_closed,
        notes: h.notes ?? undefined,
        present: true,
      }));
    }
    // Keep the initial seven-day draft for a new schedule. Missing days in an
    // existing schedule stay unset until the owner explicitly adds them.
    return [{ day_of_week: day, open_time: '09:00', close_time: '17:00', is_closed: day === 0, present: saved.length === 0 }];
  });
}

export default function BusinessLocationHoursPage() {
  const params = useParams();
  const businessId = String(params.id || '');
  const locationId = String(params.locId || '');
  return <BusinessLocationHoursEditor key={`${businessId}:${locationId}`} businessId={businessId} locationId={locationId} />;
}

function BusinessLocationHoursEditor({ businessId, locationId }: { businessId: string; locationId: string }) {
  const [loading, setLoading] = useState(true);
  const [weeklyReady, setWeeklyReady] = useState(false);
  const [specialLoading, setSpecialLoading] = useState(true);
  const [specialError, setSpecialError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hours, setHours] = useState<WeeklyHour[]>([]);
  const [specialHours, setSpecialHours] = useState<api.businesses.BusinessSpecialHours[]>([]);
  const weeklyRequest = useRef(0);
  const specialRequest = useRef(0);
  const mutationPending = useRef(false);
  const access = useQuery({ ...businessAccessQuery(businessId), retry: false });
  // A background refresh (tabbing back to the window) keeps the last answer, so it can't interrupt typing.
  // The server checks every write, and a refresh that fails or loses access turns editing off.
  const canEdit = !access.isError && !!access.data?.hasAccess
    && (access.data.isOwner || access.data.permissions.includes('hours.edit'));
  const [specialForm, setSpecialForm] = useState({
    date: '',
    open_time: '',
    close_time: '',
    is_closed: false,
    label: '',
  });

  const loadWeekly = useCallback(async () => {
    const request = ++weeklyRequest.current;
    setLoading(true);
    setError('');
    try {
      const res = await api.businesses.getLocationHours(businessId, locationId);
      if (request !== weeklyRequest.current) return;
      setHours(editableHours(res.hours));
      setWeeklyReady(true);
    } catch (e: unknown) {
      if (request !== weeklyRequest.current) return;
      setWeeklyReady(false);
      setError(e instanceof Error ? e.message : 'Failed to load hours');
    } finally {
      if (request === weeklyRequest.current) setLoading(false);
    }
  }, [businessId, locationId]);

  const loadSpecial = useCallback(async () => {
    const request = ++specialRequest.current;
    setSpecialLoading(true);
    setSpecialError('');
    try {
      const res = await api.businesses.getSpecialHours(businessId, locationId);
      if (request === specialRequest.current) setSpecialHours(res.specialHours);
    } catch (e: unknown) {
      if (request === specialRequest.current) setSpecialError(e instanceof Error ? e.message : 'Failed to load special hours');
    } finally {
      if (request === specialRequest.current) setSpecialLoading(false);
    }
  }, [businessId, locationId]);

  useEffect(() => {
    void loadWeekly();
    void loadSpecial();
    return () => { weeklyRequest.current += 1; specialRequest.current += 1; };
  }, [loadWeekly, loadSpecial]);

  const updateHour = (idx: number, patch: Partial<WeeklyHour>) => {
    setHours((prev) => prev.map((h, i) => (i === idx ? { ...h, ...patch } : h)));
  };

  const saveWeekly = async () => {
    if (mutationPending.current || !weeklyReady || !canEdit) return;
    if (hours.some((h) => h.present && !h.is_closed && (!h.open_time || !h.close_time))) {
      setError('Enter opening and closing times, or mark the interval as closed.');
      return;
    }
    mutationPending.current = true;
    setNotice('');
    setSaving(true);
    setError('');
    try {
      const res = await api.businesses.setLocationHours(businessId, locationId, {
        hours: hours.filter((h) => h.present).map((h) => ({
          day_of_week: h.day_of_week,
          open_time: h.is_closed ? undefined : h.open_time || undefined,
          close_time: h.is_closed ? undefined : h.close_time || undefined,
          is_closed: h.is_closed,
          notes: h.notes,
        })),
      });
      setHours(editableHours(res.hours));
      setNotice('Weekly hours saved.');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save weekly hours');
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const addSpecial = async () => {
    if (mutationPending.current || !canEdit || specialLoading || specialError) return;
    setNotice('');
    if (!specialForm.date) { setError('Choose a date for the special hours.'); return; }
    if (!specialForm.is_closed && (!specialForm.open_time || !specialForm.close_time)) {
      setError('Enter opening and closing times, or mark the date as closed.');
      return;
    }
    setSaving(true);
    mutationPending.current = true;
    setError('');
    try {
      const res = await api.businesses.addSpecialHours(businessId, locationId, {
        date: specialForm.date,
        label: specialForm.label || undefined,
        open_time: specialForm.is_closed ? undefined : specialForm.open_time || undefined,
        close_time: specialForm.is_closed ? undefined : specialForm.close_time || undefined,
        is_closed: specialForm.is_closed,
      });
      setSpecialForm({ date: '', open_time: '', close_time: '', is_closed: false, label: '' });
      setSpecialHours((prev) => [...prev, res.specialHour].sort((a, b) => a.date.localeCompare(b.date)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add special hours');
    } finally {
      mutationPending.current = false;
      setSaving(false);
    }
  };

  const removeSpecial = async (id: string) => {
    if (mutationPending.current || !canEdit || specialLoading || specialError) return;
    mutationPending.current = true;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.businesses.deleteSpecialHours(businessId, locationId, id);
      setSpecialHours((prev) => prev.filter((h) => h.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to remove special hours');
    } finally {
      mutationPending.current = false;
      setSaving(false);
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

      {error && <div role="alert" className="text-sm text-red-600 mb-3">{error}</div>}
      {notice && <p role="status" className="text-sm text-green-700 mb-3">{notice}</p>}
      {access.isError && <div role="alert" className="text-sm text-red-600 mb-3">Editing access could not be checked. <button onClick={() => void access.refetch()} className="underline">Retry access check</button></div>}
      {access.isPending && <p className="text-sm text-app-text-secondary mb-3">Checking editing access...</p>}
      {access.isSuccess && !canEdit && <p className="text-sm text-app-text-secondary mb-3">You can view these hours. Editing access is required to make changes.</p>}

        <div className="space-y-5">
          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-3">Weekly Hours</h2>
            {loading && <p className="text-app-text-secondary">Loading weekly hours...</p>}
            {!loading && !weeklyReady && <button onClick={() => void loadWeekly()} className="text-sm underline">Retry weekly hours</button>}
            {!loading && weeklyReady && <>
            <fieldset disabled={saving || !canEdit} className="space-y-2">
              {hours.map((h, idx) => {
                const day = DAY_NAMES[h.day_of_week];
                const label = hours.filter((row) => row.day_of_week === h.day_of_week).length > 1
                  ? `${day} interval ${hours.slice(0, idx + 1).filter((row) => row.day_of_week === h.day_of_week).length}` : day;
                return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3 text-sm text-app-text-strong">{label}</div>
                  {!h.present ? <div className="col-span-9 text-sm text-app-text-secondary">Not set · <button onClick={() => updateHour(idx, { present: true })} disabled={hours.filter((row) => row.present).length >= 7} className="underline disabled:opacity-50">Set {DAY_NAMES[h.day_of_week]} hours</button></div> : <>
                  <label className="col-span-2 text-xs inline-flex items-center gap-1">
                    <input
                      type="checkbox"
                      aria-label={`${label} closed`}
                      checked={h.is_closed}
                      onChange={(e) => updateHour(idx, { is_closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  <input
                    type={timeInputType(h.open_time)}
                    step="any"
                    aria-label={`${label} opening time`}
                    disabled={h.is_closed}
                    value={h.open_time || ''}
                    onChange={(e) => updateHour(idx, { open_time: e.target.value })}
                    className="col-span-3 rounded border border-app-border px-2 py-1 text-sm disabled:bg-app-surface-sunken"
                  />
                  <input
                    type={timeInputType(h.close_time)}
                    step="any"
                    aria-label={`${label} closing time`}
                    disabled={h.is_closed}
                    value={h.close_time || ''}
                    onChange={(e) => updateHour(idx, { close_time: e.target.value })}
                    className="col-span-3 rounded border border-app-border px-2 py-1 text-sm disabled:bg-app-surface-sunken"
                  />
                  {h.notes && <p className="col-span-12 text-xs text-app-text-secondary break-words">{h.notes}</p>}
                  </>}
                </div>
              ); })}
            </fieldset>
            {hours.filter((h) => h.present).length >= 7 && hours.some((h) => !h.present) && <p className="mt-2 text-xs text-app-text-secondary">A schedule supports up to seven saved intervals.</p>}
            <button
              onClick={saveWeekly}
              disabled={saving || !canEdit || hours.filter((h) => h.present).length > 7}
              className="mt-4 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Weekly Hours'}
            </button>
            </>}
          </div>

          <div className="bg-app-surface border border-app-border rounded-xl p-5">
            <h2 className="text-sm font-semibold text-app-text mb-3">Special Hours</h2>
            {specialLoading && <p className="text-app-text-secondary mb-3">Loading special hours...</p>}
            {specialError && <div role="alert" className="text-sm text-red-600 mb-3">{specialError} <button onClick={() => void loadSpecial()} className="underline">Retry special hours</button></div>}
            <fieldset disabled={saving || !canEdit || specialLoading || !!specialError} className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
              <input type="date" aria-label="Date" value={specialForm.date} onChange={(e) => setSpecialForm((f) => ({ ...f, date: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm" />
              <input type="text" aria-label="Label" placeholder="Label" value={specialForm.label} onChange={(e) => setSpecialForm((f) => ({ ...f, label: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm" />
              <input type="time" aria-label="Opening time" disabled={specialForm.is_closed} value={specialForm.open_time} onChange={(e) => setSpecialForm((f) => ({ ...f, open_time: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm disabled:bg-app-surface-sunken" />
              <input type="time" aria-label="Closing time" disabled={specialForm.is_closed} value={specialForm.close_time} onChange={(e) => setSpecialForm((f) => ({ ...f, close_time: e.target.value }))} className="rounded border border-app-border px-2 py-1.5 text-sm disabled:bg-app-surface-sunken" />
              <label className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" aria-label="Closed on special date" checked={specialForm.is_closed} onChange={(e) => setSpecialForm((f) => ({ ...f, is_closed: e.target.checked }))} />
                Closed
              </label>
            </fieldset>
            <button onClick={addSpecial} disabled={saving || !canEdit || specialLoading || !!specialError} className="px-3 py-1.5 rounded-lg border border-app-border text-sm text-app-text-strong hover:bg-app-hover disabled:opacity-50">
              Add Special Hour
            </button>

            <div className="mt-4 space-y-2">
              {!specialLoading && !specialError && specialHours.length === 0 ? (
                <div className="text-sm text-app-text-secondary">No special-hour overrides.</div>
              ) : (
                specialHours.map((sh) => (
                  <div key={sh.id} className="flex items-center justify-between text-sm border border-app-border rounded px-3 py-2">
                    <div>
                      <span className="font-medium text-app-text">{sh.date}</span>
                      {sh.label ? <span className="text-app-text-secondary"> · {sh.label}</span> : null}
                      <span className="text-app-text-secondary ml-2">{sh.is_closed ? 'Closed' : `${sh.open_time} - ${sh.close_time}`}</span>
                    </div>
                    <button onClick={() => void removeSpecial(sh.id)} disabled={saving || !canEdit || specialLoading || !!specialError} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
