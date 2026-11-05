// Server only: each tab's first content (lib/firstContent.ts), as the cache entries
// its screen's own queries would hold after their first reads: the same keys, the
// same shapes, the same copy rules (founder decision 3: a copy that may not show
// before its re-check is left to the browser, which reads it again).
import { cache } from 'react';
import type { DehydratedState } from '@tanstack/react-query';
import type { HubPayload, MyHome } from '@pantopus/api';
import type { PrimaryHome } from '@pantopus/api/endpoints/homes';
import type { HubToday, PlaceIntelligence, UnifiedConversationItem } from '@pantopus/types';
import { isHubTodayPayload } from '@pantopus/api/endpoints/hub';
import { queryKeys } from '@/lib/query-keys';
import { CONVERSATIONS_LIMIT, compareConversationTime } from '@/lib/conversationOrder';
import { FEED_PAGE_SIZE, buildFeedKey, feedLocationKey } from '@/lib/feedKeys';
import { placeCopyGate, showsHomeCopy, showsMyHomesCopy, showsPrimaryCopy } from '@/lib/householdCopyRules';
import { FirstContentEntries, firstContentSession, readAsVisitor, settled, type FirstContentSession } from './firstContent';

type MyHomesReply = { homes: MyHome[]; primary_home?: PrimaryHome | null };
type ConversationsPage = {
  conversations: UnifiedConversationItem[];
  total: number;
  totalUnread: number;
  totalUnmutedUnread?: number;
  totalMessages: number;
  hasMore: boolean;
  nextCursor: string | null;
};

/**
 * Your homes and primary home, as lib/myHomes.ts and lib/primaryHome.ts keep them,
 * and the home Place opens on (PlaceDashboard: the primary home, else your private setup).
 */
function setHomes(entries: FirstContentEntries, reply: MyHomesReply | undefined): { homeId: string | null; homes: MyHome[] | null } {
  if (!reply || !Array.isArray(reply.homes)) return { homeId: null, homes: null };
  const at = Date.now();
  const homes = showsMyHomesCopy(reply) ? reply.homes : null;
  if (homes) entries.set(queryKeys.placeMyHomes(), reply, at);
  // Older servers omit primary_home; their primary home is the browser's to read.
  let primary: { home: PrimaryHome | null } | null = null;
  if (reply.primary_home !== undefined && showsPrimaryCopy({ home: reply.primary_home })) {
    primary = { home: reply.primary_home };
    entries.set(queryKeys.placePrimaryHome(), primary, at);
  }
  const privateSetupId = homes?.find((home) => home.access_kind === 'private_setup')?.id ?? null;
  return { homeId: primary?.home?.id ?? privateSetupId, homes };
}

/** Place (/app/place): the setup checklist, your homes and the open home's PlaceIntelligence. */
export async function placeFirstContent(session: FirstContentSession): Promise<DehydratedState | null> {
  const entries = new FirstContentEntries();
  const [homesReply, hub] = await Promise.all([
    settled(readAsVisitor<MyHomesReply>(session, '/api/homes/my-homes')),
    settled(readAsVisitor<HubPayload>(session, '/api/hub')),
  ]);
  entries.set(['hub', 'setup'], hub);
  const { homeId, homes } = setHomes(entries, homesReply);
  if (homeId) {
    const home = homes?.find((candidate) => candidate.id === homeId);
    // Only a household's copy may show before its re-check (lib/householdCopyRules.ts).
    if (home && showsHomeCopy(home)) {
      const intelligence = await settled(readAsVisitor<PlaceIntelligence>(session, `/api/homes/${encodeURIComponent(homeId)}/intelligence`, { ballot: 1 }));
      if (intelligence && placeCopyGate(home)(intelligence)) entries.set(queryKeys.placeIntelligence(homeId), intelligence);
    }
  }
  return entries.dehydrate();
}

