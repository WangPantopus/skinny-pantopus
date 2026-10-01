// Stub notification service — captures calls for assertions
module.exports = {
  init: jest.fn(),
  deliverStoredGigNotification: jest.fn().mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 }),
  createNotification: jest.fn(),
  // A device-registered user's Push Notifications switch is on (routes/notifications.js /register).
  isPushEnabled: jest.fn().mockResolvedValue(true),
  createBulkNotifications: jest.fn().mockResolvedValue([]),
  notifyAddressRevealed: jest.fn().mockResolvedValue(undefined),
  notifyPersonaFollow: jest.fn().mockResolvedValue(undefined),
  notifyPersonaFollowApproved: jest.fn().mockResolvedValue(undefined),
  notifyPersonaBroadcast: jest.fn().mockResolvedValue([]),
};
