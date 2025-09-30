/**
 * Accessibility Testing Helper Utilities
 * WCAG 2.1 AA Compliant Testing Framework
 */

import { Page, Locator, expect } from '@playwright/test';

/**
 * WCAG 2.1 Success Criteria Coverage
 * - 2.1.1: Keyboard (Level A)
 * - 2.1.2: No Keyboard Trap (Level A)
 * - 2.4.3: Focus Order (Level A)
 * - 2.4.7: Focus Visible (Level AA)
 * - 3.3.2: Labels or Instructions (Level A)
 * - 4.1.2: Name, Role, Value (Level A)
 */

export interface AccessibilityViolation {
  element: string;
  wcag: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  recommendation: string;
}

/**
 * Verify an element is keyboard accessible
 * WCAG 2.1.1: All functionality must be available via keyboard
 */
export async function verifyKeyboardAccessible(
  element: Locator,
  description?: string
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];
  const elementDesc = description || (await element.getAttribute('data-testid')) || 'element';

  try {
    // Check if element is focusable
    const isFocusable = await element.evaluate((el) => {
      const tabIndex = el.getAttribute('tabindex');
      const role = el.getAttribute('role');
      const tag = el.tagName.toLowerCase();

      // Naturally focusable elements
      const focusableTags = ['button', 'a', 'input', 'select', 'textarea'];

      return (
        focusableTags.includes(tag) ||
        tabIndex !== null ||
        (role && ['button', 'link', 'menuitem', 'option'].includes(role))
      );
    });

    if (!isFocusable) {
      violations.push({
        element: elementDesc,
        wcag: '2.1.1',
        severity: 'critical',
        description: 'Interactive element is not keyboard accessible',
        recommendation: 'Add tabindex="0" or use semantic HTML (button, a, input)',
      });
    }

    // Check for click handlers without keyboard support
    const hasClickWithoutKeyboard = await element.evaluate((el) => {
      const hasClick = (el as any).onclick !== null ||
                       el.getAttribute('onclick') !== null;
      const hasKeyHandler = (el as any).onkeydown !== null ||
                           (el as any).onkeyup !== null ||
                           (el as any).onkeypress !== null;

      return hasClick && !hasKeyHandler && el.tagName.toLowerCase() === 'div';
    });

    if (hasClickWithoutKeyboard) {
      violations.push({
        element: elementDesc,
        wcag: '2.1.1',
        severity: 'serious',
        description: 'Element has click handler but no keyboard support',
        recommendation: 'Add keyboard event handlers (onKeyDown) for Enter/Space keys',
      });
    }
  } catch (error) {
    violations.push({
      element: elementDesc,
      wcag: '2.1.1',
      severity: 'critical',
      description: `Failed to verify keyboard accessibility: ${error}`,
      recommendation: 'Ensure element exists and is properly rendered',
    });
  }

  return violations;
}

/**
 * Verify ARIA labels on container and its interactive elements
 * WCAG 4.1.2: Name, Role, Value
 */
export async function verifyARIALabels(
  container: Locator
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    // Get all interactive elements
    const interactiveElements = await container.locator(
      'button, a, input, select, textarea, [role="button"], [role="link"], [role="menuitem"], [role="option"]'
    ).all();

    for (let i = 0; i < interactiveElements.length; i++) {
      const element = interactiveElements[i];
      const hasAccessibleName = await element.evaluate((el) => {
        // Check for accessible name in order of precedence
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');
        const textContent = el.textContent?.trim();
        const title = el.getAttribute('title');
        const altText = el.getAttribute('alt');

        return !!(ariaLabel || ariaLabelledBy || textContent || title || altText);
      });

      if (!hasAccessibleName) {
        const tagName = await element.evaluate((el) => el.tagName.toLowerCase());
        const role = await element.getAttribute('role');

        violations.push({
          element: `${tagName}${role ? `[role="${role}"]` : ''} at index ${i}`,
          wcag: '4.1.2',
          severity: 'critical',
          description: 'Interactive element has no accessible name',
          recommendation: 'Add aria-label, text content, or aria-labelledby',
        });
      }
    }

    // Verify form inputs have labels
    const inputs = await container.locator('input, select, textarea').all();
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const hasLabel = await input.evaluate((el) => {
        const id = el.id;
        const ariaLabel = el.getAttribute('aria-label');
        const ariaLabelledBy = el.getAttribute('aria-labelledby');

        // Check for associated label
        if (id) {
          const label = document.querySelector(`label[for="${id}"]`);
          if (label) return true;
        }

        return !!(ariaLabel || ariaLabelledBy);
      });

      if (!hasLabel) {
        violations.push({
          element: `input at index ${i}`,
          wcag: '3.3.2',
          severity: 'serious',
          description: 'Form input has no associated label',
          recommendation: 'Add <label> element or aria-label attribute',
        });
      }
    }
  } catch (error) {
    violations.push({
      element: 'container',
      wcag: '4.1.2',
      severity: 'critical',
      description: `Failed to verify ARIA labels: ${error}`,
      recommendation: 'Ensure container and elements exist',
    });
  }

  return violations;
}

