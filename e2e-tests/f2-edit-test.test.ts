import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';

test.describe('F2 Edit Test', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    extensionId = background.url().split('/')[2];
  });

  test.afterAll(async () => {
    await context.close();
  });

  const openExtensionPopup = async (): Promise<Page> => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  };

  test('should allow renaming space with F2 key', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    const popup = await openExtensionPopup();
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    await spaceItem.waitFor({ state: 'visible', timeout: 10000 });

    // Select the space item and press F2
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = spaceItem.locator('[data-testid="space-name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    
    await nameInput.fill('Renamed with F2');
    await nameInput.press('Enter');

    await expect(popup.locator('text=Renamed with F2')).toBeVisible();
  });
}); 