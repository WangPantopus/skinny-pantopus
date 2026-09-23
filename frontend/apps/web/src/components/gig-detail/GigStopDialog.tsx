'use client';

import { useEffect, useRef, useState } from 'react';
import type { GigStopReason } from '@pantopus/api';
import { RefreshCw, Hand, DollarSign, Siren, Calendar, XCircle, AlertTriangle, MessageCircle } from 'lucide-react';
import { stopActionLabel, stopProgressMessage } from './gigStopRecovery';
import { useGigStopRequest, type GigStopOptions } from './useGigStopRequest';

interface Props extends GigStopOptions { isOwner: boolean; onClose: () => void }
const ownerReasons: [GigStopReason, string][] = [['changed_plans', 'Changed my plans'],
  ['found_someone_else', 'Found someone else'], ['too_expensive', 'Bids too expensive'],
  ['emergency', 'Emergency'], ['other', 'Other']];
const workerReasons: [GigStopReason, string][] = [['schedule_conflict', 'Schedule conflict'],
  ['unable_to_complete', 'Unable to complete'], ['emergency', 'Emergency'],
  ['safety_concern', 'Safety concern'], ['other', 'Other']];
const reasonIcons = { changed_plans: RefreshCw, found_someone_else: Hand, too_expensive: DollarSign,
  emergency: Siren, schedule_conflict: Calendar, unable_to_complete: XCircle, safety_concern: AlertTriangle, other: MessageCircle };

export default function GigStopDialog(props: Props) {
  const state = useGigStopRequest(props);
  const [reason, setReason] = useState<GigStopReason | ''>('');
  const [customReason, setCustomReason] = useState('');
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
      const controls = Array.from(dialog.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])'));
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
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-app-surface shadow-2xl">
      <div className="px-6 py-5 border-b border-app-border-subtle">
        <h2 className="text-lg font-semibold text-app-text">{title}</h2>
        <p className="text-sm text-app-text-secondary mt-1">Please review what happens when you {requiresReason ? 'cancel' : 'continue'}.</p>
      </div>
      <div className="px-6 py-4 space-y-3">
      {state.retired ? <p role="alert">Your session or task changed. Close and reopen task actions to continue.</p> : <>
        {terms && <>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-app-text-secondary uppercase">Policy:</span>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-app-surface-sunken text-app-text-strong">
              {terms.policy.charAt(0).toUpperCase() + terms.policy.slice(1)}
            </span>
          </div>
          <div className={`rounded-lg p-4 ${terms.policyFeeCents > 0 || state.preview?.eligible === false ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'}`}>
            <p className={`text-sm font-medium ${terms.policyFeeCents > 0 || state.preview?.eligible === false ? 'text-red-900' : 'text-green-900'}`}>
              {terms.policyFeeCents > 0 ? `Current policy fee: $${(terms.policyFeeCents / 100).toFixed(2)} USD`
                : state.preview?.eligible === false ? 'Cancellation details need review' : 'No cancellation fee'}
            </p>
            <p className={`text-xs mt-1 ${terms.policyFeeCents > 0 || state.preview?.eligible === false ? 'text-red-700' : 'text-green-700'}`}>
              {financial === 'fee' && state.preview?.eligible !== false
                ? 'This fee is charged from the payment hold. The rest of the hold is released.'
                : terms.policyFeeCents > 0 || state.preview?.eligible === false
                  ? 'This action requires review. No fee has been confirmed as charged.'
                  : 'This policy does not charge a fee at this stage.'}
            </p>
          </div>
          <p className="text-sm text-app-text-secondary">Task amount: ${(terms.amountCents / 100).toFixed(2)} USD.</p>
        </>}
        {state.progress ? <p role="status">{stopProgressMessage(state.progress)}</p>
          : state.attempt ? <p role="status">This request is not confirmed yet. Check its status before starting another action.</p>
          : state.preview ? <>
            {!state.preview.eligible ? <p role="status">This action needs review before it can continue. No completed cancellation or fee charge has been confirmed.</p>
              : <p>{action === 'reopen_bidding' || action === 'worker_release'
                ? 'This will remove the current assignment and reopen the task for bids once any payment operation is confirmed.'
                : 'The task will be cancelled once any payment operation is confirmed.'}</p>}
            {financial === 'release' && <p className="text-sm">The payment authorization hold must be released before this action completes.</p>}
            {financial === 'refund' && <p className="text-sm">A refund of the remaining captured payment must be confirmed before this action completes.</p>}
          </> : !state.error && <p role="status">Loading current task action details…</p>}
        {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
        {!state.attempt && state.preview?.eligible && requiresReason && <div>
          <p className="text-sm font-medium text-app-text-strong mb-2">What happened?</p>
          <div className="space-y-1.5">
            {(props.isOwner ? ownerReasons : workerReasons).map(([value, label]) => {
              const Icon = reasonIcons[value];
              return <button key={value} type="button" disabled={state.busy} aria-pressed={reason === value}
                onClick={() => setReason(value)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 text-left transition text-sm disabled:opacity-50 ${
                  reason === value ? 'border-red-400 bg-red-50' : 'border-app-border hover:border-app-border'}`}>
                <span><Icon className="w-4 h-4" /></span>
                <span className="font-medium text-app-text">{label}</span>
              </button>;
            })}
          </div>
          {reason === 'other' && <div className="mt-3">
            <label htmlFor="gig-stop-explanation" className="block text-sm font-medium text-app-text-strong mb-1.5">Please describe</label>
            <textarea id="gig-stop-explanation" value={customReason} onChange={event => setCustomReason(event.target.value)}
              placeholder="Why are you cancelling?" maxLength={1000} disabled={state.busy} rows={3}
              className="w-full px-3 py-2 border border-app-border rounded-lg text-sm text-app-text placeholder:text-app-text-muted focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 disabled:opacity-50 resize-none" />
            <p className="text-xs text-app-text-muted mt-1 text-right">{customReason.length}/1000</p>
          </div>}
        </div>}
        {!completed && <button type="button" disabled={state.busy} onClick={() => void state.check()}
          className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">{state.busy ? 'Checking…' : 'Check status'}</button>}
        {state.attempt && state.canRetry && <button type="button" disabled={state.busy} onClick={() => void state.submit()}
          className="ml-2 rounded-lg bg-app-primary px-3 py-2 text-sm text-white disabled:opacity-50">Retry this request</button>}
      </>}
      </div>
      <div className="px-6 py-4 border-t border-app-border-subtle">
        <div className="flex gap-3 justify-end">
          <button type="button" onClick={props.onClose}
            className="px-4 py-2 text-app-text-strong hover:bg-app-hover rounded-lg font-medium text-sm">{requiresReason && !state.attempt && !state.retired ? 'Keep Gig' : 'Close'}</button>
          {!state.retired && !state.attempt && state.preview?.eligible && !state.preview.activeRequestId && <button type="button"
            disabled={state.busy || (requiresReason && (!reason || (reason === 'other' && !customReason.trim())))}
            onClick={() => void state.submit(reason || null, reason === 'other' ? customReason : undefined)}
            className="px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed">{title}</button>}
        </div>
        {state.attempt && !completed && !state.retired && <p className="mt-2 text-xs text-app-text-secondary">
          Closing this screen keeps the request. Reopen task actions to check its status.
        </p>}
      </div>
    </section>
  </div>;
}