/**
 * Verify focus management through a complete workflow
 * WCAG 2.4.3: Focus Order
 * WCAG 2.4.7: Focus Visible
 */
export async function verifyFocusManagement(
  page: Page,
  workflow: Array<{ action: string; validator: () => Promise<void> }>
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    for (const step of workflow) {
      // Verify focus is visible before action
      const focusedBefore = page.locator(':focus');
      const hasVisibleFocus = await focusedBefore.evaluate((el) => {
        if (!el) return false;

        const styles = window.getComputedStyle(el);
        const outline = styles.outline;
        const outlineWidth = styles.outlineWidth;
        const boxShadow = styles.boxShadow;

        // Check for visible focus indicator
        return (
          (outline !== 'none' && outlineWidth !== '0px') ||
          boxShadow !== 'none'
        );
      });

      if (!hasVisibleFocus) {
        violations.push({
          element: step.action,
          wcag: '2.4.7',
          severity: 'serious',
          description: 'Focus indicator not visible before action',
          recommendation: 'Add visible outline or box-shadow on :focus',
        });
      }

      // Execute workflow step
      await step.validator();

      // Verify focus didn't disappear
      const hasFocusAfter = await page.evaluate(() => {
        return document.activeElement !== document.body;
      });

      if (!hasFocusAfter) {
        violations.push({
          element: step.action,
          wcag: '2.4.3',
          severity: 'serious',
          description: 'Focus lost after action',
          recommendation: 'Ensure focus is managed programmatically after DOM changes',
        });
      }
    }
  } catch (error) {
    violations.push({
      element: 'workflow',
      wcag: '2.4.3',
      severity: 'critical',
      description: `Focus management verification failed: ${error}`,
      recommendation: 'Review focus management implementation',
    });
  }

  return violations;
}

/**
 * Get all accessibility violations from the page
 * Uses Playwright's accessibility snapshot
 */
export async function getAccessibilityViolations(
  page: Page
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    // Get accessibility tree snapshot
    const snapshot = await page.accessibility.snapshot();

    if (!snapshot) {
      violations.push({
        element: 'page',
        wcag: 'N/A',
        severity: 'critical',
        description: 'Could not generate accessibility tree',
        recommendation: 'Check page rendering and DOM structure',
      });
      return violations;
    }

    // Recursive function to check nodes
    const checkNode = (node: any, path: string = 'root') => {
      // Check for missing names on interactive elements
      if (node.role && ['button', 'link', 'menuitem'].includes(node.role)) {
        if (!node.name) {
          violations.push({
            element: `${path} [role="${node.role}"]`,
            wcag: '4.1.2',
            severity: 'critical',
            description: `${node.role} has no accessible name`,
            recommendation: 'Add aria-label or text content',
          });
        }
      }

      // Check children recursively
      if (node.children) {
        node.children.forEach((child: any, index: number) => {
          checkNode(child, `${path} > ${child.role || 'node'}[${index}]`);
        });
      }
    };

    checkNode(snapshot);
  } catch (error) {
    violations.push({
      element: 'page',
      wcag: 'N/A',
      severity: 'critical',
      description: `Accessibility scan failed: ${error}`,
      recommendation: 'Ensure page is fully loaded before scanning',
    });
  }

  return violations;
}

/**
 * Verify focus trap in a dialog/modal
 * WCAG 2.1.2: No Keyboard Trap (unless intentional)
 */
