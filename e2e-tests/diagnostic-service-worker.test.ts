/**
 * Diagnostic test to investigate service worker loading issues
 * This test provides detailed logging about extension state and service worker registration
 */

import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Service Worker Diagnostics', () => {
  test('Comprehensive service worker diagnostic', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');

    console.log('\n=== DIAGNOSTIC TEST START ===');
    console.log(`📦 Extension path: ${pathToExtension}`);
    console.log(`🖥️  Platform: ${process.platform}`);
    console.log(`📍 Working directory: ${process.cwd()}`);

    // Verify build files exist
    const fs = require('fs');
    const manifestExists = fs.existsSync(path.join(pathToExtension, 'manifest.json'));
    const backgroundExists = fs.existsSync(path.join(pathToExtension, 'background.js'));
    const popupExists = fs.existsSync(path.join(pathToExtension, 'popup.html'));

    console.log(`\n📄 Build Files:`);
    console.log(`  manifest.json: ${manifestExists ? '✅' : '❌'}`);
    console.log(`  background.js: ${backgroundExists ? '✅' : '❌'}`);
    console.log(`  popup.html: ${popupExists ? '✅' : '❌'}`);

    // Launch browser with MINIMAL flags first
    console.log(`\n🚀 Launching browser context...`);

    const context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--enable-logging=stderr',
        '--v=1',
      ],
    });

    console.log(`✅ Browser context launched`);

    // Capture all console messages
    const consoleMessages: Array<{type: string, text: string}> = [];
    context.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
      console.log(`[Browser ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Check service workers immediately
    console.log(`\n🔍 Checking service workers immediately after launch...`);
    const immediateWorkers = context.serviceWorkers();
    console.log(`  Found ${immediateWorkers.length} service worker(s)`);

    if (immediateWorkers.length > 0) {
      for (const worker of immediateWorkers) {
        console.log(`  ✅ Service Worker URL: ${worker.url()}`);
        const extensionId = worker.url().split('/')[2];
        console.log(`  📋 Extension ID: ${extensionId}`);
      }
    }

    // Wait a bit for extension to initialize
    console.log(`\n⏳ Waiting 3 seconds for extension initialization...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check again after wait
    console.log(`\n🔍 Checking service workers after 3s wait...`);
    const delayedWorkers = context.serviceWorkers();
    console.log(`  Found ${delayedWorkers.length} service worker(s)`);

    // Try to wait for service worker event
    console.log(`\n⏳ Attempting to wait for 'serviceworker' event (10s timeout)...`);
    try {
      const worker = await context.waitForEvent('serviceworker', { timeout: 10000 });
      console.log(`  ✅ Service worker event fired!`);
      console.log(`  URL: ${worker.url()}`);
      const extensionId = worker.url().split('/')[2];
      console.log(`  Extension ID: ${extensionId}`);
    } catch (error) {
      console.log(`  ❌ Service worker event timeout: ${error.message}`);
    }

    // Try to access chrome://extensions to see what's loaded
    console.log(`\n🔍 Attempting to inspect chrome://extensions page...`);
    const page = await context.newPage();

    try {
      // Note: chrome:// URLs may not be accessible in headless
      await page.goto('chrome://extensions');
      console.log(`  ✅ Navigated to chrome://extensions`);

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Try to extract extension info
      const extensionInfo = await page.evaluate(() => {
        const items = document.querySelectorAll('extensions-item');
        const extensions = [];
        for (const item of Array.from(items)) {
          const name = item.shadowRoot?.querySelector('#name')?.textContent;
          const id = item.getAttribute('id');
          const enabled = item.hasAttribute('enabled');
          extensions.push({ name, id, enabled });
        }
        return extensions;
      });

      console.log(`  Found ${extensionInfo.length} extension(s):`);
      for (const ext of extensionInfo) {
        console.log(`    - ${ext.name} (${ext.id}) ${ext.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      }
    } catch (error) {
      console.log(`  ❌ Could not access chrome://extensions: ${error.message}`);
    }

    // Try loading popup directly
    console.log(`\n🔍 Attempting to load popup.html directly from file://...`);
    try {
      const popupPath = 'file://' + path.join(pathToExtension, 'popup.html');
      await page.goto(popupPath);
      console.log(`  ✅ Loaded popup from: ${popupPath}`);

      await page.waitForTimeout(1000);

      // Check if React root rendered
      const rootContent = await page.evaluate(() => {
        const root = document.getElementById('root');
        return root ? root.innerHTML.length : 0;
      });

      console.log(`  Root div content length: ${rootContent} characters`);
      if (rootContent > 0) {
        console.log(`  ✅ React appears to have rendered`);
      } else {
        console.log(`  ⚠️  Root div is empty - React may not have rendered`);
      }
    } catch (error) {
      console.log(`  ❌ Could not load popup: ${error.message}`);
    }

    // Try using CDP to inspect service worker registration
    console.log(`\n🔍 Using CDP to inspect service worker registration...`);
    try {
      const cdpSession = await context.newCDPSession(page);

      // Enable service worker domain
      await cdpSession.send('ServiceWorker.enable');
      console.log(`  ✅ ServiceWorker domain enabled`);

      // Get all registrations
      const { registrations } = await cdpSession.send('ServiceWorker.getRegistrations') as any;
      console.log(`  Found ${registrations?.length || 0} service worker registration(s)`);

      if (registrations && registrations.length > 0) {
        for (const reg of registrations) {
          console.log(`  Registration:`);
          console.log(`    ID: ${reg.registrationId}`);
          console.log(`    Scope: ${reg.scopeURL}`);
          console.log(`    Script: ${reg.scriptURL}`);
        }
      }

      await cdpSession.detach();
    } catch (error) {
      console.log(`  ❌ CDP inspection failed: ${error.message}`);
    }

    // Summary
    console.log(`\n📊 DIAGNOSTIC SUMMARY:`);
    console.log(`  Service workers found: ${context.serviceWorkers().length}`);
    console.log(`  Console messages captured: ${consoleMessages.length}`);
    console.log(`  Background-related messages: ${consoleMessages.filter(m => m.text.toLowerCase().includes('background')).length}`);

    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    if (errorMessages.length > 0) {
      console.log(`\n❌ Console Errors (${errorMessages.length}):`);
      for (const msg of errorMessages.slice(0, 10)) {
        console.log(`  - ${msg.text}`);
      }
    }

    console.log(`\n=== DIAGNOSTIC TEST END ===\n`);

    await context.close();

    // The test "passes" - we just want the diagnostic output
    expect(true).toBe(true);
  });

  test('Test with progressive Chrome flags', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');

    // Test with progressively more flags
    const flagSets = [
      {
        name: 'Minimal',
        flags: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
        ]
      },
      {
        name: 'With sandbox disabled',
        flags: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          '--no-sandbox',
        ]
      },
      {
        name: 'With service worker flags',
        flags: [
          `--disable-extensions-except=${pathToExtension}`,
          `--load-extension=${pathToExtension}`,
          '--no-sandbox',
          '--enable-service-worker-script-debugging',
          '--enable-service-worker-servicification',
        ]
      }
    ];

    for (const flagSet of flagSets) {
      console.log(`\n🧪 Testing with: ${flagSet.name}`);

      try {
        const context = await chromium.launchPersistentContext('', {
          headless: false,  // Must be false when using --headless=new
          args: flagSet.flags,
        });

        console.log(`  ✅ Browser launched`);

        // Wait briefly
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check service workers
        const workers = context.serviceWorkers();
        console.log(`  Service workers: ${workers.length}`);

        if (workers.length > 0) {
          console.log(`  ✅ SUCCESS with ${flagSet.name}!`);
        } else {
          console.log(`  ❌ No service worker with ${flagSet.name}`);
        }

        await context.close();
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
      }
    }

    expect(true).toBe(true);
  });
});