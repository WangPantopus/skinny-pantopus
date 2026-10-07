'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { ResidencyReviewAction, ResidencyReviewRole } from '@pantopus/api';
import { ResidencyReviewController } from './ResidencyReviewController';
import { UUID, actionLabel, residencyRoles } from './residencyReviewModel';

const words = (value: string | null | undefined) => (value || 'Not given').replaceAll('_', ' ');
const claimStatus: Record<string, string> = { pending: 'Waiting for your decision', verified: 'Approved', rejected: 'Rejected' };
const joinedAs: Record<string, string> = { household: 'Household member', member: 'Household member', renter: 'Renter', tenant: 'Renter' };
const verification: Record<string, string> = {
  verified: 'Verified', pending_approval: 'Waiting for approval', pending_postcard: 'Waiting for a postcard',
  provisional_bootstrap: 'Provisional', provisional: 'Provisional', moved_out: 'Left this Home', inactive: 'Removed',
};
export function ResidencyReviewPanel({ homeId, claimId, initialAction, fromMembers = false }: {
  homeId: string; claimId: string | null; initialAction: ResidencyReviewAction; fromMembers?: boolean;
}) {
  const [controller, setController] = useState<ResidencyReviewController | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const [, repaint] = useState(0);
  const [action, setAction] = useState(initialAction);
  const [note, setNote] = useState('');
  const [role, setRole] = useState<ResidencyReviewRole>('member');
  const [reviewed, setReviewed] = useState(false);
  const lifecycle = useRef<{ active: boolean; busy: boolean; client: ResidencyReviewController | null } | null>(null);
  const back = UUID.test(homeId) ? fromMembers ? `/app/homes/${homeId}/dashboard?tab=members`
    : `/app/homes/${homeId}/owners/review-claim?tab=residency` : '/app/homes';

  useEffect(() => {
    setController(null); setError(''); setLoading(true); setWorking(false);
    setNote(''); setRole('member'); setReviewed(false); setAction(initialAction);
    const ctx = { active: true, busy: false, client: null as ResidencyReviewController | null };
    lifecycle.current = ctx;
    const invalidate = () => {
      ctx.active = false; ctx.client?.retire(); setController(null); setLoading(false); setWorking(false);
      setNote(''); setReviewed(false);
    };
    void (async () => {
      ctx.client = new ResidencyReviewController(homeId, claimId);
      const client = await ctx.client.open();
      if (!ctx.active) return;
      client.current(); setController(client);
    })().catch(failure => {
      if (ctx.active) { setController(null); setError(failure instanceof Error ? failure.message : 'Couldn’t load this request. Reload to try again.'); }
    }).finally(() => { if (ctx.active) setLoading(false); });
    const visibility = () => {
      if (document.visibilityState === 'hidden') invalidate();
      else setReload(n => n + 1);
    };
    const changed = () => { invalidate(); setError('Your account changed. Reload to continue.'); };
    const storage = (e: StorageEvent) => { if (e.key === null || e.key === api.AUTH_SESSION_CHANGE_KEY) changed(); };
    const focus = () => { if (document.visibilityState !== 'hidden') { invalidate(); setReload(n => n + 1); } };
    const unsubscribe = api.onTokenChange(changed);
    window.addEventListener('storage', storage); window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      ctx.active = false; ctx.client?.retire(); unsubscribe();
      if (lifecycle.current === ctx) lifecycle.current = null;
      window.removeEventListener('storage', storage); window.removeEventListener('focus', focus);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [homeId, claimId, initialAction, reload]);

  const run = async (task: () => Promise<void>, clear = false) => {
    const ctx = lifecycle.current;
    if (!controller || !ctx?.active || ctx.busy) return;
    ctx.busy = true; setWorking(true); setError('');
    try {
      controller.current(); await task();
      if (!ctx.active) return;
      controller.current(); setReviewed(false);
      if (clear) setNote('');
    } catch (failure) {
      if (!ctx.active) return;
      const e = failure as { statusCode?: number; code?: string; data?: { code?: string }; message?: string };
      if ([401,404].includes(e.statusCode || 0) || (e.statusCode === 403 && !controller.canDiscard)
        || (e.data?.code || e.code) === 'SESSION_SCOPE_CHANGED') {
        controller.retire(); setController(null); setNote(''); setReviewed(false);
      }
      setError(e.message || 'We couldn’t confirm your decision. Try again.');
    } finally {
      if (ctx.active) { ctx.busy = false; setWorking(false); repaint(n => n + 1); }
    }
  };
  const pending = controller?.pending;
  const claim = controller?.review?.claim;
  const occupancy = controller?.review?.occupancy;
  const button = 'rounded-lg border border-app-border px-4 py-2 text-sm font-medium disabled:opacity-50';
  return <main aria-label="Residency review" className="mx-auto max-w-2xl space-y-5 px-4 py-8 text-app-text">
    <Link href={back} prefetch={false} className="text-sm underline">{fromMembers ? 'Back to household members' : 'Back to residency claims'}</Link>
    <h1 className="text-2xl font-semibold">Residency review</h1>
    <Link href={`/app/homes/${homeId}/owners/review-claim/history`} prefetch={false} className="inline-flex min-h-11 items-center text-sm underline">Your past decisions</Link>
    <p className="text-sm text-app-text-secondary">Check who’s asking to join and the access they have now, then approve or reject.</p>
    {loading && <p role="status">Loading…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading && !controller && <button className={button} onClick={() => setReload(n => n + 1)}>Reload</button>}
    {controller && claim && <section aria-label="Request" className="space-y-2 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">Request</h2>
      {controller.claimant && <p className="break-words font-medium">{controller.claimant.name}{controller.claimant.username ? ` (@${controller.claimant.username})` : ''}</p>}
      <p className="text-sm">Reference: {claim.id.slice(-8)}</p>
      <p>Status: {claimStatus[claim.status] ?? words(claim.status)}</p>
      <p className="text-sm">Asked to join as: {joinedAs[claim.claimed_role ?? ''] ?? words(claim.claimed_role)}</p>
      {claim.claimed_address && <p className="break-words text-sm">Address: {claim.claimed_address}</p>}
      {claim.review_note && <p className="whitespace-pre-wrap break-words text-sm">Note: {claim.review_note}</p>}
      {pending && <p className="text-xs text-app-text-secondary">Above is how the request looks now. Your saved decision is below.</p>}
    </section>}
    {controller && claim && <section aria-label="Their access now" className="space-y-2 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">Their access now</h2>
      {occupancy ? <>
        <p>Membership: {occupancy.is_active ? 'Active' : 'Ended'}</p>
        <p className="text-sm">Role: {residencyRoles[(occupancy.role_base || occupancy.role) as ResidencyReviewRole] ?? words(occupancy.role_base || occupancy.role)} · Age group: {words(occupancy.age_band)}</p>
        <p className="text-sm">Verification: {verification[occupancy.verification_status ?? ''] ?? words(occupancy.verification_status)}</p>
        <dl className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          {([['Membership starts',occupancy.start_at],['Membership ends',occupancy.end_at],
            ['Access starts',occupancy.access_start_at],['Access ends',occupancy.access_end_at],
            ['Verification expires',occupancy.verification_expires_at]] as const).map(([label,value]) =>
            <div key={label}><dt className="text-app-text-secondary">{label}</dt><dd>{value ? new Date(value).toLocaleString() : 'Not set'}</dd></div>)}
        </dl>
        <p className="text-xs text-app-text-secondary">What they can do also depends on these dates and their permissions.</p>
      </> : <p className="text-sm">They don’t have access to this Home yet.</p>}
    </section>}
    {controller && pending ? <section aria-label="Your last decision" className="space-y-3 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">{pending.confirmed ? 'Decision saved' : 'Check your last decision'}</h2>
      <p>You chose: {actionLabel(pending.command.action)}</p>
      {pending.command.role && <p className="text-sm">Role: {residencyRoles[pending.command.role]}</p>}
      {pending.command.reason && <p className="whitespace-pre-wrap break-words text-sm">Reason: {pending.command.reason}</p>}
      {pending.confirmed ? <>
        <p className="text-sm">Saved {new Date(pending.confirmed.created_at).toLocaleString()}</p>
        <p className="text-sm">{pending.command.action === 'approve' ? 'You approved this request.' : 'You rejected this request.'}</p>
      </> : <p className="text-sm text-app-text-secondary">We couldn’t confirm your decision went through. Try again; it won’t be applied twice.</p>}
      {claimId && pending.claim_id !== claimId && <p className="text-sm">Finish this before reviewing another request.</p>}
      <div className="flex flex-wrap gap-3">
        {!pending.confirmed && <button className={button} disabled={working} onClick={() => void run(() => controller.retry())}>Try again</button>}
        {(pending.confirmed || controller.canDiscard) && <button className={button} disabled={working} onClick={() => void run(() => controller.acknowledge(), true)}>
          {pending.confirmed ? 'Done' : 'Start over'}</button>}
      </div>
    </section> : controller && claim && controller.canDecide ? <form aria-label="Your decision" className="space-y-4"
      onSubmit={e => { e.preventDefault(); if (reviewed) void run(() => controller.submit(action, role, note)); }}>
      <fieldset disabled={working} className="space-y-4 disabled:opacity-60">
        <div><label htmlFor="residency-action" className="mb-1 block font-medium">Your decision</label>
          <select id="residency-action" value={action} onChange={e => { setAction(e.target.value as ResidencyReviewAction); setReviewed(false); }}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2">
            <option value="approve">Approve</option><option value="reject">Reject</option>
          </select></div>
        <p className="text-sm">{action === 'approve'
          ? 'Approving lets them into this Home with the role you choose. It doesn’t make them an owner.'
          : 'Rejecting declines this request. It doesn’t change anyone’s current access.'}</p>
        {action === 'approve' ? <div><label htmlFor="residency-role" className="mb-1 block font-medium">Their role</label>
          <select id="residency-role" value={role} onChange={e => { setRole(e.target.value as ResidencyReviewRole); setReviewed(false); }}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2">
            {Object.entries(residencyRoles).map(([value,label]) => <option key={value} value={value}>{label}</option>)}
          </select></div> : <div><label htmlFor="residency-reason" className="mb-1 block font-medium">Reason for rejection (optional)</label>
          <textarea id="residency-reason" rows={3} maxLength={2000} value={note} onChange={e => { setNote(e.target.value); setReviewed(false); }}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2" /></div>}
        <label className="flex items-start gap-3 rounded-lg border border-app-border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I’ve checked this request and my decision.</label>
        <div className="flex flex-wrap gap-3">
          <button className={`${button} bg-gray-900 text-white`} type="submit" disabled={!reviewed || working}>
            {working ? 'Saving…' : 'Save decision'}</button>
          <Link href={back} prefetch={false} aria-disabled={working} onClick={e => { if (working) e.preventDefault(); }} className={button}>Cancel</Link>
        </div>
      </fieldset>
    </form> : controller && <div className="space-y-2 rounded-xl border border-app-border p-4">
      <p>{claim ? 'This request was already decided.' : 'Nothing to finish here. Choose a request to review.'}</p>
      <Link href={back} prefetch={false} className="inline-block underline">{fromMembers ? 'Review household members' : 'Review residency claims'}</Link>
    </div>}
  </main>;
}
