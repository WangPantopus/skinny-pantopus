import type {
  GigStopAction, GigStopPreview, GigStopProgress, GigStopRequest, GigStopTerms,
} from '@pantopus/api';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const actions = ['cancel', 'reopen_bidding', 'worker_release', 'close'];
const reasons = ['changed_plans', 'found_someone_else', 'too_expensive', 'emergency',
  'other', 'schedule_conflict', 'unable_to_complete', 'safety_concern'];
const termsKeys: (keyof GigStopTerms)[] = ['gigId', 'ownerId', 'workerId', 'paymentId', 'amountCents',
  'currency', 'gigStatus', 'acceptedAt', 'acceptedBidId', 'policy', 'policyFeeCents'];
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
export const stopId = (value: unknown): value is string => typeof value === 'string' && uuid.test(value);
const optionalId = (value: unknown) => value === null || stopId(value);
const cents = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0;

export function validStopTerms(value: unknown, gigId: string): value is GigStopTerms {
  if (!object(value)) return false;
  return value.gigId === gigId && stopId(gigId) && stopId(value.ownerId)
    && optionalId(value.workerId) && optionalId(value.paymentId) && optionalId(value.acceptedBidId)
    && cents(value.amountCents) && cents(value.policyFeeCents) && value.currency === 'usd'
    && typeof value.gigStatus === 'string' && value.gigStatus.length > 0
    && typeof value.policy === 'string' && value.policy.length > 0
    && (value.acceptedAt === null || (typeof value.acceptedAt === 'string' && Number.isFinite(Date.parse(value.acceptedAt))));
}

export function sameStopTerms(a: GigStopTerms, b: GigStopTerms): boolean {
  return termsKeys.every((key) => a[key] === b[key]);
}

export function validStopRequest(value: unknown, gigId: string): value is GigStopRequest {
  if (!object(value)) return false;
  return stopId(value.requestId) && value.gigId === gigId && stopId(value.actorId)
    && actions.includes(value.action as string) && validStopTerms(value.terms, gigId)
    && (value.reason === null || reasons.includes(value.reason as string))
    && (value.rollbackMode === null || (value.rollbackMode === 'payment_setup_aborted' && value.action === 'reopen_bidding'))
    && ['none', 'release', 'refund'].includes(value.financialAction as string);
}

export function sameStopRequest(a: GigStopRequest, b: GigStopRequest): boolean {
  return a.requestId === b.requestId && a.gigId === b.gigId && a.actorId === b.actorId
    && a.action === b.action && a.reason === b.reason && a.rollbackMode === b.rollbackMode
    && a.financialAction === b.financialAction && sameStopTerms(a.terms, b.terms);
}

export function verifyStopScope(actor: unknown, session: unknown, actorId: string, scope: string | null): string {
  if (actor !== actorId || typeof session !== 'string' || !/^[a-f0-9]{64}$/.test(session)
    || (scope !== null && scope !== session)) {
    throw new Error('Your session changed. Reopen task actions before continuing.');
  }
  return session;
}

export function verifyStopPreview(value: GigStopPreview, gigId: string, actorId: string,
  action: GigStopAction, scope: string | null): GigStopPreview {
  if (!value || !validStopTerms(value.terms, gigId) || value.action !== action
    || typeof value.eligible !== 'boolean' || !optionalId(value.activeRequestId)
    || !(value.unavailableReason === null || typeof value.unavailableReason === 'string')
    || !['none', 'release', 'refund', 'review'].includes(value.financialAction)
    || (value.eligible && (value.financialAction === 'review' || value.terms.policyFeeCents !== 0))) {
    throw new Error('Task action details could not be verified. Check again before continuing.');
  }
  verifyStopScope(value.actorId, value.sessionScope, actorId, scope);
  return value;
}

