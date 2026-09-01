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
    '^@pantopus/api$': '<rootDir>/tests/__mocks__/@pantopus/api.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  // Ignore Playwright spec files (E2E)
  testPathIgnorePatterns: ['/node_modules/', '\\.spec\\.ts$'],
  testMatch: ['<rootDir>/tests/**/*.test.{ts,tsx}'],
};

export default config;
