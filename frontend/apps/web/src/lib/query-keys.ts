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
  chatTopics: (otherUserId: string) =>
    ['chat', 'topics', otherUserId] as const,
  chatRoom: (roomId: string, asBusinessUserId?: string) =>
    ['chat', 'room', roomId, asBusinessUserId ?? 'me'] as const,

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
  postComments: (id: string) => ['posts', 'comments', id] as const,

  // ── Profiles ──────────────────────────────────────────────
  /** Your own profile (GET /api/users/profile); read it through lib/me.ts. */
  me: () => ['me'] as const,
  /** Your notification preferences (GET /api/hub/preferences); lib/me.ts. */
  notificationPreferences: () => ['me', 'notification-preferences'] as const,
  /** Your privacy settings (GET /api/privacy/settings); lib/me.ts. */
  privacySettings: () => ['me', 'privacy'] as const,
  profile: (username: string) =>
    ['profile', username] as const,

  // ── Homes ─────────────────────────────────────────────────
  homeDetail: (id: string) => ['homes', 'detail', id] as const,
  /** A Home's dashboard as last shown, with the access it was shown with; components/home/homeDashboardCopy.ts. */
  homeDashboard: (id: string) => ['homes', 'dashboard', id] as const,
  /** One of that dashboard's summary cards, kept beside its copy. */
  homeSummary: (id: string, name: string) => ['homes', 'dashboard', id, 'summary', name] as const,

  // ── Place (address-led home intelligence) ─────────────────
  placePrimaryHome: () => ['place', 'primary-home'] as const,
  placeMyHomes: () => ['place', 'my-homes'] as const,
  placeIntelligence: (homeId: string) =>
    ['place', 'intelligence', homeId] as const,
  /** The civic_election section alone (Today's ballot card). */
  placeBallot: (homeId: string) =>
    ['place', 'intelligence', homeId, 'civic_election'] as const,
  placePulse: (homeId: string) =>
    ['place', 'pulse', homeId] as const,
  neighborMessageTemplates: () =>
    ['place', 'neighbor-messages', 'templates'] as const,
  neighborMessage: (id: string) =>
    ['place', 'neighbor-messages', id] as const,
  residencyLetters: (homeId: string) =>
    ['place', 'residency-letters', homeId] as const,
  residencyClaims: (homeId: string) =>
    ['place', 'residency-claims', homeId] as const,
  residencyClaimViews: (homeId: string, claimId: string) =>
    ['place', 'residency-claims', homeId, claimId, 'views'] as const,
  fridgeCards: (homeId: string) =>
    ['place', 'fridge-cards', homeId] as const,
  mailboxCheck: (homeId: string) =>
    ['place', 'mailbox-check', homeId] as const,
  recordWatch: (homeId: string) =>
    ['place', 'record-watch', homeId] as const,
  blockFounders: (homeId: string) =>
    ['place', 'block-founders', homeId] as const,
  rentReport: (homeId: string) =>
    ['place', 'rent-report', homeId] as const,
  unlisted: (homeId: string) =>
    ['place', 'unlisted', homeId] as const,
  placeAccess: (homeId: string) =>
    ['place', 'access', homeId] as const,

  // ── Businesses ────────────────────────────────────────────
  businessDetail: (id: string) =>
    ['businesses', 'detail', id] as const,

  // ── Support Trains ────────────────────────────────────────
  /** Every Support Train entry; a change to any train marks them out of date. */
  supportTrains: () => ['supportTrains'] as const,
  /** Your trains on the list page: every role tab. */
  supportTrainLists: () => ['supportTrains', 'mine'] as const,
  /** Your trains on the list page, per role tab ('all', 'organizer', 'helper'). */
  supportTrainsMine: (role: string) => ['supportTrains', 'mine', role] as const,
  /** One train, with its signups when you organize it. */
  supportTrain: (id: string) => ['supportTrains', 'train', id] as const,

  // ── Audience zone (unified-IA §3.1, §3.6) ─────────────────
  audienceMe: () => ['audience', 'me'] as const,
} as const;
