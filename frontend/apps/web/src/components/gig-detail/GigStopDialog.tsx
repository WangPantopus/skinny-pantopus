'use client';

import { useEffect, useRef, useState } from 'react';
import type { GigStopReason } from '@pantopus/api';
import { stopActionLabel, stopProgressMessage } from './gigStopRecovery';
import { useGigStopRequest, type GigStopOptions } from './useGigStopRequest';

interface Props extends GigStopOptions { isOwner: boolean; onClose: () => void }
const ownerReasons: [GigStopReason, string][] = [['changed_plans', 'Changed my plans'],
  ['found_someone_else', 'Found someone else'], ['too_expensive', 'Bids too expensive'],
  ['emergency', 'Emergency'], ['other', 'Other']];
const workerReasons: [GigStopReason, string][] = [['schedule_conflict', 'Schedule conflict'],
  ['unable_to_complete', 'Unable to complete'], ['emergency', 'Emergency'],
  ['safety_concern', 'Safety concern'], ['other', 'Other']];

export default function GigStopDialog(props: Props) {
  const state = useGigStopRequest(props);
  const [reason, setReason] = useState<GigStopReason | ''>('');
  const action = state.attempt?.action ?? props.action;
  const title = stopActionLabel(action);
  const requiresReason = action === 'cancel';
  const terms = state.attempt?.terms ?? state.preview?.terms;
  const completed = state.progress?.status === 'completed';
  const financial = state.attempt?.financialAction ?? state.preview?.financialAction;
  const dialog = useRef<HTMLElement>(null);
  const close = useRef(props.onClose); close.current = props.onClose;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); return; }
      if (event.key !== 'Tab' || !dialog.current) return;
      const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled])'));
      const first = controls[0]; const last = controls[controls.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first?.focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('keydown', keyboard);
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <section ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title}
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-app-surface p-6 shadow-xl space-y-4">
      <h2 className="text-lg font-semibold text-app-text">{title}</h2>
      {state.retired ? <p role="alert">Your session or task changed. Close and reopen task actions to continue.</p> : <>
        {terms && <p className="text-sm text-app-text-secondary">Task amount: ${(terms.amountCents / 100).toFixed(2)} USD.</p>}
        {state.progress ? <p role="status">{stopProgressMessage(state.progress)}</p>
          : state.attempt ? <p role="status">This request is not confirmed yet. Check its status before starting another action.</p>
          : state.preview ? <>
            {!state.preview.eligible ? <p role="status">This action needs review before it can continue. No completed cancellation or fee charge has been confirmed.</p>
              : <p>{action === 'reopen_bidding' || action === 'worker_release'
                ? 'This will remove the current assignment and reopen the task for bids once any payment operation is confirmed.'
                : 'The task will be cancelled once any payment operation is confirmed.'}</p>}
            {financial === 'release' && <p className="text-sm">The payment authorization hold must be released before this action completes.</p>}
            {financial === 'refund' && <p className="text-sm">A refund of the remaining captured payment must be confirmed before this action completes.</p>}
            {terms && terms.policyFeeCents > 0 && <p className="text-sm">Current policy fee: ${(terms.policyFeeCents / 100).toFixed(2)} USD. This action requires review; the fee has not been confirmed as charged.</p>}
          </> : !state.error && <p role="status">Loading current task action details…</p>}
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {!state.attempt && state.preview?.eligible && requiresReason && <label className="block text-sm">Reason
          <select value={reason} disabled={state.busy} onChange={(event) => setReason(event.target.value as GigStopReason | '')}
            className="mt-1 block w-full rounded-lg border border-app-border bg-app-surface p-2">
            <option value="">Choose a reason</option>
            {(props.isOwner ? ownerReasons : workerReasons).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>}
        {!completed && <button type="button" disabled={state.busy} onClick={() => void state.check()}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{state.busy ? 'Checking…' : 'Check status'}</button>}
        {state.attempt && state.canRetry && <button type="button" disabled={state.busy} onClick={() => void state.submit()}
          className="ml-2 rounded-lg bg-app-primary px-3 py-2 text-sm text-white disabled:opacity-50">Retry this request</button>}
        {!state.attempt && state.preview?.eligible && !state.preview.activeRequestId && <button type="button"
          disabled={state.busy || (requiresReason && !reason)} onClick={() => void state.submit(reason || null)}
          className="ml-2 rounded-lg bg-red-600 px-3 py-2 text-sm text-white disabled:opacity-50">{title}</button>}
      </>}
      <div className="border-t border-app-border pt-3">
        <button type="button" onClick={props.onClose} className="rounded-lg border px-3 py-2">Close</button>
        {state.attempt && !completed && !state.retired && <p className="mt-2 text-xs text-app-text-secondary">
          Closing this screen keeps the request. Reopen task actions to check its status.
        </p>}
      </div>
    </section>
  </div>;
}
