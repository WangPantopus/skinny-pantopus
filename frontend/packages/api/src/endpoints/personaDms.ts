// ============================================================
// PERSONA DMs (P1.12)
// Audience Profile design v2 §10. Owner sees all threads on a
// persona; fan sees only their own. Wire shapes deliberately do
// NOT carry user_id of either party — threads carry membership_id,
// messages carry sender_role only.
// ============================================================

import { get, post } from '../client';

export interface PersonaDmThreadSummary {
  id: string;
  membershipId: string;
  status: 'open' | 'closed' | 'blocked';
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
  fanHandle: string | null;
  fanDisplayName: string | null;
  fanAvatarUrl: string | null;
  tier: { rank: number; name: string } | null;
}

export interface PersonaDmMessage {
  id: string;
  threadId: string;
  senderRole: 'fan' | 'creator';
  body: string;
  media: Array<Record<string, unknown>>;
  createdAt: string;
  readAt: string | null;
}

export type ReplyPolicy =
  | 'discretion'
  | 'within_3_days'
  | 'within_7_days'
  | 'within_14_days'
  | 'always';

export interface ReplyPolicyStatus {
  status: 'on_track' | 'sla_missed';
  policy: ReplyPolicy;
  slaDays: number;
  daysRemaining?: number;
}

export interface PersonaDmThreadDetail {
  thread: {
    id: string;
    membershipId: string;
    status: 'open' | 'closed' | 'blocked';
    createdAt: string;
    lastMessageAt: string | null;
  };
  fan: { handle: string; displayName: string; avatarUrl: string | null };
  persona: { handle: string; displayName: string };
  viewerRole: 'fan' | 'creator';
  messages: PersonaDmMessage[];
  // Fan-side only; null for the creator and for discretion policy /
  // already-replied threads.
  replyPolicyStatus: ReplyPolicyStatus | null;
}

export async function listThreads(personaId: string): Promise<{ threads: PersonaDmThreadSummary[] }> {
  return get<{ threads: PersonaDmThreadSummary[] }>(
    `/api/personas/${encodeURIComponent(personaId)}/dms/threads`,
  );
}

export async function openThread(
  personaId: string,
  payload: { body: string; media?: Array<Record<string, unknown>> },
): Promise<{ threadId: string; quotaRemaining: number | null }> {
  return post<{ threadId: string; quotaRemaining: number | null }>(
    `/api/personas/${encodeURIComponent(personaId)}/dms/threads`,
    payload,
  );
}

export async function getThread(
  personaId: string,
  threadId: string,
): Promise<PersonaDmThreadDetail> {
  return get<PersonaDmThreadDetail>(
    `/api/personas/${encodeURIComponent(personaId)}/dms/threads/${encodeURIComponent(threadId)}`,
  );
}

export async function sendMessage(
  personaId: string,
  threadId: string,
  payload: { body: string; media?: Array<Record<string, unknown>> },
): Promise<{ message: PersonaDmMessage }> {
  return post<{ message: PersonaDmMessage }>(
    `/api/personas/${encodeURIComponent(personaId)}/dms/threads/${encodeURIComponent(threadId)}/messages`,
    payload,
  );
}