export async function verifyFocusTrap(
  page: Page,
  dialogLocator: Locator
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    // Verify dialog is visible
    await expect(dialogLocator).toBeVisible();

    // Get all focusable elements in dialog
    const focusableElements = await dialogLocator.locator(
      'button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ).all();

    if (focusableElements.length === 0) {
      violations.push({
        element: 'dialog',
        wcag: '2.1.1',
        severity: 'critical',
        description: 'Dialog has no focusable elements',
        recommendation: 'Ensure dialog contains at least one focusable element',
      });
      return violations;
    }

    // Tab through all elements
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    // Focus first element
    await firstElement.focus();
    await expect(firstElement).toBeFocused();

    // Tab through to last element
    for (let i = 1; i < focusableElements.length; i++) {
      await page.keyboard.press('Tab');
    }

    await expect(lastElement).toBeFocused();

    // Tab once more - should wrap to first element
    await page.keyboard.press('Tab');

    const focusedAfterWrap = page.locator(':focus');
    const isInsideDialog = await dialogLocator.evaluate((dialog, focusedEl) => {
      return dialog.contains(focusedEl as Node);
    }, await focusedAfterWrap.elementHandle());

    if (!isInsideDialog) {
      violations.push({
        element: 'dialog',
        wcag: '2.1.2',
        severity: 'critical',
        description: 'Focus escaped dialog - focus trap not working',
        recommendation: 'Implement focus trap that cycles focus within dialog',
      });
    }

    // Shift+Tab from first should go to last
    await firstElement.focus();
    await page.keyboard.press('Shift+Tab');

    const focusedAfterShiftTab = page.locator(':focus');
    const isStillInDialog = await dialogLocator.evaluate((dialog, focusedEl) => {
      return dialog.contains(focusedEl as Node);
    }, await focusedAfterShiftTab.elementHandle());

    if (!isStillInDialog) {
      violations.push({
        element: 'dialog',
        wcag: '2.1.2',
        severity: 'critical',
        description: 'Focus escaped dialog on Shift+Tab - reverse trap not working',
        recommendation: 'Implement bi-directional focus trap',
      });
    }
  } catch (error) {
    violations.push({
      element: 'dialog',
      wcag: '2.1.2',
      severity: 'critical',
      description: `Focus trap verification failed: ${error}`,
      recommendation: 'Check dialog implementation and focus management',
    });
  }

  return violations;
}

/**
 * Verify color contrast ratios meet WCAG AA standards
 * WCAG 1.4.3: Contrast (Minimum) - 4.5:1 for normal text, 3:1 for large text
 */
export async function verifyColorContrast(
  element: Locator
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    const contrastData = await element.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      const color = styles.color;
      const backgroundColor = styles.backgroundColor;
      const fontSize = parseFloat(styles.fontSize);
      const fontWeight = styles.fontWeight;

      // Helper to parse rgb/rgba to [r, g, b, a]
      const parseColor = (colorStr: string): number[] => {
        const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
        if (!match) return [0, 0, 0, 1];
        return [
          parseInt(match[1]),
          parseInt(match[2]),
          parseInt(match[3]),
          match[4] ? parseFloat(match[4]) : 1,
        ];
      };

      // Calculate relative luminance
      const getLuminance = (rgb: number[]): number => {
        const [r, g, b] = rgb.map((val) => {
          val = val / 255;
          return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
      };

      // Calculate contrast ratio
      const getContrast = (lum1: number, lum2: number): number => {
        const lighter = Math.max(lum1, lum2);
        const darker = Math.min(lum1, lum2);
        return (lighter + 0.05) / (darker + 0.05);
      };

      const fgColor = parseColor(color);
      const bgColor = parseColor(backgroundColor);

      const fgLuminance = getLuminance(fgColor);
      const bgLuminance = getLuminance(bgColor);
      const contrastRatio = getContrast(fgLuminance, bgLuminance);

      // Large text: 18pt+ or 14pt+ bold (roughly 24px+ or 19px+ bold)
      const isLargeText = fontSize >= 24 || (fontSize >= 19 && parseInt(fontWeight) >= 700);

      return {
        color,
        backgroundColor,
        contrastRatio: Math.round(contrastRatio * 100) / 100,
        isLargeText,
        fontSize,
      };
    });

    // WCAG AA requirements
    const requiredRatio = contrastData.isLargeText ? 3 : 4.5;

    if (contrastData.contrastRatio < requiredRatio) {
      violations.push({
        element: await element.getAttribute('data-testid') || 'element',
        wcag: '1.4.3',
        severity: 'serious',
        description: `Insufficient contrast ratio: ${contrastData.contrastRatio}:1 (required: ${requiredRatio}:1)`,
        recommendation: `Increase contrast between foreground (${contrastData.color}) and background (${contrastData.backgroundColor})`,
      });
    }
  } catch (error) {
    violations.push({
      element: 'element',
      wcag: '1.4.3',
      severity: 'moderate',
      description: `Could not verify color contrast: ${error}`,
      recommendation: 'Manual verification may be required',
    });
  }

  return violations;
}

/**
 * Verify screen reader announcements via aria-live regions
 * WCAG 4.1.3: Status Messages
 */
