import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  displayName: 'performance',
  testMatch: ['<rootDir>/src/tests/performance/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  setupFiles: ['<rootDir>/src/tests/performance/setup.ts'],
  testEnvironment: 'node',
  verbose: true,
  // Increase test timeout for performance measurements
  testTimeout: 30000,
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json'
    }
  },
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'coverage/performance',
      outputName: 'performance-report.xml',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }]
  ]
};

export default config;