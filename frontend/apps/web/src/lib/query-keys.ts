// ============================================================
// QUERY KEY FACTORY
//
// Centralized cache key management for all React Query usage
// outside of mailbox (which keeps its own keys in mailbox-queries.ts).
//
// Convention: each factory returns a readonly tuple so keys are
// structurally typed and auto-completed.
// ============================================================

export const queryKeys = {
  // ── Hub ────────────────────────────────────────────────────
  hub: () => ['hub'] as const,
  hubToday: () => ['hub', 'today'] as const,

  // ── Feed ───────────────────────────────────────────────────
  feed: (surface: string, filter: string) =>
    ['feed', surface, filter] as const,

  // ── Gigs ───────────────────────────────────────────────────
  gigs: (filters: Record<string, any>) =>
    ['gigs', filters] as const,
  gigDetail: (id: string) => ['gigs', 'detail', id] as const,

  // ── Chat ───────────────────────────────────────────────────
  conversations: () => ['conversations'] as const,
  chatMessages: (roomId: string) =>
    ['chat', 'messages', roomId] as const,

  // ── Notifications ──────────────────────────────────────────
  notifications: () => ['notifications'] as const,

  // ── My Gigs ────────────────────────────────────────────────
  myGigs: (status?: string) =>
    ['myGigs', status] as const,

  // ── My Bids ────────────────────────────────────────────────
  myBids: (status?: string) =>
    ['myBids', status] as const,

  // ── Discover ───────────────────────────────────────────────
  discover: (scope: string, filters: Record<string, any>) =>
    ['discover', scope, filters] as const,

  // ── Relationships ──────────────────────────────────────────
  connections: () => ['connections'] as const,
  connectionRequests: (direction: 'pending' | 'sent') =>
    ['connectionRequests', direction] as const,
  blockedUsers: () => ['blockedUsers'] as const,

  // ── Marketplace ────────────────────────────────────────────
  marketplace: (mode: string, filters: Record<string, any>) =>
    ['marketplace', mode, filters] as const,
  listingDetail: (id: string) =>
    ['marketplace', 'listing', id] as const,

  // ── Posts ──────────────────────────────────────────────────
  postDetail: (id: string) => ['posts', 'detail', id] as const,

  // ── Profiles ──────────────────────────────────────────────
  profile: (username: string) =>
    ['profile', username] as const,

  // ── Homes ─────────────────────────────────────────────────
  homeDetail: (id: string) => ['homes', 'detail', id] as const,

  // ── Place (address-led home intelligence) ─────────────────
  placePrimaryHome: () => ['place', 'primary-home'] as const,
  placeMyHomes: () => ['place', 'my-homes'] as const,
  placeIntelligence: (homeId: string) =>
    ['place', 'intelligence', homeId] as const,
  placePulse: (homeId: string) =>
    ['place', 'pulse', homeId] as const,
  neighborMessageTemplates: () =>
    ['place', 'neighbor-messages', 'templates'] as const,
  neighborMessage: (id: string) =>
    ['place', 'neighbor-messages', id] as const,
  residencyLetters: (homeId: string) =>
    ['place', 'residency-letters', homeId] as const,

  // ── Businesses ────────────────────────────────────────────
  businessDetail: (id: string) =>
    ['businesses', 'detail', id] as const,

  // ── Audience zone (unified-IA §3.1, §3.6) ─────────────────
  audienceMe: () => ['audience', 'me'] as const,
} as const;