/** Today (/app/today): the briefing, and your homes for its ballot card. */
export async function todayFirstContent(session: FirstContentSession): Promise<DehydratedState | null> {
  const entries = new FirstContentEntries();
  const [today, homesReply] = await Promise.all([
    settled(readAsVisitor<HubToday | { today: null; error?: string }>(session, '/api/hub/today')),
    settled(readAsVisitor<MyHomesReply>(session, '/api/homes/my-homes')),
  ]);
  // As api.hub.getHubToday: a briefing, or null for none; a reply that says it failed is the browser's to retry.
  if (today !== undefined && !(today as { error?: unknown } | null)?.error) {
    entries.set(queryKeys.hubToday(), isHubTodayPayload(today) ? today : null);
  }
  setHomes(entries, homesReply);
  return entries.dehydrate();
}

/** Messages (/app/chat): the inbox's first page, as lib/conversations.ts keeps it. */
export async function messagesFirstContent(session: FirstContentSession): Promise<DehydratedState | null> {
  const entries = new FirstContentEntries();
  const page = await settled(readAsVisitor<ConversationsPage>(session, '/api/chat/unified-conversations', { limit: CONVERSATIONS_LIMIT }));
  if (page && Array.isArray(page.conversations)) {
    const conversations = [...page.conversations].sort((a, b) => compareConversationTime(b.last_message_at, a.last_message_at));
    entries.set(queryKeys.conversations(), { ...page, conversations, refreshId: crypto.randomUUID() });
  }
  return entries.dehydrate();
}

type ResolvedArea = { viewingLocation: { latitude?: number | null; longitude?: number | null; radiusMiles?: number | null } | null };

/**
 * Pulse (/app/feed): your viewing area (hooks/useAreaPicker.ts), its Place feed's first page
 * (hooks/useFeedData.ts), your feed preferences and whether you may post there.
 */
export async function pulseFirstContent(session: FirstContentSession): Promise<DehydratedState | null> {
  const entries = new FirstContentEntries();
  const [area, preferences] = await Promise.all([
    settled(readAsVisitor<ResolvedArea>(session, '/api/location/resolve')),
    settled(readAsVisitor<{ preferences?: unknown }>(session, '/api/posts/feed-preferences')),
  ]);
  if (preferences?.preferences !== undefined) entries.set(queryKeys.feedPreferences(), preferences.preferences);
  if (area) entries.set(queryKeys.viewingArea(), area);
  const at = area?.viewingLocation;
  if (at?.latitude == null || at.longitude == null) return entries.dehydrate();
  const { latitude, longitude } = at;
  const radiusMiles = at.radiusMiles ?? null;
  const [page, eligibility] = await Promise.all([
    settled(readAsVisitor<unknown>(session, '/api/posts/feed', { surface: 'place', limit: FEED_PAGE_SIZE, latitude, longitude, radiusMiles: radiusMiles ?? 100 })),
    settled(readAsVisitor<{ eligible: boolean; reason?: string | null }>(session, '/api/posts/place-eligibility', { latitude, longitude })),
  ]);
  if (page !== undefined) {
    const key = buildFeedKey('place', 'all', feedLocationKey('place', latitude, longitude, radiusMiles), null, 'for_you', null);
    entries.set(key, { pages: [page], pageParams: [null] });
  }
  if (eligibility) entries.set(['posts', 'place-eligibility', latitude, longitude], { eligible: eligibility.eligible, reason: eligibility.reason || null });
  return entries.dehydrate();
}

const TAB_READS: Record<string, (session: FirstContentSession) => Promise<DehydratedState | null>> = {
  '/app/place': placeFirstContent,
  '/app/today': todayFirstContent,
  '/app/chat': messagesFirstContent,
  '/app/feed': pulseFirstContent,
};

/**
 * A tab document's first content, read once per request (React cache): the tab's page
 * renders its screen from it, outside every Suspense boundary, so the screen goes out
 * with the frame (components/first-content/FirstContent.tsx).
 */
export const tabFirstContent = cache(async (route: string): Promise<{ state: DehydratedState | null; tag: string } | null> => {
  const session = await firstContentSession();
  const read = TAB_READS[route];
  if (!session || !read) return null;
  return { state: await read(session).catch(() => null), tag: session.tag };
});
