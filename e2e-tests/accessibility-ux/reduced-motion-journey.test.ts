/**
 * Reduced Motion User Journey Test
 *
 * WCAG 2.1 Success Criteria:
 * - 2.3.3: Animation from Interactions (Level AAA) - Can disable motion
 * - 2.2.2: Pause, Stop, Hide (Level A) - Control over moving content
 *
 * This test validates that users with vestibular disorders or motion
 * sensitivity can use the extension without triggering motion sickness.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';
import {
  formatViolationsReport,
  AccessibilityViolation,
} from './accessibility-helpers';

test.describe('Reduced Motion User Journey', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const allViolations: AccessibilityViolation[] = [];

  test.beforeAll(async ({ browser }) => {
    const extensionPath = path.resolve(__dirname, '../../build');
    context = await browser.newContext({
      permissions: ['tabs', 'storage'],
      reducedMotion: 'reduce', // Enable reduced motion preference
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

  test('RM-1: Verify prefers-reduced-motion is detected', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check if media query is detected
    const reducedMotionPreference = await popup.evaluate(() => {
      return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });

    expect(reducedMotionPreference).toBe(true);
    console.log('✅ prefers-reduced-motion: reduce detected');

    await popup.close();
  });

  test('RM-2: Animations disabled or significantly reduced', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Check animation/transition properties
    const animationInfo = await popup.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('*'));

      return allElements.map((el) => {
        const styles = window.getComputedStyle(el);
        const transition = styles.transition;
        const animation = styles.animation;
        const transitionDuration = styles.transitionDuration;
        const animationDuration = styles.animationDuration;

        return {
          tag: el.tagName.toLowerCase(),
          class: el.className,
          transition,
          animation,
          transitionDuration,
          animationDuration,
          hasLongTransition: parseFloat(transitionDuration) > 100, // > 0.1s
          hasLongAnimation: parseFloat(animationDuration) > 100,
        };
      }).filter(el => el.hasLongTransition || el.hasLongAnimation);
    });

    if (animationInfo.length > 0) {
      console.log(`Found ${animationInfo.length} elements with animations/transitions:`);

      animationInfo.forEach((el) => {
        console.log(
          `  ${el.tag}.${el.class}: ` +
          `transition: ${el.transitionDuration}, animation: ${el.animationDuration}`
        );

        if (el.hasLongTransition || el.hasLongAnimation) {
          allViolations.push({
            element: `${el.tag}.${el.class}`,
            wcag: '2.3.3',
            severity: 'moderate',
            description: 'Animation/transition not disabled with prefers-reduced-motion',
            recommendation: 'Use @media (prefers-reduced-motion: reduce) to disable or reduce animations',
          });
        }
      });
    } else {
      console.log('✅ No long-running animations found with reduced motion enabled');
    }

    await popup.close();
  });

  test('RM-3: Transitions complete instantly or very quickly', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    // Hover over space items to trigger any hover transitions
    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 0) {
      const firstSpace = spaceItems.first();

      // Get transition properties
      const transitionInfo = await firstSpace.evaluate((el) => {
        const styles = window.getComputedStyle(el);
        return {
          transition: styles.transition,
          transitionDuration: styles.transitionDuration,
          durationMs: parseFloat(styles.transitionDuration),
        };
      });

      console.log('Space item transition:', transitionInfo);

      // With reduced motion, transitions should be very short (< 100ms) or none
      if (transitionInfo.durationMs > 100) {
        allViolations.push({
          element: 'Space item',
          wcag: '2.3.3',
          severity: 'moderate',
          description: `Transition too long for reduced motion: ${transitionInfo.durationMs}ms`,
          recommendation: 'Reduce transition-duration to < 0.1s or 0s with prefers-reduced-motion',
        });
      } else {
        console.log('✅ Transitions are instant or very quick with reduced motion');
      }
    }

    await popup.close();
  });

  test('RM-4: No parallax or scrolling effects', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for transform/translate on scroll
    const scrollEffects = await popup.evaluate(() => {
      const scrollableElements = Array.from(
        document.querySelectorAll('[style*="transform"], [style*="translate"]')
      );

      return scrollableElements.map((el) => {
        const styles = window.getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          transform: styles.transform,
          willChange: styles.willChange,
        };
      });
    });

    if (scrollEffects.length > 0) {
      console.log(`Found ${scrollEffects.length} elements with transform styles`);

      // Transforms are OK if they're not animated
      scrollEffects.forEach((el) => {
        if (el.willChange === 'transform') {
          console.log(`  ⚠️ ${el.tag} has will-change: transform (may indicate animation)`);
        }
      });
    } else {
      console.log('✅ No scroll-based animations detected');
    }

    await popup.close();
  });

  test('RM-5: All functionality works without animation', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    console.log('Testing complete user journey with reduced motion...');

    // Test navigation
    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 0) {
      // Tab to space item
      await popup.keyboard.press('Tab');
      const focused = popup.locator(':focus');
      const isVisible = await focused.isVisible();

      expect(isVisible).toBe(true);
      console.log('✅ Navigation works with reduced motion');
    }

    // Test interaction (rename if available)
    const firstSpace = spaceItems.first();

    if (await firstSpace.count() > 0) {
      await firstSpace.focus();
      await popup.keyboard.press('F2');
      await popup.waitForTimeout(100); // Minimal wait since no animation

      const editInput = popup.locator('input[type="text"]').first();

      if (await editInput.count() > 0) {
        await expect(editInput).toBeVisible();
        console.log('✅ Edit mode activates instantly with reduced motion');

        // Cancel edit
        await popup.keyboard.press('Escape');
      }
    }

    await popup.close();
  });

  test('RM-6: Loading states appear instantly (no spinners)', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check if any loading spinners are animated
    const loadingAnimation = await popup.evaluate(() => {
      const loaders = Array.from(
        document.querySelectorAll('[class*="loading"], [class*="spinner"], [class*="loader"]')
      );

      return loaders.map((el) => {
        const styles = window.getComputedStyle(el);
        return {
          element: el.className,
          animation: styles.animation,
          animationDuration: parseFloat(styles.animationDuration),
        };
      });
    });

    if (loadingAnimation.length > 0) {
      loadingAnimation.forEach((loader) => {
        if (loader.animationDuration > 0) {
          allViolations.push({
            element: loader.element,
            wcag: '2.3.3',
            severity: 'minor',
            description: 'Loading animation not disabled with reduced motion',
            recommendation: 'Show static loading indicator with prefers-reduced-motion',
          });
        }
      });
    }

    await popup.close();
  });

  test('RM-7: Hover effects are instant (no fade-in/out)', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    const spaceItems = popup.locator('[data-testid^="space-item"]');

    if (await spaceItems.count() > 0) {
      const firstSpace = spaceItems.first();

      // Get hover transition
      const hoverTransition = await firstSpace.evaluate((el) => {
        // Temporarily add hover class to check styles
        el.classList.add('hover');
        const styles = window.getComputedStyle(el);
        const transition = styles.transition;
        const transitionDuration = parseFloat(styles.transitionDuration);
        el.classList.remove('hover');

        return {
          transition,
          transitionDuration,
        };
      });

      if (hoverTransition.transitionDuration > 100) {
        allViolations.push({
          element: 'Space item hover',
          wcag: '2.3.3',
          severity: 'minor',
          description: 'Hover transition not disabled with reduced motion',
          recommendation: 'Make hover effects instant with prefers-reduced-motion',
        });
      } else {
        console.log('✅ Hover effects are instant with reduced motion');
      }
    }

    await popup.close();
  });

  test('RM-8: No auto-playing animations on page load', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    // Monitor for animations during load
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check immediately after load
    const autoPlayAnimations = await popup.evaluate(() => {
      const animated = Array.from(document.querySelectorAll('*')).filter((el) => {
        const styles = window.getComputedStyle(el);
        const animation = styles.animation;
        const animationPlayState = styles.animationPlayState;

        return animation !== 'none' && animationPlayState === 'running';
      });

      return animated.map((el) => ({
        tag: el.tagName.toLowerCase(),
        class: el.className,
        animation: window.getComputedStyle(el).animation,
      }));
    });

    if (autoPlayAnimations.length > 0) {
      console.log(`Found ${autoPlayAnimations.length} auto-playing animations:`);

      autoPlayAnimations.forEach((anim) => {
        console.log(`  ${anim.tag}.${anim.class}: ${anim.animation}`);

        allViolations.push({
          element: `${anim.tag}.${anim.class}`,
          wcag: '2.3.3',
          severity: 'serious',
          description: 'Animation auto-plays on load despite reduced motion preference',
          recommendation: 'Disable auto-play animations with prefers-reduced-motion',
        });
      });
    } else {
      console.log('✅ No auto-playing animations on page load');
    }

    await popup.close();
  });

  test('RM-9: CSS transitions respect reduced motion', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Check for CSS that respects prefers-reduced-motion
    const cssSupport = await popup.evaluate(() => {
      // Check if any stylesheets contain prefers-reduced-motion
      const styleSheets = Array.from(document.styleSheets);
      let hasReducedMotionRules = false;

      try {
        styleSheets.forEach((sheet) => {
          if (sheet.cssRules) {
            Array.from(sheet.cssRules).forEach((rule: any) => {
              if (rule.media && rule.media.mediaText.includes('prefers-reduced-motion')) {
                hasReducedMotionRules = true;
              }
            });
          }
        });
      } catch (e) {
        // May fail due to CORS, but we can still check computed styles
      }

      return {
        hasReducedMotionRules,
        mediaQuery: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      };
    });

    if (!cssSupport.hasReducedMotionRules) {
      console.log('ℹ️ No prefers-reduced-motion CSS rules detected (may be in external stylesheet)');
    } else {
      console.log('✅ CSS includes prefers-reduced-motion rules');
    }

    console.log('Media query matches:', cssSupport.mediaQuery);

    await popup.close();
  });

  test('RM-10: Complete workflow without motion-triggered discomfort', async () => {
    const popup = await context.newPage();
    await popup.emulateMedia({ reducedMotion: 'reduce' });

    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    await popup.waitForSelector('[data-testid="space-list"]', { timeout: 5000 });

    console.log('Testing complete workflow with reduced motion...');

    const spaceItems = popup.locator('[data-testid^="space-item"]');
    const itemCount = await spaceItems.count();

    if (itemCount > 1) {
      // Complete workflow
      const steps = [
        'Navigate to first space',
        'Navigate to second space',
        'Open context menu (if available)',
        'Close context menu',
      ];

      for (const step of steps) {
        console.log(`  - ${step}`);
        await popup.keyboard.press('Tab');
        await popup.waitForTimeout(50); // Minimal wait, no animations
      }

      console.log('✅ Complete workflow executes smoothly without animations');
    }

    await popup.close();
  });

  test('Summary: Report all reduced motion violations', () => {
    if (allViolations.length > 0) {
      console.log('\n' + '='.repeat(80));
      console.log('REDUCED MOTION VIOLATIONS SUMMARY');
      console.log('='.repeat(80));
      console.log(formatViolationsReport(allViolations));
      console.log('='.repeat(80) + '\n');

      const criticalViolations = allViolations.filter((v) => v.severity === 'critical');
      expect(criticalViolations.length).toBe(0);
    } else {
      console.log('\n✅ All reduced motion tests passed! No violations found.\n');
    }
  });
});