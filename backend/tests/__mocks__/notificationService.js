// Stub notification service — captures calls for assertions
module.exports = {
  init: jest.fn(),
  createNotification: jest.fn(),
  createBulkNotifications: jest.fn().mockResolvedValue([]),
  notifyAddressRevealed: jest.fn().mockResolvedValue(undefined),
  notifyPersonaFollow: jest.fn().mockResolvedValue(undefined),
  notifyPersonaFollowApproved: jest.fn().mockResolvedValue(undefined),
  notifyPersonaBroadcast: jest.fn().mockResolvedValue([]),
};
