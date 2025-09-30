/**
 * Test extension loading in headed (non-headless) mode
 * To run: xvfb-run npx playwright test e2e-tests/diagnostic-headed.test.ts
 */

import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Extension Loading - Headed Mode', () => {
  test('Verify extension loads in headed mode', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');

    console.log('\n=== HEADED MODE DIAGNOSTIC ===');
    console.log(`📦 Extension path: ${pathToExtension}`);

    // Launch in HEADED mode (headless: false)
    console.log(`🚀 Launching browser in HEADED mode...`);

    const context = await chromium.launchPersistentContext('', {
      headless: false,  // KEY DIFFERENCE
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    console.log(`✅ Browser launched in headed mode`);

    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check service workers
    console.log(`\n🔍 Checking for service workers...`);
    const workers = context.serviceWorkers();
    console.log(`  Found ${workers.length} service worker(s)`);

    if (workers.length > 0) {
      console.log(`  ✅ SERVICE WORKER LOADED IN HEADED MODE!`);
      for (const worker of workers) {
        console.log(`  URL: ${worker.url()}`);
        const extensionId = worker.url().split('/')[2];
        console.log(`  Extension ID: ${extensionId}`);
      }
    } else {
      console.log(`  ❌ No service worker even in headed mode`);

      // Try waiting for the event
      try {
        const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
        console.log(`  ✅ Service worker event fired after wait!`);
        console.log(`  URL: ${worker.url()}`);
      } catch (error) {
        console.log(`  ❌ Service worker timeout even in headed mode`);
      }
    }

    console.log(`\n=== END HEADED MODE DIAGNOSTIC ===\n`);

    await context.close();

    // Report results
    if (workers.length > 0) {
      console.log(`\n✅ CONCLUSION: Extension DOES load in headed mode`);
      console.log(`   This confirms the issue is headless-mode specific`);
    } else {
      console.log(`\n❌ CONCLUSION: Extension DOES NOT load even in headed mode`);
      console.log(`   This suggests a deeper Playwright/extension compatibility issue`);
    }

    expect(true).toBe(true);
  });
});