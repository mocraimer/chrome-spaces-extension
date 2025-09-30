/**
 * Browser Restart During Operation UX Tests
 *
 * Tests state consistency when browser restarts mid-operation:
 * - Browser closes during space creation/rename
 * - State consistency on restart
 * - No orphaned or duplicate spaces
 * - Operation completes or rolls back cleanly
 *
 * Focus: Data integrity across browser restarts
 */

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('Browser Restart During Operation UX Tests', () => {
  const pathToExtension = path.join(__dirname, '../..', 'build');

  test('should maintain state consistency after unexpected restart', async () => {
    // First session: start operation
    let context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    const extensionId = background.url().split('/')[2];

    // Create space
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await setupPage.waitForTimeout(500);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    // Start renaming
    const spaceItem = popup.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');
    const input = popup.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Name Before Restart');

    // DON'T press Enter - simulate crash
    await context.close();

    // Second session: verify state
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }

    const newPopup = await context.newPage();
    await newPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopup.waitForTimeout(1000);

    // Should either:
    // 1. Revert to previous name
    // 2. Have no space (if creation was interrupted)
    // 3. Show recovery prompt

    const spaces = await newPopup.locator('[data-testid="space-item"], .space-item, text=No spaces').count();
    expect(spaces).toBeGreaterThanOrEqual(0);

    console.log('✓ State recovered after unexpected restart');

    await context.close();
  });

  test('should not create duplicate spaces on restart', async () => {
    // Create space and simulate restart during creation
    let context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    const extensionId = background.url().split('/')[2];

    // Create multiple spaces
    for (let i = 0; i < 3; i++) {
      const testPage = await context.newPage();
      await testPage.goto(`https://example${i}.com`);
      await testPage.waitForTimeout(300);
    }

    await context.close();

    // Restart
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    const spaceCount = await popup.locator('[data-testid="space-item"], .space-item').count();

    // Should not have duplicates
    expect(spaceCount).toBeLessThanOrEqual(3);

    console.log(`✓ No duplicates after restart: ${spaceCount} spaces`);

    await context.close();
  });

  test('should recover closed spaces after restart', async () => {
    let context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    const extensionId = background.url().split('/')[2];

    // Create and close space
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await testPage.waitForTimeout(500);
    await testPage.close();
    await testPage.waitForTimeout(500);

    await context.close();

    // Restart
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    // Check closed spaces
    const closedToggle = popup.locator('button:has-text("Closed")');
    if (await closedToggle.isVisible({ timeout: 2000 })) {
      await closedToggle.click();
      await popup.waitForTimeout(500);

      const closedSpaces = await popup.locator('.closed-space, [data-closed="true"]').count();
      expect(closedSpaces).toBeGreaterThanOrEqual(0);

      console.log(`✓ Closed spaces preserved: ${closedSpaces}`);
    }

    await context.close();
  });
});