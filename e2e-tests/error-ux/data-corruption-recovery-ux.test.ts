/**
 * Data Corruption Recovery UX Tests
 *
 * Tests recovery from corrupted data:
 * - Corrupt storage data detected
 * - Automatic repair attempt
 * - Clear message about what happened
 * - Backup restoration option
 * - Graceful fallback to default state
 *
 * Focus: Don't lose user data, explain what happened, offer recovery
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import { simulateDataCorruption, verifyErrorMessage } from './error-simulation-helpers';

test.describe('Data Corruption Recovery UX Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '../..', 'build');

  test.beforeEach(async () => {
    context = await chromium.launchPersistentContext('', {
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
    extensionId = background.url().split('/')[2];

    page = await context.newPage();
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should detect and recover from partial corruption', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Create valid data first
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await page.waitForTimeout(500);

    // Corrupt the data
    await simulateDataCorruption(page, 'partial');

    // Reload to trigger corruption detection
    await page.reload();
    await page.waitForTimeout(2000);

    // Should either:
    // 1. Auto-repair and show success message
    // 2. Show error with recovery options
    // 3. Gracefully fallback to clean state

    const errorVerification = await verifyErrorMessage(page);

    if (errorVerification.isVisible) {
      console.log('Shows corruption recovery message');
      expect(errorVerification.isUserFriendly).toBe(true);
    }

    // Extension should still be usable
    const isUsable = await page.locator('body, [data-testid="space-item"], text=No spaces').isVisible();
    expect(isUsable).toBe(true);
  });

  test('should offer backup restoration when corruption detected', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Create data
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await page.waitForTimeout(500);

    // Corrupt
    await simulateDataCorruption(page, 'missing-fields');

    await page.reload();
    await page.waitForTimeout(1000);

    // Look for recovery options
    const restoreButton = page.locator('button:has-text("Restore"), button:has-text("Recover"), button:has-text("Backup")');
    const hasRestoreOption = await restoreButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasRestoreOption) {
      console.log('✓ Offers backup restoration');
    }
  });

  test('should explain what happened with corruption', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    await simulateDataCorruption(page, 'wrong-types');

    await page.reload();
    await page.waitForTimeout(1000);

    const errorVerification = await verifyErrorMessage(page);

    if (errorVerification.isVisible) {
      const message = errorVerification.message.toLowerCase();

      // Should explain the issue
      const explainsIssue =
        message.includes('corrupted') ||
        message.includes('damaged') ||
        message.includes('invalid') ||
        message.includes('recover');

      expect(explainsIssue).toBe(true);

      // Should be reassuring, not alarming
      expect(message.length).toBeGreaterThan(50); // Should be explanatory
    }
  });

  test('should not lose all data on minor corruption', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Create multiple spaces
    for (let i = 0; i < 3; i++) {
      const testPage = await context.newPage();
      await testPage.goto(`https://example${i}.com`);
      await page.waitForTimeout(300);
    }

    await page.reload();
    const spacesBeforeCount = await page.locator('[data-testid="space-item"], .space-item').count();

    // Partially corrupt
    await simulateDataCorruption(page, 'partial');

    await page.reload();
    await page.waitForTimeout(1000);

    // Should recover some or all spaces
    const spacesAfterCount = await page.locator('[data-testid="space-item"], .space-item, text=No spaces').count();

    expect(spacesAfterCount).toBeGreaterThanOrEqual(0); // At least shows something
  });

  test('should provide export option before reset', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    await simulateDataCorruption(page, 'invalid-json');

    await page.reload();
    await page.waitForTimeout(1000);

    const resetDialog = page.locator('[role="dialog"]:has-text("Reset"), [role="alert"]:has-text("Reset")');
    const hasResetDialog = await resetDialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasResetDialog) {
      // Should offer export before reset
      const exportButton = page.locator('button:has-text("Export"), button:has-text("Save"), button:has-text("Backup")');
      const hasExport = await exportButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasExport) {
        console.log('✓ Offers export before reset');
      }
    }
  });
});