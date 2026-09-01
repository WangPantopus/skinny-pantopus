/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  // P1.15 — audienceProfile.e2e is an integration-shaped test that uses
  // the project's mocked supabaseAdmin (live Supabase isn't available in
  // CI). Allow it under default `npm test` alongside auth-exploits. P2.3
  // adds notifications.context — same shape, mocked supabaseAdmin only.
  testPathIgnorePatterns: ['/node_modules/', '/tests/integration/(?!auth-exploits|audienceProfile\\.e2e|notifications\\.context|posts\\.identityContext|identityCenter\\.unified|identityCenter\\.viewAs|personaPayments\\.stripeArgs)'],
  // Map requires to mocks so tests don't need live Supabase/Stripe
  moduleNameMapper: {
    '^../config/supabaseAdmin$': '<rootDir>/tests/__mocks__/supabaseAdmin.js',
    '^../config/supabase$': '<rootDir>/tests/__mocks__/supabaseAdmin.js',
    '^../utils/logger$': '<rootDir>/tests/__mocks__/logger.js',
    '^\\.\/logger$': '<rootDir>/tests/__mocks__/logger.js',
    '^../../config/supabaseAdmin$': '<rootDir>/tests/__mocks__/supabaseAdmin.js',
    '^../../utils/logger$': '<rootDir>/tests/__mocks__/logger.js',
    // Providers under services/context/providers/ reach three levels up.
    // Without this the real winston loads and throws in the test env.
    '^../../../utils/logger$': '<rootDir>/tests/__mocks__/logger.js',
    '^../../../config/supabaseAdmin$': '<rootDir>/tests/__mocks__/supabaseAdmin.js',
    '^../services/notificationService$': '<rootDir>/tests/__mocks__/notificationService.js',
    '^../../services/notificationService$': '<rootDir>/tests/__mocks__/notificationService.js',
    '^../notificationService$': '<rootDir>/tests/__mocks__/notificationService.js',
    '^\\.\/notificationService$': '<rootDir>/tests/__mocks__/notificationService.js',
    '^../services/pushService$': '<rootDir>/tests/__mocks__/pushService.js',
    '^\\.\/pushService$': '<rootDir>/tests/__mocks__/pushService.js',
    '^dotenv$': '<rootDir>/tests/__mocks__/dotenv.js',
    '^../middleware/verifyToken$': '<rootDir>/tests/__mocks__/verifyToken.js',
  },
  // Automatically clear mock calls and instances between every test
  clearMocks: true,
};
