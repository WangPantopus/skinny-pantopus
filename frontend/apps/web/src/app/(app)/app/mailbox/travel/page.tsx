'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { VacationHold, HoldAction, PackageHoldAction } from '@/types/mailbox';
import {
  useVacationHold,
  useCreateVacationHold,
  useCancelVacationHold,
} from '@/lib/mailbox-queries';

// ── Hold action options ──────────────────────────────────────

const MAIL_OPTIONS: { value: HoldAction; label: string; description: string }[] = [
  {
    value: 'hold_in_vault',
    label: 'Hold everything in Vault',
    description: 'Auto-file all mail, alert urgent items only',
  },
  {
    value: 'forward_to_household',
    label: 'Forward to a household member',
    description: 'Designated member receives your mail',
  },
  {
    value: 'notify_urgent_only',
    label: 'Notify me for urgent items only',
    description: 'Silent mode except time-sensitive and certified mail',
  },
];

const PACKAGE_OPTIONS: { value: PackageHoldAction; label: string; description: string }[] = [
  {
    value: 'ask_neighbor',
    label: 'Ask a Verified Neighbor to hold packages',
    description: 'Auto-post gig when package arrives',
  },
  {
    value: 'locker',
    label: 'Auto-request locker delivery if available',
    description: 'Redirect to nearest smart locker',
  },
  {
    value: 'hold_at_carrier',
    label: 'Hold at carrier facility',
    description: 'Packages held at UPS/FedEx/USPS until return',
  },
];

// ── Radio group ──────────────────────────────────────────────

function RadioOption<T extends string>({
  value,
  label,
  description,
  selected,
  onChange,
}: {
  value: T;
  label: string;
  description: string;
  selected: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg border text-left transition-colors ${
        selected
          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
          : 'border-app-border hover:bg-app-hover dark:hover:bg-gray-800'
      }`}
    >
      <div
        className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
          selected ? 'border-primary-500' : 'border-app-border'
        }`}
      >
        {selected && <div className="w-2 h-2 rounded-full bg-primary-500" />}
      </div>
      <div>
        <p className={`text-sm font-medium ${selected ? 'text-app-text' : 'text-app-text-strong'}`}>
          {label}
        </p>
        <p className="text-xs text-app-text-secondary mt-0.5">{description}</p>
      </div>
    </button>
  );
}

// ── Cancel confirmation dialog ───────────────────────────────

