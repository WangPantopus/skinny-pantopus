'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import * as api from '@pantopus/api';
import type { RelationshipAction } from '@pantopus/api';
import { RelationshipController } from './RelationshipController';
import { UUID, actionLabel } from './relationshipModel';

const methods: Record<string, string> = { doc_upload: 'Document upload', property_data_match: 'Property data match', invite: 'Invitation', vouch: 'Household vouch', escrow_agent: 'Escrow verification', landlord_portal: 'Landlord portal' };
const words = (value: string | null | undefined) => (value || 'Unknown').replaceAll('_', ' ');
export function RelationshipReviewPanel({ homeId, claimId, initialAction }: {
  homeId: string; claimId: string | null; initialAction: RelationshipAction;
}) {
  const [controller, setController] = useState<RelationshipController | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [reload, setReload] = useState(0);
  const [, repaint] = useState(0);
  const [action, setAction] = useState(initialAction);
  const [note, setNote] = useState('');
  const [reviewed, setReviewed] = useState(false);
  const lifecycle = useRef<{ active: boolean; busy: boolean; client: RelationshipController | null } | null>(null);
  const back = UUID.test(homeId) ? `/app/homes/${homeId}/owners/review-claim` : '/app/homes';

  useEffect(() => {
    setController(null); setError(''); setLoading(true); setWorking(false);
    setNote(''); setReviewed(false); setAction(initialAction);
    const ctx = { active: true, busy: false, client: null as RelationshipController | null };
    lifecycle.current = ctx;
    const invalidate = () => {
      ctx.active = false; ctx.client?.retire(); setController(null); setLoading(false); setWorking(false);
      setNote(''); setReviewed(false);
    };
    void (async () => {
      ctx.client = new RelationshipController(homeId, claimId);
      const client = await ctx.client.open();
      if (!ctx.active) return;
      client.current(); setController(client);
    })().catch(failure => {
      if (ctx.active) { setController(null); setError(failure instanceof Error ? failure.message : 'Current claim access could not be confirmed.'); }
    }).finally(() => { if (ctx.active) setLoading(false); });
    const visibility = () => {
      if (document.visibilityState === 'hidden') invalidate();
      else setReload(n => n + 1);
    };
    const changed = () => { invalidate(); setError('Your account changed. Reload to check current access.'); };
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
      if ([401,403,404].includes(e.statusCode || 0) || (e.data?.code || e.code) === 'SESSION_SCOPE_CHANGED') {
        controller.retire(); setController(null); setNote(''); setReviewed(false);
      }
      setError(e.message || 'The original decision was not confirmed. Retry it.');
    } finally {
      if (ctx.active) { ctx.busy = false; setWorking(false); repaint(n => n + 1); }
    }
  };
  const pending = controller?.pending;
  const claim = controller?.review?.claim;
  const button = 'rounded-lg border border-app-border px-4 py-2 text-sm font-medium disabled:opacity-50';
  return <main aria-label="Claimant relationship review" className="mx-auto max-w-2xl space-y-5 px-4 py-8 text-app-text">
    <Link href={back} prefetch={false} className="text-sm underline">Back to claims</Link>
    <h1 className="text-2xl font-semibold">Claimant relationship</h1>
    <p className="text-sm text-app-text-secondary">Review the current claim before deciding how your household responds.</p>
    {loading && <p role="status">Checking current claim access…</p>}
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!loading && !controller && <button className={button} onClick={() => setReload(n => n + 1)}>Reload current access</button>}
    {controller && claim && <section aria-label="Current claim" className="space-y-2 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">Current claim</h2>
      <p className="text-sm">Claim reference: {claim.id.slice(-8)}</p>
      <p className="capitalize">{words(claim.claim_type)} claim · {words(claim.claim_phase_v2 || claim.state)}</p>
      <p className="text-sm">Verification method: {methods[claim.method] || words(claim.method)}</p>
      <p className="text-sm">{claim.evidence.filter(e => e.eligible_for_review).length} verified evidence {claim.evidence.filter(e => e.eligible_for_review).length === 1 ? 'record' : 'records'}</p>
      {claim.evidence.length > 0 && <ul className="space-y-1 text-sm">{claim.evidence.map(e => <li key={e.id}>
        {words(e.evidence_type)} — {e.eligible_for_review ? 'Verified for review' : 'Not verified for review'}
      </li>)}</ul>}
      {pending && <p className="text-xs text-app-text-secondary">This is the latest claim state. The saved decision below records the earlier request.</p>}
    </section>}
    {controller && pending ? <section aria-label="Saved relationship decision" className="space-y-3 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">{pending.confirmed ? 'Original decision confirmed' : 'Decision needs confirmation'}</h2>
      <p>{actionLabel(pending.command.action)}</p>
      {pending.command.note && <p className="whitespace-pre-wrap break-words text-sm">Original note: {pending.command.note}</p>}
      {pending.confirmed ? <>
        <p className="text-sm">Recorded {new Date(pending.confirmed.created_at).toLocaleString()}</p>
        <p className="text-sm">{pending.command.action === 'decline_relationship' ? 'Independent review was allowed to continue. This did not approve or reject the claim.'
          : pending.confirmed.result.qualifies_for_dispute ? 'The original flag entered dispute review.' : 'The original flag entered admin review.'}</p>
        <p className="text-sm text-app-text-secondary">Later changes remain in effect. This confirmation does not repeat the decision.</p>
      </> : <p className="text-sm text-app-text-secondary">The original decision is saved on this browser. Retry it to confirm the outcome without submitting a second decision.</p>}
      {claimId && pending.claim_id !== claimId && <p className="text-sm">Finish this saved decision before reviewing another claim.</p>}
      <div className="flex flex-wrap gap-3">
        {!pending.confirmed && <button className={button} disabled={working} onClick={() => void run(() => controller.retry())}>Retry original decision</button>}
        {(pending.confirmed || controller.canDiscard) && <button className={button} disabled={working} onClick={() => void run(() => controller.acknowledge(), true)}>
          {pending.confirmed ? 'I reviewed this confirmation' : 'Review current claim again'}</button>}
      </div>
    </section> : controller && claim && controller.canDecide ? <form aria-label="Review relationship decision" className="space-y-4"
      onSubmit={e => { e.preventDefault(); if (reviewed) void run(() => controller.submit(action, note)); }}>
      <fieldset disabled={working} className="space-y-4 disabled:opacity-60">
        <div><label htmlFor="relationship-action" className="mb-1 block font-medium">Household response</label>
          <select id="relationship-action" value={action} onChange={e => { setAction(e.target.value as RelationshipAction); setReviewed(false); }}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2">
            <option value="decline_relationship">Continue independent review</option><option value="flag_unknown_person">Flag unknown claimant</option>
          </select></div>
        <p className="text-sm">{action === 'decline_relationship'
          ? 'The claimant continues independent verification. Their evidence and household membership stay unchanged.'
          : 'Flag this claimant for review. A dispute requires qualifying verified ownership evidence. This action does not approve identity, remove anyone or freeze the Home.'}</p>
        <div><label htmlFor="relationship-note" className="mb-1 block font-medium">Private review note (optional)</label>
          <textarea id="relationship-note" rows={3} maxLength={1000} value={note} onChange={e => { setNote(e.target.value); setReviewed(false); }}
            className="w-full rounded-lg border border-app-border bg-app-surface px-3 py-2" /></div>
        <label className="flex items-start gap-3 rounded-lg border border-app-border p-3 text-sm">
          <input type="checkbox" className="mt-1" checked={reviewed} onChange={e => setReviewed(e.target.checked)} />I reviewed this claim, evidence status and household response.</label>
        <button className={`${button} bg-gray-900 text-white`} type="submit" disabled={!reviewed || working}>
          {working ? 'Confirming decision…' : 'Save relationship decision'}</button>
      </fieldset>
    </form> : controller && <div className="space-y-2 rounded-xl border border-app-border p-4">
      <p>{claim ? 'This claim needs its current verification or dispute process. No new relationship decision is available.' : 'No relationship decision needs recovery on this browser. Choose a claim to review.'}</p>
      <Link href={back} prefetch={false} className="inline-block underline">Review claims</Link>
    </div>}
  </main>;
}
