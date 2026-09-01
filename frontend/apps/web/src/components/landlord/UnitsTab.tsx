'use client';

/**
 * UnitsTab — Lists units in a building with occupancy status, quick actions,
 * and bulk tools (import CSV, generate range).
 */

import { useState, useCallback } from 'react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';

type Props = {
  homeId: string;
  authorityId: string;
  units: landlord.PropertyUnit[];
  leases: landlord.HomeLease[];
  occupants: landlord.HomeOccupant[];
  onRefresh: () => void;
};

// ── Occupancy status ────────────────────────────────────────

type OccupancyStatus = 'active' | 'pending' | 'vacant';

function getUnitOccupancy(unitId: string, leases: landlord.HomeLease[]): { status: OccupancyStatus; lease?: landlord.HomeLease } {
  const active = leases.find((l) => l.home_id === unitId && l.state === 'active');
  if (active) return { status: 'active', lease: active };
  const pending = leases.find((l) => l.home_id === unitId && l.state === 'pending');
  if (pending) return { status: 'pending', lease: pending };
  return { status: 'vacant' };
}

const OCCUPANCY_BADGE: Record<OccupancyStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Active', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  pending: { label: 'Pending', bg: 'bg-amber-100', text: 'text-amber-700' },
  vacant: { label: 'Vacant', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary' },
};

