'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plane } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { VacationHold } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

function localDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function VacationContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<VacationHold | null>(null);
  const [upcoming, setUpcoming] = useState<VacationHold | null>(null);

  // Setup form: the user's own calendar days (toISOString() is the UTC day, a day off in some hours).
  const [startDate, setStartDate] = useState(() => localDay(new Date()));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return localDay(d);
  });
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await api.mailboxV2P3.getVacationStatus();
      setActive(result.active);
      setUpcoming(result.upcoming);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const dateError = !startDate || !endDate ? 'Choose departure and return dates.'
    : endDate < startDate ? 'Return date must be on or after departure.'
      : startDate < localDay(new Date()) ? 'Departure must be today or later.' : null;

  const handleStart = async () => {
    if (creating || dateError) return;
    setCreating(true);
    try {
      const homesResult = await api.homes.getHomes();
      const homesList = (homesResult as any)?.homes ?? homesResult;
      const homeId = homesList?.[0]?.id;
      if (!homeId) { toast.error('You need a home to set vacation mode'); return; }
      const result = await api.mailboxV2P3.startVacation({
        homeId,
        startDate,
        endDate,
        // Compatibility fields are stored only; no delivery handling is performed.
        holdAction: 'hold_in_vault',
        packageAction: 'hold_at_carrier',
        autoNeighborRequest: false,
      });
      setActive(result.hold.status === 'active' ? result.hold : null);
      setUpcoming(result.hold.status === 'scheduled' ? result.hold : null);
      toast.success('Travel dates saved');
    } catch {
      toast.error('Could not save your travel dates. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = async () => {
    const holdId = active?.id || upcoming?.id;
    if (!holdId) return;
    setCancelling(true);
    try {
      await api.mailboxV2P3.cancelVacation(holdId);
      await loadStatus();
      toast.success('Travel dates cancelled');
    } catch {
      toast.error('Could not cancel your travel dates. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(`${d.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });


  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  if (loadError) return <div className="max-w-2xl mx-auto px-4 py-6 text-center"><p role="alert" className="text-sm text-app-text-secondary mb-3">Couldn&apos;t load your travel dates.</p><button type="button" onClick={() => void loadStatus()} className="text-sm text-primary-600 hover:underline">Try again</button></div>;

  const hold = active || upcoming;

  // ── ACTIVE STATE ──
  if (hold) {
    const scheduled = hold.status === 'scheduled';
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <div>
            <h1 className="text-xl font-bold text-app-text">Travel Mode</h1>
            <p className="text-xs text-app-text-muted">{scheduled ? 'Scheduled' : 'Current'} &middot; Returns {formatDate(hold.end_date)}</p>
          </div>
        </div>

        {/* Active banner */}
        <div className="bg-gray-700 rounded-2xl p-6 mb-4 text-center text-white">
          <Plane className="w-10 h-10 mx-auto mb-3 opacity-80" />
          <p className="text-xl font-bold mb-1">Travel Dates {scheduled ? 'Scheduled' : 'Current'}</p>
          <p className="text-sm opacity-70 mb-4">
            {formatDate(hold.start_date)} &ndash; {formatDate(hold.end_date)}
          </p>
          <p className="bg-white/10 rounded-xl p-3 text-left text-sm opacity-90">
            Your travel dates are saved. This does not pause mail, arrange package handling, or show an away status to others. Contact your carrier directly for delivery changes.
          </p>
        </div>


        <button onClick={handleCancel} disabled={cancelling}
          className="w-full py-3 bg-app-surface-sunken text-app-text font-bold rounded-xl hover:bg-app-hover disabled:opacity-50 transition">
          {cancelling ? 'Cancelling...' : 'Cancel Travel Mode'}
        </button>
      </div>
    );
  }

  // ── SETUP STATE ──
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
        <div>
          <h1 className="text-xl font-bold text-app-text">Travel Mode</h1>
          <p className="text-xs text-app-text-muted">Set your travel dates</p>
        </div>
      </div>

      {/* Dates */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <p className="text-[11px] font-bold tracking-wider text-app-text-muted mb-3">TRAVEL DATES</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Departure</label>
            <input type="date" value={startDate} min={localDay(new Date())}
              onChange={e => { setStartDate(e.target.value); if (e.target.value >= endDate) { const d = new Date(`${e.target.value}T00:00:00`); d.setDate(d.getDate() + 1); setEndDate(localDay(d)); } }}
              className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="text-xs text-app-text-muted mb-1 block">Return</label>
            <input type="date" value={endDate} min={startDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        </div>
      </div>

      <p className="text-sm text-app-text-secondary mb-4">
        Saving dates does not pause mail, arrange package handling, or show an away status to others. Contact your carrier directly for delivery changes.
      </p>
      {dateError && <p role="alert" className="text-sm text-red-600 mb-3">{dateError}</p>}

      <button onClick={handleStart} disabled={creating || !!dateError}
        className="w-full py-3.5 bg-gray-700 text-white rounded-xl font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition">
        {creating ? 'Saving...' : 'Save Travel Dates'}
      </button>
    </div>
  );
}

export default function VacationPage() { return <Suspense><VacationContent /></Suspense>; }
