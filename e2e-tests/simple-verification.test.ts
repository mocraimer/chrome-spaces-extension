import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from './helpers';

test.describe('Simple Extension Verification', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const pathToExtension = path.resolve(__dirname, '..', 'build');
    context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--enable-logging=stderr',
        '--vmodule=*/browser/extensions/*=1',
        '--enable-service-worker-script-debugging',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    // Use robust service worker detection
    extensionId = await waitForServiceWorker(context);
    console.log('✅ Extension ID obtained:', extensionId);
  });

  test.afterAll(async () => {
    if (context) {
      await context.close();
    }
  });

  test('Extension files are accessible', async () => {
    const page = await context.newPage();

    // Extension ID is already available from beforeAll
    console.log('Using extension ID:', extensionId);

    // Test popup page loads
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(2000);

    // Check if page loaded without major errors
    const title = await page.title();
    console.log('Popup page title:', title);

    // Check if HTML contains expected elements
    const bodyText = await page.evaluate(() => document.body.innerHTML);
    expect(bodyText.length).toBeGreaterThan(50); // Should have some content

    // Verify service workers are running
    const serviceWorkers = context.serviceWorkers();
    console.log(`Found ${serviceWorkers.length} service workers`);
    expect(serviceWorkers.length).toBeGreaterThan(0);

    // Also verify the build files exist as backup verification
    const fs = require('fs');
    const buildPath = path.join(__dirname, '..', 'build');
    expect(fs.existsSync(path.join(buildPath, 'manifest.json'))).toBe(true);
    expect(fs.existsSync(path.join(buildPath, 'popup.html'))).toBe(true);
    expect(fs.existsSync(path.join(buildPath, 'background.js'))).toBe(true);

    console.log('✅ Extension verification completed successfully');
  });
});