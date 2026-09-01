export const get = jest.fn();
export const post = jest.fn();
export const put = jest.fn();
export const del = jest.fn();
export const patch = jest.fn();

export const identitySearch = {
  searchProfiles: jest.fn(),
};

// Public address typeahead (services/geo) — the signed-out funnel's input.
export const geo = {
  autocomplete: jest.fn(),
  autocompleteWithAbort: jest.fn(),
};

// P1.6 — audience-profile surface mocks. Tests stub these via mockResolvedValue.
export const personas = {
  getMyPersona: jest.fn(),
  getMyAudienceIdentity: jest.fn(),
  getPersona: jest.fn(),
  followPersona: jest.fn(),
  unfollowPersona: jest.fn(),
  followPersonaWithHandshake: jest.fn(),
  getFanHandleSuggestion: jest.fn(),
  getMembershipStats: jest.fn(),
};

// P2.2 — primary-nav prefetchers warm chat conversations as well.
export const chat = {
  getUnifiedConversations: jest.fn(),
};
// Hub prefetcher uses api.hub.getHub; the briefing opt-in card reads
// and writes preferences through the client (CSRF header lives there).
export const hub = {
  getHub: jest.fn(),
  getHubPreferences: jest.fn(),
  updateHubPreferences: jest.fn(),
};

export const broadcast = {
  getBroadcastMessages: jest.fn(),
  publishBroadcastMessage: jest.fn(),
  markBroadcastMessageRead: jest.fn(),
};

export const upload = {
  uploadPostMedia: jest.fn(),
};

export const personaTiers = {
  listOwnerTiers: jest.fn(),
  listPublicTiers: jest.fn(),
  updateTier: jest.fn(),
  setTierVisibility: jest.fn(),
  deleteTier: jest.fn(),
};

export const personaPayments = {
  startOnboarding: jest.fn(),
  getOnboardingStatus: jest.fn(),
};

export const personaDms = {
  listThreads: jest.fn(),
  openThread: jest.fn(),
  getThread: jest.fn(),
  sendMessage: jest.fn(),
};

export const personaMembership = {
  getMyMembership: jest.fn(),
  upgradeMembership: jest.fn(),
  downgradeMembership: jest.fn(),
  cancelMembership: jest.fn(),
  requestRefund: jest.fn(),
};

export const personaBlocks = {
  blockFan: jest.fn(),
  unblockFan: jest.fn(),
  listBlocks: jest.fn(),
};

export const featureFlags = {
  getFeatureFlag: jest.fn(),
};

// P2.3 — bell + megaphone split + notifications page tabs.
export const notifications = {
  getNotifications: jest.fn(),
  getUnreadCount: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn(),
  deleteNotification: jest.fn(),
  registerPushToken: jest.fn(),
  unregisterPushToken: jest.fn(),
};

// P2.4 — personal-zone composer enforcement.
export const posts = {
  getPostingIdentities: jest.fn(),
  createPost: jest.fn(),
};

// P2.6 — unified Profiles & Privacy surface.
export const identityCenter = {
  getIdentityCenter: jest.fn(),
  getViewAsPreview: jest.fn(),
  updateBridgeSettings: jest.fn(),
};

// P2.1 — ProfileToggle / ProBadge / ProModeCard
// W2.4 — Place multi-home switcher reads getPrimaryHome + getMyHomes.
export const homes = {
  getMyHomes: jest.fn(),
  getPrimaryHome: jest.fn(),
};

