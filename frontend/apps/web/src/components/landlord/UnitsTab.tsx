'use client';

/**
 * UnitsTab — Lists units in a building with occupancy status, quick actions,
 * and bulk tools (import CSV, generate range).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import * as api from '@pantopus/api';
import type { landlord } from '@pantopus/api';
import { extractApiError } from '@pantopus/ui-utils';
import { confirmStore } from '@/components/ui/confirm-store';
import { ProtectedRecoverySlot, type ProtectedRecoverySnapshot } from '@/components/home/tasks/TaskRecoveryStorage';

type Props = {
  homeId: string;
  actorId: string;
  authorityId: string;
  units: landlord.PropertyUnit[];
  leases: landlord.HomeLease[];
  occupants: landlord.HomeOccupant[];
  onRefresh: () => void;
  isCurrent: () => boolean;
};

// ── Occupancy status ────────────────────────────────────────

type OccupancyStatus = 'active' | 'pending' | 'vacant' | 'unavailable';

function getUnitOccupancy(unit: landlord.PropertyUnit, leases: landlord.HomeLease[]): { status: OccupancyStatus; lease?: landlord.HomeLease } {
  if (unit.lease_status_available !== true) return { status: 'unavailable' };
  const unitId = unit.id;
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
  unavailable: { label: 'Unavailable', bg: 'bg-app-surface-sunken', text: 'text-app-text-secondary' },
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

type InvitationInput = Parameters<typeof api.landlord.inviteTenant>[0];

// ── Invite tenant modal ─────────────────────────────────────

function InviteTenantModal({
  homeId: _homeId,
  actorId,
  unitId,
  unitName,
  authorityId,
  onClose,
  onSuccess,
  isCurrent,
}: {
  homeId: string;
  actorId: string;
  unitId: string;
  unitName: string;
  authorityId: string;
  onClose: () => void;
  onSuccess: () => void;
  isCurrent: () => boolean;
}) {
  const [email, setEmail] = useState('');
  const [startAt, setStartAt] = useState(new Date().toISOString().split('T')[0]);
  const [endAt, setEndAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [ready, setReady] = useState(false);
  const pendingInvite = useRef<ProtectedRecoverySnapshot<InvitationInput> | null>(null);
  const store = useRef<ProtectedRecoverySlot<InvitationInput> | null>(null);
  const currentView = useRef(isCurrent); currentView.current = isCurrent;
  const [session] = useState(() => ({ auth: api.getAuthToken(), origin: api.getApiBaseUrl(),
    marker: localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) }));
  const sessionCurrent = () => currentView.current() && api.getAuthToken() === session.auth
    && api.getApiBaseUrl() === session.origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === session.marker;
  const scope = useRef({ generation: 0, busy: false });
  useEffect(() => {
    const lifetime = scope.current, generation = ++lifetime.generation;
    const current = () => lifetime.generation === generation && currentView.current()
      && api.getAuthToken() === session.auth && api.getApiBaseUrl() === session.origin
      && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === session.marker;
    setReady(false);
    void (async () => {
      if (!actorId || !session.auth) throw new Error('Your account could not be confirmed. Reopen the property before inviting.');
      const slot = new ProtectedRecoverySlot<InvitationInput>(['lease-invitation-create-v1', session.origin, actorId, unitId], (value): value is InvitationInput => {
        const v = value as InvitationInput | null;
        return !!v && v.home_id === unitId && v.expected_actor_id === actorId && typeof v.authority_id === 'string' && !!v.authority_id
          && typeof v.invitee_email === 'string' && !!v.invitee_email.trim() && v.invitee_email.length <= 320
          && typeof v.start_at === 'string' && Number.isFinite(Date.parse(v.start_at))
          && (v.end_at === undefined || typeof v.end_at === 'string' && Number.isFinite(Date.parse(v.end_at)))
          && typeof v.invite_token === 'string' && /^[a-f0-9]{64}$/.test(v.invite_token);
      });
      const saved = await slot.load(); if (!current()) return;
      store.current = slot; pendingInvite.current = saved;
      if (saved) { setEmail(saved.value.invitee_email); setStartAt(saved.value.start_at); setEndAt(saved.value.end_at || ''); setUncertain(true); }
      setReady(true);
    })().catch(error => { if (current()) setError(extractApiError(error, 'Recovery could not be opened. Reopen the form before sending.')); });
    return () => { ++lifetime.generation; };
  }, [actorId, unitId, session]);

  // Dismissing the modal keeps its protected original. Done acknowledges a
  // confirmed link; compare-and-clear cannot erase another tab's newer request.
  const close = () => { ++scope.current.generation; onClose(); };
  const done = async () => {
    if (!inviteLink || !sessionCurrent() || scope.current.busy || !pendingInvite.current || !store.current) return;
    const generation = scope.current.generation;
    const current = () => generation === scope.current.generation && sessionCurrent();
    scope.current.busy = true; setLoading(true);
    try {
      await store.current.clear(pendingInvite.current, current);
      if (current()) { onSuccess(); close(); }
    } catch (err) { if (current()) setError(extractApiError(err, 'The saved link was kept. Please retry Done.')); }
    finally { if (current()) { scope.current.busy = false; setLoading(false); } }
  };

  const handleSubmit = async () => {
    if (!ready || !store.current || !email.trim() || !sessionCurrent() || scope.current.busy) return;
    if (!startAt) { setError('Enter a start date.'); return; }
    if (endAt && endAt <= startAt) { setError('End date must be after start date.'); return; }
    const generation = scope.current.generation;
    const current = () => generation === scope.current.generation && sessionCurrent();
    scope.current.busy = true;
    setLoading(true);
    setError('');
    try {
      if (!pendingInvite.current) {
        if (!globalThis.crypto?.getRandomValues) throw new Error('Could not prepare a secure invitation. Reopen in a supported browser.');
        const inviteToken = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        pendingInvite.current = await store.current.retain({ home_id: unitId, authority_id: authorityId, expected_actor_id: actorId,
          invitee_email: email.trim(), start_at: startAt, end_at: endAt || undefined, invite_token: inviteToken }, current);
      }
      if (!current()) return;
      const result = await api.landlord.inviteTenant(pendingInvite.current.value);
      if (!current()) return;
      if (!result?.invite?.id || result.invite.home_id !== unitId || !/^[a-f0-9]{64}$/.test(result.token) || result.token !== pendingInvite.current.value.invite_token) {
        throw new Error('Could not recover the invitation link. Reopen the property to check its status.');
      }
      setUncertain(false);
      setInviteLink(`${window.location.origin}/invite/lease/${result.token}`);
    } catch (err: unknown) {
      if (current()) {
        const status = err && typeof err === 'object' && 'statusCode' in err ? err.statusCode : null;
        const rejected = typeof status === 'number' && (status === 410 || !uncertain && [400, 401, 403, 404, 409, 422].includes(status));
        if (rejected && pendingInvite.current) {
          try { await store.current.clear(pendingInvite.current, current); if (!current()) return; pendingInvite.current = null; }
          catch (storageError) { if (current()) { setUncertain(true); setError(extractApiError(storageError, 'The original invitation was kept.')); } return; }
        }
        // A failed retain may have committed before its response was lost.
        // Reopen storage instead of issuing a replacement from an empty ref.
        if (!pendingInvite.current && !rejected) setReady(false);
        setUncertain(pendingInvite.current !== null);
        setError(extractApiError(err, 'Could not confirm the invitation. Retry the original invitation.'));
      }
    } finally {
      if (current()) { scope.current.busy = false; setLoading(false); }
    }
  };

  const copyLink = async () => {
    const generation = scope.current.generation;
    const current = () => generation === scope.current.generation && sessionCurrent();
    if (!inviteLink || !current()) return;
    try { await navigator.clipboard.writeText(inviteLink); if (current()) { setCopied(true); setError(''); } }
    catch { if (current()) setError('Copy failed. Select and copy the invitation link above.'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={close}>
      <div className="bg-app-surface rounded-2xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-app-text mb-1">Invite Tenant</h3>
        <p className="text-sm text-app-text-secondary mb-4">{inviteLink
          ? `Invitation created for ${email}. Share the link with the tenant. Email delivery has not been confirmed.`
          : !ready ? 'Checking protected invitation recovery. Close and reopen if it cannot be read.' : uncertain ? 'The result is not confirmed. Retry the original invitation to recover its link before changing the details.' : `Send a lease invite for ${unitName}.`}</p>

        <div className="space-y-3">
          <div>
            <label htmlFor="lease-invite-contact" className="block text-sm font-medium text-app-text-strong mb-1">{inviteLink ? 'Invitation link' : 'Email address'}</label>
            <input
              id="lease-invite-contact"
              type={inviteLink ? 'text' : 'email'}
              value={inviteLink || email}
              readOnly={!!inviteLink}
              disabled={!ready || loading || uncertain}
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
                disabled={!ready || loading || !!inviteLink || uncertain}
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-app-text-strong mb-1">End date <span className="text-app-text-muted font-normal">(optional)</span></label>
              <input
                type="date"
                disabled={!ready || loading || !!inviteLink || uncertain}
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="w-full px-3 py-2.5 border border-app-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={inviteLink ? () => void done() : close} disabled={!!inviteLink && loading} className="px-4 py-2.5 text-sm font-medium text-app-text-secondary hover:text-app-text transition-colors">
            {inviteLink ? 'Done' : uncertain || loading ? 'Close' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={inviteLink ? copyLink : handleSubmit}
            disabled={!ready || !email.trim() || loading}
            className="px-5 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors disabled:opacity-40"
          >
            {inviteLink ? copied ? 'Copied' : 'Copy Link' : loading ? 'Sending...' : uncertain ? 'Retry Original Invite' : 'Send Invite'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Bulk tools ──────────────────────────────────────────────

type UnitBatchOriginal = { mode: 'csv'; input: landlord.ImportUnitsInput } | { mode: 'generate'; input: landlord.GenerateUnitsInput };
const unitLabels = (original: UnitBatchOriginal) => original.mode === 'csv' ? original.input.units.map(unit => unit.label)
  : Array.from({ length: original.input.end - original.input.start + 1 }, (_, index) => `${original.input.prefix}${original.input.start + index}`.trim());
const unitUuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value);
function validUnitOriginal(value: unknown, actorId: string): value is UnitBatchOriginal {
  const v = value as UnitBatchOriginal | null;
  if (!v || !v.input || v.input.expected_actor_id !== actorId || !unitUuid(v.input.request_id)) return false;
  if (v.mode === 'csv') {
    if (!Array.isArray(v.input.units) || v.input.units.length < 1 || v.input.units.length > 50
      || v.input.units.some(unit => !unit || typeof unit.label !== 'string')) return false;
  } else if (v.mode === 'generate') {
    if (typeof v.input.prefix !== 'string' || !v.input.prefix.trim() || v.input.prefix.length > 30
      || !Number.isInteger(v.input.start) || !Number.isInteger(v.input.end) || v.input.start < 0 || v.input.end > 9999
      || v.input.end < v.input.start || v.input.end - v.input.start >= 50) return false;
  } else return false;
  const labels = unitLabels(v);
  return labels.every(label => label.length > 0 && label.length <= 50 && label === label.trim())
    && new Set(labels.map(label => label.toLowerCase())).size === labels.length;
}
function confirmedUnitResult(result: landlord.UnitBatchResult, original: UnitBatchOriginal, actorId: string, homeId: string): boolean {
  const labels = unitLabels(original);
  if (!result || result.request_id !== original.input.request_id || result.actor_id !== actorId || result.home_id !== homeId
    || result.requires_verification !== true || result.total !== labels.length || !['completed', 'pending', 'rejected'].includes(result.state)
    || !Array.isArray(result.results) || result.results.length > labels.length
    || new Set(result.results.map(row => row?.request_id)).size !== result.results.length) return false;
  const settled = (row: landlord.UnitBatchResult['results'][number]) => ['completed', 'existing'].includes(row.state) && unitUuid(row.home_id);
  if (!result.results.every((row, index) => row && row.label === labels[index] && unitUuid(row.request_id)
    && (index !== 0 || row.request_id === original.input.request_id)
    && (settled(row) || index === result.results.length - 1 && ['pending', 'rejected', 'cancelled'].includes(row.state)))) return false;
  if (result.state === 'completed') return result.results.length === labels.length && result.results.every(settled);
  if (result.state === 'rejected') return ['rejected', 'cancelled'].includes(result.results.at(-1)?.state || '');
  return result.results.every(settled) || result.results.at(-1)?.state === 'pending';
}

function BulkTools({
  homeId,
  actorId,
  onSuccess,
  isCurrent,
}: {
  homeId: string;
  actorId: string;
  onSuccess: () => void;
  isCurrent: () => boolean;
}) {
  const [mode, setMode] = useState<'idle' | 'csv' | 'generate'>('idle');
  const [csvText, setCsvText] = useState('');
  const [prefix, setPrefix] = useState('');
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [retained, setRetained] = useState(false);
  const [outcome, setOutcome] = useState<landlord.UnitBatchResult | null>(null);
  const original = useRef<ProtectedRecoverySnapshot<UnitBatchOriginal> | null>(null);
  const store = useRef<ProtectedRecoverySlot<UnitBatchOriginal> | null>(null);
  const currentView = useRef(isCurrent); currentView.current = isCurrent;
  const scope = useRef({ generation: 0, busy: false });
  const [session] = useState(() => ({ auth: api.getAuthToken(), origin: api.getApiBaseUrl(),
    marker: localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) }));
  const sessionCurrent = () => currentView.current() && api.getAuthToken() === session.auth
    && api.getApiBaseUrl() === session.origin && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === session.marker;
  useEffect(() => {
    const lifetime = scope.current, generation = ++lifetime.generation;
    const current = () => lifetime.generation === generation && currentView.current()
      && api.getAuthToken() === session.auth && api.getApiBaseUrl() === session.origin
      && localStorage.getItem(api.AUTH_SESSION_CHANGE_KEY) === session.marker;
    void (async () => {
      if (!actorId || !session.auth) throw new Error('Your account could not be confirmed. Reopen the property.');
      const slot = new ProtectedRecoverySlot<UnitBatchOriginal>(['home-unit-batch-v1', session.origin, actorId, homeId],
        (value): value is UnitBatchOriginal => validUnitOriginal(value, actorId));
      const saved = await slot.load(); if (!current()) return;
      store.current = slot; original.current = saved;
      if (saved) {
        setRetained(true); setMode(saved.value.mode);
        if (saved.value.mode === 'csv') setCsvText(saved.value.input.units.map(unit => unit.label).join('\n'));
        else { setPrefix(saved.value.input.prefix); setRangeStart(String(saved.value.input.start)); setRangeEnd(String(saved.value.input.end)); }
      }
      setReady(true);
    })().catch(err => { if (current()) setError(extractApiError(err, 'Recovery could not be opened. Reopen the property before creating units.')); });
    return () => { ++lifetime.generation; };
  }, [actorId, homeId, session]);

  const submit = async () => {
    if (!ready || !store.current || !sessionCurrent() || scope.current.busy || mode === 'idle') return;
    const generation = scope.current.generation;
    const current = () => generation === scope.current.generation && sessionCurrent();
    scope.current.busy = true; setLoading(true); setError('');
    try {
      if (!original.current) {
        const identity = { request_id: crypto.randomUUID(), expected_actor_id: actorId };
        const value: UnitBatchOriginal = mode === 'csv' ? { mode, input: { ...identity,
          units: csvText.split(/[\n,]/).map(label => label.trim()).filter(Boolean).map(label => ({ label })) } }
          : { mode, input: { ...identity, prefix, start: rangeStart.trim() ? Number(rangeStart) : NaN, end: rangeEnd.trim() ? Number(rangeEnd) : NaN } };
        if (!validUnitOriginal(value, actorId)) {
          setError('Enter 1–50 distinct unit labels, up to 50 characters each. Ranges need whole numbers from 0 to 9999.'); return;
        }
        original.current = await store.current.retain(value, current);
        if (!current()) return;
        setRetained(true);
      }
      if (!current()) return;
      const saved = original.current.value;
      const result = saved.mode === 'csv' ? await api.landlord.importUnits(homeId, saved.input) : await api.landlord.generateUnits(homeId, saved.input);
      if (!current()) return;
      if (!confirmedUnitResult(result, saved, actorId, homeId)) throw new Error('The unit results could not be confirmed. Retry the original batch.');
      setOutcome(result);
      if (result.state !== 'completed') setError(result.results.at(-1)?.message || 'Some units remain unresolved. Retry the original batch.');
    } catch (err) {
      if (current()) {
        // A failed storage reply may already have retained an original; never replace it blindly.
        if (!original.current) setReady(false);
        setError(extractApiError(err, 'The result is not confirmed. Retry the original batch.'));
      }
    } finally { if (current()) { scope.current.busy = false; setLoading(false); } }
  };
  const done = async () => {
    if (!outcome || outcome.state === 'pending' || !store.current || !original.current || !sessionCurrent() || scope.current.busy) return;
    const generation = scope.current.generation;
    const current = () => generation === scope.current.generation && sessionCurrent();
    scope.current.busy = true; setLoading(true);
    try {
      await store.current.clear(original.current, current); if (!current()) return;
      original.current = null; setRetained(false); setOutcome(null); setCsvText(''); setPrefix(''); setRangeStart(''); setRangeEnd('');
      setError(''); setMode('idle'); onSuccess();
    } catch (err) { if (current()) setError(extractApiError(err, 'The result was kept. Please retry Done.')); }
    finally { if (current()) { scope.current.busy = false; setLoading(false); } }
  };
  const open = (nextMode: 'csv' | 'generate') => { if (!scope.current.busy) setMode(original.current?.value.mode || nextMode); };
  const settled = outcome && outcome.state !== 'pending';

  if (mode === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => open('csv')}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-app-text-secondary border border-app-border rounded-lg hover:bg-app-hover transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
          </svg>
          Import units
        </button>
        <button
          type="button"
          onClick={() => open('generate')}
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
            disabled={!ready || loading || retained}
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
              disabled={!ready || loading || retained}
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="A"
              className="w-20 px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <input
              type="number"
              disabled={!ready || loading || retained}
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              placeholder="101"
              className="w-24 px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-app-text-muted">&ndash;</span>
            <input
              type="number"
              disabled={!ready || loading || retained}
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              placeholder="130"
              className="w-24 px-3 py-2 border border-app-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {prefix && rangeStart && rangeEnd && (
            <p className="mt-1 text-xs text-app-text-secondary">
              Unit range: {prefix}{rangeStart} &ndash; {prefix}{rangeEnd}
            </p>
          )}
        </>
      )}

      <p className="mt-2 text-xs text-app-text-secondary">{!ready ? 'Checking protected recovery. Reopen the property if it cannot be read.'
        : outcome ? `Saved unit setups: ${outcome.results.filter(row => row.state === 'completed').length}; already present: ${outcome.results.filter(row => row.state === 'existing').length}. ${outcome.state === 'completed' ? 'Each unit still needs verification before tenant management.' : outcome.state === 'rejected' ? 'The batch stopped; later units were not created.' : 'The original batch is kept for retry.'}`
          : retained ? 'The original batch is kept. Retry it to confirm the saved units before changing details.' : 'Creates private unit setup. Each address is checked, and unit verification is still required.'}</p>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => { setMode('idle'); }}
          className="px-3 py-1.5 text-xs font-medium text-app-text-secondary hover:text-app-text"
        >
          {retained || loading ? 'Close' : 'Cancel'}
        </button>
        <button
          type="button"
          onClick={settled ? done : submit}
          disabled={!ready || loading}
          className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-semibold hover:bg-black transition-colors disabled:opacity-40"
        >
          {loading ? 'Working...' : settled ? 'Done' : retained ? 'Retry Original Batch' : mode === 'csv' ? 'Import' : 'Generate'}
        </button>
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────

export default function UnitsTab({ actorId, homeId, authorityId, units, leases, onRefresh, isCurrent }: Props) {
  const [inviteTarget, setInviteTarget] = useState<{ unitId: string; unitName: string } | null>(null);
  const [endingId, setEndingId] = useState<string | null>(null);
  const ending = useRef(false), lifetime = useRef({ generation: 0 });
  useEffect(() => {
    const scope = lifetime.current;
    return () => { ++scope.generation; };
  }, []);

  const handleMarkVacant = useCallback(async (lease: landlord.HomeLease) => {
    if (!isCurrent() || ending.current || lease.state !== 'active') return;
    const generation = lifetime.current.generation;
    const current = () => generation === lifetime.current.generation && isCurrent();
    ending.current = true; setEndingId(lease.id);
    try {
      const confirmed = await confirmStore.open({ title: 'Mark this unit vacant?',
        description: 'This ends the displayed lease and its lease-based access. Other active leases and independent Home membership remain.',
        confirmLabel: 'End displayed lease', variant: 'destructive' });
      if (!confirmed || !current()) return;
      await api.landlord.endLease(lease.id);
      if (current()) onRefresh();
    } catch (err: unknown) {
      if (current()) alert(extractApiError(err, 'Could not end the lease. Please retry.'));
    } finally {
      ending.current = false;
      if (current()) setEndingId(null);
    }
  }, [onRefresh, isCurrent]);

  if (units.length === 0) {
    return (
      <div className="space-y-4">
        <div className="text-center py-12">
          <p className="text-sm text-app-text-secondary mb-4">No units added yet. Import from a list or generate a range.</p>
        </div>
        <BulkTools key={`${actorId}:${homeId}`} homeId={homeId} actorId={actorId} onSuccess={onRefresh} isCurrent={isCurrent} />
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
        <BulkTools key={`${actorId}:${homeId}`} homeId={homeId} actorId={actorId} onSuccess={onRefresh} isCurrent={isCurrent} />
      </div>

      {/* Units list */}
      <div className="rounded-xl border border-app-border bg-app-surface divide-y divide-app-border-subtle">
        {units.map((unit) => {
          const occ = getUnitOccupancy(unit, leases);
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
                  {occ.status === 'active' && occ.lease && (
                    <button
                      type="button"
                      onClick={() => { if (occ.lease) void handleMarkVacant(occ.lease); }}
                      disabled={endingId !== null}
                      className="px-2.5 py-1 text-xs font-medium text-app-text-secondary hover:text-app-text-strong hover:bg-app-hover rounded-lg transition-colors disabled:opacity-40"
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
          key={`${actorId}:${inviteTarget.unitId}`}
          homeId={homeId}
          actorId={actorId}
          unitId={inviteTarget.unitId}
          unitName={inviteTarget.unitName}
          authorityId={authorityId}
          onClose={() => setInviteTarget(null)}
          onSuccess={onRefresh}
          isCurrent={isCurrent}
        />
      )}
    </div>
  );
}
