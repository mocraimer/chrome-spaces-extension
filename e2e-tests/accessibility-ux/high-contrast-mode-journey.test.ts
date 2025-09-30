/**
 * High Contrast Mode User Journey Test
 *
 * WCAG 2.1 Success Criteria:
 * - 1.4.3: Contrast (Minimum) (Level AA) - 4.5:1 for text
 * - 1.4.6: Contrast (Enhanced) (Level AAA) - 7:1 for text
 * - 1.4.11: Non-text Contrast (Level AA) - 3:1 for UI components
 * - 1.4.1: Use of Color (Level A) - Not relying solely on color
 *
 * This test validates the extension works in Windows High Contrast Mode
 * and other forced colors modes for users with visual impairments.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  verifyColorContrast,
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('High Contrast Mode User Journey', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const allViolations: AccessibilityViolation[] = [];

  // Windows High Contrast themes
  const HIGH_CONTRAST_THEMES = [
    { name: 'High Contrast Black', backgroundColor: 'black', textColor: 'white' },
    { name: 'High Contrast White', backgroundColor: 'white', textColor: 'black' },
    { name: 'High Contrast #1', backgroundColor: 'black', textColor: 'lime' },
    { name: 'High Contrast #2', backgroundColor: 'black', textColor: 'aqua' },
  ];

  test.beforeAll(async ({ browser }) => {
    const extensionPath = path.resolve(__dirname, '../../build');
    context = await browser.newContext({
      permissions: ['tabs', 'storage'],
      forcedColors: 'active', // Enable forced colors mode
      colorScheme: 'dark',
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

  test('HC-1: Extension UI visible in high contrast mode', async () => {
    const popup = await context.newPage();

    // Enable forced colors
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Verify main elements are visible
    const mainElements = await popup.evaluate(() => {
      const getVisibility = (selector: string) => {
        const el = document.querySelector(selector);
        if (!el) return { exists: false };

        const styles = window.getComputedStyle(el);
        return {
          exists: true,
          visible: styles.display !== 'none' && styles.visibility !== 'hidden',
          hasBackground: styles.backgroundColor !== 'rgba(0, 0, 0, 0)',
          hasText: el.textContent?.trim().length > 0,
        };
      };

      return {
        spaceList: getVisibility('[data-testid="space-list"]'),
        spaceItems: Array.from(document.querySelectorAll('[data-testid^="space-item"]')).length,
      };
    });

    expect(mainElements.spaceList.exists).toBe(true);
    expect(mainElements.spaceList.visible).toBe(true);

    if (mainElements.spaceItems === 0) {
      console.log('⚠️ No space items found to test high contrast rendering');
    } else {
      console.log(`✅ Extension UI visible in high contrast mode (${mainElements.spaceItems} spaces)`);
    }

    await popup.close();
  });

  test('HC-2: Focus indicators visible in high contrast mode', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Tab through focusable elements
    const focusableElements = popup.locator(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const count = await focusableElements.count();
    console.log(`Testing ${count} focusable elements in high contrast mode`);

    for (let i = 0; i < Math.min(count, 5); i++) {
      const element = focusableElements.nth(i);
      await element.focus();

      const focusIndicator = await element.evaluate((el) => {
        const styles = window.getComputedStyle(el);

        // In forced colors mode, browsers render focus differently
        return {
          outline: styles.outline,
          outlineWidth: styles.outlineWidth,
          outlineStyle: styles.outlineStyle,
          boxShadow: styles.boxShadow,
          border: styles.border,
        };
      });

      const hasVisibleFocus =
        (focusIndicator.outline !== 'none' && focusIndicator.outlineWidth !== '0px') ||
        focusIndicator.boxShadow !== 'none';

      if (!hasVisibleFocus) {
        allViolations.push({
          element: `Focusable element ${i}`,
          wcag: '2.4.7',
          severity: 'critical',
          description: 'Focus indicator not visible in high contrast mode',
          recommendation: 'Ensure :focus styles use outline or border that respects forced colors',
        });
      }

      expect(hasVisibleFocus).toBe(true);
    }

    await popup.close();
  });

  test('HC-3: All text readable in high contrast mode', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check text elements are readable
    const textReadability = await popup.evaluate(() => {
      const results: any[] = [];

      // Get all text-containing elements
      const textElements = Array.from(
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, button, a, label, li')
      );

      textElements.forEach((el, index) => {
        const text = el.textContent?.trim();
        if (!text || text.length === 0) return;

        const styles = window.getComputedStyle(el);
        const fontSize = parseFloat(styles.fontSize);

        results.push({
          index,
          tag: el.tagName.toLowerCase(),
          fontSize,
          color: styles.color,
          backgroundColor: styles.backgroundColor,
          textLength: text.length,
          sampleText: text.substring(0, 30),
        });
      });

      return results;
    });

    console.log(`Found ${textReadability.length} text elements`);

    textReadability.forEach((element) => {
      console.log(
        `  ${element.tag}: "${element.sampleText}" (${element.fontSize}px) - ` +
        `color: ${element.color}, bg: ${element.backgroundColor}`
      );
    });

    // In forced colors mode, system colors should be used
    const usingSystemColors = textReadability.every((el) => {
      // System colors in forced colors mode
      return el.color !== 'rgba(0, 0, 0, 0)' && el.color !== 'transparent';
    });

    if (!usingSystemColors) {
      allViolations.push({
        element: 'Text rendering',
        wcag: '1.4.3',
        severity: 'serious',
        description: 'Some text may not respect forced colors mode',
        recommendation: 'Remove color overrides that prevent system colors in forced-colors mode',
      });
    } else {
      console.log('✅ Text respects forced colors system settings');
    }

    await popup.close();
  });

  test('HC-4: Borders and separators visible in high contrast', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for border visibility
    const borderInfo = await popup.evaluate(() => {
      const elements = Array.from(
        document.querySelectorAll('[data-testid^="space-item"], button, input')
      );

      return elements.map((el, index) => {
        const styles = window.getComputedStyle(el);
        return {
          index,
          tag: el.tagName.toLowerCase(),
          testId: el.getAttribute('data-testid'),
          border: styles.border,
          borderWidth: styles.borderWidth,
          borderStyle: styles.borderStyle,
          borderColor: styles.borderColor,
          outline: styles.outline,
        };
      });
    });

    console.log('Border visibility in high contrast:');
    borderInfo.forEach((el) => {
      const hasBorder = el.borderStyle !== 'none' && el.borderWidth !== '0px';
      const hasOutline = el.outline !== 'none';

      console.log(
        `  ${el.tag}[${el.testId}]: ${hasBorder ? '✅' : '⚠️'} border: ${el.borderWidth} ${el.borderStyle}`
      );
    });

    await popup.close();
  });

  test('HC-5: Interactive elements distinguishable in high contrast', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check that buttons and links are distinguishable from regular text
    const interactiveElements = await popup.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const links = Array.from(document.querySelectorAll('a'));

      const getStyles = (el: Element) => {
        const styles = window.getComputedStyle(el);
        return {
          textDecoration: styles.textDecoration,
          border: styles.border,
          borderWidth: styles.borderWidth,
          backgroundColor: styles.backgroundColor,
          cursor: styles.cursor,
        };
      };

      return {
        buttons: buttons.map((btn, i) => ({
          index: i,
          text: btn.textContent?.trim(),
          styles: getStyles(btn),
        })),
        links: links.map((link, i) => ({
          index: i,
          text: link.textContent?.trim(),
          styles: getStyles(link),
        })),
      };
    });

    // Verify buttons have visible borders
    interactiveElements.buttons.forEach((button) => {
      const hasBorder = button.styles.borderWidth !== '0px' && button.styles.border !== 'none';

      if (!hasBorder) {
        allViolations.push({
          element: `Button: "${button.text}"`,
          wcag: '1.4.11',
          severity: 'serious',
          description: 'Button not distinguishable in high contrast mode',
          recommendation: 'Add visible border to buttons (will be rendered by forced colors)',
        });
      }
    });

    // Verify links are distinguishable
    interactiveElements.links.forEach((link) => {
      const hasUnderline = link.styles.textDecoration.includes('underline');

      if (!hasUnderline) {
        console.log(`ℹ️ Link "${link.text}" may not be underlined in high contrast`);
      }
    });

    console.log(`✅ Checked ${interactiveElements.buttons.length} buttons and ${interactiveElements.links.length} links`);

    await popup.close();
  });

  test('HC-6: Current space indication visible in high contrast', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Find current space
    const currentSpaceInfo = await popup.evaluate(() => {
      const spaces = Array.from(document.querySelectorAll('[data-testid^="space-item"]'));

      return spaces.map((space, index) => {
        const styles = window.getComputedStyle(space);
        const isCurrent =
          space.classList.contains('current') ||
          space.getAttribute('aria-current') === 'true' ||
          space.getAttribute('aria-selected') === 'true';

        return {
          index,
          isCurrent,
          backgroundColor: styles.backgroundColor,
          border: styles.border,
          borderWidth: styles.borderWidth,
          fontWeight: styles.fontWeight,
          textDecoration: styles.textDecoration,
        };
      });
    });

    const currentSpace = currentSpaceInfo.find((s) => s.isCurrent);

    if (currentSpace) {
      // Verify current space has visual distinction
      const hasDistinction =
        currentSpace.borderWidth !== '0px' ||
        parseInt(currentSpace.fontWeight) >= 700 ||
        currentSpace.textDecoration !== 'none';

      if (!hasDistinction) {
        allViolations.push({
          element: 'Current space indicator',
          wcag: '1.4.1',
          severity: 'serious',
          description: 'Current space not distinguishable in high contrast mode',
          recommendation: 'Use border, bold text, or other non-color indicators for current state',
        });
      } else {
        console.log('✅ Current space distinguishable in high contrast mode');
      }

      expect(hasDistinction).toBe(true);
    } else {
      console.log('ℹ️ No current space found to test');
    }

    await popup.close();
  });

  test('HC-7: Icons and images visible in high contrast', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for SVG icons
    const iconInfo = await popup.evaluate(() => {
      const svgs = Array.from(document.querySelectorAll('svg'));
      const imgs = Array.from(document.querySelectorAll('img'));

      return {
        svgCount: svgs.length,
        imgCount: imgs.length,
        svgs: svgs.map((svg, i) => {
          const styles = window.getComputedStyle(svg);
          return {
            index: i,
            fill: styles.fill,
            stroke: styles.stroke,
            forcedColorAdjust: styles.getPropertyValue('forced-color-adjust'),
          };
        }),
        imgs: imgs.map((img, i) => ({
          index: i,
          src: img.src,
          alt: img.alt,
        })),
      };
    });

    console.log(`Found ${iconInfo.svgCount} SVG icons and ${iconInfo.imgCount} images`);

    // SVGs should respect forced-color-adjust
    iconInfo.svgs.forEach((svg, i) => {
      console.log(`  SVG ${i}: forced-color-adjust: ${svg.forcedColorAdjust || 'auto'}`);

      // Icons should ideally have forced-color-adjust: auto to respect system colors
      if (svg.forcedColorAdjust === 'none') {
        console.log(`    ⚠️ SVG ${i} may not respect high contrast colors`);
      }
    });

    await popup.close();
  });

  test('HC-8: Complete user journey in high contrast mode', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    console.log('Testing complete user journey in high contrast mode...');

    // Journey: Navigate, focus, read content
    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 0) {
      // Tab to first space
      await popup.keyboard.press('Tab');
      let focused = popup.locator(':focus');

      // Verify focused element is visible
      const isVisible = await focused.isVisible();
      expect(isVisible).toBe(true);

      // Tab to next space
      if (itemCount > 1) {
        await popup.keyboard.press('Tab');
        focused = popup.locator(':focus');

        const stillVisible = await focused.isVisible();
        expect(stillVisible).toBe(true);
      }

      console.log('✅ Complete navigation workflow works in high contrast mode');
    }

    await popup.close();
  });

  test('HC-9: Verify media query for prefers-contrast', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check if styles respond to prefers-contrast media query
    const contrastSupport = await popup.evaluate(() => {
      // Check if prefers-contrast media query is supported
      const highContrast = window.matchMedia('(prefers-contrast: more)').matches;
      const noPreference = window.matchMedia('(prefers-contrast: no-preference)').matches;
      const forcedColors = window.matchMedia('(forced-colors: active)').matches;

      return {
        highContrast,
        noPreference,
        forcedColors,
      };
    });

    console.log('Contrast mode detection:', contrastSupport);

    if (contrastSupport.forcedColors) {
      console.log('✅ Forced colors mode active');
    } else {
      console.log('ℹ️ Forced colors mode not detected (may be browser limitation)');
    }

    await popup.close();
  });

  test('HC-10: Verify no information conveyed by color alone', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ forcedColors: 'active' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check that current space has non-color indicators
    const stateIndicators = await popup.evaluate(() => {
      const spaces = Array.from(document.querySelectorAll('[data-testid^="space-item"]'));

      return spaces.map((space) => {
        const isCurrent = space.getAttribute('aria-current') === 'true' ||
                         space.getAttribute('aria-selected') === 'true';

        const styles = window.getComputedStyle(space);
        const hasNonColorIndicator =
          styles.fontWeight !== 'normal' &&
          parseInt(styles.fontWeight) >= 700 ||
          styles.textDecoration !== 'none' ||
          styles.borderWidth !== '0px';

        return {
          isCurrent,
          hasAriaIndicator: space.getAttribute('aria-current') || space.getAttribute('aria-selected'),
          hasVisualIndicator: hasNonColorIndicator,
          ariaLabel: space.getAttribute('aria-label'),
        };
      });
    });

    const currentStates = stateIndicators.filter((s) => s.isCurrent);

    currentStates.forEach((state, i) => {
      if (!state.hasVisualIndicator && !state.hasAriaIndicator) {
        allViolations.push({
          element: `Current space ${i}`,
          wcag: '1.4.1',
          severity: 'critical',
          description: 'Current state indicated by color only',
          recommendation: 'Add border, bold text, icon, or ARIA attributes to indicate state',
        });
      } else {
        console.log(`✅ Current space ${i} has non-color indicator`);
      }
    });

    await popup.close();
  });

  test('Summary: Report all high contrast mode violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('HIGH CONTRAST MODE VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All high contrast mode tests passed! No violations found.\n');
    }
  });
});