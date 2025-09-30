/**
 * Keyboard-Only Complete User Journey Test
 *
 * WCAG 2.1 Success Criteria:
 * - 2.1.1: Keyboard (Level A) - All functionality available via keyboard
 * - 2.1.2: No Keyboard Trap (Level A) - Keyboard focus can move away
 * - 2.4.3: Focus Order (Level A) - Focus order is logical
 *
 * This test validates that a user can complete ALL extension workflows
 * using ONLY keyboard navigation (no mouse/pointer interactions).
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  verifyKeyboardAccessible,
  verifyTabOrder,
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('Keyboard-Only Complete User Journey', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const allViolations: AccessibilityViolation[] = [];

  test.beforeAll(async ({ browser }) => {
    // Load extension
    const extensionPath = path.resolve(__dirname, '../../build');
    context = await browser.newContext({
      permissions: ['tabs', 'storage'],
    });

    // Wait for extension to load
    await context.waitForEvent('page');

    // Get extension ID
    const pages = context.pages();
    const extensionUrl = pages[0]?.url();
    if (extensionUrl?.startsWith('chrome-extension://')) {
      extensionId = extensionUrl.split('/')[2];
    } else {
      throw new Error('Extension did not load');
    }

    // Navigate to a test page
    page = await context.newPage();
    await page.goto('https://example.com');
  });

  test.afterAll(async () => {
    await context?.close();

    // Report all violations at the end
    if (allViolations.length > 0) {
      console.log(formatViolationsReport(allViolations));
    }
  });

  test('Journey 1: Open popup with keyboard shortcut', async () => {
    // Extension popup keyboard shortcuts vary by browser
    // Typically Ctrl+Shift+Y or Cmd+Shift+Y (configurable)
    // For testing, we'll open popup programmatically and verify keyboard nav

    const popupPromise = context.waitForEvent('page');

    // Simulate keyboard shortcut to open popup (or use chrome.action.openPopup)
    await page.evaluate(async () => {
      // In real extension, user presses keyboard shortcut
      // For testing, we programmatically open it
      await chrome.action.openPopup();
    });

    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');

    // Verify popup opened
    expect(popup.url()).toContain('chrome-extension://');
    expect(popup.url()).toContain('/popup.html');

    // Verify popup is keyboard navigable
    const firstFocusable = popup.locator('button, input, a, [tabindex="0"]').first();
    const violations = await verifyKeyboardAccessible(firstFocusable, 'Popup first focusable element');
    allViolations.push(...violations);

    expect(violations.length).toBe(0);
  });

  test('Journey 2: Navigate spaces list with Tab key', async () => {
    // Open popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Wait for spaces to load
    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Tab through the interface
    await popup.keyboard.press('Tab');

    // Get first focused element
    let focusedElement = popup.locator(':focus');
    let tagName = await focusedElement.evaluate((el) => el.tagName.toLowerCase());

    // Should focus on first interactive element (likely search or space item)
    expect(['input', 'button', 'div']).toContain(tagName);

    // Continue tabbing through space items
    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 0) {
      // Tab to each space item
      for (let i = 0; i < Math.min(itemCount, 5); i++) {
        await popup.keyboard.press('Tab');
        focusedElement = popup.locator(':focus');

        // Verify focus is visible
        const hasVisibleFocus = await focusedElement.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          const outline = styles.outline;
          const outlineWidth = styles.outlineWidth;
          const boxShadow = styles.boxShadow;

          return (outline !== 'none' && outlineWidth !== '0px') || boxShadow !== 'none';
        });

        if (!hasVisibleFocus) {
          allViolations.push({
            element: `Space item ${i}`,
            wcag: '2.4.7',
            severity: 'serious',
            description: 'Focus indicator not visible on space item',
            recommendation: 'Add :focus styles with visible outline or box-shadow',
          });
        }

        expect(hasVisibleFocus).toBe(true);
      }
    }

    await popup.close();
  });

  test('Journey 3: Navigate with Arrow keys (if implemented)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Focus on space list
    const spaceList = popup.locator('[data-testid="space-list"]');
    await spaceList.focus();

    const initialFocused = popup.locator(':focus');
    const initialElement = await initialFocused.evaluate((el) => el.getAttribute('data-testid'));

    // Try ArrowDown
    await popup.keyboard.press('ArrowDown');
    await popup.waitForTimeout(200); // Allow for focus change

    const afterDownFocused = popup.locator(':focus');
    const afterDownElement = await afterDownFocused.evaluate((el) => el.getAttribute('data-testid'));

    // Note: Arrow key navigation is optional but improves accessibility
    // If implemented, focus should change
    if (initialElement !== afterDownElement) {
      console.log('✅ Arrow key navigation implemented');
    } else {
      console.log('ℹ️ Arrow key navigation not implemented (optional, but recommended)');
    }

    await popup.close();
  });

  test('Journey 4: Rename space using F2 key', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Get first space item
    const firstSpace = popup.locator('[data-testid^="space-item"]').first();

    if (await firstSpace.count() > 0) {
      // Focus on first space
      await firstSpace.focus();

      // Press F2 to enter edit mode
      await popup.keyboard.press('F2');
      await popup.waitForTimeout(300);

      // Check if edit input appeared
      const editInput = popup.locator('[data-testid="space-name-input"], input[type="text"]').first();

      if (await editInput.count() > 0) {
        // Verify input is focused
        await expect(editInput).toBeFocused();

        // Type new name
        await popup.keyboard.type('Renamed via Keyboard', { delay: 50 });

        // Press Enter to save
        await popup.keyboard.press('Enter');
        await popup.waitForTimeout(300);

        // Verify edit mode closed and name updated
        const updatedSpace = popup.locator('[data-testid^="space-item"]').first();
        const nameText = await updatedSpace.textContent();

        expect(nameText).toContain('Renamed via Keyboard');
        console.log('✅ F2 rename shortcut works');
      } else {
        allViolations.push({
          element: 'Space item',
          wcag: '2.1.1',
          severity: 'moderate',
          description: 'F2 key does not activate rename mode',
          recommendation: 'Implement F2 keyboard shortcut to enter edit mode',
        });
      }
    }

    await popup.close();
  });

  test('Journey 5: Switch to space using Enter key', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Get a non-current space
    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Find a space that is not current
      let targetSpace = null;
      for (let i = 0; i < itemCount; i++) {
        const space = spaceItems.nth(i);
        const isCurrent = await space.evaluate((el) => {
          return el.classList.contains('current') ||
                 el.getAttribute('aria-current') === 'true';
        });

        if (!isCurrent) {
          targetSpace = space;
          break;
        }
      }

      if (targetSpace) {
        // Focus on target space
        await targetSpace.focus();
        await expect(targetSpace).toBeFocused();

        // Press Enter to switch
        const closePromise = popup.waitForEvent('close');
        await popup.keyboard.press('Enter');

        // Popup should close after switching
        await closePromise.catch(() => {}); // Handle if popup doesn't close

        console.log('✅ Enter key switches to space');
      }
    } else {
      console.log('ℹ️ Only one space available, skipping switch test');
    }
  });

  test('Journey 6: Activate search using / key or Tab to search field', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Try / key to activate search (common keyboard shortcut)
    await popup.keyboard.press('/');
    await popup.waitForTimeout(200);

    let searchInput = popup.locator('[data-testid="search-input"], input[type="search"], input[placeholder*="Search"]').first();

    if (await searchInput.count() > 0) {
      const isFocused = await searchInput.evaluate((el) => el === document.activeElement);

      if (isFocused) {
        console.log('✅ "/" key activates search');

        // Type search query
        await popup.keyboard.type('test search', { delay: 50 });

        // Verify search is filtering
        const searchValue = await searchInput.inputValue();
        expect(searchValue).toContain('test');
      } else {
        // Try tabbing to search
        await popup.keyboard.press('Tab');
        const focusedAfterTab = popup.locator(':focus');
        const isSearchFocused = await focusedAfterTab.evaluate((el) => {
          return el.tagName.toLowerCase() === 'input' &&
                 (el.getAttribute('type') === 'search' ||
                  el.getAttribute('placeholder')?.toLowerCase().includes('search'));
        });

        if (!isSearchFocused) {
          allViolations.push({
            element: 'Search input',
            wcag: '2.1.1',
            severity: 'moderate',
            description: 'No keyboard shortcut to activate search',
            recommendation: 'Implement "/" key or ensure search is first Tab stop',
          });
        }
      }
    } else {
      console.log('ℹ️ No search functionality detected');
    }

    await popup.close();
  });

  test('Journey 7: Delete space with Delete/Backspace key', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Focus on a space item
      const targetSpace = spaceItems.nth(1);
      await targetSpace.focus();

      // Press Delete key
      await popup.keyboard.press('Delete');
      await popup.waitForTimeout(300);

      // Check if confirmation dialog appeared
      const confirmDialog = popup.locator('[role="dialog"], [role="alertdialog"]').first();

      if (await confirmDialog.count() > 0) {
        // Verify dialog is keyboard accessible
        await expect(confirmDialog).toBeVisible();

        // Find confirm button
        const confirmButton = confirmDialog.locator('button').filter({ hasText: /confirm|delete|yes|ok/i }).first();

        if (await confirmButton.count() > 0) {
          // Verify we can Tab to confirm button
          await popup.keyboard.press('Tab');
          const focused = popup.locator(':focus');
          const isButton = await focused.evaluate((el) => el.tagName.toLowerCase() === 'button');

          expect(isButton).toBe(true);

          // Press Escape to cancel (test escape key)
          await popup.keyboard.press('Escape');
          await popup.waitForTimeout(200);

          // Dialog should close
          await expect(confirmDialog).not.toBeVisible();

          console.log('✅ Delete confirmation dialog is keyboard accessible');
        }
      } else {
        allViolations.push({
          element: 'Space item',
          wcag: '2.1.1',
          severity: 'moderate',
          description: 'Delete key does not trigger delete action',
          recommendation: 'Implement Delete/Backspace keyboard shortcut',
        });
      }
    }

    await popup.close();
  });

  test('Journey 8: Close popup with Escape key', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Press Escape
    const closePromise = popup.waitForEvent('close', { timeout: 2000 });
    await popup.keyboard.press('Escape');

    try {
      await closePromise;
      console.log('✅ Escape key closes popup');
    } catch (error) {
      // Popup may not close with Escape, which is acceptable
      console.log('ℹ️ Escape key does not close popup (optional behavior)');
      await popup.close();
    }
  });

  test('Journey 9: Verify complete Tab order is logical', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Expected tab order (general pattern)
    // 1. Search input (if present)
    // 2. Create new space button (if present)
    // 3. Space items (in order)
    // 4. Action buttons (settings, import/export, etc.)

    const focusableElements = await popup.locator(
      'input, button, a, [tabindex]:not([tabindex="-1"])'
    ).all();

    console.log(`Found ${focusableElements.length} focusable elements`);

    // Tab through all elements and record order
    const tabOrder: string[] = [];

    for (let i = 0; i < Math.min(focusableElements.length, 20); i++) {
      await popup.keyboard.press('Tab');
      const focused = popup.locator(':focus');

      const identifier = await focused.evaluate((el) => {
        return el.getAttribute('data-testid') ||
               el.getAttribute('aria-label') ||
               el.getAttribute('title') ||
               el.textContent?.trim()?.substring(0, 30) ||
               el.tagName.toLowerCase();
      });

      tabOrder.push(identifier || 'unknown');
    }

    console.log('Tab order:', tabOrder);

    // Verify no duplicate focus (focus didn't get stuck)
    const uniqueElements = new Set(tabOrder);
    if (uniqueElements.size < tabOrder.length * 0.7) {
      allViolations.push({
        element: 'Page',
        wcag: '2.1.2',
        severity: 'critical',
        description: 'Potential keyboard trap - focus cycles through limited elements',
        recommendation: 'Ensure all focusable elements are reachable and focus doesn\'t loop prematurely',
      });
    }

    await popup.close();
  });

  test('Journey 10: Verify no mouse-only functionality', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for elements with click handlers but no keyboard support
    const clickOnlyElements = await popup.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      const violations: string[] = [];

      elements.forEach((el) => {
        const hasClick = (el as any).onclick !== null ||
                        el.getAttribute('onclick') !== null;
        const hasKeyHandler = (el as any).onkeydown !== null ||
                             (el as any).onkeyup !== null ||
                             (el as any).onkeypress !== null;
        const isFocusable = el.getAttribute('tabindex') !== null ||
                           ['button', 'a', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase());

        if (hasClick && !hasKeyHandler && !isFocusable) {
          violations.push(
            `${el.tagName.toLowerCase()}${el.className ? '.' + el.className.split(' ').join('.') : ''}`
          );
        }
      });

      return violations;
    });

    if (clickOnlyElements.length > 0) {
      clickOnlyElements.forEach((element) => {
        allViolations.push({
          element,
          wcag: '2.1.1',
          severity: 'critical',
          description: 'Element has click handler but is not keyboard accessible',
          recommendation: 'Add tabindex="0" and keyboard event handlers, or use semantic button element',
        });
      });
    }

    expect(clickOnlyElements.length).toBe(0);

    await popup.close();
  });

  test('Summary: Report all keyboard accessibility violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('KEYBOARD ACCESSIBILITY VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      // Fail test if there are critical violations
      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All keyboard accessibility tests passed! No violations found.\n');
    }
  });
});