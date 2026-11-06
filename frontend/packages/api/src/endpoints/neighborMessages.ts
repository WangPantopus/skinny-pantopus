// ============================================================
// NEIGHBOR MESSAGES — verified-only, template-only neighbor heads-ups (W2.6)
//
// Thin wrappers over /api/neighbor-messages. The trust-and-safety model is
// baked into the API, so these wrappers stay deliberately small:
//   * the template catalog is the single source of truth (server-served) —
//     there is no free-text field anywhere;
//   * sending requires a verified resident (T4) and an address on their
//     block; the server enforces both, and its answer never says whether
//     anyone lives there;
//   * the recipient never learns the sender — responses are anonymized
//     ("a verified neighbor nearby");
//   * reply is templated; report / not-helpful / block are all available
//     and never notify the sender.
// ============================================================

import { get, post } from '../client';

// ─── Template catalog (server source of truth) ───

/** An outbound, pre-written note. `icon` maps to a lucide-react icon name. */
export interface NeighborMessageTemplate {
  id: string;
  icon: string;
  category: string;
  body: string;
}

/** A templated quick-reply (anonymous both ways). */
export interface NeighborReplyTemplate {
  id: string;
  body: string;
}

export interface NeighborMessageTemplates {
  templates: NeighborMessageTemplate[];
  replies: NeighborReplyTemplate[];
}

// ─── Message shapes (always anonymized) ───

/** The anonymized sender label — never an identity. */
export interface NeighborMessageSender {
  label: string;
  block_label: string;
  verified: boolean;
}

export interface NeighborMessageReply {
  template_id: string;
  body: string;
  replied_at: string | null;
}

/** Recipient-facing view of a received message. No sender identity. */
export interface ReceivedNeighborMessage {
  id: string;
  category: string;
  body: string;
  created_at: string;
  sender: NeighborMessageSender;
  reply: NeighborMessageReply | null;
  can_reply: boolean;
  not_helpful: boolean;
  reported: boolean;
  read_at: string | null;
}

/** Sender-facing confirmation after a successful send. */
export interface SentNeighborMessage {
  id: string | null;
  template_id: string;
  category: string;
  body: string;
  created_at: string;
  status: 'sent';
  recipient: { label: string; block_label: string };
}

export interface NeighborAddress {
  address: string;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
}

/** Whether an address can get a note. Nothing here says who lives there. */
export type NeighborAddressCheck =
  | { status: 'on_block'; address: string; city: string; state: string; zipcode: string }
  | { status: 'off_block' | 'not_found' | 'own_home'; message: string };

export interface SendNeighborMessageInput {
  senderHomeId: string;
  /** Any address on the sender's block. */
  recipientAddress?: NeighborAddress & { unit?: string | null };
  /** A home opened by a link to it, instead of an address. */
  recipientHomeId?: string;
  templateId: string;
}

/** The pre-written note catalog + templated quick-replies. */
export async function getNeighborMessageTemplates(): Promise<NeighborMessageTemplates> {
  return get<NeighborMessageTemplates>('/api/neighbor-messages/templates');
}

/** The recipient's received messages (most recent first). */
export async function getReceivedNeighborMessages(): Promise<ReceivedNeighborMessage[]> {
  const res = await get<{ messages: ReceivedNeighborMessage[] }>('/api/neighbor-messages/received');
  return res.messages;
}

/** A single received message (recipient only). Marks it read. */
export async function getNeighborMessage(id: string): Promise<ReceivedNeighborMessage> {
  return get<ReceivedNeighborMessage>(`/api/neighbor-messages/${id}`);
}

/** Check an address before a note is written: is it on the sender's block? */
export async function checkNeighborAddress(
  senderHomeId: string,
  address: NeighborAddress
): Promise<NeighborAddressCheck> {
  return post<NeighborAddressCheck>('/api/neighbor-messages/address-check', {
    sender_home_id: senderHomeId,
    ...address,
  });
}

/** Send a template-only note to an address on your block. It reaches a verified household if one lives there. */
export async function sendNeighborMessage(
  input: SendNeighborMessageInput
): Promise<SentNeighborMessage> {
  return post<SentNeighborMessage>('/api/neighbor-messages', {
    sender_home_id: input.senderHomeId,
    ...(input.recipientAddress
      ? { recipient_address: input.recipientAddress }
      : { recipient_home_id: input.recipientHomeId }),
    template_id: input.templateId,
  });
}

/** Reply with a templated quick-reply (anonymous both ways). */
export async function replyToNeighborMessage(
  id: string,
  replyTemplateId: string
): Promise<ReceivedNeighborMessage> {
  return post<ReceivedNeighborMessage>(`/api/neighbor-messages/${id}/reply`, {
    reply_template_id: replyTemplateId,
  });
}

/** Mark a message as not helpful (sender is never notified). */
export async function markNeighborMessageNotHelpful(id: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/api/neighbor-messages/${id}/not-helpful`, {});
}

/** Report a message to the trust team (sender is never notified). */
export async function reportNeighborMessage(
  id: string,
  reason?: string
): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/api/neighbor-messages/${id}/report`, {
    reason: reason || null,
  });
}

/** Block the sender of a message (sender is never notified). */
export async function blockNeighborMessageSender(id: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/api/neighbor-messages/${id}/block`, {});
}