export function verifyStopProgress(value: GigStopProgress, gigId: string, actorId: string,
  requestId: string, scope: string | null, expected?: GigStopRequest | null): GigStopProgress {
  if (!value || !validStopRequest(value.request, gigId) || value.requestId !== requestId
    || value.request.requestId !== requestId || value.action !== value.request.action
    || (expected && !sameStopRequest(value.request, expected))
    || !['pending', 'needs_review', 'completed'].includes(value.status)
    || !['none', 'release_pending', 'released', 'refund_pending', 'refunded', 'needs_review'].includes(value.financialStatus)
    || typeof value.canRetry !== 'boolean' || (value.canRetry && value.request.actorId !== actorId)) {
    throw new Error('The task action is not confirmed. Check its status to recover the original request.');
  }
  verifyStopScope(value.actorId, value.sessionScope, actorId, scope);
  if (value.status !== 'completed') {
    if (value.receipt !== null) throw new Error('The task action receipt is inconsistent. Check its status.');
    return value;
  }
  const request = value.request;
  const receipt = value.receipt;
  const financial = { none: 'none', release: 'released', refund: 'refunded' }[request.financialAction];
  const status = ['reopen_bidding', 'worker_release'].includes(request.action) ? 'open' : 'cancelled';
  if (!receipt || value.canRetry || receipt.requestId !== requestId || receipt.gigId !== gigId
    || receipt.action !== request.action || receipt.paymentId !== request.terms.paymentId
    || receipt.ownerId !== request.terms.ownerId || receipt.workerId !== request.terms.workerId
    || receipt.amountCents !== request.terms.amountCents || receipt.currency !== 'usd'
    || receipt.gigStatus !== status || receipt.financialStatus !== financial || value.financialStatus !== financial) {
    throw new Error('Completion is not confirmed. Check the original task action before continuing.');
  }
  return value;
}

export function stopRecoveryKey(origin: string, actorId: string, gigId: string): string {
  return `pantopus:gig-stop:v1:${encodeURIComponent(origin)}:${actorId}:${gigId}`;
}

export const GIG_STOP_RECOVERY_CHANGE = 'pantopus:gig-stop-recovery-change';
function notifyRecoveryChange(key: string): void {
  window.dispatchEvent(new CustomEvent(GIG_STOP_RECOVERY_CHANGE, { detail: key }));
}

export function clearStopRequest(key: string): void {
  localStorage.removeItem(key);
  notifyRecoveryChange(key);
}

/** Explicit projection keeps server extras, provider secrets and session proof out of storage. */
export function retainStopRequest(key: string, request: GigStopRequest): void {
  const terms = Object.fromEntries(termsKeys.map((field) => [field, request.terms[field]]));
  localStorage.setItem(key, JSON.stringify({ requestId: request.requestId, gigId: request.gigId,
    actorId: request.actorId, action: request.action, terms, reason: request.reason,
    rollbackMode: request.rollbackMode, financialAction: request.financialAction }));
  notifyRecoveryChange(key);
}

export function readStopRequest(key: string, actorId: string, gigId: string): GigStopRequest | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!validStopRequest(value, gigId) || value.actorId !== actorId) {
    throw new Error('Saved task recovery could not be verified. Contact support before starting another request.');
  }
  return value;
}

export const stopActionLabel = (action: GigStopAction) => ({ cancel: 'Cancel task',
  reopen_bidding: 'Reopen bidding', worker_release: 'Leave assignment', close: 'Close task' })[action];

export function stopProgressMessage(progress: GigStopProgress): string {
  if (progress.status === 'needs_review') return 'This task action needs review. Check its status or contact support before continuing.';
  if (progress.status !== 'completed') return progress.financialStatus === 'refund_pending'
    ? 'The refund is pending. The task action is not complete yet.'
    : progress.financialStatus === 'release_pending'
      ? 'The payment hold release is pending. The task action is not complete yet.'
      : 'The task action is pending. Check its status before continuing.';
  const outcome = progress.receipt?.gigStatus === 'open' ? 'The task is open for bidding.' : 'The task is cancelled.';
  return progress.financialStatus === 'refunded' ? `${outcome} The refund is confirmed; your bank may take additional time to show it.`
    : progress.financialStatus === 'released' ? `${outcome} The payment hold release is confirmed.` : outcome;
}
