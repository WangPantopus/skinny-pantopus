'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plane, ShieldCheck, Calendar } from 'lucide-react';
import * as api from '@pantopus/api';
import { getAuthToken } from '@pantopus/api';
import type { VacationHold, HoldAction, PackageHoldAction } from '@pantopus/api';
import { toast } from '@/components/ui/toast-store';

const MAIL_OPTIONS: { id: HoldAction; label: string; sub: string }[] = [
  { id: 'hold_in_vault', label: 'Hold in Vault', sub: 'Auto-file, notify for urgent only' },
  { id: 'forward_to_household', label: 'Forward to household member', sub: 'Spouse or roommate sees everything' },
  { id: 'notify_urgent_only', label: 'Urgent items only', sub: 'Bills due, certified, time-sensitive' },
];

const PKG_OPTIONS: { id: PackageHoldAction; label: string; sub: string }[] = [
  { id: 'ask_neighbor', label: 'Ask a Verified Neighbor', sub: 'Auto-gig posted when package arrives' },
  { id: 'locker', label: 'Auto-request locker delivery', sub: 'If carrier locker available nearby' },
  { id: 'hold_at_carrier', label: 'Hold at carrier facility', sub: 'Pick up when you return' },
];

function VacationContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<VacationHold | null>(null);
  const [upcoming, setUpcoming] = useState<VacationHold | null>(null);

  // Setup form
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [mailAction, setMailAction] = useState<HoldAction>('hold_in_vault');
  const [pkgAction, setPkgAction] = useState<PackageHoldAction>('ask_neighbor');
  const [autoGig, setAutoGig] = useState(true);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { if (!getAuthToken()) router.push('/login'); }, [router]);

  useEffect(() => {
    api.mailboxV2P3.getVacationStatus()
      .then(result => { setActive(result.active); setUpcoming(result.upcoming); })
      .catch(() => toast.error('Failed to load vacation status'))
      .finally(() => setLoading(false));
  }, []);

  const handleStart = async () => {
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
        holdAction: mailAction,
        packageAction: pkgAction,
        autoNeighborRequest: autoGig,
      });
      setActive(result.hold);
      toast.success('Travel mode activated');
    } catch {
      toast.error('Could not set vacation mode');
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
      setActive(null);
      setUpcoming(null);
      toast.success('Travel mode cancelled');
    } catch {
      toast.error('Could not cancel vacation mode');
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const daysUntilReturn = () => {
    if (!active?.end_date) return 0;
    return Math.max(0, Math.ceil((new Date(active.end_date).getTime() - Date.now()) / 86400000));
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><div className="animate-spin h-8 w-8 border-3 border-emerald-600 border-t-transparent rounded-full" /></div>;

  const hold = active || upcoming;

  // ── ACTIVE STATE ──
  if (hold) {
    const days = daysUntilReturn();
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.back()} className="p-1.5 hover:bg-app-hover rounded-lg transition"><ArrowLeft className="w-5 h-5 text-app-text" /></button>
          <div>
            <h1 className="text-xl font-bold text-app-text">Travel Mode</h1>
            <p className="text-xs text-app-text-muted">Active &middot; Returns {formatDate(hold.end_date)}</p>
          </div>
        </div>

        {/* Active banner */}
        <div className="bg-gray-700 rounded-2xl p-6 mb-4 text-center text-white">
          <Plane className="w-10 h-10 mx-auto mb-3 opacity-80" />
          <p className="text-xl font-bold mb-1">Travel Mode Active</p>
          <p className="text-sm opacity-70 mb-4">
            {formatDate(hold.start_date)} &ndash; {formatDate(hold.end_date)} &middot; Returns in {days} day{days !== 1 ? 's' : ''}
          </p>
          <div className="bg-white/10 rounded-xl p-3 text-left text-sm opacity-90 space-y-1">
            <p>&#10003; Mail Day paused (urgent items still alert)</p>
            <p>&#10003; Mail {hold.hold_action === 'hold_in_vault' ? 'holding in Vault' : hold.hold_action === 'forward_to_household' ? 'forwarded to household' : 'urgent items only'}</p>
            <p>&#10003; {hold.package_action === 'ask_neighbor' ? 'Neighbor auto-gig enabled for packages' : hold.package_action === 'locker' ? 'Locker delivery requested' : 'Packages held at carrier'}</p>
          </div>
        </div>

        {(hold.items_held_count || 0) > 0 && (
          <div className="bg-app-surface border border-app-border rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-app-text">{hold.items_held_count} item{hold.items_held_count !== 1 ? 's' : ''} held while away</p>
            <p className="text-xs text-app-text-muted mt-1">Will be released when you return</p>
          </div>
        )}

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
            <input type="date" value={startDate} min={new Date().toISOString().split('T')[0]}
              onChange={e => { setStartDate(e.target.value); if (e.target.value >= endDate) { const d = new Date(e.target.value); d.setDate(d.getDate() + 1); setEndDate(d.toISOString().split('T')[0]); } }}
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

      {/* Mail handling */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <p className="text-[11px] font-bold tracking-wider text-app-text-muted mb-3">WHILE YOU&apos;RE AWAY &mdash; MAIL</p>
        <div className="space-y-2">
          {MAIL_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setMailAction(opt.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${
                mailAction === opt.id ? 'border-gray-700 bg-gray-50' : 'border-transparent bg-app-surface-sunken'
              }`}>
              <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                mailAction === opt.id ? 'border-gray-700 bg-gray-700' : 'border-app-border'
              }`}>
                {mailAction === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-bold text-app-text">{opt.label}</p>
                <p className="text-xs text-app-text-muted">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Package handling */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 mb-4">
        <p className="text-[11px] font-bold tracking-wider text-app-text-muted mb-3">WHILE YOU&apos;RE AWAY &mdash; PACKAGES</p>
        <div className="space-y-2">
          {PKG_OPTIONS.map(opt => (
            <button key={opt.id} onClick={() => setPkgAction(opt.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 text-left transition ${
                pkgAction === opt.id ? 'border-gray-700 bg-gray-50' : 'border-transparent bg-app-surface-sunken'
              }`}>
              <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                pkgAction === opt.id ? 'border-gray-700 bg-gray-700' : 'border-app-border'
              }`}>
                {pkgAction === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div>
                <p className="text-sm font-bold text-app-text">{opt.label}</p>
                <p className="text-xs text-app-text-muted">{opt.sub}</p>
              </div>
            </button>
          ))}
        </div>

        {pkgAction === 'ask_neighbor' && (
          <label className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 mt-3 cursor-pointer">
            <input type="checkbox" checked={autoGig} onChange={e => setAutoGig(e.target.checked)}
              className="w-4 h-4 rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500" />
            <div>
              <p className="text-xs font-bold text-emerald-800">Auto-post gig when package arrives</p>
              <p className="text-[10px] text-emerald-600">No action needed from you while traveling</p>
            </div>
          </label>
        )}
      </div>

      {/* Safety note */}
      <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl mb-4">
        <ShieldCheck className="w-4 h-4 text-emerald-700 flex-shrink-0" />
        <p className="text-xs text-emerald-800">Only verified household members and trusted neighbors will handle your mail</p>
      </div>

      {/* CTA */}
      <button onClick={handleStart} disabled={creating}
        className="w-full py-3.5 bg-gray-700 text-white rounded-xl font-bold text-base hover:bg-gray-800 disabled:opacity-50 transition">
        {creating ? 'Setting up...' : 'Set Travel Mode'}
      </button>
    </div>
  );
}

export default function VacationPage() { return <Suspense><VacationContent /></Suspense>; }
