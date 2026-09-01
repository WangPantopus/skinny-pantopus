// ============================================================
// NEIGHBOR MESSAGES — verified-only, template-only neighbor heads-ups (W2.6)
//
// Thin wrappers over /api/neighbor-messages. The trust-and-safety model is
// baked into the API, so these wrappers stay deliberately small:
//   * the template catalog is the single source of truth (server-served) —
//     there is no free-text field anywhere;
//   * sending requires a verified resident (T4) and a recipient home on the
//     same block; the server enforces both;
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

export interface SendNeighborMessageInput {
  senderHomeId: string;
  recipientHomeId: string;
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

/** Send a template-only note to a verified home on your block. */
export async function sendNeighborMessage(
  input: SendNeighborMessageInput
): Promise<SentNeighborMessage> {
  return post<SentNeighborMessage>('/api/neighbor-messages', {
    sender_home_id: input.senderHomeId,
    recipient_home_id: input.recipientHomeId,
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
