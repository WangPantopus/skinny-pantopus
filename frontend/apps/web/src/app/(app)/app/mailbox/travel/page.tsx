'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { VacationHold } from '@/types/mailbox';
import {
  useVacationHold,
  useCreateVacationHold,
  useCancelVacationHold,
} from '@/lib/mailbox-queries';
// The user's Home; the page sent a hard-coded 'home_1'.
import useHomeProfile from '../_components/useMailboxHome';

// ── Cancel confirmation dialog ───────────────────────────────

function CancelConfirmDialog({
  onConfirm,
  onCancel,
  confirming,
  error,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
  error: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-5">
        <h3 className="text-sm font-semibold text-app-text mb-2">
          Cancel Travel Mode?
        </h3>
        <p className="text-sm text-app-text-secondary dark:text-app-text-muted mb-1">
          Remove these saved travel dates? This does not change any delivery arrangements.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
          Contact your carrier directly to change a delivery or postal hold.
        </p>
        {error && <p role="alert" className="text-sm text-red-600 mb-3">Couldn&apos;t cancel your travel dates. Please try again.</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Keep Dates
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirming}
            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              confirming
                ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            }`}
          >
            {confirming ? 'Cancelling...' : 'Cancel Travel Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Days until return helper ─────────────────────────────────

function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(`${start.slice(0, 10)}T00:00:00`);
  const e = new Date(`${end.slice(0, 10)}T00:00:00`);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

// ── Active state component ───────────────────────────────────

function ActiveHoldView({
  hold,
  onCancel,
}: {
  hold: VacationHold;
  onCancel: () => void;
}) {
  const returnDays = daysUntil(hold.end_date);
  const scheduled = hold.status === 'scheduled';
  const cancelMutation = useCancelVacationHold();
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleCancel = useCallback(() => {
    cancelMutation.mutate(hold.id, {
      onSuccess: () => {
        setShowCancelConfirm(false);
        onCancel();
      },
    });
  }, [cancelMutation, hold.id, onCancel]);

  return (
    <>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <span className="text-2xl">✈️</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-app-text">
                Travel Mode
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                {scheduled ? 'Scheduled' : 'Current'}
              </span>
            </div>
            <p className="text-sm text-app-text-secondary dark:text-app-text-muted mt-0.5">
              {formatDateRange(hold.start_date, hold.end_date)}{!scheduled && <> · Returns in {returnDays} day{returnDays !== 1 ? 's' : ''}</>}
            </p>
          </div>
        </div>

        <p className="text-sm text-app-text-secondary">
          Your travel dates are saved. This does not pause mail, arrange package handling, or show an away status to others. Contact your carrier directly for delivery changes.
        </p>

        {/* Cancel */}
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="w-full py-2.5 text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          Cancel Travel Mode
        </button>
      </div>

      {showCancelConfirm && (
        <CancelConfirmDialog
          onConfirm={handleCancel}
          onCancel={() => setShowCancelConfirm(false)}
          confirming={cancelMutation.isPending}
          error={cancelMutation.isError}
        />
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function TravelModePage() {
  const home = useHomeProfile();
  const { data: hold, isLoading, isError, refetch } = useVacationHold();
  const createMutation = useCreateVacationHold();

  // ── Form state (inactive mode) ────────────────────────
  const [departure, setDeparture] = useState('');
  const [returnDate, setReturnDate] = useState('');

  // ── Validation ────────────────────────────────────────
  // The user's own calendar day. toISOString() is the UTC day, which is a day off in the evening (Americas)
  // or the morning (Asia/Pacific) and let a past departure through or blocked today's.
  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const dateError = useMemo(() => {
    if (!departure || !returnDate) return null;
    if (departure >= returnDate) return 'Return date must be after departure';
    if (departure < today) return 'Departure must be today or later';
    return null;
  }, [departure, returnDate, today]);

  const canSubmit = departure && returnDate && !dateError && !!home.homeId && !home.isError;

  // ── Poll active hold for package updates (30s) ────────
  useEffect(() => {
    if (!hold || hold.status !== 'active') return;
    const interval = setInterval(() => refetch(), 30_000);
    return () => clearInterval(interval);
  }, [hold, refetch]);

  // ── Submit ────────────────────────────────────────────
  const handleCreate = useCallback(() => {
    if (!canSubmit) return;
    createMutation.mutate(
      {
        homeId: home.homeId,
        startDate: departure,
        endDate: returnDate,
        // Compatibility fields are stored only; no delivery handling is performed.
        holdAction: 'hold_in_vault',
        packageAction: 'hold_at_carrier',
        autoNeighborRequest: false,
      },
      {
        onSuccess: () => refetch(),
      },
    );
  }, [canSubmit, home.homeId, departure, returnDate, createMutation, refetch]);

  if (isLoading || (!hold && home.isLoading)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!hold && (isError || home.isError)) {
    return <div className="max-w-xl mx-auto p-6 text-center"><p role="alert" className="text-sm text-app-text-secondary mb-3">Couldn&apos;t load your travel dates or Home.</p><button type="button" onClick={() => { void refetch(); void home.refetch(); }} className="text-sm text-primary-600 hover:underline">Try again</button></div>;
  }

  // ── Active state ──────────────────────────────────────
  const isActive = hold && (hold.status === 'active' || hold.status === 'scheduled');

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      <div className="max-w-xl mx-auto p-6">
        {isError && hold && <p role="alert" className="text-sm text-red-600 mb-3">Couldn&apos;t refresh your travel dates. <button type="button" onClick={() => refetch()} className="underline">Try again</button></p>}
        {isActive ? (
          <ActiveHoldView hold={hold} onCancel={() => refetch()} />
        ) : (
          <div className="space-y-6">
            {/* ── Header ─────────────────────────────────── */}
            <div className="flex items-center gap-3">
              <span className="text-2xl">✈️</span>
              <div>
                <h1 className="text-lg font-bold text-app-text">
                  Travel Mode
                </h1>
                <p className="text-sm text-app-text-secondary mt-0.5">
                  Save your travel dates for your own reference
                </p>
              </div>
            </div>

            {/* ── Travel dates ───────────────────────────── */}
            <div>
              <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
                Travel Dates
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-app-text-secondary mb-1 block">Departure</label>
                  <input
                    type="date"
                    value={departure}
                    min={today}
                    onChange={(e) => setDeparture(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-app-text-secondary mb-1 block">Return</label>
                  <input
                    type="date"
                    value={returnDate}
                    min={departure || today}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full text-sm px-3 py-2 border border-app-border rounded-lg bg-app-surface text-app-text focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
              {dateError && (
                <p className="text-xs text-red-500 mt-1.5">{dateError}</p>
              )}
            </div>

            <p className="text-sm text-app-text-secondary">
              Saving dates does not pause mail, arrange package handling, or show an away status to others. Contact your carrier directly for delivery changes.
            </p>

            {!home.homeId && <p role="alert" className="text-sm text-app-text-secondary">Add a Home before saving travel dates.</p>}

            {/* ── Submit ─────────────────────────────────── */}
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canSubmit || createMutation.isPending}
              className={`w-full py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                !canSubmit || createMutation.isPending
                  ? 'bg-app-surface-sunken text-app-text-muted cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700'
              }`}
            >
              {createMutation.isPending ? 'Saving...' : 'Save Travel Dates'}
            </button>

            {createMutation.isError && (
              <p className="text-xs text-red-500 text-center">
                Couldn&apos;t save your travel dates. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
