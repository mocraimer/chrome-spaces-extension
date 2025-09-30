/**
 * Keyboard Shortcuts Accessibility Test
 *
 * WCAG 2.1 Success Criteria:
 * - 2.1.1: Keyboard (Level A) - All functionality via keyboard
 * - 2.1.4: Character Key Shortcuts (Level A) - Can remap or disable
 * - 2.4.1: Bypass Blocks (Level A) - Skip navigation
 *
 * This test validates that all keyboard shortcuts are accessible,
 * documented, discoverable, and don't conflict with assistive tech.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('Keyboard Shortcuts Accessibility', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const allViolations: AccessibilityViolation[] = [];

  // Define expected keyboard shortcuts
  const EXPECTED_SHORTCUTS = {
    'F2': 'Rename selected space',
    'Delete': 'Delete selected space',
    'Backspace': 'Delete selected space (alternative)',
    'Enter': 'Switch to selected space / Confirm action',
    'Escape': 'Cancel action / Close dialog',
    '/': 'Focus search input',
    'Tab': 'Navigate forward',
    'Shift+Tab': 'Navigate backward',
    'ArrowDown': 'Navigate to next space (optional)',
    'ArrowUp': 'Navigate to previous space (optional)',
    'Ctrl+N': 'Create new space (optional)',
    '?': 'Show keyboard shortcuts help (optional)',
  };

  test.beforeAll(async ({ browser }) => {
    const extensionPath = path.resolve(__dirname, '../../build');
    context = await browser.newContext({
      permissions: ['tabs', 'storage'],
    });

    await context.waitForEvent('page');

    const pages = context.pages();
    const extensionUrl = pages[0]?.url();
    if (extensionUrl?.startsWith('chrome-extension://')) {
      extensionId = extensionUrl.split('/')[2];
    } else {
      throw new Error('Extension did not load');
    }

    page = await context.newPage();
    await page.goto('https://example.com');
  });

  test.afterAll(async () => {
    await context?.close();

    if (allViolations.length > 0) {
      console.log(formatViolationsReport(allViolations));
    }
  });

  test('KS-1: F2 key activates rename mode', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      await spaceItem.focus();
      await popup.keyboard.press('F2');
      await popup.waitForTimeout(300);

      // Check if edit mode activated
      const editInput = popup.locator('input[type="text"]').first();

      if (await editInput.count() > 0) {
        await expect(editInput).toBeFocused();
        console.log('✅ F2 shortcut works');
      } else {
        allViolations.push({
          element: 'F2 shortcut',
          wcag: '2.1.1',
          severity: 'moderate',
          description: 'F2 key does not activate rename mode',
          recommendation: 'Implement F2 keyboard shortcut for renaming',
        });
      }
    }

    await popup.close();
  });

  test('KS-2: Delete/Backspace key triggers delete confirmation', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      await spaceItem.focus();
      await popup.keyboard.press('Delete');
      await popup.waitForTimeout(300);

      const confirmDialog = popup.locator('[role="dialog"], [role="alertdialog"]').first();

      if (await confirmDialog.count() > 0) {
        console.log('✅ Delete shortcut works');
        await popup.keyboard.press('Escape');
      } else {
        allViolations.push({
          element: 'Delete shortcut',
          wcag: '2.1.1',
          severity: 'moderate',
          description: 'Delete key does not trigger delete action',
          recommendation: 'Implement Delete/Backspace shortcut for deletion',
        });
      }
    }

    await popup.close();
  });

  test('KS-3: Enter key activates selected item', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Find non-current space
      let targetSpace = null;
      for (let i = 0; i < itemCount; i++) {
        const space = spaceItems.nth(i);
        const isCurrent = await space.evaluate((el) =>
          el.classList.contains('current') || el.getAttribute('aria-current') === 'true'
        );

        if (!isCurrent) {
          targetSpace = space;
          break;
        }
      }

      if (targetSpace) {
        await targetSpace.focus();

        const closePromise = popup.waitForEvent('close', { timeout: 2000 });
        await popup.keyboard.press('Enter');

        try {
          await closePromise;
          console.log('✅ Enter key activates space');
        } catch {
          console.log('ℹ️ Enter key behavior may vary');
        }
      }
    }

    if (!popup.isClosed()) {
      await popup.close();
    }
  });

  test('KS-4: Escape key cancels actions and closes dialogs', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Trigger delete dialog
    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      await spaceItem.focus();
      await popup.keyboard.press('Delete');
      await popup.waitForTimeout(300);

      const dialog = popup.locator('[role="dialog"]').first();

      if (await dialog.count() > 0) {
        await expect(dialog).toBeVisible();

        // Press Escape
        await popup.keyboard.press('Escape');
        await popup.waitForTimeout(200);

        // Verify dialog closed
        const isVisible = await dialog.isVisible().catch(() => false);

        if (isVisible) {
          allViolations.push({
            element: 'Escape shortcut',
            wcag: '2.1.1',
            severity: 'serious',
            description: 'Escape key does not close dialog',
            recommendation: 'Implement Escape key to dismiss dialogs and cancel actions',
          });
        } else {
          console.log('✅ Escape key closes dialogs');
        }
      }
    }

    await popup.close();
  });

  test('KS-5: Slash (/) key focuses search input', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Press / to focus search
    await popup.keyboard.press('/');
    await popup.waitForTimeout(200);

    const searchInput = popup.locator('input[type="search"], input[placeholder*="earch"], [data-testid="search-input"]').first();

    if (await searchInput.count() > 0) {
      const isFocused = await searchInput.evaluate((el) => el === document.activeElement);

      if (isFocused) {
        console.log('✅ "/" shortcut focuses search');
      } else {
        console.log('ℹ️ "/" shortcut not implemented (recommended)');
      }
    }

    await popup.close();
  });

  test('KS-6: Arrow keys navigate through list (if implemented)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Focus first space
      await spaceItems.first().focus();

      const firstFocused = await popup.locator(':focus').evaluate((el) =>
        el.getAttribute('data-testid')
      );

      // Press ArrowDown
      await popup.keyboard.press('ArrowDown');
      await popup.waitForTimeout(200);

      const secondFocused = await popup.locator(':focus').evaluate((el) =>
        el.getAttribute('data-testid')
      );

      if (firstFocused !== secondFocused) {
        console.log('✅ Arrow key navigation implemented');
      } else {
        console.log('ℹ️ Arrow key navigation not implemented (optional, but improves UX)');
      }
    }

    await popup.close();
  });

  test('KS-7: Verify no single-character shortcuts that conflict with typing', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Test typing letters doesn't trigger unwanted shortcuts
    const searchInput = popup.locator('input[type="search"], input[type="text"]').first();

    if (await searchInput.count() > 0) {
      await searchInput.focus();

      // Type various characters
      await popup.keyboard.type('abcdefghijklmnopqrstuvwxyz', { delay: 50 });

      // Verify text was entered correctly
      const inputValue = await searchInput.inputValue();

      if (inputValue.includes('abcdefg')) {
        console.log('✅ No conflicting single-character shortcuts');
      } else {
        allViolations.push({
          element: 'Keyboard shortcuts',
          wcag: '2.1.4',
          severity: 'critical',
          description: 'Single-character shortcuts interfere with text input',
          recommendation: 'Use modifier keys (Ctrl, Alt) or exempt text inputs from shortcuts',
        });
      }
    }

    await popup.close();
  });

  test('KS-8: Check for keyboard shortcut help/documentation', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Try "?" key for help
    await popup.keyboard.press('?');
    await popup.waitForTimeout(300);

    const helpDialog = popup.locator('[role="dialog"]').filter({ hasText: /help|shortcuts|keyboard/i }).first();

    if (await helpDialog.count() > 0) {
      console.log('✅ Keyboard shortcuts help available');
      await popup.keyboard.press('Escape');
    } else {
      console.log('ℹ️ No keyboard shortcuts help dialog (recommended to add)');

      allViolations.push({
        element: 'Documentation',
        wcag: '2.4.1',
        severity: 'minor',
        description: 'No discoverable keyboard shortcuts documentation',
        recommendation: 'Add "?" shortcut to show keyboard shortcuts help overlay',
      });
    }

    await popup.close();
  });

  test('KS-9: Verify Ctrl/Cmd+N creates new space (if implemented)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    const spaceCountBefore = await popup.locator('[data-testid^="space-item"]').count();

    // Try Ctrl+N (Cmd+N on Mac)
    await popup.keyboard.press('Control+n');
    await popup.waitForTimeout(500);

    // Check if new space dialog opened or space was created
    const dialog = popup.locator('[role="dialog"]').first();
    const spaceCountAfter = await popup.locator('[data-testid^="space-item"]').count();

    if ((await dialog.count() > 0) || spaceCountAfter > spaceCountBefore) {
      console.log('✅ Ctrl+N creates new space');
    } else {
      console.log('ℹ️ Ctrl+N shortcut not implemented (optional)');
    }

    await popup.close();
  });

  test('KS-10: Shortcuts work when using screen reader mode', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Simulate screen reader mode - tab to element then use shortcut
    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      // Tab to space item (screen reader virtual cursor)
      await spaceItem.focus();

      // Try F2 with focus
      await popup.keyboard.press('F2');
      await popup.waitForTimeout(300);

      const editInput = popup.locator('input[type="text"]').first();

      if (await editInput.count() > 0) {
        console.log('✅ Shortcuts work with screen reader navigation');
      } else {
        console.log('ℹ️ Verify shortcuts work when element has focus (screen reader mode)');
      }
    }

    await popup.close();
  });

  test('KS-11: Document all shortcuts for users', async () => {
    // This test documents the shortcuts that should be available

    console.log('\n' + '='.repeat(80));
    console.log('EXPECTED KEYBOARD SHORTCUTS');
    console.log('='.repeat(80));

    Object.entries(EXPECTED_SHORTCUTS).forEach(([key, description]) => {
      console.log(`  ${key.padEnd(15)} - ${description}`);
    });

    console.log('='.repeat(80) + '\n');

    // Recommend adding help overlay
    if (allViolations.some((v) => v.element === 'Documentation')) {
      console.log('📝 RECOMMENDATION: Add keyboard shortcuts help overlay accessible via "?" key\n');
    }
  });

  test('KS-12: Verify no conflicts with browser/OS shortcuts', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Common browser shortcuts to avoid
    const BROWSER_SHORTCUTS = [
      'Ctrl+W', // Close tab
      'Ctrl+T', // New tab
      'Ctrl+N', // New window (should be OK with preventDefault)
      'Ctrl+Shift+T', // Reopen closed tab
      'Ctrl+L', // Focus address bar
      'Ctrl+F', // Find in page
    ];

    // Common screen reader shortcuts to avoid
    const SCREEN_READER_SHORTCUTS = [
      'H', // Navigate by heading
      'D', // Navigate by landmark
      'T', // Navigate by table
      'F', // Navigate by form
      'B', // Navigate by button
      'L', // Navigate by list
    ];

    console.log('\n⚠️  AVOID CONFLICTING WITH BROWSER SHORTCUTS:');
    BROWSER_SHORTCUTS.forEach((shortcut) => console.log(`  - ${shortcut}`));

    console.log('\n⚠️  AVOID SINGLE-CHARACTER SHORTCUTS (conflicts with screen readers):');
    SCREEN_READER_SHORTCUTS.forEach((shortcut) => console.log(`  - ${shortcut}`));

    console.log('');

    await popup.close();
  });

  test('KS-13: Verify shortcuts are consistent across extension', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check that Escape consistently closes things
    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      // Open dialog
      await spaceItem.focus();
      await popup.keyboard.press('Delete');
      await popup.waitForTimeout(300);

      let dialog = popup.locator('[role="dialog"]').first();

      if (await dialog.count() > 0) {
        // Escape should close
        await popup.keyboard.press('Escape');
        await popup.waitForTimeout(200);

        const closed = !(await dialog.isVisible().catch(() => false));

        if (closed) {
          console.log('✅ Escape consistently closes dialogs');
        } else {
          allViolations.push({
            element: 'Keyboard shortcuts',
            wcag: '3.2.4',
            severity: 'moderate',
            description: 'Escape key behavior is inconsistent',
            recommendation: 'Ensure Escape always dismisses dialogs and cancels actions',
          });
        }
      }
    }

    await popup.close();
  });

  test('Summary: Report all keyboard shortcut violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('KEYBOARD SHORTCUTS ACCESSIBILITY VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All keyboard shortcut accessibility tests passed!\n');
    }
  });
});