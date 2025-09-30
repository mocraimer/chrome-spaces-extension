/**
 * Screen Reader User Journey Test
 *
 * WCAG 2.1 Success Criteria:
 * - 1.3.1: Info and Relationships (Level A) - Semantic structure
 * - 4.1.2: Name, Role, Value (Level A) - Accessible names and roles
 * - 4.1.3: Status Messages (Level AA) - Dynamic content announcements
 * - 1.1.1: Non-text Content (Level A) - Alt text for images
 *
 * This test validates that screen reader users can understand and
 * interact with the extension effectively.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  verifyARIALabels,
  verifyLiveRegionAnnouncements,
  getAccessibilityViolations,
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('Screen Reader User Journey', () => {
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

  test('SR-1: Verify ARIA labels on all interactive elements', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Wait for content to load
    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check ARIA labels on entire popup
    const violations = await verifyARIALabels(popup.locator('body'));
    allViolations.push(...violations);

    if (violations.length > 0) {
      console.log('Found ARIA label violations:');
      violations.forEach((v) => console.log(`  - ${v.element}: ${v.description}`));
    }

    // Verify specific critical elements have labels
    const criticalElements = [
      { selector: '[data-testid="search-input"]', name: 'Search input' },
      { selector: 'button', name: 'Buttons' },
      { selector: '[data-testid^="space-item"]', name: 'Space items' },
    ];

    for (const { selector, name } of criticalElements) {
      const elements = popup.locator(selector);
      const count = await elements.count();

      if (count > 0) {
        const firstElement = elements.first();
        const hasLabel = await firstElement.evaluate((el) => {
          const ariaLabel = el.getAttribute('aria-label');
          const ariaLabelledBy = el.getAttribute('aria-labelledby');
          const textContent = el.textContent?.trim();
          const title = el.getAttribute('title');

          return !!(ariaLabel || ariaLabelledBy || textContent || title);
        });

        if (!hasLabel) {
          allViolations.push({
            element: name,
            wcag: '4.1.2',
            severity: 'critical',
            description: `${name} has no accessible name`,
            recommendation: 'Add aria-label or ensure text content is present',
          });
        }

        expect(hasLabel).toBe(true);
      }
    }

    await popup.close();
  });

  test('SR-2: Verify semantic HTML structure (landmarks)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for semantic landmarks
    const landmarks = await popup.evaluate(() => {
      return {
        main: document.querySelector('main, [role="main"]') !== null,
        search: document.querySelector('[role="search"]') !== null ||
                document.querySelector('input[type="search"]') !== null,
        list: document.querySelector('ul, ol, [role="list"]') !== null,
        navigation: document.querySelector('nav, [role="navigation"]') !== null,
      };
    });

    console.log('Semantic landmarks found:', landmarks);

    // Main content area should exist
    if (!landmarks.main) {
      allViolations.push({
        element: 'Page structure',
        wcag: '1.3.1',
        severity: 'serious',
        description: 'No main landmark found',
        recommendation: 'Wrap main content in <main> or role="main"',
      });
    }

    // List structure for spaces
    if (!landmarks.list) {
      allViolations.push({
        element: 'Space list',
        wcag: '1.3.1',
        severity: 'moderate',
        description: 'Spaces not contained in semantic list',
        recommendation: 'Use <ul>/<ol> or role="list" for space items',
      });
    }

    await popup.close();
  });

  test('SR-3: Verify role attributes are correct', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for proper ARIA roles
    const roleChecks = await popup.evaluate(() => {
      const results: any[] = [];

      // Check buttons have correct role
      const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
      buttons.forEach((btn, i) => {
        const role = btn.getAttribute('role') || 'button';
        const hasProperRole = role === 'button';
        results.push({
          type: 'button',
          index: i,
          hasProperRole,
          actualRole: role,
        });
      });

      // Check list items have correct role
      const listItems = Array.from(document.querySelectorAll('[data-testid^="space-item"]'));
      listItems.forEach((item, i) => {
        const role = item.getAttribute('role');
        const parentRole = item.parentElement?.getAttribute('role');

        // If parent is a list, children should be listitem
        const shouldBeListItem = parentRole === 'list' ||
                                item.parentElement?.tagName === 'UL' ||
                                item.parentElement?.tagName === 'OL';

        results.push({
          type: 'list-item',
          index: i,
          hasProperRole: !shouldBeListItem || role === 'listitem' || item.tagName === 'LI',
          actualRole: role || item.tagName,
        });
      });

      // Check for dialog roles
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"]'));
      dialogs.forEach((dialog, i) => {
        const ariaModal = dialog.getAttribute('aria-modal');
        results.push({
          type: 'dialog',
          index: i,
          hasProperRole: true,
          hasAriaModal: ariaModal === 'true',
        });
      });

      return results;
    });

    roleChecks.forEach((check) => {
      if (!check.hasProperRole) {
        allViolations.push({
          element: `${check.type} at index ${check.index}`,
          wcag: '4.1.2',
          severity: 'serious',
          description: `Incorrect or missing role attribute (found: ${check.actualRole})`,
          recommendation: 'Use semantic HTML or add appropriate ARIA role',
        });
      }

      if (check.type === 'dialog' && !check.hasAriaModal) {
        allViolations.push({
          element: `dialog at index ${check.index}`,
          wcag: '4.1.2',
          severity: 'moderate',
          description: 'Dialog missing aria-modal="true"',
          recommendation: 'Add aria-modal="true" to modal dialogs',
        });
      }
    });

    await popup.close();
  });

  test('SR-4: Verify alt text on images and icons', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check all images have alt text
    const images = await popup.locator('img').all();

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const altText = await img.getAttribute('alt');

      if (altText === null) {
        allViolations.push({
          element: `img at index ${i}`,
          wcag: '1.1.1',
          severity: 'critical',
          description: 'Image missing alt attribute',
          recommendation: 'Add alt="" for decorative images or descriptive alt text',
        });
      }
    }

    // Check SVG icons have accessible names
    const svgs = await popup.locator('svg').all();

    for (let i = 0; i < svgs.length; i++) {
      const svg = svgs[i];
      const hasAccessibleName = await svg.evaluate((el) => {
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const title = el.querySelector('title');
        const role = el.getAttribute('role');

        // If role="presentation" or "img", needs accessible name
        if (role === 'img') {
          return !!(ariaLabel || ariaLabelledBy || title);
        }

        // If no role, should be presentation or have accessible name
        return role === 'presentation' || ariaLabel || ariaLabelledBy || title;
      });

      if (!hasAccessibleName) {
        allViolations.push({
          element: `svg at index ${i}`,
          wcag: '1.1.1',
          severity: 'moderate',
          description: 'SVG icon may not have accessible name',
          recommendation: 'Add aria-label, <title>, or role="presentation" if decorative',
        });
      }
    }

    await popup.close();
  });

  test('SR-5: Verify live region announcements for space switch', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for aria-live region
    const liveRegions = await popup.locator('[aria-live]').all();

    if (liveRegions.length === 0) {
      allViolations.push({
        element: 'Page',
        wcag: '4.1.3',
        severity: 'serious',
        description: 'No aria-live regions found for status announcements',
        recommendation: 'Add aria-live="polite" region for status updates',
      });
    } else {
      console.log(`✅ Found ${liveRegions.length} aria-live region(s)`);

      // Verify live region attributes
      for (let i = 0; i < liveRegions.length; i++) {
        const region = liveRegions[i];
        const ariaLive = await region.getAttribute('aria-live');
        const ariaAtomic = await region.getAttribute('aria-atomic');

        console.log(`  Live region ${i}: aria-live="${ariaLive}", aria-atomic="${ariaAtomic}"`);

        if (!['polite', 'assertive'].includes(ariaLive || '')) {
          allViolations.push({
            element: `aria-live region ${i}`,
            wcag: '4.1.3',
            severity: 'moderate',
            description: `Invalid aria-live value: "${ariaLive}"`,
            recommendation: 'Use aria-live="polite" or "assertive"',
          });
        }
      }
    }

    await popup.close();
  });

  test('SR-6: Verify status messages are announced (simulated space switch)', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Get aria-live region
    const liveRegion = popup.locator('[aria-live]').first();

    if (await liveRegion.count() > 0) {
      // Get space items
      const spaceItems = popup.locator('[data-testid^="space-item"]');
      const itemCount = await spaceItems.count();

      if (itemCount > 1) {
        // Click a space item (simulate space switch)
        const targetSpace = spaceItems.nth(1);
        const spaceName = await targetSpace.textContent();

        // Monitor live region for updates
        const liveRegionTextBefore = await liveRegion.textContent();

        await targetSpace.click();
        await popup.waitForTimeout(500);

        const liveRegionTextAfter = await liveRegion.textContent();

        // Check if status message was announced
        if (liveRegionTextBefore !== liveRegionTextAfter) {
          console.log(`✅ Status message announced: "${liveRegionTextAfter}"`);

          // Verify message is meaningful
          if (liveRegionTextAfter?.trim().length === 0) {
            allViolations.push({
              element: 'aria-live region',
              wcag: '4.1.3',
              severity: 'serious',
              description: 'Live region updated but message is empty',
              recommendation: 'Ensure status messages contain meaningful text',
            });
          }
        } else {
          console.log('ℹ️ Live region did not update (may update after popup closes)');
        }
      }
    }

    await popup.close();
  });

  test('SR-7: Verify error messages are accessible', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Try to create a space with invalid name (if functionality exists)
    const createButton = popup.locator('button').filter({ hasText: /new|create|add/i }).first();

    if (await createButton.count() > 0) {
      await createButton.click();
      await popup.waitForTimeout(300);

      // Look for input field
      const nameInput = popup.locator('input[type="text"]').first();

      if (await nameInput.count() > 0) {
        // Try to submit empty or invalid name
        await nameInput.fill('');
        await popup.keyboard.press('Enter');
        await popup.waitForTimeout(500);

        // Check for error message
        const errorMessage = popup.locator('[role="alert"], [aria-live="assertive"], .error, [class*="error"]').first();

        if (await errorMessage.count() > 0) {
          const hasAccessibleError = await errorMessage.evaluate((el) => {
            const role = el.getAttribute('role');
            const ariaLive = el.getAttribute('aria-live');
            const hasText = el.textContent?.trim().length > 0;

            return (role === 'alert' || ariaLive === 'assertive') && hasText;
          });

          if (!hasAccessibleError) {
            allViolations.push({
              element: 'Error message',
              wcag: '4.1.3',
              severity: 'serious',
              description: 'Error message not properly announced to screen readers',
              recommendation: 'Use role="alert" or aria-live="assertive" on error messages',
            });
          } else {
            console.log('✅ Error messages are accessible');
          }
        }
      }
    }

    await popup.close();
  });

  test('SR-8: Verify form inputs have proper labels and descriptions', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Find all form inputs
    const inputs = await popup.locator('input, textarea, select').all();

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];

      const labelInfo = await input.evaluate((el) => {
        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const ariaDescribedBy = el.getAttribute('aria-describedby');
        const placeholder = el.getAttribute('placeholder');

        let hasLabel = false;
        let labelText = '';

        // Check for associated <label>
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) {
            hasLabel = true;
            labelText = label.textContent || '';
          }
        }

        // Check for aria-label
        if (ariaLabel) {
          hasLabel = true;
          labelText = ariaLabel;
        }

        // Check for aria-labelledby
        if (ariaLabelledBy) {
          const labelElement = document.getElementById(ariaLabelledBy);
          if (labelElement) {
            hasLabel = true;
            labelText = labelElement.textContent || '';
          }
        }

        return {
          hasLabel,
          labelText,
          hasDescription: !!ariaDescribedBy,
          placeholder,
          type: el.getAttribute('type'),
        };
      });

      if (!labelInfo.hasLabel) {
        allViolations.push({
          element: `${labelInfo.type || 'input'} at index ${i}`,
          wcag: '3.3.2',
          severity: 'critical',
          description: 'Form input has no associated label',
          recommendation: 'Add <label> element, aria-label, or aria-labelledby',
        });
      }

      // Placeholder alone is not sufficient
      if (labelInfo.placeholder && !labelInfo.hasLabel) {
        allViolations.push({
          element: `input at index ${i}`,
          wcag: '3.3.2',
          severity: 'serious',
          description: 'Input relies on placeholder text only (not accessible)',
          recommendation: 'Add proper label in addition to placeholder',
        });
      }

      console.log(`Input ${i}: ${labelInfo.hasLabel ? '✅' : '❌'} Label: "${labelInfo.labelText}"`);
    }

    await popup.close();
  });

  test('SR-9: Verify current space indication is announced', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Find current space
    const currentSpace = popup.locator('[data-testid^="space-item"]').filter({
      has: popup.locator('[aria-current="true"], [aria-current="page"], [aria-selected="true"]'),
    }).first();

    if (await currentSpace.count() === 0) {
      // Try alternate detection methods
      const spaceItems = popup.locator('[data-testid^="space-item"]');
      const itemCount = await spaceItems.count();

      let foundCurrent = false;

      for (let i = 0; i < itemCount; i++) {
        const space = spaceItems.nth(i);
        const isCurrent = await space.evaluate((el) => {
          return el.getAttribute('aria-current') !== null ||
                 el.getAttribute('aria-selected') === 'true' ||
                 el.classList.contains('current') ||
                 el.classList.contains('active');
        });

        if (isCurrent) {
          foundCurrent = true;
          console.log('✅ Current space found with state indication');
          break;
        }
      }

      if (!foundCurrent) {
        allViolations.push({
          element: 'Space list',
          wcag: '4.1.2',
          severity: 'serious',
          description: 'Current space not indicated with aria-current or aria-selected',
          recommendation: 'Add aria-current="page" or aria-selected="true" to current space',
        });
      }
    } else {
      console.log('✅ Current space properly indicated with ARIA attributes');
    }

    await popup.close();
  });

  test('SR-10: Get accessibility tree snapshot', async () => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Get full accessibility violations
    const violations = await getAccessibilityViolations(popup);
    allViolations.push(...violations);

    // Get accessibility tree
    const snapshot = await popup.accessibility.snapshot();

    if (snapshot) {
      console.log('\n=== Accessibility Tree ===');
      console.log(JSON.stringify(snapshot, null, 2));
      console.log('========================\n');

      // Verify tree has proper structure
      if (!snapshot.children || snapshot.children.length === 0) {
        allViolations.push({
          element: 'Accessibility tree',
          wcag: '1.3.1',
          severity: 'critical',
          description: 'Accessibility tree is empty or malformed',
          recommendation: 'Ensure proper semantic HTML and ARIA attributes',
        });
      }
    } else {
      allViolations.push({
        element: 'Page',
        wcag: 'N/A',
        severity: 'critical',
        description: 'Could not generate accessibility tree',
        recommendation: 'Check page rendering and DOM structure',
      });
    }

    await popup.close();
  });

  test('Summary: Report all screen reader accessibility violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('SCREEN READER ACCESSIBILITY VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All screen reader accessibility tests passed! No violations found.\n');
    }
  });
});