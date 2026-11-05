import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        module: 'commonjs',
        esModuleInterop: true,
        moduleResolution: 'node',
        target: 'ES2017',
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@pantopus/api(?:/client)?$': '<rootDir>/tests/__mocks__/@pantopus/api.ts',
    // Stylesheets imported by components (e.g. a map's Leaflet CSS) are for the browser, not the tests.
    '\\.css$': '<rootDir>/tests/__mocks__/style.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Ignore Playwright spec files (E2E)
  testPathIgnorePatterns: ['/node_modules/', '\\.spec\\.ts$'],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
};

export default config;
