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
  const currentInput = draft ? { home_id: draft.home_id, target_user_id: draft.target_user_id } : context ? { home_id: context.home_id, target_user_id: context.target_user_id } : input;
  return <div className="space-y-5">
    {vm.accountLabel && <p className="text-sm text-app-text-secondary">Signed in as {vm.accountLabel}</p>}
    {vm.error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{vm.error}</p>}
    {vm.blocked ? <button className={button} onClick={vm.reopen}>Reopen removal recovery</button>
      : !vm.ready ? <p role="status">Opening protected removal recovery…</p>
        : draft ? <section aria-label="Original member removal" className="space-y-4 rounded-xl border border-app-border p-4">
          <h2 className="text-lg font-semibold">{outcome?.state === 'completed' ? 'Removal recorded' : outcome?.state === 'cancelled' ? 'Attempt cancelled' : outcome?.state === 'rejected' ? 'Removal needs review' : 'Recover your removal'}</h2>
          <ReviewSummary summary={draft.reviewed} historical/>
          {input && (input.home_id !== draft.home_id || input.target_user_id !== draft.target_user_id)
            && <p role="note" className="text-sm">This is an earlier removal. Recover and acknowledge it before starting the selected action.</p>}
          {outcome?.state === 'completed' ? <p role="status" className="text-sm">This removal was saved on {new Date(outcome.completed_at!).toLocaleString()}. Check the current roster separately; this result records the original action.</p>
            : outcome?.state === 'cancelled' ? <p role="status" className="text-sm">This attempt was cancelled before it was applied. Cancelling an attempt does not restore or change anyone’s membership.</p>
              : outcome?.state === 'rejected' ? <p role="status" className="text-sm">{removalMessage(outcome.code)}</p>
                : <p className="text-sm">The original removal is kept on this browser. Check its saved result before starting another action. Retrying sends that same original.</p>}
          {vm.canAcknowledge ? <button className={primary} disabled={vm.busy} onClick={() => void vm.acknowledge(draft.request_id)}>Done</button>
            : <div className="flex flex-wrap gap-2">
              <button className={button} disabled={vm.busy} onClick={() => void vm.recover('status', draft.request_id)}>Check saved result</button>
              <button className={primary} disabled={vm.busy} onClick={() => void vm.recover('retry', draft.request_id)}>Retry original removal</button>
              <button className={button} disabled={vm.busy} onClick={() => setCancelConfirm(draft.request_id)}>Cancel this attempt</button>
            </div>}
          {!terminal && cancelConfirm === draft.request_id && <div role="alertdialog" aria-modal="false" aria-label="Cancel original removal attempt" className="space-y-3 rounded-lg border border-app-border p-3"
            onKeyDown={event => { if (event.key === 'Escape' && !vm.busy) { event.preventDefault(); setCancelConfirm(null); } }}>
            <p ref={cancelHeading} tabIndex={-1} className="text-sm">Cancel this original only if it has not already committed. A saved removal wins and cannot be undone here.</p>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={vm.busy} onClick={() => setCancelConfirm(null)}>Keep original</button>
              <button className={primary} disabled={vm.busy} onClick={() => { setCancelConfirm(null); void vm.recover('cancel', draft.request_id); }}>Confirm cancellation</button></div>
          </div>}
        </section>
          : context ? <section role="alertdialog" aria-modal="false" aria-label="Review member removal" className="space-y-4 rounded-xl border border-app-border p-4"
            onKeyDown={event => { if (event.key === 'Escape' && !vm.busy) { event.preventDefault(); vm.cancelReview(); } }}>
            <h2 ref={reviewHeading} tabIndex={-1} className="text-lg font-semibold">{context.target.is_self ? 'Review leaving this Home' : 'Review member removal'}</h2>
            <ReviewSummary summary={context}/>
            <p className="text-sm">{context.target.is_self ? 'End your household membership and its current Home access.' : 'End this member’s household membership and its current Home access.'} Returning requires a separate supported membership review.</p>
            <div className="flex flex-wrap gap-2"><button className={button} disabled={vm.busy} onClick={vm.cancelReview}>Cancel</button>
              <button className={destructive} disabled={vm.busy} onClick={() => void vm.submit(context.decision_token)}>{vm.busy ? 'Saving…' : context.target.is_self ? 'Confirm leave' : 'Confirm removal'}</button></div>
          </section>
            : <section className="space-y-3 rounded-xl border border-app-border p-4">
              {input ? <><p className="text-sm">Check the current member, Home and your authority before confirming.</p><button ref={reviewStart} className={button} disabled={vm.busy} onClick={() => void vm.prepare(input)}>{self ? 'Review leaving Home' : 'Review removal'}</button></>
                : <><h2 className="font-semibold">No saved removal to recover</h2><p className="text-sm">Select a current member from Members, or choose Leave from My Homes.</p></>}
            </section>}
    {vm.ready && !vm.blocked && currentInput && <section aria-label="Current household roster" className="space-y-3 rounded-xl border border-app-border p-4">
      <h2 className="font-semibold">Current household roster</h2>
      {vm.roster.state === 'checked' ? <p role="status" className="text-sm">{vm.roster.listed ? 'This member appears in the current household roster.' : 'This member does not appear in the current household roster.'}</p>
        : vm.roster.state === 'unavailable' ? <p role="alert" className="text-sm text-amber-800">The current roster could not be checked. Current membership is unknown; your saved removal result is kept.</p>
          : <p role="status" className="text-sm">{vm.roster.state === 'loading' ? 'Checking the current roster…' : 'Current membership has not been checked.'}</p>}
      <button className={button} disabled={vm.busy || vm.roster.state === 'loading'} onClick={() => void vm.checkRoster(currentInput)}>Check current roster</button>
      <Link href={`/app/homes/${currentInput.home_id}/members`} className="ml-3 inline-block text-sm text-blue-700 underline">Open Members</Link>
    </section>}
    <p className="text-sm text-app-text-secondary">Closing keeps any original removal for this account. Recover it from My Homes.</p>
  </div>;
}
function ReviewSummary({ summary, historical = false }: { summary: RemovalSummary; historical?: boolean }) {
  const t = summary.target;
  const name = t.username ? `@${t.username}` : t.name || 'Selected household member';
  return <dl className="space-y-2 text-sm">
    <div><dt className="font-medium">{historical ? 'Home reviewed' : 'Home'}</dt><dd className="break-words">{summary.home.name || 'Selected Home'}</dd></div>
    <div><dt className="font-medium">{historical ? 'Member reviewed' : 'Member'}</dt><dd className="break-words">{name}{t.is_self ? ' (you)' : ''}</dd></div>
    <div><dt className="font-medium">{historical ? 'Role reviewed' : 'Household role'}</dt><dd>{t.role_base?.replaceAll('_', ' ') || 'Historical role unavailable'}</dd></div>
    {t.access_start_at && <div><dt>Access starts</dt><dd>{new Date(t.access_start_at).toLocaleString()}</dd></div>}
    {(t.access_end_at || t.end_at) && <div><dt>Access ends</dt><dd>{new Date(t.access_end_at || t.end_at!).toLocaleString()}</dd></div>}
  </dl>;
}
