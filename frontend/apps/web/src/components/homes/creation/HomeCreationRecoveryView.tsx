'use client';
import { useState } from 'react';
import type { useHomeCreation } from './useHomeCreation';
import type { HomeCreationInput } from './homeCreationModel';

export default function HomeCreationRecoveryView({ recovery, onContinue }: {
  recovery: ReturnType<typeof useHomeCreation>; onContinue: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { pending, busy, error, canAcknowledge } = recovery;
  const state = pending?.outcome?.state;
  const input: HomeCreationInput | null = pending ? JSON.parse(pending.request_json) : null;
  const title = state === 'completed' ? 'Your Home was saved' : state === 'cancelled' ? 'Home request cancelled'
    : state === 'rejected' ? 'Review your Home request' : pending ? 'Recover your Home request' : 'Preparing Home recovery';
  const explanation = state === 'completed' ? 'Your Home and optional setup were saved together. Open My Homes to check current access and verification options.'
    : state === 'cancelled' ? 'The server confirmed cancellation. This request cannot create a Home. You can edit the original details.'
    : state === 'rejected' ? 'The server confirmed that this request did not create a Home. Review the original address and optional setup before trying again.'
    : pending ? 'The original details are saved securely in this browser. Check the result or retry that same request. Cancel it before editing.'
    : 'Checking your account and protected storage before a Home can be submitted.';
  const button = 'min-h-11 rounded-lg border border-app-border px-4 py-3 text-sm font-semibold disabled:opacity-50';
  return <main className="mx-auto max-w-2xl space-y-5 px-4 py-8" aria-busy={busy}>
    <h1 className="text-2xl font-semibold">{title}</h1>
    <p className="text-app-text-secondary">{explanation}</p>
    {input && <div className="space-y-1 rounded-xl border border-app-border bg-app-surface p-4 break-words">
      <p className="font-semibold">{input.address}{input.unit_number ? ` · Unit ${input.unit_number}` : ''}</p>
      <p>{input.city}, {input.state} {input.zip_code}</p>
      <p className="text-sm text-app-text-secondary">{input.role === 'owner' ? 'Owner' : 'Renter'} · Verification still required</p>
    </div>}
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
      <p id="cancel-home-description">Cancellation must be confirmed by the server. If the Home was already saved, its original result will be recovered.</p>
      <div className="flex flex-wrap gap-3">
        <button autoFocus className={button} disabled={busy} onClick={() => setConfirmCancel(false)}>Keep request</button>
        <button className={button} disabled={busy} onClick={() => { setConfirmCancel(false); void recovery.recover('cancel'); }}>Confirm cancellation</button>
      </div>
    </section>}
  </main>;
}
