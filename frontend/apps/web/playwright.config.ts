import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
  webServer: {
    command: 'npx next dev --port 3000',
    port: 3000,
    timeout: 120_000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_API_URL: 'http://localhost:8000',
      // The first-launch cut hides eight features unless this lists them; like Jest
      // (tests/setup.ts), the browser tests run with every feature on.
      NEXT_PUBLIC_LAUNCH_FEATURES: process.env.NEXT_PUBLIC_LAUNCH_FEATURES ?? 'all',
    },
  },
});
