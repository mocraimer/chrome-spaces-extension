import { PlaywrightTestConfig, devices } from '@playwright/test';
import path from 'path';

/**
 * Playwright Configuration for Visual UI Stability Testing
 *
 * This configuration is optimized specifically for visual regression testing
 * of the Chrome Spaces extension popup UI. It includes:
 *
 * - Consistent viewport settings for screenshot comparisons
 * - Disabled animations for stable visual testing
 * - Optimized retry and timeout settings
 * - Proper screenshot comparison thresholds
 * - Extension loading configuration
 */

const config: PlaywrightTestConfig = {
  testDir: './e2e-tests',

  // Include only visual test files
  testMatch: ['**/visual-*.spec.ts', '**/visual-*.test.ts'],

  // Visual testing specific timeouts
  timeout: 90000, // 90 seconds for visual tests (longer due to screenshot processing)

  // Test execution settings
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 3 : 1, // More retries for visual tests due to potential flakiness
  workers: 1, // Sequential execution to avoid resource conflicts

  // Reporter configuration for visual tests
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report-visual' }],
    // Custom reporter could be added here for visual test specific reporting
  ],

  // Global configuration for all visual tests
  use: {
    // Consistent viewport for all visual tests
    viewport: { width: 1280, height: 720 },

    // Screenshot settings
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',

    // Visual testing specific settings
    actionTimeout: 30000, // Longer timeout for visual assertions

    // Disable animations for consistent screenshots
    reducedMotion: 'reduce',

    // Force dark/light mode for consistent visual testing
    colorScheme: 'light',

    // Consistent font rendering
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto',

    // Disable auto-waiting for network requests in visual tests
    waitForLoadState: 'domcontentloaded',

    // Headless mode for CI
    headless: !!process.env.CI,
  },

  // Visual testing specific expect configuration
  expect: {
    // Screenshot comparison settings
    toHaveScreenshot: {
      // Pixel difference threshold (0-1, where 0.2 = 20% difference allowed)
      threshold: 0.2,

      // Maximum allowed different pixels
      maxDiffPixels: 1000,

      // Animation handling
      animations: 'disabled',

      // Ensure consistent rendering
      clip: undefined,

      // Scale factor for high-DPI displays
      scale: 'device'
    },

    // Visual assertions timeout
    timeout: 30000
  },

  projects: [
    {
      name: 'chromium-visual',
      use: {
        ...devices['Desktop Chrome'],

        // Chrome launch options optimized for extension visual testing
        launchOptions: {
          headless: !!process.env.CI,

          // Extension loading arguments
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'build')}`,
            `--load-extension=${path.resolve(__dirname, 'build')}`,

            // Visual testing optimization arguments
            '--no-sandbox',
            '--disable-web-security',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',

            // Visual rendering consistency
            '--force-device-scale-factor=1',
            '--disable-gpu-sandbox',
            '--use-gl=swiftshader',
            '--disable-software-rasterizer',

            // Font rendering consistency
            '--font-render-hinting=none',
            '--disable-font-subpixel-positioning',

            // Animation and transition control
            '--disable-background-media-playback',
            '--disable-component-update',

            // Extension debugging (for troubleshooting)
            '--enable-logging=stderr',
            '--vmodule=*/browser/extensions/*=1',
            '--enable-service-worker-script-debugging',

            // Memory and performance optimization
            '--memory-pressure-off',
            '--disable-background-networking',
            '--disable-client-side-phishing-detection',
            '--disable-default-apps',
            '--disable-hang-monitor',
            '--disable-prompt-on-repost',
            '--disable-sync',

            // Visual testing specific flags
            '--run-all-compositor-stages-before-draw',
            '--disable-threaded-animation',
            '--disable-threaded-scrolling',
          ],

          // Consistent window size
          defaultViewport: { width: 1280, height: 720 },

          // Device scale factor for consistent rendering
          deviceScaleFactor: 1,
        },

        // Additional Chrome context options
        ignoreHTTPSErrors: true,
        acceptDownloads: false,

        // Geolocation disabled for consistency
        geolocation: undefined,
        permissions: [],

        // Timezone consistency
        timezoneId: 'UTC',

        // Locale consistency
        locale: 'en-US',

        // Extra HTTP headers for consistency
        extraHTTPHeaders: {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      },
    },

    // Optional: Firefox visual testing (commented out for now)
    // {
    //   name: 'firefox-visual',
    //   use: {
    //     ...devices['Desktop Firefox'],
    //     // Firefox doesn't support Chrome extensions
    //   },
    // },

    // Optional: WebKit visual testing (commented out for now)
    // {
    //   name: 'webkit-visual',
    //   use: {
    //     ...devices['Desktop Safari'],
    //     // WebKit doesn't support Chrome extensions
    //   },
    // },
  ],

  // Global setup for visual testing environment
  globalSetup: './e2e-tests/visual-setup.ts',

  // Global teardown for cleanup
  globalTeardown: './e2e-tests/visual-teardown.ts',

  // Output directories
  outputDir: './test-results-visual',

  // Test metadata
  metadata: {
    'test-type': 'visual-regression',
    'extension': 'chrome-spaces',
    'viewport': '1280x720',
    'browser': 'chromium'
  }
};

export default config;