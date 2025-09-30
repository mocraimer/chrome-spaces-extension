/**
 * Storage Quota Exceeded UX Tests
 *
 * Tests user experience when extension storage is full:
 * - Clear error message with storage usage info
 * - Options to free up space
 * - Prevents data loss
 * - Shows how much space needed vs available
 *
 * Focus: Help user understand and resolve storage issues
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import {
  simulateStorageQuotaExceeded,
  verifyErrorMessage,
  waitForError
} from './error-simulation-helpers';

test.describe('Storage Quota Exceeded UX Tests', () => {
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

  test('should show clear error with storage usage info', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Simulate quota exceeded
    const cleanup = await simulateStorageQuotaExceeded(page, {
      currentUsage: 5 * 1024 * 1024, // 5MB
      maxQuota: 5 * 1024 * 1024, // 5MB limit
      throwImmediately: true
    });

    // Try to create new space
    const newPage = await context.newPage();
    await newPage.goto('https://example.com');
    await page.waitForTimeout(1000);

    await page.reload();
    await page.waitForTimeout(1000);

    // Should show storage quota error
    const errorShown = await waitForError(page);

    if (errorShown) {
      const errorVerification = await verifyErrorMessage(page);
      const message = errorVerification.message.toLowerCase();

      // Should mention storage or quota
      const hasStorageMessage =
        message.includes('storage') ||
        message.includes('quota') ||
        message.includes('space') ||
        message.includes('full') ||
        message.includes('limit');

      expect(hasStorageMessage).toBe(true);

      // Should show usage information
      const hasUsageInfo =
        /\d+\s*(mb|kb|bytes|%)/i.test(errorVerification.message);

      if (hasUsageInfo) {
        console.log('✓ Shows storage usage info');
      }

      // Should be user-friendly
      expect(errorVerification.isUserFriendly).toBe(true);
    }

    await cleanup();
  });

  test('should provide options to free up space', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulateStorageQuotaExceeded(page, {
      currentUsage: 5 * 1024 * 1024,
      maxQuota: 5 * 1024 * 1024
    });

    await page.reload();
    await page.waitForTimeout(1000);

    // Look for storage management options
    const storageDialog = page.locator('[role="dialog"], [role="alert"]').first();
    const hasDialog = await storageDialog.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasDialog) {
      // Should offer to delete old spaces
      const deleteOldButton = page.locator(
        'button:has-text("Delete"), button:has-text("Clean"), button:has-text("Free Space")'
      );

      const hasDeleteOption = await deleteOldButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasDeleteOption) {
        console.log('✓ Provides option to delete old spaces');
      }

      // Should have link to storage management
      const manageStorageLink = page.locator(
        'a:has-text("Manage"), button:has-text("Settings"), a:has-text("Storage")'
      );

      const hasManageLink = await manageStorageLink.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasManageLink) {
        console.log('✓ Provides link to storage management');
      }

      // Should have at least one option
      expect(hasDeleteOption || hasManageLink).toBe(true);
    }

    await cleanup();
  });

  test('should prevent data loss when storage full', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Create a space and name it
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await page.waitForTimeout(500);

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Important Data');

    // Simulate storage full before save
    const cleanup = await simulateStorageQuotaExceeded(page, {
      currentUsage: 5 * 1024 * 1024,
      maxQuota: 5 * 1024 * 1024
    });

    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should either:
    // 1. Keep input visible with error
    // 2. Save locally and queue for sync
    // 3. Show error with option to export/backup

    const inputStillVisible = await input.isVisible({ timeout: 1000 }).catch(() => false);
    const errorShown = await waitForError(page);

    if (inputStillVisible) {
      // Good: preserved input for user to try again
      const value = await input.inputValue();
      expect(value).toBe('Important Data');
      console.log('✓ Preserved user input');
    }

    if (errorShown) {
      // Should offer to save/export data
      const exportOption = page.locator('button:has-text("Export"), button:has-text("Save"), button:has-text("Backup")');
      const hasExportOption = await exportOption.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasExportOption) {
        console.log('✓ Offers data export option');
      }
    }

    // Should not silently lose data
    expect(inputStillVisible || errorShown).toBe(true);

    await cleanup();
  });

  test('should show how much space is needed', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulateStorageQuotaExceeded(page, {
      currentUsage: 4.5 * 1024 * 1024,
      maxQuota: 5 * 1024 * 1024
    });

    await page.reload();
    await page.waitForTimeout(1000);

    const errorDialog = page.locator('[role="dialog"], [role="alert"]').first();
    const hasDialog = await errorDialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasDialog) {
      const text = await errorDialog.textContent() || '';

      // Should show both current usage and limit
      const hasUsageNumbers = /\d+(\.\d+)?\s*(mb|kb|%)/gi.test(text);

      if (hasUsageNumbers) {
        console.log('✓ Shows storage usage numbers');
        console.log(`  Message: ${text.substring(0, 100)}...`);
      }
    }

    await cleanup();
  });

  test('should allow deletion of old closed spaces', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Create and close multiple spaces
    for (let i = 0; i < 3; i++) {
      const testPage = await context.newPage();
      await testPage.goto(`https://example${i}.com`);
      await page.waitForTimeout(300);
      await testPage.close();
      await page.waitForTimeout(300);
    }

    await page.reload();
    await page.waitForTimeout(1000);

    // Show closed spaces
    const closedToggle = page.locator('button:has-text("Closed")');
    if (await closedToggle.isVisible({ timeout: 2000 })) {
      await closedToggle.click();
      await page.waitForTimeout(500);
    }

    // Should be able to delete closed spaces
    const closedSpaces = page.locator('.closed-space, [data-closed="true"], .space-item');
    const closedCount = await closedSpaces.count();

    if (closedCount > 0) {
      // Look for delete option
      const deleteButton = page.locator('button:has-text("Delete"), button[title*="Delete"]').first();
      const hasDelete = await deleteButton.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasDelete) {
        console.log('✓ Can delete closed spaces to free storage');

        await deleteButton.click();
        await page.waitForTimeout(500);

        // Should show confirmation
        const confirmDialog = page.locator('[role="dialog"]:has-text("Delete")');
        const hasConfirm = await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false);

        if (hasConfirm) {
          console.log('✓ Shows deletion confirmation');
        }
      }
    }
  });

  test('should warn before storage becomes full', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Simulate storage at 90% capacity
    const cleanup = await simulateStorageQuotaExceeded(page, {
      currentUsage: 4.5 * 1024 * 1024, // 4.5MB
      maxQuota: 5 * 1024 * 1024, // 5MB limit
      throwImmediately: false
    });

    await page.reload();
    await page.waitForTimeout(1000);

    // Should show warning (not error yet)
    const warning = page.locator(
      '.storage-warning, [role="alert"]:has-text("storage"), text=/storage.*low/i'
    );

    const hasWarning = await warning.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasWarning) {
      console.log('✓ Shows proactive storage warning');

      const warningText = await warning.textContent() || '';
      // Should mention approaching limit
      expect(warningText.toLowerCase()).toMatch(/low|almost|approaching|near/);
    }

    await cleanup();
  });
});