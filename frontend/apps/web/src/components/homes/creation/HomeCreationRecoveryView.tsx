'use client';
import { useState } from 'react';
import type { useHomeCreation } from './useHomeCreation';
import type { HomeCreationInput } from './homeCreationModel';
import type { HomeResidencyInput } from './homeResidencySubmissionModel';

export default function HomeCreationRecoveryView({ recovery, onContinue }: {
  recovery: ReturnType<typeof useHomeCreation>; onContinue: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { pending, busy, error, canAcknowledge } = recovery;
  const state = pending?.outcome?.state;
  const joining = pending?.version === 2;
  const input: HomeCreationInput | null = pending && !joining ? JSON.parse(pending.request_json) : null;
  const residency: HomeResidencyInput | null = pending && joining ? JSON.parse(pending.request_json) : null;
  const title = state === 'completed' ? joining ? 'Your residency request was saved' : 'Your Home was saved' : state === 'cancelled' ? 'Home request cancelled'
    : state === 'rejected' ? 'Review your Home request' : pending ? 'Recover your Home request' : 'Preparing Home recovery';
  const explanation = state === 'completed' ? joining
    ? 'Your original residency request is saved. Open My Homes to check its current status, access and verification steps.'
    : 'Your Home and optional setup were saved together. Open My Homes to check current access and verification options.'
    : state === 'cancelled' ? joining ? 'The server confirmed cancellation. This request cannot submit a residency claim. You can edit the original details.'
      : 'The server confirmed cancellation. This request cannot create a Home. You can edit the original details.'
    : state === 'rejected' ? joining ? 'This residency request was not accepted. Review the original address and your relationship before trying again.'
      : 'The server confirmed that this request did not create a Home. Review the original address and optional setup before trying again.'
    : pending ? 'The original details are saved securely in this browser. Check the result or retry that same request. Cancel it before editing.'
    : 'Checking your account and protected storage before a Home can be submitted.';
  const button = 'min-h-11 rounded-lg border border-app-border px-4 py-3 text-sm font-semibold disabled:opacity-50';
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8" aria-busy={busy}>
    <h1 className="text-2xl font-semibold">{title}</h1>
    <p className="text-app-text-secondary">{explanation}</p>
    {input && <div className="space-y-1 rounded-xl border border-app-border bg-app-surface p-4 break-words">
      <p className="font-semibold">{input.address}{input.unit_number ? ` · Unit ${input.unit_number}` : ''}</p>
      <p>{input.city}, {input.state} {input.zip_code}</p>
      <p className="text-sm text-app-text-secondary">{input.role === 'owner' ? 'Owner' : 'Renter'} · Check verification in My Homes</p>
    </div>}
    {residency && <div className="space-y-1 rounded-xl border border-app-border bg-app-surface p-4 break-words">
      <p className="font-semibold">{residency.address.line1}{residency.address.line2 ? ` · ${residency.address.line2}` : ''}</p>
      <p>{residency.address.city}, {residency.address.state} {residency.address.postal_code}</p>
      <p className="text-sm text-app-text-secondary">{residency.claimed_role === 'renter' ? 'Renter' : 'Household member'} · Check verification in My Homes</p>
    </div>}
    {joining && pending?.outcome?.code && <p role="status" className="text-app-text-secondary">{
      ({ RESIDENCY_ADDRESS_CHANGED: 'This Home’s address changed. Check the street and apartment again before sending a new request.',
        MEMBERSHIP_RENEWAL_REQUIRED: 'Previous access cannot be restored by submitting again. Ask the household to review your access.',
        OWNERSHIP_FLOW_REQUIRED: 'Continue through ownership verification for this Home.',
        RESIDENCY_ALREADY_VERIFIED: 'Residency was previously verified. Open My Homes to check current access.',
        RESIDENCY_EXISTING_REQUEST: 'An existing request has different details. Check its current status in My Homes.',
        HOME_NOT_FOUND: 'The selected Home is no longer available. Check the address again.',
        RESIDENCY_HOME_UNAVAILABLE: 'This Home cannot accept a residency request right now.',
      } as Record<string, string>)[pending.outcome.code] || 'Check the original details before continuing.'
    }</p>}
    {error && <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">{error}</p>}
    {busy && <p role="status">Checking the original request…</p>}
    {canAcknowledge && <button className={`${button} w-full bg-black text-white`} disabled={busy} onClick={onContinue}>
      {state === 'completed' ? 'Open My Homes' : 'Edit original details'}
    </button>}
    {pending && !canAcknowledge && <div className="grid gap-3 sm:grid-cols-2">
      <button className={button} disabled={busy} onClick={() => void recovery.recover('status')}>Check status</button>
      <button className={`${button} bg-black text-white`} disabled={busy} onClick={() => void recovery.recover('retry')}>Retry original request</button>
      <button className={`${button} sm:col-span-2`} disabled={busy} onClick={() => setConfirmCancel(true)}>Cancel original request</button>
    </div>}
    {!busy && <button className={`${button} w-full`} onClick={recovery.reopen}>Reopen recovery</button>}
    {confirmCancel && <section role="group" aria-labelledby="cancel-home-title" aria-describedby="cancel-home-description"
      className="space-y-4 rounded-xl border border-amber-300 bg-app-surface p-5">
      <h2 id="cancel-home-title" className="font-semibold">Cancel this Home request?</h2>
      <p id="cancel-home-description">Cancellation must be confirmed by the server. If the {joining ? 'residency request' : 'Home'} was already saved, its original result will be recovered.</p>
      <div className="flex flex-wrap gap-3">
        <button autoFocus className={button} disabled={busy} onClick={() => setConfirmCancel(false)}>Keep request</button>
        <button className={button} disabled={busy} onClick={() => { setConfirmCancel(false); void recovery.recover('cancel'); }}>Confirm cancellation</button>
      </div>
    </section>}
  </main>;
}
