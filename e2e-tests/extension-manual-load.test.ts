import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('Manual Extension Loading', () => {
  let context: BrowserContext;

  test.beforeAll(async () => {
    const pathToExtension = path.resolve(__dirname, '..', 'build');
    console.log('🔧 Extension path:', pathToExtension);
    console.log('🔧 Current working directory:', process.cwd());

    // Use a temporary user data directory
    const tempUserDataDir = `/tmp/playwright-extension-test-${Date.now()}`;

    context = await chromium.launchPersistentContext(tempUserDataDir, {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-default-apps',
      ],
    });

    console.log('🔧 Browser context created with temp user data dir');
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Manual extension loading verification', async () => {
    console.log('🔍 Starting manual extension loading test...');

    // Give Chrome extra time to load the extension
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log('⏰ Waited 10 seconds for extension loading...');

    // Check service workers multiple times
    let serviceWorkers = context.serviceWorkers();
    console.log(`🔧 Initial service workers: ${serviceWorkers.length}`);

    // Create a page and navigate to trigger extension activity
    const page = await context.newPage();
    await page.goto('https://example.com', { waitUntil: 'networkidle' });
    console.log('📄 Navigated to example.com');

    // Wait and check again
    await new Promise(resolve => setTimeout(resolve, 5000));
    serviceWorkers = context.serviceWorkers();
    console.log(`🔧 Service workers after navigation: ${serviceWorkers.length}`);

    // Try to access Chrome extension APIs from the page context
    const extensionCheck = await page.evaluate(async () => {
      // This won't work from a regular page, but let's see what we get
      return {
        chromeAvailable: typeof chrome !== 'undefined',
        chromeRuntimeAvailable: typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined',
        location: window.location.href,
        userAgent: navigator.userAgent
      };
    });

    console.log('🔧 Extension API check from page:', extensionCheck);

    // Try navigation to chrome:// pages to see if extensions are enabled
    try {
      await page.goto('chrome://extensions/', { timeout: 5000 });
      console.log('🔧 Successfully accessed chrome://extensions/');
      const pageContent = await page.content();
      if (pageContent.includes('Chrome Spaces') || pageContent.includes('extension')) {
        console.log('✅ Extension management page shows extensions');
      }
    } catch (e) {
      console.log('❌ Could not access chrome://extensions/');
    }

    // Final attempt: Listen for service worker events
    console.log('🔧 Setting up service worker event listener...');

    const serviceWorkerPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout waiting for service worker')), 15000);

      context.on('serviceworker', (worker) => {
        clearTimeout(timeout);
        console.log(`✅ Service worker detected: ${worker.url()}`);
        resolve(worker);
      });
    });

    try {
      const worker = await serviceWorkerPromise;
      console.log('🎉 SUCCESS: Service worker event detected!');
    } catch (error) {
      console.log(`❌ Service worker event timeout: ${error.message}`);
    }

    // Check one more time after all attempts
    const finalServiceWorkers = context.serviceWorkers();
    console.log(`🔧 Final service worker count: ${finalServiceWorkers.length}`);

    if (finalServiceWorkers.length > 0) {
      finalServiceWorkers.forEach((sw, index) => {
        console.log(`  Final SW ${index}: ${sw.url()}`);
      });

      // Extract extension ID and test
      const sw = finalServiceWorkers[0];
      const swUrl = sw.url();
      const match = swUrl.match(/chrome-extension:\/\/([a-z]+)/);

      if (match) {
        const extensionId = match[1];
        console.log(`🎉 Extension ID: ${extensionId}`);

        // Test popup page
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForTimeout(2000);

        const title = await page.title();
        console.log(`🎉 Popup title: ${title}`);

        expect(extensionId).toBeTruthy();
        expect(title).toBeTruthy();
      } else {
        throw new Error('Could not extract extension ID from service worker URL');
      }
    } else {
      console.log('❌ FINAL FAILURE: No service workers found');

      // Get all pages to see what's available
      const allPages = context.pages();
      console.log(`📄 All pages (${allPages.length}):`);
      allPages.forEach((p, i) => {
        console.log(`  Page ${i}: ${p.url()}`);
      });

      throw new Error('Extension loading failed - no service workers detected');
    }
  });
});