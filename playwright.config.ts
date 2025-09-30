import { PlaywrightTestConfig, devices } from '@playwright/test';
import path from 'path';

const config: PlaywrightTestConfig = {
  testDir: './e2e-tests',
  timeout: 60000, // Increased from 30s to 60s for service worker initialization
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    actionTimeout: 20000, // Increased from 10s to 20s for extension actions
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: false,  // Must be false when using --headless=new flag
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          headless: false,  // Must be false when using --headless=new
          args: [
            '--headless=new',  // CRITICAL: Use new headless mode for extension support
            `--disable-extensions-except=${path.resolve(__dirname, 'build')}`,
            `--load-extension=${path.resolve(__dirname, 'build')}`,
            '--no-sandbox',
            '--disable-setuid-sandbox',
          ],
        },
      },
    },
  ],
  globalSetup: './e2e-tests/setup.ts',
};

export default config;