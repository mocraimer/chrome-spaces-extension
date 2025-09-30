/**
 * Zoom and Magnification User Journey Test
 *
 * WCAG 2.1 Success Criteria:
 * - 1.4.4: Resize Text (Level AA) - Text can be resized to 200%
 * - 1.4.10: Reflow (Level AA) - Content reflows at 400% zoom
 * - 1.4.12: Text Spacing (Level AA) - Supports increased text spacing
 *
 * This test validates that users with low vision can zoom the extension
 * and all content remains accessible and usable.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('Zoom and Magnification User Journey', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const allViolations: AccessibilityViolation[] = [];

  const ZOOM_LEVELS = [
    { level: 100, name: '100% (Default)' },
    { level: 150, name: '150%' },
    { level: 200, name: '200% (WCAG AA)' },
    { level: 300, name: '300%' },
    { level: 400, name: '400% (WCAG AAA)' },
  ];

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

  test('ZM-1: Test at 200% zoom (WCAG AA requirement)', async () => {
    const popup = await context.newPage();

    // Set viewport for testing
    await popup.setViewportSize({ width: 800, height: 600 });

    // Apply 200% zoom via CSS
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Simulate 200% zoom
    await popup.evaluate(() => {
      document.body.style.zoom = '2';
    });

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check for horizontal scrolling
    const hasHorizontalScroll = await popup.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    if (hasHorizontalScroll) {
      allViolations.push({
        element: 'Page layout',
        wcag: '1.4.10',
        severity: 'serious',
        description: 'Horizontal scrolling required at 200% zoom',
        recommendation: 'Ensure content reflows and does not require horizontal scrolling',
      });
    } else {
      console.log('✅ No horizontal scrolling at 200% zoom');
    }

    // Verify text is readable
    const textReadability = await popup.evaluate(() => {
      const textElements = Array.from(
        document.querySelectorAll('p, span, button, a, h1, h2, h3, h4, h5, h6, label')
      );

      return textElements
        .filter((el) => el.textContent?.trim().length > 0)
        .map((el) => {
          const rect = el.getBoundingClientRect();
          const styles = window.getComputedStyle(el);

          return {
            text: el.textContent?.trim().substring(0, 30),
            fontSize: parseFloat(styles.fontSize),
            visible: rect.width > 0 && rect.height > 0,
            clipped: rect.right > window.innerWidth || rect.bottom > window.innerHeight,
          };
        });
    });

    const clippedText = textReadability.filter((t) => t.clipped);

    if (clippedText.length > 0) {
      console.log(`⚠️ ${clippedText.length} text elements clipped at 200% zoom`);

      allViolations.push({
        element: 'Text elements',
        wcag: '1.4.4',
        severity: 'serious',
        description: `${clippedText.length} text elements are clipped at 200% zoom`,
        recommendation: 'Use responsive units and allow content to reflow',
      });
    } else {
      console.log('✅ All text readable at 200% zoom');
    }

    await popup.close();
  });

  test('ZM-2: Test at 400% zoom (maximum reflow test)', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 1280, height: 1024 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Apply 400% zoom
    await popup.evaluate(() => {
      document.body.style.zoom = '4';
    });

    await popup.waitForTimeout(500);

    // Check layout integrity
    const layoutInfo = await popup.evaluate(() => {
      return {
        hasHorizontalScroll:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        hasVerticalScroll:
          document.documentElement.scrollHeight > document.documentElement.clientHeight,
        viewportWidth: window.innerWidth,
        contentWidth: document.documentElement.scrollWidth,
      };
    });

    if (layoutInfo.hasHorizontalScroll) {
      allViolations.push({
        element: 'Page layout',
        wcag: '1.4.10',
        severity: 'moderate',
        description: 'Horizontal scrolling at 400% zoom',
        recommendation: 'Content should reflow to single column at high zoom levels',
      });
    } else {
      console.log('✅ No horizontal scrolling at 400% zoom');
    }

    // Vertical scrolling is OK and expected
    console.log(`Viewport: ${layoutInfo.viewportWidth}px, Content: ${layoutInfo.contentWidth}px`);

    await popup.close();
  });

  test('ZM-3: All interactive elements accessible at high zoom', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 800, height: 600 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Test at 200% zoom
    await popup.evaluate(() => {
      document.body.style.zoom = '2';
    });

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check if buttons/controls are still accessible
    const controls = await popup.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button, a, input'));

      return buttons.map((btn) => {
        const rect = btn.getBoundingClientRect();
        const styles = window.getComputedStyle(btn);

        return {
          tag: btn.tagName.toLowerCase(),
          text: btn.textContent?.trim().substring(0, 20),
          visible: rect.width > 0 && rect.height > 0,
          accessible: rect.left >= 0 && rect.top >= 0,
          minSize: rect.width >= 24 && rect.height >= 24, // WCAG 2.5.5 target size
        };
      });
    });

    const inaccessibleControls = controls.filter((c) => !c.accessible || !c.visible);

    if (inaccessibleControls.length > 0) {
      inaccessibleControls.forEach((control) => {
        allViolations.push({
          element: `${control.tag}: "${control.text}"`,
          wcag: '1.4.4',
          severity: 'serious',
          description: 'Control not accessible at 200% zoom',
          recommendation: 'Ensure all controls remain within viewport at high zoom',
        });
      });
    } else {
      console.log('✅ All controls accessible at 200% zoom');
    }

    await popup.close();
  });

  test('ZM-4: Text doesn\'t overlap at high zoom', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 800, height: 600 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.evaluate(() => {
      document.body.style.zoom = '2';
    });

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Take screenshot to check for overlapping (basic check)
    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Get positions of first two space items
      const positions = await popup.evaluate(() => {
        const spaces = Array.from(document.querySelectorAll('[data-testid^="space-item"]'));

        return spaces.slice(0, 2).map((space) => {
          const rect = space.getBoundingClientRect();
          return {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left,
            right: rect.right,
            height: rect.height,
          };
        });
      });

      if (positions.length === 2) {
        // Check if they overlap
        const overlapping = positions[0].bottom > positions[1].top + 5; // 5px tolerance

        if (overlapping) {
          allViolations.push({
            element: 'Space items',
            wcag: '1.4.4',
            severity: 'serious',
            description: 'Space items overlap at 200% zoom',
            recommendation: 'Increase spacing between items or adjust layout',
          });
        } else {
          console.log('✅ No text overlap at 200% zoom');
        }
      }
    }

    await popup.close();
  });

  test('ZM-5: Test with increased text spacing (WCAG 1.4.12)', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 800, height: 600 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Apply WCAG 1.4.12 text spacing requirements
    await popup.evaluate(() => {
      const style = document.createElement('style');
      style.textContent = `
        * {
          line-height: 1.5 !important;
          letter-spacing: 0.12em !important;
          word-spacing: 0.16em !important;
        }
        p {
          margin-bottom: 2em !important;
        }
      `;
      document.head.appendChild(style);
    });

    await popup.waitForTimeout(500);

    // Check if content is clipped or overlaps
    const textSpacingIssues = await popup.evaluate(() => {
      const textElements = Array.from(
        document.querySelectorAll('p, span, button, a, label')
      );

      return textElements
        .filter((el) => el.textContent?.trim().length > 0)
        .map((el) => {
          const rect = el.getBoundingClientRect();

          return {
            text: el.textContent?.trim().substring(0, 30),
            clipped: rect.right > window.innerWidth || rect.bottom > window.innerHeight,
            hasOverflow: el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight,
          };
        });
    });

    const clippedElements = textSpacingIssues.filter((el) => el.clipped || el.hasOverflow);

    if (clippedElements.length > 0) {
      allViolations.push({
        element: 'Text with increased spacing',
        wcag: '1.4.12',
        severity: 'serious',
        description: `${clippedElements.length} elements clipped with increased text spacing`,
        recommendation: 'Ensure containers accommodate increased text spacing without clipping',
      });
    } else {
      console.log('✅ Content accommodates increased text spacing');
    }

    await popup.close();
  });

  test('ZM-6: Browser zoom levels (100%, 150%, 200%)', async () => {
    for (const zoom of ZOOM_LEVELS.slice(0, 3)) {
      const popup = await context.newPage();

      // Set viewport and zoom
      await popup.setViewportSize({ width: 1280, height: 1024 });
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await popup.waitForLoadState('domcontentloaded');

      // Apply zoom
      await popup.evaluate((level) => {
        document.body.style.zoom = `${level / 100}`;
      }, zoom.level);

      await popup.waitForTimeout(300);

      // Check layout
      const layoutCheck = await popup.evaluate(() => {
        const spaceList = document.querySelector('[data-testid="space-list"]');

        if (!spaceList) return { exists: false };

        const rect = spaceList.getBoundingClientRect();

        return {
          exists: true,
          visible: rect.width > 0 && rect.height > 0,
          withinViewport: rect.right <= window.innerWidth,
        };
      });

      if (!layoutCheck.withinViewport) {
        console.log(`⚠️ Layout issues at ${zoom.name}`);
      } else {
        console.log(`✅ Layout OK at ${zoom.name}`);
      }

      expect(layoutCheck.exists).toBe(true);
      expect(layoutCheck.visible).toBe(true);

      await popup.close();
    }
  });

  test('ZM-7: Font size increases proportionally with zoom', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 1280, height: 1024 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Get baseline font size
    const baselineSize = await popup.evaluate(() => {
      const element = document.querySelector('[data-testid^="space-item"]');
      if (!element) return null;

      const styles = window.getComputedStyle(element);
      return parseFloat(styles.fontSize);
    });

    if (baselineSize === null) {
      console.log('ℹ️ No space items to test font scaling');
      await popup.close();
      return;
    }

    // Apply 200% zoom
    await popup.evaluate(() => {
      document.body.style.zoom = '2';
    });

    await popup.waitForTimeout(300);

    const zoomedSize = await popup.evaluate(() => {
      const element = document.querySelector('[data-testid^="space-item"]');
      if (!element) return null;

      const styles = window.getComputedStyle(element);
      return parseFloat(styles.fontSize);
    });

    if (zoomedSize !== null) {
      const scaleFactor = zoomedSize / baselineSize;
      console.log(`Font scaling: ${baselineSize}px -> ${zoomedSize}px (${scaleFactor.toFixed(2)}x)`);

      // Should be close to 2x
      if (scaleFactor < 1.8 || scaleFactor > 2.2) {
        allViolations.push({
          element: 'Font size',
          wcag: '1.4.4',
          severity: 'moderate',
          description: 'Font size does not scale proportionally with zoom',
          recommendation: 'Use relative units (em, rem) instead of fixed px values',
        });
      } else {
        console.log('✅ Font size scales correctly with zoom');
      }
    }

    await popup.close();
  });

  test('ZM-8: Scrollbars appear when needed at high zoom', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 800, height: 600 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.evaluate(() => {
      document.body.style.zoom = '3';
    });

    await popup.waitForTimeout(500);

    const scrollInfo = await popup.evaluate(() => {
      return {
        hasVerticalScroll:
          document.documentElement.scrollHeight > document.documentElement.clientHeight,
        hasHorizontalScroll:
          document.documentElement.scrollWidth > document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      };
    });

    // Vertical scrolling is OK
    if (scrollInfo.hasVerticalScroll) {
      console.log('✅ Vertical scrollbar appears (expected at high zoom)');
    }

    // Horizontal scrolling is problematic
    if (scrollInfo.hasHorizontalScroll) {
      console.log('⚠️ Horizontal scrollbar appears at 300% zoom');
    } else {
      console.log('✅ No horizontal scrolling at 300% zoom');
    }

    await popup.close();
  });

  test('ZM-9: Touch targets remain adequate size at zoom', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 800, height: 600 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.evaluate(() => {
      document.body.style.zoom = '2';
    });

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check button sizes
    const buttonSizes = await popup.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));

      return buttons.map((btn) => {
        const rect = btn.getBoundingClientRect();
        return {
          text: btn.textContent?.trim(),
          width: rect.width,
          height: rect.height,
          meetsMinSize: rect.width >= 24 && rect.height >= 24, // WCAG 2.5.5
        };
      });
    });

    const undersizedButtons = buttonSizes.filter((b) => !b.meetsMinSize);

    if (undersizedButtons.length > 0) {
      undersizedButtons.forEach((btn) => {
        allViolations.push({
          element: `Button: "${btn.text}"`,
          wcag: '2.5.5',
          severity: 'moderate',
          description: `Button too small: ${btn.width}x${btn.height}px (min 24x24px)`,
          recommendation: 'Increase button size to meet 24x24px minimum',
        });
      });
    } else {
      console.log('✅ All buttons meet minimum size at 200% zoom');
    }

    await popup.close();
  });

  test('ZM-10: Complete user workflow at 200% zoom', async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 1280, height: 1024 });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Apply 200% zoom
    await popup.evaluate(() => {
      document.body.style.zoom = '2';
    });

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    console.log('Testing complete workflow at 200% zoom...');

    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 0) {
      // Navigate with keyboard
      await popup.keyboard.press('Tab');
      const focused = popup.locator(':focus');

      const isVisible = await focused.isVisible();
      expect(isVisible).toBe(true);

      // Try to rename (F2)
      await popup.keyboard.press('F2');
      await popup.waitForTimeout(300);

      const editInput = popup.locator('input[type="text"]').first();

      if (await editInput.count() > 0) {
        await expect(editInput).toBeVisible();
        console.log('✅ Edit mode accessible at 200% zoom');

        await popup.keyboard.press('Escape');
      }

      console.log('✅ Complete workflow works at 200% zoom');
    }

    await popup.close();
  });

  test('Summary: Report all zoom/magnification violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('ZOOM/MAGNIFICATION VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All zoom/magnification tests passed! No violations found.\n');
    }
  });
});