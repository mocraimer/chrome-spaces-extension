import { test, expect, chromium, BrowserContext, Browser } from '@playwright/test';
import path from 'path';

test.describe('Alternative Extension Loading', () => {
  let browser: Browser;
  let context: BrowserContext;

  test.beforeAll(async () => {
    const pathToExtension = path.resolve(__dirname, '..', 'build');
    console.log('🔧 Extension path:', pathToExtension);

    // Try standard browser launch instead of persistent context
    browser = await chromium.launch({
      headless: true, // Try with headless false first
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

    context = await browser.newContext();
    console.log('🔧 Browser and context created');
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
  });

  test('Test extension loading with standard browser launch', async () => {
    console.log('🔍 Starting alternative extension test...');

    // Wait a moment for extension to load
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check service workers
    const serviceWorkers = context.serviceWorkers();
    console.log(`🔧 Service workers found: ${serviceWorkers.length}`);

    if (serviceWorkers.length > 0) {
      serviceWorkers.forEach((sw, index) => {
        console.log(`  SW ${index}: ${sw.url()}`);
      });

      const sw = serviceWorkers[0];
      const swUrl = sw.url();
      const match = swUrl.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        const extensionId = match[1];
        console.log(`✅ Extension ID found: ${extensionId}`);

        // Test popup access
        const page = await context.newPage();
        await page.goto(`chrome-extension://${extensionId}/popup.html`);
        await page.waitForTimeout(2000);

        const title = await page.title();
        console.log(`🎉 Popup accessible, title: ${title}`);

        expect(extensionId).toBeTruthy();
        expect(title).toBeTruthy();
      }
    } else {
      console.log('❌ No service workers found with standard launch');
      throw new Error('Extension not loaded with standard browser launch');
    }
  });
});