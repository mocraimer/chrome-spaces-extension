import { PlaywrightTestConfig, devices } from '@playwright/test';
import path from 'path';

const config: PlaywrightTestConfig = {
  testDir: './src/tests/e2e',
  timeout: 30000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    actionTimeout: 10000,
    trace: 'on-first-retry',
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.join(__dirname, 'build')}`,
            `--load-extension=${path.join(__dirname, 'build')}`,
            '--no-sandbox',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npm run build',
    port: 8080,
    reuseExistingServer: !process.env.CI,
  },
};

export default config;