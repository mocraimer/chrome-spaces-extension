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
    headless: true,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          headless: true,
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'build')}`,
            `--load-extension=${path.resolve(__dirname, 'build')}`,
            '--no-sandbox',
            '--enable-logging=stderr', // Critical: Enable extension logging
            '--vmodule=*/browser/extensions/*=1', // Critical: Extension debugging logs
            '--enable-service-worker-script-debugging', // Critical: Service worker debugging
            '--disable-features=TranslateUI', // Critical: Prevents extension interference
            '--disable-ipc-flooding-protection', // Critical: Prevents IPC throttling
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor', // Improves extension compatibility
            '--disable-background-timer-throttling', // Ensures service worker timing
            '--disable-backgrounding-occluded-windows', // Prevents window management issues
            '--disable-renderer-backgrounding', // Keeps extension active
            '--enable-service-worker-servicification', // Force service worker registration
            '--enable-service-worker-web-bundle', // Enable service worker support
            '--allow-running-insecure-content', // Allow extension content
            '--disable-extensions-http-throttling', // Prevent extension throttling
          ],
        },
      },
    },
  ],
  globalSetup: './e2e-tests/setup.ts',
};

export default config;