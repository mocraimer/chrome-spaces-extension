import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';

test.describe('Space Persistence and Auto-Restore', () => {
  let browserContext: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.resolve(__dirname, '..', 'build');

  test.beforeAll(async () => {
    // Launch a new browser context with the extension loaded
    browserContext = await chromium.launchPersistentContext('', {
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

    let [background] = browserContext.serviceWorkers();
    if (!background) {
      background = await browserContext.waitForEvent('serviceworker');
    }
    extensionId = background.url().split('/')[2];
  });

  test.afterAll(async () => {
    if (browserContext) {
      await browserContext.close();
    }
  });

  test('should save spaces when Chrome is closed and restore them on restart', async () => {
    // Phase 1: Create a space and give it a name
    let page = await browserContext.newPage();
    await page.goto('https://www.google.com');
    await page.goto('https://www.github.com');

    // Open the popup and name the space
    const popupPage = await browserContext.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for a space to appear, then double-click to edit its name
    const spaceItem = popupPage.locator('[data-testid="space-item"]').first();
    await spaceItem.waitFor({ state: 'visible', timeout: 10000 });

    const spaceNameDisplay = spaceItem.locator('.space-name');
    await spaceNameDisplay.dblclick();

    const nameInput = spaceItem.locator('[data-testid="space-name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('My Test Space');
    await nameInput.press('Enter');

    // Wait for the name to be updated and displayed
    await expect(popupPage.locator('text="My Test Space"')).toBeVisible();
    await popupPage.close();

    // Phase 2: Close the browser and reopen it
    await browserContext.close();
    browserContext = await chromium.launchPersistentContext('', {
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
    
    // Re-establish the extensionId
    let [background] = browserContext.serviceWorkers();
    if (!background) {
      background = await browserContext.waitForEvent('serviceworker');
    }
    extensionId = background.url().split('/')[2];

    // Phase 3: Verify the space was restored
    // Give the browser a moment to restore the space
    await new Promise(resolve => setTimeout(resolve, 2000));

    const pages = browserContext.pages();
    const urls = pages.map(p => p.url());

    // Check that the restored window has the correct tabs
    expect(urls).toContain('https://www.google.com/');
    expect(urls).toContain('https://www.github.com/');

    // Open the popup and verify the space name is correct
    const newPopupPage = await browserContext.newPage();
    await newPopupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(newPopupPage.locator('text="My Test Space"')).toBeVisible();
  });
}); 