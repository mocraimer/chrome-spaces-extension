import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Diagnostic test to understand E2E test failures related to persistence
 */
test.describe('Diagnostic: Persistence E2E Setup', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  test('should diagnose popup state and window tracking', async () => {
    // Step 1: Launch browser with extension
    console.log('[Diagnostic] Launching browser context...');
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Step 2: Wait for extension to load
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];
    console.log(`[Diagnostic] Extension loaded with ID: ${extensionId}`);

    // Step 3: Give extension time to initialize
    console.log('[Diagnostic] Waiting 3s for extension initialization...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 4: Check how many windows extension sees
    const initialPopup = await context.newPage();
    await initialPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await initialPopup.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const initialWindowCount = await initialPopup.evaluate(async () => {
      try {
        const windows = await chrome.windows.getAll();
        return windows.length;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    });
    console.log(`[Diagnostic] Initial windows tracked by extension: ${initialWindowCount}`);

    // Step 5: Check popup DOM
    const popupHtml = await initialPopup.content();
    console.log(`[Diagnostic] Popup HTML length: ${popupHtml.length} characters`);

    // Check for various selectors
    const selectors = [
      '[data-testid^="space-item"]',
      '[data-testid="space-item"]',
      '.space-item',
      '[data-testid="spaces-list"]',
      '[data-testid="no-results"]',
      '[data-testid="popup-container"]',
    ];

    for (const selector of selectors) {
      const count = await initialPopup.locator(selector).count();
      console.log(`[Diagnostic] Selector "${selector}": ${count} elements found`);
    }

    // Check Redux state
    const reduxState = await initialPopup.evaluate(() => {
      // @ts-ignore - accessing window.__REDUX_STATE__ if it exists
      return window.__REDUX_STATE__ || 'Redux state not available';
    });
    console.log(`[Diagnostic] Redux state:`, typeof reduxState === 'string' ? reduxState : JSON.stringify(reduxState, null, 2).slice(0, 500));

    await initialPopup.close();

    // Step 6: Create a page and see if extension tracks it
    console.log('[Diagnostic] Creating test page...');
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await testPage.waitForLoadState('networkidle');
    console.log('[Diagnostic] Test page loaded');

    // Wait for extension to detect the new window
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 7: Open popup again and check if new window is tracked
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const windowCountAfterPage = await popup2.evaluate(async () => {
      try {
        const windows = await chrome.windows.getAll();
        console.log('[Extension] Windows:', windows.map(w => ({ id: w.id, type: w.type, state: w.state })));
        return windows.length;
      } catch (err) {
        return `Error: ${err.message}`;
      }
    });
    console.log(`[Diagnostic] Windows tracked after creating page: ${windowCountAfterPage}`);

    // Check selectors again
    for (const selector of ['[data-testid^="space-item"]', '[data-testid="spaces-list"]', '[data-testid="no-results"]']) {
      const count = await popup2.locator(selector).count();
      console.log(`[Diagnostic] After page creation - Selector "${selector}": ${count} elements`);
    }

    // Check storage
    const storageData = await popup2.evaluate(async () => {
      try {
        const data = await chrome.storage.local.get(null);
        return {
          keys: Object.keys(data),
          hasSpaces: 'spaces' in data,
          spaceCount: data.spaces ? (Array.isArray(data.spaces) ? data.spaces.length : 'not array') : 0
        };
      } catch (err) {
        return { error: err.message };
      }
    });
    console.log(`[Diagnostic] Storage data:`, JSON.stringify(storageData, null, 2));

    await popup2.close();
    await context.close();

    // Test should always pass - this is just diagnostic
    expect(true).toBe(true);
  });
});