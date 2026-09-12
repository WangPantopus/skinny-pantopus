'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Mail, ShieldCheck } from 'lucide-react';
import { usePostalVerification } from '@/components/homes/postcard/usePostalVerification';
import { postalMessage, validMailingAddress, type MailingAddress } from '@/components/homes/postcard/postcardModel';
import { residencyRequestLabel } from '@/components/homes/residencyProgressModel';

const emptyAddress = (): MailingAddress => ({ line1: '', line2: '', city: '', state: '', postal_code: '', country: 'US' });
const button = 'min-h-11 rounded-xl border border-app-border px-4 py-3 text-sm font-semibold transition hover:bg-app-hover disabled:opacity-50';
const primary = `${button} w-full bg-emerald-700 text-white hover:bg-emerald-800`;
const panel = 'space-y-4 rounded-2xl border border-app-border bg-app-surface p-5';
const inputStyle = 'mt-1 min-h-11 w-full rounded-lg border border-app-border bg-app-background px-3 py-2 text-app-text';
function Address({ address }: { address: MailingAddress }) {
  return <div className="break-words text-sm text-app-text-secondary">
    <p className="font-semibold text-app-text">{address.line1}</p>{address.line2 && <p>{address.line2}</p>}
    <p>{address.city}, {address.state} {address.postal_code}</p><p>{address.country}</p>
  </div>;
}
function VerifyPostcardContent() {
  const { id: homeId } = useParams<{ id: string }>();
  const search = useSearchParams();
  const flow = usePostalVerification(homeId);
  const [address, setAddress] = useState<MailingAddress>(emptyAddress), [confirmed, setConfirmed] = useState(false);
  const [code, setCode] = useState(''), [cancel, setCancel] = useState(false);
  useEffect(() => { setAddress(emptyAddress()); setConfirmed(false); setCode(''); setCancel(false); }, [flow.lifetime]);
  const { pending, status, progress, busy } = flow;
  const outcome = pending?.outcome;
  const retainedAddress = pending?.kind === 'mail' ? (JSON.parse(pending.request_json) as { address: MailingAddress }).address : null;
  const update = (key: keyof MailingAddress, value: string) => { setAddress(previous => ({ ...previous, [key]: value })); setConfirmed(false); };
  const unavailable = !flow.ready || flow.blocked;
  return <main className="mx-auto max-w-lg space-y-6 px-4 py-6 pb-28 text-app-text" aria-busy={busy}>
    <Link href={`/app/homes/${homeId}/residency`} className="inline-block min-h-11 py-2 text-sm font-semibold text-app-text-secondary">← Residency status</Link>
    <header className="flex items-start gap-3">
      <Mail className="mt-1 h-7 w-7 shrink-0 text-emerald-700" aria-hidden="true" />
      <div><h1 className="text-2xl font-semibold">Verify by mail</h1>
        <p className="mt-2 text-sm text-app-text-secondary">Confirm your mailing address, follow your postcard request and enter its code when it arrives.</p></div>
    </header>
    {flow.error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">{flow.error}</p>}
    {busy && <p role="status">Checking mail verification…</p>}
    {unavailable ? <section className={panel}>
      <h2 className="font-semibold">{flow.error ? 'Recovery is unavailable' : 'Checking saved mail verification'}</h2>
      <p className="text-sm text-app-text-secondary">Your account and saved request must be checked before a postcard or code attempt can be submitted.</p>
      {flow.error && <button className={button} onClick={flow.reopen}>Reopen recovery</button>}
    </section> : pending ? <section className={panel}>
      <h2 className="text-lg font-semibold">{outcome?.state === 'completed' ? pending.kind === 'code' ? 'Code verification recorded' : 'Postcard request saved'
        : outcome?.state === 'cancelled' ? 'Original attempt cancelled' : outcome?.state === 'rejected' ? 'Original attempt was not accepted' : 'Recover your original attempt'}</h2>
      {retainedAddress && <><p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">Original mailing address</p><Address address={retainedAddress} /></>}
      {pending.kind === 'code' && <p className="text-sm text-app-text-secondary">Postcard reference: {pending.postcard_id?.slice(-8)}. Your original code attempt is kept securely; it is not displayed here.</p>}
      <p className="text-sm text-app-text-secondary">{outcome?.state === 'completed'
        ? pending.kind === 'code' ? 'The code result is saved. Household review may still be required. Check residency status for current Home access.'
          : 'Saving a request does not confirm mailing or physical delivery. Check current mail status for its outcome.'
        : outcome?.state === 'cancelled' ? 'The server confirmed cancellation of this attempt. It cannot request a postcard or consume a code attempt.'
          : outcome?.state === 'rejected' ? postalMessage(outcome.code)
            : 'The result is not confirmed. Check it or retry the same saved details. Confirm cancellation before entering different details.'}</p>
      {outcome?.code === 'POSTCARD_WRONG_CODE' && <p className="text-sm font-semibold">After this attempt: {outcome.attempts_remaining} code attempts remaining.</p>}
      {flow.canAcknowledge ? <button className={primary} disabled={busy} onClick={() => { setCode(''); setConfirmed(false); void flow.acknowledge(); }}>Review current mail status</button>
        : <div className="grid gap-3 sm:grid-cols-2">
          <button className={button} disabled={busy} onClick={() => void flow.recover('status')}>Check original result</button>
          <button className={button} disabled={busy} onClick={() => void flow.recover('retry')}>Retry original attempt</button>
          <button className={`${button} sm:col-span-2`} disabled={busy} onClick={() => setCancel(true)}>Cancel original attempt</button>
        </div>}
      {cancel && !flow.canAcknowledge && <section role="group" aria-labelledby="postal-cancel-title" className="space-y-3 border-t border-app-border pt-4">
        <h3 id="postal-cancel-title" className="font-semibold">Cancel this attempt?</h3>
        <p className="text-sm text-app-text-secondary">If it already completed, the recorded result will be recovered. Cancellation does not recall mail or undo recorded verification.</p>
        <div className="flex flex-wrap gap-3"><button className={button} autoFocus disabled={busy} onClick={() => setCancel(false)}>Keep attempt</button>
          <button className={button} disabled={busy} onClick={() => { setCancel(false); void flow.recover('cancel'); }}>Confirm cancellation</button></div>
      </section>}
      <button className={button} disabled={busy} onClick={flow.reopen}>Reopen recovery</button>
    </section> : status ? <>
      {progress?.request && <section className={panel}><p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">Your submitted residency address</p>
        <p className="break-words text-sm">{residencyRequestLabel(progress.request)}</p></section>}
      {status.postcard && <section className={panel}>
        <h2 className="text-lg font-semibold">{status.postcard.status === 'verified' ? 'Postal proof recorded' : status.postcard.status === 'expired' ? 'Postcard code expired'
          : status.postcard.status === 'cancelled' ? 'Postcard no longer active' : 'Your postcard request'}</h2>
        {status.request && <><p className="text-xs font-semibold uppercase tracking-wide text-app-text-secondary">Previously confirmed mailing address</p><Address address={status.request.address} /></>}
        <p className="text-sm text-app-text-secondary">{({ not_started: 'Mailing has not started. Resume the saved request when available.',
          accepted: 'The mailing provider accepted this request. Physical delivery has not been confirmed.',
          unknown: 'The mailing outcome is unknown. The postcard may already be on its way; checking status does not send another.',
          rejected: 'The mailing provider did not accept this request. Confirm the address before requesting another postcard.' })[status.postcard.delivery]}</p>
        <p className="text-sm text-app-text-secondary">Postcard reference: {status.postcard.id.slice(-8)} · Code expiry: {new Date(status.postcard.expires_at).toLocaleDateString()}</p>
        {status.can_resume && <button className={primary} disabled={busy} onClick={() => void flow.resumeMail()}>Resume saved mailing request</button>}
      </section>}
      {status.restriction && <p role="status" className="rounded-xl border border-app-border p-4 text-sm">{postalMessage(status.restriction)}</p>}
      {status.can_verify && <form className={panel} onSubmit={event => { event.preventDefault(); void flow.verify(code); }}>
        <h2 className="text-lg font-semibold">Enter your postcard code</h2>
        <p className="text-sm text-app-text-secondary">Use the code from this postcard. Verification records address proof; your current household permissions still apply.</p>
        <label className="block text-sm font-medium" htmlFor="postal-code">Postcard code</label>
        <input id="postal-code" type="text" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false}
          value={code} maxLength={8} onChange={event => setCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())}
          disabled={busy} className={`${inputStyle} text-center text-2xl tracking-widest`} />
        <p className="text-sm text-app-text-secondary">{status.postcard?.attempts_remaining} code attempts remaining.</p>
        <button className={primary} disabled={busy || !/^[a-z0-9]{6,8}$/i.test(code)}>Record code verification</button>
      </form>}
      {status.can_request && <form className={panel} onSubmit={event => { event.preventDefault(); if (confirmed) void flow.requestMail(address); }}>
        <h2 className="text-lg font-semibold">Confirm your mailing address</h2>
        <p className="text-sm text-app-text-secondary">Enter the exact street and apartment for the Home you requested to join. We will check it before accepting the postcard request.</p>
        {status.request && <button type="button" className={button} onClick={() => { setAddress({ ...status.request!.address }); setConfirmed(false); }}>Use previously confirmed address</button>}
        {([{ key: 'line1', label: 'Street address', max: 255, auto: 'address-line1' }, { key: 'line2', label: 'Apartment, suite or unit (optional)', max: 255, auto: 'address-line2' },
          { key: 'city', label: 'City', max: 100, auto: 'address-level2' }, { key: 'state', label: 'State', max: 50, auto: 'address-level1' },
          { key: 'postal_code', label: 'ZIP code', max: 20, auto: 'postal-code' }] as const).map(field => <label key={field.key} className="block text-sm font-medium">
          {field.label}<input className={inputStyle} value={address[field.key]} maxLength={field.max} autoComplete={field.auto}
            required={field.key !== 'line2'} disabled={busy} onChange={event => update(field.key, event.target.value)} /></label>)}
        <p className="text-sm text-app-text-secondary">Country: United States</p>
        <label className="flex min-h-11 items-start gap-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={confirmed}
          disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I confirm the street and apartment above are the address I want to verify.</span></label>
        <button className={primary} disabled={busy || !confirmed || !validMailingAddress(address)}>Request postcard</button>
      </form>}
      <section className={panel}>
        <div className="flex items-start gap-2"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
          <p className="text-sm">{progress?.current_access === 'shared' ? 'Current household access is available. Your role and permissions still apply.'
            : progress?.next_step === 'household_review' ? 'Your residency is waiting for household review.' : 'Check residency status for your current access and next step.'}</p></div>
        <Link className={`${button} block text-center`} href={`/app/homes/${homeId}/residency`}>Check residency status</Link>
        {progress?.current_access === 'shared' && <Link className={`${button} block text-center`} href={search.get('return') === 'place' ? '/app/place' : `/app/homes/${homeId}/dashboard`}>
          {search.get('return') === 'place' ? 'Return to Place' : 'Open Home'}</Link>}
      </section>
      <button className={`${button} w-full`} disabled={busy} onClick={() => void flow.refresh()}>Refresh mail status</button>
    </> : !busy && <button className={`${button} w-full`} onClick={() => void flow.refresh()}>Retry mail status</button>}
  </main>;
}
export default function VerifyPostcardPage() {
  const { id: homeId } = useParams<{ id: string }>();
  return <Suspense fallback={<p role="status" className="p-6">Loading mail verification…</p>}><VerifyPostcardContent key={homeId} /></Suspense>;
}
