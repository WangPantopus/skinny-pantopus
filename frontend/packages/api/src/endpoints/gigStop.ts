import { get, post } from '../client';

export type GigStopAction = 'cancel' | 'reopen_bidding' | 'worker_release' | 'close';
export type GigStopFinancialAction = 'none' | 'release' | 'refund';
export type GigStopReason = 'changed_plans' | 'found_someone_else' | 'too_expensive'
  | 'emergency' | 'other' | 'schedule_conflict' | 'unable_to_complete' | 'safety_concern';

export interface GigStopTerms {
  gigId: string;
  ownerId: string;
  workerId: string | null;
  paymentId: string | null;
  amountCents: number;
  currency: 'usd';
  gigStatus: string;
  acceptedAt: string | null;
  acceptedBidId: string | null;
  policy: string;
  policyFeeCents: number;
}

export interface GigStopPreview {
  actorId: string;
  sessionScope: string;
  action: GigStopAction;
  terms: GigStopTerms;
  eligible: boolean;
  unavailableReason: string | null;
  financialAction: GigStopFinancialAction | 'review';
  activeRequestId: string | null;
}

/** Nonsecret identity and original terms; safe to retain for interrupted requests. */
export interface GigStopRequest {
  requestId: string;
  gigId: string;
  actorId: string;
  action: GigStopAction;
  terms: GigStopTerms;
  reason: GigStopReason | null;
  rollbackMode: 'payment_setup_aborted' | null;
  financialAction: GigStopFinancialAction;
}

export interface GigStopReceipt {
  requestId: string;
  gigId: string;
  paymentId: string | null;
  ownerId: string;
  workerId: string | null;
  amountCents: number;
  currency: 'usd';
  action: GigStopAction;
  gigStatus: 'open' | 'cancelled';
  financialStatus: 'none' | 'released' | 'refunded';
}

export interface GigStopProgress {
  actorId: string;
  sessionScope: string;
  requestId: string;
  action: GigStopAction;
  status: 'pending' | 'needs_review' | 'completed';
  financialStatus: 'none' | 'release_pending' | 'released' | 'refund_pending' | 'refunded' | 'needs_review';
  canRetry: boolean;
  request: GigStopRequest;
  receipt: GigStopReceipt | null;
}

export interface GigStopCommand {
  requestId: string;
  action: GigStopAction;
  expectedActorId: string;
  expectedSessionScope: string;
  expectedTerms: GigStopTerms;
  reason: GigStopReason | null;
  rollbackMode: 'payment_setup_aborted' | null;
}

/** Reads only. Neither preview nor status starts a provider operation. */
export function getGigStopPreview(gigId: string, action: GigStopAction): Promise<GigStopPreview> {
  return get(`/api/gigs/${gigId}/stop-preview`, { action });
}

export function getGigStopRequest(gigId: string, requestId: string): Promise<GigStopProgress> {
  return get(`/api/gigs/${gigId}/stop-requests/${requestId}`);
}

/** Only a verified matching completed receipt establishes success. */
export function submitGigStopRequest(gigId: string, command: GigStopCommand): Promise<GigStopProgress> {
  return post(`/api/gigs/${gigId}/stop-requests`, command);
}
