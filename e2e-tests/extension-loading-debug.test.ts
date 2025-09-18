import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('Extension Loading Debug', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    const pathToExtension = path.resolve(__dirname, '..', 'build');
    console.log('🔧 Extension path:', pathToExtension);

    context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--enable-logging=stderr',
        '--vmodule=*/browser/extensions/*=1',
        '--enable-service-worker-script-debugging',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--enable-service-worker-servicification',
        '--enable-service-worker-web-bundle',
        '--allow-running-insecure-content',
        '--disable-extensions-http-throttling',
      ],
    });

    console.log('🔧 Browser context created');
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Debug extension loading step by step', async () => {
    console.log('🔍 Starting extension debug test...');

    // Wait a moment for extension to load
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check service workers
    const serviceWorkers = context.serviceWorkers();
    console.log(`🔧 Service workers found: ${serviceWorkers.length}`);

    if (serviceWorkers.length > 0) {
      serviceWorkers.forEach((sw, index) => {
        console.log(`  SW ${index}: ${sw.url()}`);
      });
    }

    // Try to open a test page first
    const page = await context.newPage();
    await page.goto('https://example.com');
    console.log('📄 Test page loaded');

    // Wait again and recheck service workers
    await new Promise(resolve => setTimeout(resolve, 2000));
    const serviceWorkersAfter = context.serviceWorkers();
    console.log(`🔧 Service workers after page load: ${serviceWorkersAfter.length}`);

    // Try different extension ID extraction strategies
    let extensionId = null;

    // Strategy 1: From service worker URL
    if (serviceWorkersAfter.length > 0) {
      const swUrl = serviceWorkersAfter[0].url();
      console.log(`🔧 Service worker URL: ${swUrl}`);
      const match = swUrl.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        extensionId = match[1];
        console.log(`✅ Extension ID from service worker: ${extensionId}`);
      }
    }

    // Strategy 2: Try to navigate directly to extension pages
    if (!extensionId) {
      console.log('🔧 Trying Chrome Extension API approach...');

      // Create a content script to get extension info
      const extensionInfo = await page.evaluate(() => {
        return new Promise((resolve) => {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            resolve({
              id: chrome.runtime.id,
              available: true
            });
          } else {
            resolve({ available: false });
          }
        });
      });

      console.log('🔧 Extension info from page:', extensionInfo);
    }

    // Strategy 3: Check all pages in context
    const pages = context.pages();
    console.log(`📄 Pages in context: ${pages.length}`);
    pages.forEach((p, index) => {
      console.log(`  Page ${index}: ${p.url()}`);
    });

    // Try extension URLs with common patterns
    const possibleIds = ['abcdefghijklmnop', 'bcdefghijklmnop', 'cdefghijklmnop'];

    for (const testId of possibleIds) {
      try {
        await page.goto(`chrome-extension://${testId}/popup.html`, { timeout: 2000 });
        if (page.url().includes(testId)) {
          extensionId = testId;
          console.log(`✅ Found working extension ID: ${testId}`);
          break;
        }
      } catch (e) {
        // Expected to fail for wrong IDs
      }
    }

    // Final attempt: Wait for service worker event
    if (!extensionId) {
      console.log('🔧 Waiting for service worker event...');
      try {
        const sw = await context.waitForEvent('serviceworker', { timeout: 10000 });
        const swUrl = sw.url();
        console.log(`🎯 Service worker event received: ${swUrl}`);
        const match = swUrl.match(/chrome-extension:\/\/([a-z]+)/);
        if (match) {
          extensionId = match[1];
          console.log(`✅ Extension ID from event: ${extensionId}`);
        }
      } catch (eventError) {
        console.log(`❌ Service worker event failed: ${eventError.message}`);
      }
    }

    if (extensionId) {
      console.log(`🎉 SUCCESS: Extension ID found: ${extensionId}`);

      // Test popup access
      try {
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForTimeout(1000);
        const title = await page.title();
        console.log(`🎉 Popup accessible, title: ${title}`);
      } catch (popupError) {
        console.log(`❌ Popup access failed: ${popupError.message}`);
      }
    } else {
      console.log('❌ FAILED: No extension ID found');
      throw new Error('Extension not loaded - no extension ID found');
    }
  });
});