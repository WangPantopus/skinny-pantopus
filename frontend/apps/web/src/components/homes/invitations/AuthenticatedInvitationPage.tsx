'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import * as api from '@pantopus/api';
import { confirmStore } from '@/components/ui/confirm-store';
import { useInvitationDecision } from './useInvitationDecision';
import { invitationDecisionMessage } from './invitationDecisionModel';

const button = 'min-h-11 rounded-xl border border-app-border px-4 py-3 text-sm font-semibold disabled:opacity-50';
export default function AuthenticatedInvitationPage({ token }: { token: string }) {
  const recovery = useInvitationDecision(token), router = useRouter();
  const [switching, setSwitching] = useState(false), [switchError, setSwitchError] = useState('');
  const { pending, context, progress, error, busy, ready, canAcknowledge, canDecide, accountLabel } = recovery;
  const state = pending?.outcome?.state;
  const title = pending ? state === 'completed' ? pending.action === 'accept' ? 'Acceptance saved' : 'Decline saved'
    : state === 'cancelled' ? 'Decision attempt cancelled' : state === 'rejected' ? 'Decision needs review' : 'Recover your invitation decision'
    : context ? "You're invited" : error ? 'Invitation status' : 'Checking your invitation';
  const decide = async (action: 'accept' | 'decline') => {
    if (!context || !canDecide) return;
    const expected = context.decision_token;
    const yes = await confirmStore.open({ title: action === 'accept' ? 'Accept this invitation?' : 'Decline this invitation?',
      description: `${accountLabel} will ${action} the invitation to ${context.preview.home?.name || 'this Home'}. Household permissions and access dates still apply.`,
      confirmLabel: action === 'accept' ? 'Confirm acceptance' : 'Confirm decline', variant: action === 'accept' ? 'primary' : 'destructive' });
    if (yes) await recovery.decide(action, expected);
  };
  const cancel = async () => {
    if (!pending) return;
    const original = pending.request_id;
    const yes = await confirmStore.open({ title: 'Cancel this attempt?',
      description: 'Cancellation must be confirmed. If your decision was already saved, that original result will be recovered. Cancelling an attempt does not decline the invitation.',
      confirmLabel: 'Confirm cancellation', variant: 'destructive' });
    if (yes) await recovery.recover('cancel', original);
  };
  const switchAccount = async () => {
    const lifetime = recovery.lifetime;
    const yes = await confirmStore.open({ title: 'Use another account?', description: 'You will be signed out. Any saved invitation decision stays protected for this account.', confirmLabel: 'Sign out and continue' });
    if (!yes || !recovery.isCurrent(lifetime)) return;
    setSwitching(true); setSwitchError('');
    try {
      await api.auth.logout();
      router.push(`/login?redirectTo=${encodeURIComponent(`/invite/${token}`)}`);
    } catch { setSwitchError('Sign-out could not be confirmed. Retry before using another account.'); setSwitching(false); }
  };
  return <main className="mx-auto max-w-lg px-4 py-8 space-y-5" aria-busy={busy || switching}>
    <Link href="/app/homes" className="inline-block py-2 text-sm font-semibold text-app-text-secondary">← My Homes</Link>
    <h1 className="text-2xl font-semibold text-app-text">{title}</h1>
    {accountLabel && <p className="text-sm text-app-text-secondary break-words">Signed in as {accountLabel}</p>}
    {!ready && !error && <p role="status">Checking your account and protected recovery…</p>}
    {error && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">{error}</p>}
    {busy && <p role="status">Checking the original decision…</p>}
    {pending ? <>
      <section aria-label="Original invitation decision" className="rounded-xl border border-app-border bg-app-surface p-5 space-y-3 break-words">
        <h2 className="font-semibold text-lg">{pending.home_label}</h2>
        <p>Original decision: {pending.action === 'accept' ? 'Accept invitation' : 'Decline invitation'}</p>
        {pending.token !== token && <p className="text-sm text-app-text-secondary">This is an earlier invitation. Finish its recovery before deciding on the link you just opened.</p>}
        <p className="text-app-text-secondary">{state === 'completed'
          ? pending.action === 'accept' ? 'Your acceptance is saved. Current household access is checked separately; roles, permissions and access dates still apply.'
            : 'Your decline is saved for this account. An open invitation link may remain available to other people.'
          : state === 'cancelled' ? 'The server confirmed that this attempt cannot accept or decline the invitation.'
            : state === 'rejected' ? invitationDecisionMessage(pending.outcome?.code)
              : 'Your original decision is stored securely in this browser. Check the result or retry the same decision. Confirm cancellation before starting a different attempt.'}</p>
      </section>
      {state === 'completed' && pending.action === 'accept' && <section className="space-y-3" aria-label="Current household access">
        <button className={`${button} w-full`} disabled={busy} onClick={() => void recovery.checkAccess()}>Check current Home access</button>
        {progress && <>
          <p role="status" className="text-app-text-secondary">{progress.current_access === 'shared' ? 'Your current account can open this Home. Household permissions still apply.'
            : 'Your saved acceptance does not provide current shared access. My Homes shows the available next steps.'}</p>
          {progress.current_access === 'shared' && <button className={`${button} w-full bg-gray-900 text-white`} disabled={busy} onClick={async () => {
            const homeId = await recovery.openHome(pending.request_id); if (homeId) router.push(`/app/homes/${homeId}/dashboard`);
          }}>Open Home</button>}
        </>}
      </section>}
      {canAcknowledge ? <button className={`${button} w-full bg-gray-900 text-white`} disabled={busy} onClick={async () => {
        const result = await recovery.acknowledge(pending.request_id);
        if (result?.outcome?.state === 'completed' && result.token === token) router.push('/app/homes');
        else if (result) recovery.reopen();
      }}>{state === 'completed' ? 'Done' : 'Review invitation again'}</button> : <div className="grid gap-3">
        <button className={button} disabled={busy} onClick={() => void recovery.recover('status')}>Check saved decision</button>
        <button className={`${button} bg-gray-900 text-white`} disabled={busy} onClick={() => void recovery.recover('retry')}>Retry original decision</button>
        <button className={button} disabled={busy} onClick={() => void cancel()}>Cancel original attempt</button>
      </div>}
    </> : context && <section className="rounded-2xl border border-app-border bg-app-surface p-5 space-y-4">
      <h2 className="text-xl font-semibold break-words">{context.preview.home?.name || 'This Home'}</h2>
      <p className="text-app-text-secondary">{context.preview.home?.city}</p>
      <p>Invited by {context.preview.inviter?.name || 'the household'}</p>
      <p className="rounded-lg bg-blue-50 p-3 text-blue-950">Offered role: {context.preview.invitation.proposed_role?.replaceAll('_', ' ')}</p>
      <p className="text-sm text-app-text-secondary">Household permissions determine what you can open or manage. This invitation does not grant ownership.</p>
      {context.preview.invitation.access_start_at && <p className="text-sm">Access starts {new Date(context.preview.invitation.access_start_at).toLocaleString()}.</p>}
      {context.preview.invitation.access_end_at && <p className="text-sm">Access ends {new Date(context.preview.invitation.access_end_at).toLocaleString()}.</p>}
      {context.preview.invitation.expires_at && <p className="text-sm text-app-text-secondary">Invitation expires {new Date(context.preview.invitation.expires_at).toLocaleString()}.</p>}
      <div className="grid gap-3">
        <button className={`${button} bg-gray-900 text-white`} disabled={busy || !canDecide} onClick={() => void decide('accept')}>Accept invitation</button>
        <button className={button} disabled={busy || !canDecide} onClick={() => void decide('decline')}>Decline invitation</button>
      </div>
    </section>}
    {(error || !context && !pending) && <button className={`${button} w-full`} disabled={busy || switching} onClick={recovery.reopen}>{pending ? 'Reopen recovery' : 'Retry invitation'}</button>}
    <button className={`${button} w-full`} disabled={busy || switching} onClick={() => void switchAccount()}>Use another account</button>
    {switchError && <p role="alert">{switchError}</p>}
  </main>;
}
