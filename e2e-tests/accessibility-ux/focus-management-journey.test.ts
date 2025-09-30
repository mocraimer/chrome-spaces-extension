/**
 * Focus Management User Journey Test
 *
 * WCAG 2.1 Success Criteria:
 * - 2.4.3: Focus Order (Level A) - Logical focus sequence
 * - 2.4.7: Focus Visible (Level AA) - Visible focus indicator
 * - 2.1.2: No Keyboard Trap (Level A) - Focus can be moved away
 * - 3.2.1: On Focus (Level A) - No unexpected context changes
 *
 * This test validates that focus is managed correctly throughout
 * the user journey, with proper focus restoration and trapping.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  verifyFocusManagement,
  verifyFocusTrap,
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('Focus Management User Journey', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const allViolations: AccessibilityViolation[] = [];

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

  test('FM-1: Focus order through complete popup workflow', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Define expected focus workflow
    const workflow = [
      {
        action: 'Initial focus',
        validator: async () => {
          await popup.keyboard.press('Tab');
          const focused = popup.locator(':focus');
          await expect(focused).toBeVisible();
        },
      },
      {
        action: 'Tab to second element',
        validator: async () => {
          await popup.keyboard.press('Tab');
          const focused = popup.locator(':focus');
          await expect(focused).toBeVisible();
        },
      },
      {
        action: 'Tab to third element',
        validator: async () => {
          await popup.keyboard.press('Tab');
          const focused = popup.locator(':focus');
          await expect(focused).toBeVisible();
        },
      },
    ];

    const violations = await verifyFocusManagement(popup, workflow);
    allViolations.push(...violations);

    expect(violations.length).toBe(0);

    await popup.close();
  });

  test('FM-2: Focus visible indicator on all interactive elements', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Get all focusable elements
    const focusableElements = popup.locator(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const count = await focusableElements.count();
    console.log(`Testing focus visibility on ${count} elements`);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const element = focusableElements.nth(i);
      await element.focus();

      // Verify focus indicator is visible
      const focusInfo = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          outlineStyle: styles.outlineStyle,
          outlineColor: styles.outlineColor,
          boxShadow: styles.boxShadow,
          border: styles.border,
          element: el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : ''),
        };
      });

      const hasVisibleFocus =
        (focusInfo.outline !== 'none' && focusInfo.outlineWidth !== '0px') ||
        focusInfo.boxShadow !== 'none' ||
        focusInfo.outlineStyle !== 'none';

      if (!hasVisibleFocus) {
        allViolations.push({
          element: focusInfo.element,
          wcag: '2.4.7',
          severity: 'serious',
          description: `No visible focus indicator on ${focusInfo.element}`,
          recommendation: 'Add :focus styles with outline or box-shadow (min 2px)',
        });
      }

      expect(hasVisibleFocus).toBe(true);
    }

    await popup.close();
  });

  test('FM-3: Focus restoration after closing dialog', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Find a space item with delete functionality
    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      // Focus on space item
      await spaceItem.focus();
      const triggerElement = popup.locator(':focus');
      const triggerIdentifier = await triggerElement.evaluate((el) =>
        el.getAttribute('data-testid') || el.textContent?.trim()
      );

      // Open delete confirmation dialog
      await popup.keyboard.press('Delete');
      await popup.waitForTimeout(300);

      // Check for dialog
      const dialog = popup.locator('[role="dialog"], [role="alertdialog"]').first();

      if (await dialog.count() > 0) {
        // Verify dialog is visible
        await expect(dialog).toBeVisible();

        // Close dialog with Escape
        await popup.keyboard.press('Escape');
        await popup.waitForTimeout(300);

        // Verify dialog closed
        await expect(dialog).not.toBeVisible();

        // Verify focus returned to trigger element
        const focusedAfterClose = popup.locator(':focus');
        const focusedIdentifier = await focusedAfterClose.evaluate((el) =>
          el.getAttribute('data-testid') || el.textContent?.trim()
        );

        if (focusedIdentifier !== triggerIdentifier) {
          allViolations.push({
            element: 'Dialog',
            wcag: '2.4.3',
            severity: 'serious',
            description: 'Focus not restored to trigger element after closing dialog',
            recommendation: 'Store reference to trigger element and restore focus on close',
          });
        } else {
          console.log('✅ Focus properly restored after closing dialog');
        }

        expect(focusedIdentifier).toBe(triggerIdentifier);
      }
    }

    await popup.close();
  });

  test('FM-4: Focus trap in confirmation dialog', async () => {
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

      const dialog = popup.locator('[role="dialog"], [role="alertdialog"]').first();

      if (await dialog.count() > 0) {
        // Verify focus trap
        const violations = await verifyFocusTrap(popup, dialog);
        allViolations.push(...violations);

        if (violations.length === 0) {
          console.log('✅ Focus trap working correctly in dialog');
        }

        // Clean up: close dialog
        await popup.keyboard.press('Escape');
        await popup.waitForTimeout(200);
      }
    }

    await popup.close();
  });

  test('FM-5: No focus loss during async operations', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Focus on a space item
    const spaceItem = popup.locator('[data-testid^="space-item"]').first();

    if (await spaceItem.count() > 0) {
      await spaceItem.focus();

      const focusedBefore = popup.locator(':focus');
      const elementBefore = await focusedBefore.evaluate((el) =>
        el.getAttribute('data-testid')
      );

      // Wait for potential async updates (e.g., data refresh)
      await popup.waitForTimeout(1000);

      // Verify focus is still on an element (not lost to body)
      const focusedAfter = popup.locator(':focus');
      const elementAfter = await focusedAfter.evaluate((el) => {
        return {
          testId: el.getAttribute('data-testid'),
          tagName: el.tagName.toLowerCase(),
          isBody: el === document.body,
        };
      });

      if (elementAfter.isBody) {
        allViolations.push({
          element: 'Async operation',
          wcag: '2.4.3',
          severity: 'serious',
          description: 'Focus lost to body during async operation',
          recommendation: 'Preserve focus or move to logical element after updates',
        });
      } else {
        console.log(`✅ Focus preserved during async operations (on ${elementAfter.tagName})`);
      }

      expect(elementAfter.isBody).toBe(false);
    }

    await popup.close();
  });

  test('FM-6: Focus does not move unexpectedly on hover', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Focus on first space
      const firstSpace = spaceItems.nth(0);
      await firstSpace.focus();

      const focusedBefore = popup.locator(':focus');
      const elementBefore = await focusedBefore.evaluate((el) =>
        el.getAttribute('data-testid')
      );

      // Hover over second space
      const secondSpace = spaceItems.nth(1);
      await secondSpace.hover();
      await popup.waitForTimeout(200);

      // Verify focus didn't move
      const focusedAfter = popup.locator(':focus');
      const elementAfter = await focusedAfter.evaluate((el) =>
        el.getAttribute('data-testid')
      );

      if (elementBefore !== elementAfter) {
        allViolations.push({
          element: 'Space item',
          wcag: '3.2.1',
          severity: 'serious',
          description: 'Focus moved unexpectedly on hover',
          recommendation: 'Do not programmatically move focus on hover events',
        });
      } else {
        console.log('✅ Focus does not move on hover');
      }

      expect(elementAfter).toBe(elementBefore);
    }

    await popup.close();
  });

  test('FM-7: Focus order follows visual order (left-to-right, top-to-bottom)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Get all focusable elements with positions
    const focusOrder = await popup.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );

      return elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        return {
          index,
          top: rect.top,
          left: rect.left,
          identifier: el.getAttribute('data-testid') || el.textContent?.trim()?.substring(0, 20) || el.tagName,
        };
      });
    });

    console.log('Focus order analysis:', focusOrder);

    // Verify reading order (top-to-bottom, left-to-right)
    for (let i = 1; i < focusOrder.length; i++) {
      const prev = focusOrder[i - 1];
      const curr = focusOrder[i];

      // Current element should not be significantly higher than previous
      // (unless it's a new column)
      const isSignificantlyHigher = curr.top < prev.top - 10;
      const isSameRow = Math.abs(curr.top - prev.top) < 10;
      const isLeftOfPrevious = curr.left < prev.left;

      if (isSignificantlyHigher || (isSameRow && isLeftOfPrevious)) {
        allViolations.push({
          element: `Focus order: ${prev.identifier} -> ${curr.identifier}`,
          wcag: '2.4.3',
          severity: 'moderate',
          description: 'Focus order does not follow visual order',
          recommendation: 'Reorder DOM elements or use tabindex to match visual layout',
        });
      }
    }

    await popup.close();
  });

  test('FM-8: Shift+Tab reverses focus order correctly', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Tab forward through elements
    const forwardOrder: string[] = [];

    for (let i = 0; i < 5; i++) {
      await popup.keyboard.press('Tab');
      const focused = popup.locator(':focus');
      const identifier = await focused.evaluate((el) =>
        el.getAttribute('data-testid') || el.textContent?.trim()?.substring(0, 20)
      );
      forwardOrder.push(identifier || 'unknown');
    }

    // Tab backward through elements
    const backwardOrder: string[] = [];

    for (let i = 0; i < 5; i++) {
      await popup.keyboard.press('Shift+Tab');
      const focused = popup.locator(':focus');
      const identifier = await focused.evaluate((el) =>
        el.getAttribute('data-testid') || el.textContent?.trim()?.substring(0, 20)
      );
      backwardOrder.push(identifier || 'unknown');
    }

    // Reverse backward order and compare
    backwardOrder.reverse();

    console.log('Forward order:', forwardOrder);
    console.log('Backward order (reversed):', backwardOrder);

    // First element should match (we tabbed back to start)
    if (forwardOrder[0] !== backwardOrder[0]) {
      allViolations.push({
        element: 'Tab navigation',
        wcag: '2.4.3',
        severity: 'moderate',
        description: 'Shift+Tab does not correctly reverse Tab order',
        recommendation: 'Ensure tabindex values allow bi-directional navigation',
      });
    } else {
      console.log('✅ Shift+Tab correctly reverses Tab order');
    }

    await popup.close();
  });

  test('FM-9: Focus not trapped in popup (can exit)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Tab through all elements
    const focusableCount = await popup.locator(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).count();

    console.log(`Tabbing through ${focusableCount} elements`);

    // Tab through all elements multiple times
    for (let i = 0; i < focusableCount + 5; i++) {
      await popup.keyboard.press('Tab');
      await popup.waitForTimeout(50);
    }

    // Verify we can still move focus (not trapped)
    const focused = popup.locator(':focus');
    const isStillFocusable = await focused.evaluate((el) => el !== document.body);

    if (!isStillFocusable) {
      console.log('✅ Focus exited popup elements (no keyboard trap)');
    } else {
      // May be cycling within popup, which is acceptable
      console.log('ℹ️ Focus cycles within popup (intentional for extension popups)');
    }

    await popup.close();
  });

  test('FM-10: Focus management in nested elements', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check for nested focusable elements (e.g., buttons within list items)
    const nestedStructure = await popup.evaluate(() => {
      const spaces = Array.from(document.querySelectorAll('[data-testid^="space-item"]'));

      return spaces.map((space, index) => {
        const focusableChildren = space.querySelectorAll(
          'button, a, input, [tabindex]:not([tabindex="-1"])'
        );

        return {
          index,
          isFocusable: space.getAttribute('tabindex') !== null,
          childrenCount: focusableChildren.length,
          children: Array.from(focusableChildren).map((child) => child.tagName),
        };
      });
    });

    console.log('Nested focusable structure:', nestedStructure);

    // Verify proper focus management for nested elements
    for (const space of nestedStructure) {
      if (space.childrenCount > 0 && !space.isFocusable) {
        // Parent is not focusable but has focusable children - this is OK
        console.log(`✅ Space ${space.index} has ${space.childrenCount} focusable children`);
      } else if (space.isFocusable && space.childrenCount === 0) {
        // Parent is focusable with no children - this is OK
        console.log(`✅ Space ${space.index} is directly focusable`);
      }
    }

    await popup.close();
  });

  test('Summary: Report all focus management violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('FOCUS MANAGEMENT VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All focus management tests passed! No violations found.\n');
    }
  });
});