'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRemoval } from './useRemoval';
import { removalMessage, validRemovalInput, type RemovalSummary } from './removalModel';

const button = 'rounded-lg border border-app-border px-3 py-2 text-sm font-medium disabled:opacity-50';
const destructive = button + ' border-red-700 bg-red-700 text-white';
const primary = button + ' bg-blue-700 text-white';
export default function MemberRemovalRecovery({ homeId, targetId, self = false }: { homeId?: string; targetId?: string; self?: boolean }) {
  const vm = useRemoval(JSON.stringify([homeId, targetId, self]));
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const draft = vm.pending, outcome = draft?.outcome, context = vm.context;
  const reviewToken = context?.decision_token;
  const reviewHeading = useRef<HTMLHeadingElement>(null), cancelHeading = useRef<HTMLParagraphElement>(null);
  const reviewStart = useRef<HTMLButtonElement>(null), hadReview = useRef(false);
  useEffect(() => {
    if (reviewToken) { hadReview.current = true; reviewHeading.current?.focus(); }
    else if (hadReview.current) { hadReview.current = false; reviewStart.current?.focus(); }
  }, [reviewToken]);
  useEffect(() => { if (cancelConfirm) cancelHeading.current?.focus(); }, [cancelConfirm]);
  const terminal = !!outcome && outcome.state !== 'pending';
  const selected = { home_id: homeId, target_user_id: self ? vm.actorId : targetId };
  const input = validRemovalInput(selected) ? { home_id: selected.home_id.toLowerCase(), target_user_id: selected.target_user_id.toLowerCase() } : null;
  // Someone who has left can no longer read that Home's member list, so there is nothing to check.
  const leftHome = draft?.reviewed.target.is_self === true && outcome?.state === 'completed';
  const currentInput = draft ? { home_id: draft.home_id, target_user_id: draft.target_user_id } : context ? { home_id: context.home_id, target_user_id: context.target_user_id } : input;
  return <div className="space-y-5">
    {vm.accountLabel && <p className="text-sm text-app-text-secondary">Signed in as {vm.accountLabel}</p>}
    {vm.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{vm.error}</p>}
    {vm.blocked ? <button className={button} onClick={vm.reopen}>Reload</button>
      : !vm.ready ? <p role="status">Loading…</p>
        : draft ? <section aria-label="Your last removal" className="space-y-4 rounded-xl border border-app-border p-4">
          <h2 className="text-lg font-semibold">{outcome?.state === 'completed' ? draft.reviewed.target.is_self ? 'You left this Home' : 'Member removed' : outcome?.state === 'cancelled' ? 'Attempt discarded' : outcome?.state === 'rejected' ? 'Couldn’t finish this' : 'Check your last removal'}</h2>
          <ReviewSummary summary={draft.reviewed} historical/>
          {input && (input.home_id !== draft.home_id || input.target_user_id !== draft.target_user_id)
            && <p role="note" className="text-sm">You have an unfinished removal. Finish it before starting another.</p>}
          {outcome?.state === 'completed' ? <p role="status" className="text-sm">{draft.reviewed.target.is_self ? `You left this Home on ${new Date(outcome.completed_at!).toLocaleString()}.` : `Removed on ${new Date(outcome.completed_at!).toLocaleString()}. They no longer have access to this Home.`}</p>
            : outcome?.state === 'cancelled' ? <p role="status" className="text-sm">Nothing changed. This attempt was discarded before it took effect.</p>
              : outcome?.state === 'rejected' ? <p role="status" className="text-sm">{removalMessage(outcome.code)}</p>
                : <p className="text-sm">We couldn’t confirm whether this went through. Check again, or try again.</p>}
          {vm.canAcknowledge ? <button className={primary} disabled={vm.busy} onClick={() => void vm.acknowledge(draft.request_id)}>Done</button>
            : <div className="flex flex-wrap gap-2">
              <button className={button} disabled={vm.busy} onClick={() => void vm.recover('status', draft.request_id)}>Check again</button>
              <button className={primary} disabled={vm.busy} onClick={() => void vm.recover('retry', draft.request_id)}>Try again</button>
              <button className={button} disabled={vm.busy} onClick={() => setCancelConfirm(draft.request_id)}>Discard attempt</button>
            </div>}
          {!terminal && cancelConfirm === draft.request_id && <div role="alertdialog" aria-modal="false" aria-label="Discard this attempt" className="space-y-3 rounded-lg border border-app-border p-3"
            onKeyDown={event => { if (event.key === 'Escape' && !vm.busy) { event.preventDefault(); setCancelConfirm(null); } }}>
            <p ref={cancelHeading} tabIndex={-1} className="text-sm">If it already went through, it stays. Discarding doesn’t remove anyone.</p>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={vm.busy} onClick={() => setCancelConfirm(null)}>Keep it</button>
              <button className={primary} disabled={vm.busy} onClick={() => { setCancelConfirm(null); void vm.recover('cancel', draft.request_id); }}>Discard</button></div>
          </div>}
        </section>
          : context ? <section role="alertdialog" aria-modal="false" aria-label={context.target.is_self ? 'Leave this Home' : 'Remove member'} className="space-y-4 rounded-xl border border-app-border p-4"
            onKeyDown={event => { if (event.key === 'Escape' && !vm.busy) { event.preventDefault(); vm.cancelReview(); } }}>
            <h2 ref={reviewHeading} tabIndex={-1} className="text-lg font-semibold">{context.target.is_self ? 'Leave this Home' : 'Remove member'}</h2>
            <ReviewSummary summary={context}/>
            <p className="text-sm">{context.target.is_self ? 'You’ll lose access to this Home. To come back later, someone in the household will need to invite you again.' : 'They’ll lose access to this Home. You can invite them again later.'}</p>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={vm.busy} onClick={vm.cancelReview}>Cancel</button>
              <button className={destructive} disabled={vm.busy} onClick={() => void vm.submit(context.decision_token)}>{vm.busy ? 'Saving…' : context.target.is_self ? 'Leave Home' : 'Remove member'}</button></div>
          </section>
            : <section className="space-y-3 rounded-xl border border-app-border p-4">
              {input ? <><p className="text-sm">Check the details before you confirm.</p><button ref={reviewStart} className={button} disabled={vm.busy} onClick={() => void vm.prepare(input)}>{self ? 'Leave this Home' : 'Remove this member'}</button></>
                : <><h2 className="font-semibold">Nothing to finish here</h2><p className="text-sm">To remove someone, choose them in Members. To leave a Home, choose Leave in My Homes.</p></>}
            </section>}
    {vm.ready && !vm.blocked && currentInput && !leftHome && <section aria-label="Member list" className="space-y-3 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">Member list now</h2>
      {vm.roster.state === 'checked' ? <p role="status" className="text-sm">{vm.roster.listed ? 'This member is still in the member list.' : 'This member is no longer in the member list.'}</p>
        : vm.roster.state === 'unavailable' ? <p role="alert" className="text-sm text-amber-800">Couldn’t check the member list. Try again.</p>
          : <p role="status" className="text-sm">{vm.roster.state === 'loading' ? 'Checking the member list…' : 'Check the member list to see who’s in the household now.'}</p>}
      <button className={button} disabled={vm.busy || vm.roster.state === 'loading'} onClick={() => void vm.checkRoster(currentInput)}>Check member list</button>
      <Link href={`/app/homes/${currentInput.home_id}/members`} className="ml-3 inline-block text-sm text-blue-700 dark:text-blue-400 underline">Open Members</Link>
    </section>}
    <p className="text-sm text-app-text-secondary">If you close this before a removal finishes, you can check it later from My Homes.</p>
  </div>;
}
function ReviewSummary({ summary, historical = false }: { summary: RemovalSummary; historical?: boolean }) {
  const t = summary.target;
  const name = t.username ? `@${t.username}` : t.name || 'Selected household member';
  return <dl className="space-y-2 text-sm">
    <div><dt className="font-medium">Home</dt><dd className="break-words">{summary.home.name || 'Selected Home'}</dd></div>
    <div><dt className="font-medium">Member</dt><dd className="break-words">{name}{t.is_self ? ' (you)' : ''}</dd></div>
    <div><dt className="font-medium">Role</dt><dd>{t.role_base ? t.role_base.charAt(0).toUpperCase() + t.role_base.slice(1).replaceAll('_', ' ') : 'Not recorded'}</dd></div>
    {t.access_start_at && <div><dt>Access starts</dt><dd>{new Date(t.access_start_at).toLocaleString()}</dd></div>}
    {(t.access_end_at || t.end_at) && <div><dt>Access ends</dt><dd>{new Date(t.access_end_at || t.end_at!).toLocaleString()}</dd></div>}
  </dl>;
}
