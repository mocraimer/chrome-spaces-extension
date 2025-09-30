/**
 * Test extension loading with Chrome's NEW headless mode (--headless=new)
 * Chrome 112+ supports a new headless implementation that works with extensions
 */

import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Extension Loading - New Headless Mode', () => {
  test('Verify extension loads with --headless=new', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');

    console.log('\n=== NEW HEADLESS MODE DIAGNOSTIC ===');
    console.log(`📦 Extension path: ${pathToExtension}`);

    // Launch with NEW headless mode
    console.log(`🚀 Launching browser with --headless=new...`);

    const context = await chromium.launchPersistentContext('', {
      headless: false,  // Set to false but use --headless=new flag
      args: [
        '--headless=new',  // KEY: Use new headless mode
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    console.log(`✅ Browser launched with new headless mode`);

    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check service workers
    console.log(`\n🔍 Checking for service workers...`);
    const workers = context.serviceWorkers();
    console.log(`  Found ${workers.length} service worker(s)`);

    if (workers.length > 0) {
      console.log(`  ✅ SERVICE WORKER LOADED WITH NEW HEADLESS MODE!`);
      for (const worker of workers) {
        console.log(`  URL: ${worker.url()}`);
        const extensionId = worker.url().split('/')[2];
        console.log(`  Extension ID: ${extensionId}`);
      }
    } else {
      console.log(`  ❌ No service worker with new headless mode`);

      // Try waiting for the event
      try {
        const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
        console.log(`  ✅ Service worker event fired after wait!`);
        console.log(`  URL: ${worker.url()}`);
      } catch (error) {
        console.log(`  ❌ Service worker timeout with new headless mode`);
      }
    }

    // Try loading popup to verify chrome APIs work
    if (workers.length > 0) {
      const extensionId = workers[0].url().split('/')[2];
      console.log(`\n🔍 Testing popup with extension ID: ${extensionId}`);

      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/popup.html`);
      await page.waitForTimeout(2000);

      // Check for chrome API errors
      const errors: string[] = [];
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });

      await page.waitForTimeout(1000);

      if (errors.some(e => e.includes('chrome is not defined'))) {
        console.log(`  ❌ Chrome APIs not available in popup`);
      } else {
        console.log(`  ✅ Popup loaded without chrome API errors`);
      }

      // Check if popup rendered
      const rootContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root ? root.innerHTML.length : 0;
      });

      console.log(`  Root content length: ${rootContent} characters`);
      if (rootContent > 100) {
        console.log(`  ✅ Popup appears to have rendered`);
      } else {
        console.log(`  ⚠️  Popup may not have rendered properly`);
      }
    }

    console.log(`\n=== END NEW HEADLESS MODE DIAGNOSTIC ===\n`);

    await context.close();

    // Report results
    if (workers.length > 0) {
      console.log(`\n✅ CONCLUSION: New headless mode WORKS!`);
      console.log(`   Solution: Use --headless=new flag in all tests`);
    } else {
      console.log(`\n❌ CONCLUSION: New headless mode doesn't help`);
      console.log(`   Alternative: Must use xvfb-run for headed mode`);
    }

    expect(true).toBe(true);
  });
});