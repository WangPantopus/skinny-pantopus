import { get, post } from '../client';
import type { AudienceProfile, BroadcastAnalyticsSummary, BroadcastChannel, BroadcastMessage } from '@pantopus/types';

export type BroadcastVisibility =
  | 'public'
  | 'followers'
  | 'tier_or_above'
  // Legacy alias preserved for one rollout window. Server-side it
  // still validates and is treated as tier_or_above rank=2.
  | 'subscribers';

export async function getBroadcastMessages(channelId: string): Promise<{
  channel: BroadcastChannel;
  persona: AudienceProfile;
  messages: BroadcastMessage[];
  analytics?: BroadcastAnalyticsSummary | null;
  viewer?: { tierRank: number };
}> {
  return get(`/api/broadcast/channels/${encodeURIComponent(channelId)}/messages`);
}

export interface PublishBroadcastPayload {
  body?: string | null;
  media?: Array<Record<string, unknown>>;
  visibility?: BroadcastVisibility;
  target_tier_rank?: number | null;
}

export async function publishBroadcastMessage(
  channelId: string,
  payload: PublishBroadcastPayload,
): Promise<{ message: BroadcastMessage }> {
  return post(`/api/broadcast/channels/${encodeURIComponent(channelId)}/messages`, payload);
}

export async function markBroadcastMessageRead(messageId: string): Promise<{ message: BroadcastMessage }> {
  return post(`/api/broadcast/messages/${encodeURIComponent(messageId)}/read`);
}
