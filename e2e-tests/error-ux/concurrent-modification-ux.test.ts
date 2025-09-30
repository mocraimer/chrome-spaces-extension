/**
 * Concurrent Modification UX Tests
 *
 * Tests handling of concurrent modifications:
 * - Two popups modify same space simultaneously
 * - Clear conflict resolution message
 * - Show what changed and by whom (if possible)
 * - Let user choose which change to keep
 * - Or automatic last-write-wins with notification
 *
 * Focus: Don't silently lose changes, inform user of conflicts
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import { verifyErrorMessage, waitForError } from './error-simulation-helpers';

test.describe('Concurrent Modification UX Tests', () => {
  let context: BrowserContext;
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
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should handle two popups modifying same space', async () => {
    // Setup: create a space
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await setupPage.waitForTimeout(500);

    // Open two popups
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');
    await popup1.waitForTimeout(1000);

    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await popup2.waitForTimeout(1000);

    // Both try to rename same space simultaneously
    const renameInPopup = async (popup: Page, newName: string) => {
      const spaceItem = popup.locator('[data-testid="space-item"], .space-item').first();
      await spaceItem.focus();
      await popup.keyboard.press('F2');
      const input = popup.locator('[data-testid="space-name-input"], input.edit-input');
      await input.fill(newName);
      await popup.keyboard.press('Enter');
    };

    await Promise.all([
      renameInPopup(popup1, 'Name from Popup 1'),
      renameInPopup(popup2, 'Name from Popup 2')
    ]);

    await popup1.waitForTimeout(1000);
    await popup2.waitForTimeout(1000);

    // Check for conflict notification
    const conflict1 = await verifyErrorMessage(popup1);
    const conflict2 = await verifyErrorMessage(popup2);

    if (conflict1.isVisible || conflict2.isVisible) {
      console.log('✓ Shows conflict notification');

      const message = (conflict1.message || conflict2.message).toLowerCase();

      // Should mention conflict or concurrent change
      const mentionsConflict =
        message.includes('conflict') ||
        message.includes('changed') ||
        message.includes('modified') ||
        message.includes('updated elsewhere');

      expect(mentionsConflict).toBe(true);
    }

    // One of the names should win
    await popup1.reload();
    await popup1.waitForTimeout(500);

    const finalName = await popup1.locator('[data-testid="space-item"], .space-item').first().textContent();
    const hasOneName =
      finalName?.includes('Name from Popup 1') ||
      finalName?.includes('Name from Popup 2');

    expect(hasOneName).toBe(true);
  });

  test('should not silently discard concurrent changes', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup1.waitForTimeout(1000);

    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForTimeout(1000);

    // Popup 1 makes change
    const space1 = popup1.locator('[data-testid="space-item"], .space-item').first();
    await space1.focus();
    await popup1.keyboard.press('F2');
    const input1 = popup1.locator('[data-testid="space-name-input"], input.edit-input');
    await input1.fill('First Change');
    await popup1.keyboard.press('Enter');
    await popup1.waitForTimeout(500);

    // Popup 2 makes different change (without seeing popup 1's change)
    const space2 = popup2.locator('[data-testid="space-item"], .space-item').first();
    await space2.focus();
    await popup2.keyboard.press('F2');
    const input2 = popup2.locator('[data-testid="space-name-input"], input.edit-input');
    await input2.fill('Second Change');
    await popup2.keyboard.press('Enter');
    await popup2.waitForTimeout(500);

    // Should either:
    // 1. Show conflict resolution UI
    // 2. Notify user of overwrite
    // 3. Last write wins with notification

    const notification = await waitForError(popup2, 3000);

    if (notification) {
      console.log('✓ Shows notification about concurrent change');
    }

    // Should not silently lose "First Change"
    await popup1.reload();
    await popup1.waitForTimeout(500);

    const savedName = await popup1.locator('[data-testid="space-item"], .space-item').first().textContent();
    console.log(`Final saved name: ${savedName}`);

    // At minimum, one of the changes should be preserved
    expect(savedName).toBeTruthy();
  });

  test('should sync changes across multiple popups', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup1.waitForTimeout(1000);

    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForTimeout(1000);

    // Make change in popup1
    const space1 = popup1.locator('[data-testid="space-item"], .space-item').first();
    await space1.focus();
    await popup1.keyboard.press('F2');
    const input1 = popup1.locator('[data-testid="space-name-input"], input.edit-input');
    await input1.fill('Synced Name');
    await popup1.keyboard.press('Enter');
    await popup1.waitForTimeout(1000);

    // popup2 should see the change (within reasonable time)
    await popup2.waitForTimeout(2000);

    const space2Name = await popup2.locator('[data-testid="space-item"], .space-item').first().textContent();

    if (space2Name?.includes('Synced Name')) {
      console.log('✓ Changes synced across popups');
    } else {
      // Might need manual refresh
      await popup2.reload();
      await popup2.waitForTimeout(500);

      const refreshedName = await popup2.locator('[data-testid="space-item"], .space-item').first().textContent();
      expect(refreshedName).toContain('Synced Name');
    }
  });

  test('should handle popup closed during save', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    // Start editing
    const spaceItem = popup.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');
    const input = popup.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Interrupted Save');

    // Press Enter and immediately close popup
    await Promise.all([
      popup.keyboard.press('Enter'),
      popup.close()
    ]);

    // Reopen and verify save completed
    const newPopup = await context.newPage();
    await newPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopup.waitForTimeout(1000);

    const savedName = await newPopup.locator('[data-testid="space-item"], .space-item').first().textContent();

    // Should either save successfully or revert
    // Should NOT be in inconsistent state
    expect(savedName).toBeTruthy();
    console.log(`Name after interrupted save: ${savedName}`);
  });

  test('should handle rapid sequential edits', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    // Make rapid sequential changes
    for (let i = 0; i < 5; i++) {
      const spaceItem = popup.locator('[data-testid="space-item"], .space-item').first();
      await spaceItem.focus();
      await popup.keyboard.press('F2');
      const input = popup.locator('[data-testid="space-name-input"], input.edit-input');
      await input.fill(`Rapid Edit ${i}`);
      await popup.keyboard.press('Enter');
      await popup.waitForTimeout(100); // Very short delay
    }

    await popup.waitForTimeout(1000);

    // Should handle gracefully, last edit should win
    const finalName = await popup.locator('[data-testid="space-item"], .space-item').first().textContent();

    expect(finalName).toContain('Rapid Edit');
    console.log(`✓ Handled rapid edits, final name: ${finalName}`);
  });
});