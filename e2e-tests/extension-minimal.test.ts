import { test, expect, chromium } from '@playwright/test';
import path from 'path';

test.describe('Minimal Extension Loading', () => {
  test('Load extension with minimal flags', async () => {
    const pathToExtension = path.resolve(__dirname, '..', 'build');
    console.log('🔧 Extension path:', pathToExtension);

    // Use absolute minimal flags based on Playwright docs
    const context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    console.log('🔧 Context created with minimal flags');

    // Wait longer for extension to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check service workers
    let serviceWorkers = context.serviceWorkers();
    console.log(`🔧 Service workers found: ${serviceWorkers.length}`);

    if (serviceWorkers.length === 0) {
      // Try opening a page to trigger extension loading
      const page = await context.newPage();
      await page.goto('https://example.com');
      console.log('📄 Opened example.com to trigger extension');

      // Wait and check again
      await new Promise(resolve => setTimeout(resolve, 3000));
      serviceWorkers = context.serviceWorkers();
      console.log(`🔧 Service workers after page load: ${serviceWorkers.length}`);
    }

    if (serviceWorkers.length === 0) {
      // Final attempt - wait for service worker event
      console.log('🔧 Waiting for service worker event...');
      try {
        const sw = await context.waitForEvent('serviceworker', { timeout: 60000 });
        console.log(`✅ Service worker event: ${sw.url()}`);
        serviceWorkers = [sw];
      } catch (e) {
        console.log(`❌ No service worker event: ${e.message}`);
      }
    }

    await context.close();

    if (serviceWorkers.length > 0) {
      const sw = serviceWorkers[0];
      console.log(`🎉 SUCCESS: Found service worker at ${sw.url()}`);

      // Extract extension ID
      const match = sw.url().match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        console.log(`🎉 Extension ID: ${match[1]}`);
        expect(match[1]).toBeTruthy();
      } else {
        throw new Error('Could not extract extension ID');
      }
    } else {
      console.log('❌ FAILURE: No service workers found with minimal flags');
      throw new Error('Extension failed to load with minimal configuration');
    }
  });
});