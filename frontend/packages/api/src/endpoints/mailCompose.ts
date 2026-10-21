// ============================================================
// MAIL COMPOSE ENDPOINTS
// API layer for the four-moment compose flow.
// Wraps existing and new endpoints behind compose-specific functions.
// ============================================================

import { get, post } from '../client';
import apiClient from '../client';
import type { Mail } from '@pantopus/types';
import type { MailIntent, InkSelection } from '@pantopus/types';
import type { StructuredMailSendPayload } from './mailbox';

// ─── Escrow types ──────────────────────────────────────────

/**
 * The public preview of a letter sent to someone who isn't on Pantopus: who it is from and a short preview,
 * never the letter itself (GET /api/mailbox/claim/:mailId).
 */
export interface EscrowedMailView {
  mail: {
    id: string;
    senderName: string;
    senderVerified: boolean;
    /** A letter sent as a business names the business, never the person who sent it for the business. */
    senderKind: 'business' | 'person';
    subject: string | null;
    previewText: string | null;
    mailType: string | null;
    outcomeDescription: string | null;
    /** The address or number the letter was sent to, masked (j***@example.com). */
    sentTo: string;
    createdAt: string;
    expiresAt: string | null;
  };
}

/** Why a letter's link can't be opened or claimed: the `code` of a claim route's error. */
export type EscrowClaimErrorCode =
  | 'MAIL_LINK_INVALID'
  | 'MAIL_CLAIMED'
  | 'MAIL_EXPIRED'
  | 'MAIL_WITHDRAWN'
  | 'MAIL_OWN_LETTER'
  | 'MAIL_CONTACT_MISMATCH';

export interface ClaimEscrowedMailResponse {
  message: string;
  mail: {
    id: string;
    type: Mail['type'];
    subject: string | null;
    mailType: Mail['mail_type'] | null;
    displayTitle: string | null;
    escrowStatus: 'claimed';
  };
}

// ─── Response types ────────────────────────────────────────

/** Matches the existing sendMail response shape */
export interface SendMailResponse {
  message: string;
  mail: {
    id: string;
    type: Mail['type'];
    subject: string | null;
    mailType?: Mail['mail_type'] | null;
    displayTitle?: string | null;
    previewText?: string | null;
    primaryAction?: Mail['primary_action'] | null;
    actionRequired?: boolean;
    recipientUserId?: string | null;
    recipientHomeId?: string | null;
    addressHomeId?: string | null;
    deliveryTargetType?: 'home' | 'user' | null;
    deliveryTargetId?: string | null;
    attnUserId?: string | null;
    attnLabel?: string | null;
    deliveryVisibility?: 'home_members' | 'attn_only' | 'attn_plus_admins' | null;
    createdAt: string;
  };
}

/** A single recipient search result */
export interface RecipientSearchResult {
  name: string;
  userId: string;
  homeId: string | null;
  isVerified: boolean;
  homeMediaUrl: string | null;
  isOnPantopus: boolean;
}

/** Home context for the compose destination step */
export interface HomeContext {
  homeId: string;
  addressDisplay: string;
  householdMemberCount: number;
  homeMediaUrl: string | null;
  privateDeliveryAvailable: boolean;
}

// ─── Endpoints ─────────────────────────────────────────────

/**
 * Send composed mail via POST /api/mailbox/send.
 * Wraps the existing send endpoint with the StructuredMailSendPayload shape.
 */
export async function sendComposedMail(
  payload: StructuredMailSendPayload,
): Promise<SendMailResponse> {
  return post<SendMailResponse>('/api/mailbox/send', payload);
}

/**
 * Search for recipients while composing.
 * Calls GET /api/mailbox/compose/recipients?q=...&homeId=...
 * (Backend endpoint built in P1-04.)
 */
export async function searchRecipients(
  query: string,
  homeId?: string,
): Promise<RecipientSearchResult[]> {
  const params: Record<string, string> = { q: query };
  if (homeId) params.homeId = homeId;
  const result = await get<{ recipients: RecipientSearchResult[] }>(
    '/api/mailbox/compose/recipients',
    params,
  );
  return result.recipients;
}

/**
 * Get home context for a recipient's address.
 * Calls GET /api/mailbox/compose/home-context/:homeId
 * (Backend endpoint built in P1-04.)
 */
export async function getRecipientHomeContext(
  homeId: string,
): Promise<HomeContext> {
  return get<HomeContext>(`/api/mailbox/compose/home-context/${homeId}`);
}

/**
 * Request an AI-generated opening line suggestion.
 * Calls POST /api/ai/draft/mail-opening
 * (Backend endpoint built in Phase 2.)
 */
export async function requestAISuggestion(params: {
  intent: MailIntent;
  ink: InkSelection;
  recipientName: string;
  body?: string;
}): Promise<{ suggestion: string }> {
  return post<{ suggestion: string }>('/api/ai/draft/mail-opening', params);
}

/**
 * Upload a voice postscript audio recording.
 * Uses the existing file upload infrastructure (POST /api/files/upload).
 * Returns the URI to attach to the compose state.
 */
export async function uploadVoicePostscript(
  audioBlob: Blob,
): Promise<{ uri: string }> {
  const formData = new FormData();
  const file = new File([audioBlob], 'voice-postscript.webm', {
    type: audioBlob.type || 'audio/webm',
  });
  formData.append('file', file);
  formData.append('file_type', 'voice_postscript');
  formData.append('visibility', 'private');

  const response = await apiClient.post<{
    message: string;
    file: { id: string; url: string };
  }>('/api/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return { uri: response.data.file.url };
}

// ─── Escrow Claim Endpoints ─────────────────────────────────

/**
 * Public preview of a letter sent to someone who isn't on Pantopus (no sign-in): the page its emailed link opens.
 * Calls GET /api/mailbox/claim/:mailId?token=...
 */
export async function getEscrowedMailPublic(
  mailId: string,
  token: string,
): Promise<EscrowedMailView> {
  return get<EscrowedMailView>(
    `/api/mailbox/claim/${encodeURIComponent(mailId)}`,
    { token },
  );
}

/**
 * Put the letter in the signed-in person's mailbox. Their account's email (or phone number) must be the one the
 * letter was sent to. Calls POST /api/mailbox/claim/:mailId
 */
export async function claimEscrowedMail(
  mailId: string,
  token: string,
): Promise<ClaimEscrowedMailResponse> {
  return post<ClaimEscrowedMailResponse>(
    `/api/mailbox/claim/${encodeURIComponent(mailId)}`,
    { token },
  );
}

/**
 * Withdraw escrowed mail (sender only, before claim).
 * Calls POST /api/mailbox/compose/withdraw/:mailId
 */
export async function withdrawEscrowedMail(
  mailId: string,
): Promise<{ success: boolean; message: string }> {
  return post<{ success: boolean; message: string }>(
    `/api/mailbox/compose/withdraw/${encodeURIComponent(mailId)}`,
  );
}
