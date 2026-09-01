// Stub push service — prevents expo-server-sdk ESM import in tests
module.exports = {
  saveToken: jest.fn().mockResolvedValue({ id: 'mock-id', token: 'mock-token' }),
  removeToken: jest.fn().mockResolvedValue(undefined),
  removeAllTokens: jest.fn().mockResolvedValue(undefined),
  sendToUser: jest.fn().mockResolvedValue(undefined),
  sendToUsers: jest.fn().mockResolvedValue(undefined),
  checkReceipts: jest.fn().mockResolvedValue(undefined),
};
