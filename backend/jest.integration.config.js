/**
 * Jest config for integration tests.
 *
 * Key difference from the default config: does NOT use __mocks__
 * so tests hit a real Supabase instance (local or CI).
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run with: pnpm test:integration
 */
module.exports = {
  testMatch: ['<rootDir>/tests/integration/**/*.test.js'],
  testTimeout: 30000,
  // Deliberately omit moduleNameMapper so real Supabase clients are used
  setupFilesAfterSetup: [],
  verbose: true,
  forceExit: true,
  // Run tests sequentially — they share the same DB
  maxWorkers: 1,
};