// Place — address-led home intelligence (W1.x dashboard + W2.4 switcher).
export const place = {
  getPlaceIntelligence: jest.fn(),
  getPublicPlacePreview: jest.fn(),
  putHomeSystem: jest.fn(),
};
// Place — residency letters (Phase 1) + scoped live claims (Wave 1).
export const residencyLetters = {
  issueResidencyLetter: jest.fn(),
  listResidencyLetters: jest.fn(),
  getResidencyLetterPdf: jest.fn(),
  revokeResidencyLetter: jest.fn(),
  verifyResidencyLetter: jest.fn(),
};
// The component builds its duration picker from this constant at module
// scope, so the mock must export the real value.
export const RESIDENCY_CLAIM_EXPIRY_DAYS = [1, 7, 30, 90] as const;
export const residencyClaims = {
  issueResidencyClaim: jest.fn(),
  listResidencyClaims: jest.fn(),
  listResidencyClaimViews: jest.fn(),
  revokeResidencyClaim: jest.fn(),
  verifyResidencyClaim: jest.fn(),
};
// Place — 911-ready household fridge cards (Wave 1, #2).
export const fridgeCards = {
  issueFridgeCard: jest.fn(),
  listFridgeCards: jest.fn(),
  revokeFridgeCard: jest.fn(),
  getPublicFridgeCard: jest.fn(),
};
// Home profile bits the fridge-card composer seeds from.
export const homeProfile = {
  getHomeEmergencies: jest.fn(),
};
// Place — Block Founders growth mechanic (Wave 3).
export const blockFounders = {
  getBlockStatus: jest.fn(),
  sendBlockInvite: jest.fn(),
  redeemInviteOptOut: jest.fn(),
};
// Place — the Real Rent Benchmark, resident contribution half (Wave 3).
export const realRent = {
  getRentReport: jest.fn(),
  setRentReport: jest.fn(),
  deleteRentReport: jest.fn(),
};
// Place — Unlisted: the address-removal surface (Wave 4).
export const scout = {
  getScoutReport: jest.fn(),
};

export const unlisted = {
  getPublicUnlisted: jest.fn(),
  getHomeUnlisted: jest.fn(),
  setRemovalStatus: jest.fn(),
};
export const UNLISTED_REMOVAL_STATUSES = ['todo', 'requested', 'confirmed', 'relisted'] as const;
// Place — mailbox reality check (Wave 1, #3).
export const mailboxCheck = {
  getMailboxCheck: jest.fn(),
};
// Place — home record watch, rate-watch half (Wave 2b).
export const recordWatch = {
  setRecordWatch: jest.fn(),
  getRecordWatch: jest.fn(),
  deleteRecordWatch: jest.fn(),
};
export const businesses = {
  getMyBusinesses: jest.fn(),
};
export const businessSeats = {
  getMySeats: jest.fn(),
};
export const professional = {
  getMyProfile: jest.fn(),
};

export const getAuthToken = jest.fn();
// Wedge Phase 1 funnel beacons (fire-and-forget from /start).
export const recordFunnelEvent = jest.fn();
export const getFunnelAnonId = jest.fn(() => 'anon-test');
export const clearAuthToken = jest.fn();
export const refreshAuthSession = jest.fn();

// Persistent login — /api/users auth helpers used by settings/security + session refresh.
export const auth = {
  logout: jest.fn(),
  getAuthMethods: jest.fn(),
  reauthenticate: jest.fn(),
};

// Persistent login — /api/auth devices / sessions / step-up (packages/api/src/endpoints/authDevices.ts).
export const authDevices = {
  getDevices: jest.fn(),
  revokeDevice: jest.fn(),
  revokeOtherSessions: jest.fn(),
  revokeAllSessions: jest.fn(),
  stepUpWithPassword: jest.fn(),
  stepUpWithDeviceKey: jest.fn(),
  createChallenge: jest.fn(),
  getSecurityPrefs: jest.fn(),
  updateSecurityPrefs: jest.fn(),
  getSecurityEvents: jest.fn(),
  isStepUpRequired: (err: unknown) => {
    const e = err as { statusCode?: number; data?: { code?: string } } | null | undefined;
    return e?.statusCode === 403 && e?.data?.code === 'STEP_UP_REQUIRED';
  },
  getApiErrorCode: (err: unknown) => (err as { data?: { code?: string } } | null | undefined)?.data?.code,
  isSecuritySignOutCode: (code: string | undefined | null) =>
    Boolean(code && ['TOKEN_REUSE', 'DEVICE_MISMATCH', 'DEVICE_REVOKED', 'SESSION_REVOKED', 'SESSION_EXPIRED_INACTIVE', 'DPOP_REQUIRED'].includes(code)),
  STEP_UP_HEADER: 'X-Step-Up',
};