function OccupancyBadge({ status }: { status: OccupancyStatus }) {
  const config = OCCUPANCY_BADGE[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// ── Lease countdown ─────────────────────────────────────────

function LeaseCountdown({ endAt }: { endAt: string | null }) {
  if (!endAt) return <span className="text-xs text-app-text-muted">No end date</span>;

  const diff = new Date(endAt).getTime() - Date.now();
  if (diff < 0) return <span className="text-xs text-red-600 font-medium">Ended</span>;

  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 30) return <span className="text-xs text-amber-600 font-medium">{days}d remaining</span>;
  if (days <= 90) return <span className="text-xs text-blue-600">{days}d remaining</span>;
  return <span className="text-xs text-app-text-secondary">{days}d remaining</span>;
}

// ── Invite tenant modal ─────────────────────────────────────

function InviteTenantModal({
  homeId: _homeId,
  unitId,
  unitName,
  authorityId,
  onClose,
  onSuccess,
}: {
  homeId: string;
  unitId: string;
  unitName: string;
  authorityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState('');
  const [startAt, setStartAt] = useState(new Date().toISOString().split('T')[0]);
  const [endAt, setEndAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.landlord.inviteTenant({
        home_id: unitId,
        authority_id: authorityId,
        invitee_email: email.trim(),
        start_at: new Date(startAt).toISOString(),
        end_at: endAt ? new Date(endAt).toISOString() : undefined,
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-app-text mb-1">Invite Tenant</h3>
        <p className="text-sm text-app-text-secondary mb-4">Send a lease invite for {unitName}.</p>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-app-text-strong mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tenant@example.com"
              className="w-full px-4 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">Start date</label>
              <input
                type="date"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">End date <span className="text-app-text-muted font-normal">(optional)</span></label>
              <input
                type="date"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-app-text-secondary hover:text-app-text transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!email.trim() || loading}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40"
          >
            {loading ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk tools ──────────────────────────────────────────────

function BulkTools({
  homeId,
  onSuccess,
}: {
  homeId: string;
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<'idle' | 'csv' | 'generate'>('idle');
  const [csvText, setCsvText] = useState('');
  const [prefix, setPrefix] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCSVImport = async () => {
    const labels = csvText
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (labels.length === 0) return;

    setLoading(true);
    setError('');
    try {
      await api.landlord.importUnits(homeId, { units: labels.map((label) => ({ label })) });
      setCsvText('');
      setMode('idle');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const start = parseInt(rangeStart, 10);
    const end = parseInt(rangeEnd, 10);
    if (!prefix || isNaN(start) || isNaN(end) || start > end) return;

    setLoading(true);
    setError('');
    try {
      await api.landlord.generateUnits(homeId, { prefix, start, end });
      setPrefix('');
      setRangeStart('');
      setRangeEnd('');
      setMode('idle');
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('csv')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-app-text-secondary border border-app-border rounded-lg hover:bg-app-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Import units
        </button>
        <button
          type="button"
          onClick={() => setMode('generate')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-app-text-secondary border border-app-border rounded-lg hover:bg-app-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Generate range
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-app-border bg-app-surface-raised p-4">
      {mode === 'csv' && (
        <>
          <p className="text-sm font-medium text-app-text-strong mb-2">Import units (one per line or comma-separated)</p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={4}
            placeholder="Apt 101&#10;Apt 102&#10;Apt 103"
            className="w-full px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </>
      )}

      {mode === 'generate' && (
        <>
          <p className="text-sm font-medium text-app-text-strong mb-2">Generate unit range</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="A"
              className="w-20 px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              placeholder="101"
              className="w-24 px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-app-text-muted">&ndash;</span>
            <input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              placeholder="130"
              className="w-24 px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {prefix && rangeStart && rangeEnd && (
            <p className="mt-1 text-xs text-app-text-secondary">
              Will create: {prefix}{rangeStart} &ndash; {prefix}{rangeEnd}
            </p>
          )}
        </>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setMode('idle'); setError(''); }}
          className="px-3 py-1.5 text-xs font-medium text-app-text-secondary hover:text-app-text"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={mode === 'csv' ? handleCSVImport : handleGenerate}
          disabled={loading}
          className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors disabled:opacity-40"
        >
          {loading ? 'Working...' : mode === 'csv' ? 'Import' : 'Generate'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function UnitsTab({ homeId, authorityId, units, leases, onRefresh }: Props) {
  const [inviteTarget, setInviteTarget] = useState<{ unitId: string; unitName: string } | null>(null);

  const handleMarkVacant = useCallback(async (unitId: string) => {
    try {
      await api.landlord.markUnitVacant(homeId, unitId);
      onRefresh();
    } catch (err: unknown) {
      console.error('Mark vacant failed:', err);
    }
  }, [homeId, onRefresh]);

  if (units.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <p className="text-sm text-app-text-secondary mb-4">No units added yet. Import from a list or generate a range.</p>
        </div>
        <BulkTools homeId={homeId} onSuccess={onRefresh} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Bulk tools */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-app-text-strong">
          {units.length} unit{units.length === 1 ? '' : 's'}
        </p>
        <BulkTools homeId={homeId} onSuccess={onRefresh} />
      </div>

      {/* Units list */}
      <div className="rounded-xl border border-app-border bg-app-surface divide-y divide-app-border-subtle">
        {units.map((unit) => {
          const occ = getUnitOccupancy(unit.id, leases);
          return (
            <div key={unit.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-app-surface-sunken flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-app-text-secondary" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-app-text text-sm">{unit.name}</p>
                  {occ.lease?.primary_resident && (
                    <p className="text-xs text-app-text-secondary truncate">{occ.lease.primary_resident.name}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <OccupancyBadge status={occ.status} />
                {occ.lease && <LeaseCountdown endAt={occ.lease.end_at} />}

                {/* Quick actions */}
                <div className="flex items-center gap-1">
                  {occ.status === 'vacant' && (
                    <button
                      type="button"
                      onClick={() => setInviteTarget({ unitId: unit.id, unitName: unit.name })}
                      className="px-2.5 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded-lg transition-colors"
                    >
                      Invite
                    </button>
                  )}
                  {occ.status === 'active' && (
                    <button
                      type="button"
                      onClick={() => handleMarkVacant(unit.id)}
                      className="px-2.5 py-1 text-xs font-medium text-app-text-secondary hover:text-app-text-strong hover:bg-app-hover rounded-lg transition-colors"
                    >
                      Mark Vacant
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Invite modal */}
      {inviteTarget && (
        <InviteTenantModal
          homeId={homeId}
          unitId={inviteTarget.unitId}
          unitName={inviteTarget.unitName}
          authorityId={authorityId}
          onClose={() => setInviteTarget(null)}
          onSuccess={onRefresh}
        />
      )}
    </div>
  );
}
