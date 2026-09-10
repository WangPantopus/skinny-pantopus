// Stub push service — prevents expo-server-sdk ESM import in tests
module.exports = {
  saveToken: jest.fn().mockResolvedValue({ id: 'mock-id', token: 'mock-token' }),
  removeToken: jest.fn().mockResolvedValue(undefined),
  removeAllTokens: jest.fn().mockResolvedValue(undefined),
  removeTokensForDevice: jest.fn().mockResolvedValue(0),
  sendToUserWithReceipt: jest.fn().mockResolvedValue({ acceptedCount: 1, unresolvedCount: 0 }),
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUserExcludingDevice: jest.fn().mockResolvedValue(undefined),
  sendToDevice: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  checkReceipts: jest.fn().mockResolvedValue(undefined),
};
