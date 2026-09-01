export const get = jest.fn();
export const post = jest.fn();
export const put = jest.fn();
export const del = jest.fn();
export const patch = jest.fn();

export const identitySearch = {
  searchProfiles: jest.fn(),
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
// Hub prefetcher uses api.hub.getHub.
export const hub = {
  getHub: jest.fn(),
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