function CancelConfirmDialog({
  onConfirm,
  onCancel,
  confirming,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-sm mx-4 bg-app-surface rounded-xl shadow-2xl border border-app-border p-5">
        <h3 className="text-sm font-semibold text-app-text mb-2">
          Cancel Travel Mode?
        </h3>
        <p className="text-sm text-app-text-secondary dark:text-app-text-muted mb-1">
          Items already held in your Vault will stay filed. Active package gigs will continue until completed.
        </p>
        <p className="text-xs text-amber-600 dark:text-amber-400 mb-4">
          This action cannot be undone for items already processed.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2 text-sm text-app-text-secondary dark:text-app-text-muted hover:bg-app-hover dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            Keep Active
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
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start);
  const e = new Date(end);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${s.toLocaleDateString(undefined, opts)} – ${e.toLocaleDateString(undefined, opts)}`;
}

// ── Hold action label map ────────────────────────────────────

const HOLD_LABELS: Record<HoldAction, string> = {
  hold_in_vault: 'Mail holding in Vault',
  forward_to_household: 'Mail forwarded to household member',
  notify_urgent_only: 'Notifications for urgent items only',
};

const PACKAGE_LABELS: Record<PackageHoldAction, string> = {
  ask_neighbor: 'Neighbor auto-gig enabled for packages',
  locker: 'Locker delivery enabled',
  hold_at_carrier: 'Packages held at carrier',
};

// ── Active state component ───────────────────────────────────

function ActiveHoldView({
  hold,
  onCancel,
}: {
  hold: VacationHold;
  onCancel: () => void;
}) {
  const returnDays = daysUntil(hold.end_date);
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
                Active
              </span>
            </div>
            <p className="text-sm text-app-text-secondary dark:text-app-text-muted mt-0.5">
              {formatDateRange(hold.start_date, hold.end_date)} · Returns in {returnDays} day{returnDays !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Status checkmarks */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-app-text-strong">
            <span className="text-green-500">✓</span>
            Mail Day paused (urgent items still alert)
          </div>
          <div className="flex items-center gap-2 text-sm text-app-text-strong">
            <span className="text-green-500">✓</span>
            {HOLD_LABELS[hold.hold_action]}
          </div>
          <div className="flex items-center gap-2 text-sm text-app-text-strong">
            <span className="text-green-500">✓</span>
            {PACKAGE_LABELS[hold.package_action]}
          </div>
          {hold.items_held_count > 0 && (
            <div className="flex items-center gap-2 text-sm text-app-text-secondary">
              <span className="text-primary-500">📬</span>
              {hold.items_held_count} item{hold.items_held_count !== 1 ? 's' : ''} held so far
            </div>
          )}
        </div>

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
        />
      )}
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function TravelModePage() {
  const { data: hold, isLoading, refetch } = useVacationHold();
  const createMutation = useCreateVacationHold();

  // ── Form state (inactive mode) ────────────────────────
  const [departure, setDeparture] = useState('');
  const [returnDate, setReturnDate] = useState('');
  const [holdAction, setHoldAction] = useState<HoldAction>('hold_in_vault');
  const [packageAction, setPackageAction] = useState<PackageHoldAction>('ask_neighbor');
  const [autoGig, setAutoGig] = useState(true);

  // ── Validation ────────────────────────────────────────
  const today = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);

  const dateError = useMemo(() => {
    if (!departure || !returnDate) return null;
    if (departure >= returnDate) return 'Return date must be after departure';
    if (departure < today) return 'Departure must be today or later';
    return null;
  }, [departure, returnDate, today]);

  const canSubmit = departure && returnDate && !dateError;

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
        homeId: 'home_1', // Would come from user context in production
        startDate: departure,
        endDate: returnDate,
        holdAction,
        packageAction,
        autoNeighborRequest: packageAction === 'ask_neighbor' && autoGig,
      },
      {
        onSuccess: () => refetch(),
      },
    );
  }, [canSubmit, departure, returnDate, holdAction, packageAction, autoGig, createMutation, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-app-border border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  // ── Active state ──────────────────────────────────────
  const isActive = hold && (hold.status === 'active' || hold.status === 'scheduled');

  return (
    <div className="h-full overflow-y-auto bg-app-surface">
      <div className="max-w-xl mx-auto p-6">
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
                  Set up automatic mail handling while you&apos;re away
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

            {/* ── Mail handling ───────────────────────────── */}
            <div>
              <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
                While You&apos;re Away — Mail
              </p>
              <div className="space-y-2">
                {MAIL_OPTIONS.map((opt) => (
                  <RadioOption
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    description={opt.description}
                    selected={holdAction === opt.value}
                    onChange={setHoldAction}
                  />
                ))}
              </div>
            </div>

            {/* ── Package handling ────────────────────────── */}
            <div>
              <p className="text-[10px] font-semibold text-app-text-muted uppercase tracking-wider mb-3">
                While You&apos;re Away — Packages
              </p>
              <div className="space-y-2">
                {PACKAGE_OPTIONS.map((opt) => (
                  <RadioOption
                    key={opt.value}
                    value={opt.value}
                    label={opt.label}
                    description={opt.description}
                    selected={packageAction === opt.value}
                    onChange={setPackageAction}
                  />
                ))}
              </div>

              {/* Auto-gig checkbox (only visible when neighbor selected) */}
              {packageAction === 'ask_neighbor' && (
                <label className="flex items-center gap-2 mt-3 px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoGig}
                    onChange={(e) => setAutoGig(e.target.checked)}
                    className="w-4 h-4 rounded border-app-border text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-app-text-strong">
                    Auto-post gig when package arrives
                  </span>
                </label>
              )}
            </div>

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
              {createMutation.isPending ? 'Setting up...' : 'Set Travel Mode'}
            </button>

            {createMutation.isError && (
              <p className="text-xs text-red-500 text-center">
                Failed to activate travel mode. Please try again.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