export async function verifyLiveRegionAnnouncements(
  page: Page,
  expectedMessage: string,
  timeout: number = 5000
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    // Look for aria-live regions
    const liveRegions = await page.locator('[aria-live]').all();

    if (liveRegions.length === 0) {
      violations.push({
        element: 'page',
        wcag: '4.1.3',
        severity: 'serious',
        description: 'No aria-live regions found for status announcements',
        recommendation: 'Add aria-live="polite" or "assertive" region for dynamic updates',
      });
      return violations;
    }

    // Check if any live region contains the expected message
    let found = false;
    for (const region of liveRegions) {
      const text = await region.textContent();
      if (text?.includes(expectedMessage)) {
        found = true;
        break;
      }
    }

    if (!found) {
      violations.push({
        element: 'aria-live region',
        wcag: '4.1.3',
        severity: 'moderate',
        description: `Expected message "${expectedMessage}" not announced`,
        recommendation: 'Ensure status messages are inserted into aria-live region',
      });
    }
  } catch (error) {
    violations.push({
      element: 'page',
      wcag: '4.1.3',
      severity: 'moderate',
      description: `Could not verify live region announcements: ${error}`,
      recommendation: 'Check aria-live region implementation',
    });
  }

  return violations;
}

/**
 * Test complete tab navigation order
 * WCAG 2.4.3: Focus Order
 */
export async function verifyTabOrder(
  page: Page,
  expectedOrder: string[]
): Promise<AccessibilityViolation[]> {
  const violations: AccessibilityViolation[] = [];

  try {
    const actualOrder: string[] = [];

    // Focus first element
    await page.keyboard.press('Tab');

    for (let i = 0; i < expectedOrder.length; i++) {
      const focused = page.locator(':focus');
      const identifier = await focused.evaluate((el) => {
        return el.getAttribute('data-testid') ||
               el.getAttribute('aria-label') ||
               el.textContent?.trim() ||
               el.tagName.toLowerCase();
      });

      actualOrder.push(identifier || 'unknown');

      if (i < expectedOrder.length - 1) {
        await page.keyboard.press('Tab');
      }
    }

    // Compare orders
    for (let i = 0; i < expectedOrder.length; i++) {
      if (actualOrder[i] !== expectedOrder[i]) {
        violations.push({
          element: `Position ${i + 1}`,
          wcag: '2.4.3',
          severity: 'serious',
          description: `Tab order incorrect. Expected "${expectedOrder[i]}", got "${actualOrder[i]}"`,
          recommendation: 'Adjust DOM order or tabindex values to match logical order',
        });
      }
    }
  } catch (error) {
    violations.push({
      element: 'page',
      wcag: '2.4.3',
      severity: 'critical',
      description: `Tab order verification failed: ${error}`,
      recommendation: 'Review focusable elements and tab order',
    });
  }

  return violations;
}

/**
 * Format violations report for output
 */
export function formatViolationsReport(violations: AccessibilityViolation[]): string {
  if (violations.length === 0) {
    return '✅ No accessibility violations found';
  }

  const critical = violations.filter((v) => v.severity === 'critical');
  const serious = violations.filter((v) => v.severity === 'serious');
  const moderate = violations.filter((v) => v.severity === 'moderate');
  const minor = violations.filter((v) => v.severity === 'minor');

  let report = `\n❌ ${violations.length} Accessibility Violations Found\n\n`;
  report += `Critical: ${critical.length} | Serious: ${serious.length} | Moderate: ${moderate.length} | Minor: ${minor.length}\n\n`;

  const formatViolation = (v: AccessibilityViolation) => {
    return `  • Element: ${v.element}\n` +
           `    WCAG: ${v.wcag}\n` +
           `    Issue: ${v.description}\n` +
           `    Fix: ${v.recommendation}\n`;
  };

  if (critical.length > 0) {
    report += '🔴 CRITICAL VIOLATIONS:\n';
    critical.forEach((v) => (report += formatViolation(v)));
  }

  if (serious.length > 0) {
    report += '\n🟠 SERIOUS VIOLATIONS:\n';
    serious.forEach((v) => (report += formatViolation(v)));
  }

  if (moderate.length > 0) {
    report += '\n🟡 MODERATE VIOLATIONS:\n';
    moderate.forEach((v) => (report += formatViolation(v)));
  }

  if (minor.length > 0) {
    report += '\n🟢 MINOR VIOLATIONS:\n';
    minor.forEach((v) => (report += formatViolation(v)));
  }

  return report;
}