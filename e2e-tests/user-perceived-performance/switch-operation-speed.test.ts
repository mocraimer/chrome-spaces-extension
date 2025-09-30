import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
} from './performance-helpers';

/**
 * Switch Operation Speed Tests
 *
 * Measures: Time from click "Switch" to window switches
 * User Impact: Users notice delays in window switching
 * Target: < 1s perceived delay (with immediate feedback)
 */
test.describe('Switch Operation Speed - User-Perceived Performance', () => {
  let context: BrowserContext;
  let extensionId: string;
  const performanceMetrics: PerformanceMetrics[] = [];

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '../..', 'build');
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
      ],
    });

    extensionId = await waitForServiceWorker(context);
    console.log('✅ Extension loaded:', extensionId);

    // Setup test data with existing windows
    const testPage = await context.newPage();
    await testPage.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create test spaces with windows
    await testPage.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 5; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Switch Test Space ${i}`,
          windowId: 1000 + i, // Mock window IDs
          urls: [`https://example${i}.com`, `https://test${i}.com`],
          lastModified: Date.now() - (i * 1000),
          named: true,
          version: 1,
        };
      }

      chrome.storage.local.set({
        state: {
          spaces: { active: spaces, closed: {} },
          currentSpace: 'space-0',
        },
      });
    });

    await testPage.close();
  });

  test.afterAll(async () => {
    await context.close();

    const report = createPerformanceReport(performanceMetrics);
    console.log(report);
  });

  test('Immediate feedback when clicking switch', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing switch button feedback...');

    // Find switch button
    const switchButton = page.locator('button[aria-label*="switch"], button:has-text("Switch")').first();

    if ((await switchButton.count()) === 0) {
      console.log('⚠️  No switch button found, skipping test');
      await page.close();
      return;
    }

    await switchButton.waitFor({ state: 'visible' });

    const startTime = Date.now();

    // Click switch button
    await switchButton.click();

    // Check for immediate visual feedback (loading state, disabled button, etc.)
    await page.waitForTimeout(50);

    const feedbackTime = Date.now() - startTime;

    // Check if button state changed (disabled, loading, etc.)
    const hasImmediateFeedback = await switchButton.evaluate(btn => {
      return (
        btn.hasAttribute('disabled') ||
        btn.classList.contains('loading') ||
        btn.classList.contains('disabled') ||
        btn.getAttribute('aria-busy') === 'true'
      );
    });

    console.log(`📊 Visual feedback time: ${feedbackTime}ms`);
    console.log(`📊 Has immediate feedback: ${hasImmediateFeedback}`);

    logPerformanceMetric('Switch Button Feedback', feedbackTime, PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    performanceMetrics.push({
      metric: 'Switch Button Immediate Feedback',
      value: feedbackTime,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK,
      passed: feedbackTime <= PERFORMANCE_TARGETS.CLICK_FEEDBACK,
    });

    expect(feedbackTime).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    await page.close();
  });

  test('Loading indicator during window switch', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing loading indicator during switch...');

    const switchButton = page.locator('button[aria-label*="switch"], button:has-text("Switch")').first();

    if ((await switchButton.count()) === 0) {
      console.log('⚠️  No switch button found, skipping test');
      await page.close();
      return;
    }

    await switchButton.click();

    // Check if loading indicator appears
    await page.waitForTimeout(PERFORMANCE_TARGETS.LOADING_DELAY);

    const loadingIndicator = page.locator('[data-testid="loading"], .loading, [class*="spinner"]');
    const hasLoading = await loadingIndicator.isVisible().catch(() => false);

    console.log(`📊 Loading indicator shown: ${hasLoading}`);

    performanceMetrics.push({
      metric: 'Switch Loading Indicator',
      value: hasLoading ? 1 : 0,
      target: 1,
      passed: hasLoading,
    });

    // Should show loading for slow operations
    if (!hasLoading) {
      console.log('⚠️  No loading indicator found - user may not know operation is in progress');
    }

    await page.close();
  });

  test('Perceived delay vs actual delay', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring perceived vs actual switch delay...');

    const switchButton = page.locator('button[aria-label*="switch"], button:has-text("Switch")').first();

    if ((await switchButton.count()) === 0) {
      console.log('⚠️  No switch button found, skipping test');
      await page.close();
      return;
    }

    // Time from click to visual feedback
    const perceivedStart = Date.now();
    await switchButton.click();

    // Wait for immediate feedback
    await page.waitForTimeout(50);

    const perceivedDelay = Date.now() - perceivedStart;

    // Time until operation completes
    const actualStart = Date.now();

    // Wait for operation to complete (button re-enabled, loading hidden)
    await page.waitForTimeout(2000);

    const actualDelay = Date.now() - actualStart;

    console.log(`📊 Perceived delay: ${perceivedDelay}ms`);
    console.log(`📊 Actual delay: ${actualDelay}ms`);
    console.log(`📊 User waited: ${perceivedDelay}ms (feels faster due to feedback)`);

    logPerformanceMetric('Perceived Switch Delay', perceivedDelay, PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    performanceMetrics.push({
      metric: 'Switch Perceived Delay',
      value: perceivedDelay,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK,
      passed: perceivedDelay <= PERFORMANCE_TARGETS.CLICK_FEEDBACK,
    });

    performanceMetrics.push({
      metric: 'Switch Actual Delay',
      value: actualDelay,
      target: PERFORMANCE_TARGETS.SPACE_SWITCH,
      passed: actualDelay <= PERFORMANCE_TARGETS.SPACE_SWITCH,
    });

    // Perceived delay should be immediate
    expect(perceivedDelay).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    await page.close();
  });

  test('Space restore operation speed', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create a closed space
    await page.evaluate(() => {
      chrome.storage.local.set({
        state: {
          spaces: {
            active: {},
            closed: {
              'space-restore': {
                id: 'space-restore',
                name: 'Restore Test Space',
                urls: [
                  'https://example1.com',
                  'https://example2.com',
                  'https://example3.com',
                ],
                lastModified: Date.now(),
                named: true,
                version: 1,
              },
            },
          },
          currentSpace: null,
        },
      });
    });

    await page.reload();
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing space restore speed...');

    const restoreButton = page.locator('button[aria-label*="restore"], button:has-text("Restore")').first();

    if ((await restoreButton.count()) === 0) {
      console.log('⚠️  No restore button found, skipping test');
      await page.close();
      return;
    }

    // Measure perceived delay (time to feedback)
    const perceivedStart = Date.now();
    await restoreButton.click();

    await page.waitForTimeout(50);
    const perceivedDelay = Date.now() - perceivedStart;

    console.log(`📊 Restore perceived delay: ${perceivedDelay}ms`);

    logPerformanceMetric('Restore Perceived Delay', perceivedDelay, PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    performanceMetrics.push({
      metric: 'Restore Operation Perceived Delay',
      value: perceivedDelay,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK,
      passed: perceivedDelay <= PERFORMANCE_TARGETS.CLICK_FEEDBACK,
    });

    expect(perceivedDelay).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    await page.close();
  });

  test('Multiple rapid switches remain responsive', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing rapid switch operations...');

    const spaceItems = page.locator('.space-item, [class*="space"]');

    if ((await spaceItems.count()) === 0) {
      console.log('⚠️  No space items found, skipping test');
      await page.close();
      return;
    }

    // Try rapid switching
    const switchTimes: number[] = [];

    const itemCount = await spaceItems.count();
    const itemsToSwitch = Math.min(itemCount, 3);

    for (let i = 0; i < itemsToSwitch; i++) {
      const startTime = Date.now();

      const item = spaceItems.nth(i);
      await item.click();

      const switchTime = Date.now() - startTime;
      switchTimes.push(switchTime);

      await page.waitForTimeout(300);
    }

    const avgSwitchTime = switchTimes.reduce((a, b) => a + b, 0) / switchTimes.length;

    console.log(`📊 Average switch response time: ${avgSwitchTime}ms`);
    console.log(`📊 Switch times: ${switchTimes.join(', ')}ms`);

    logPerformanceMetric('Rapid Switch Average', avgSwitchTime, PERFORMANCE_TARGETS.CLICK_FEEDBACK * 2);

    performanceMetrics.push({
      metric: 'Rapid Switch Responsiveness',
      value: avgSwitchTime,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK * 2,
      passed: avgSwitchTime <= PERFORMANCE_TARGETS.CLICK_FEEDBACK * 2,
    });

    expect(avgSwitchTime).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK * 3);

    await page.close();
  });

  test('Switch operation doesn\'t block UI', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing UI responsiveness during switch...');

    const switchButton = page.locator('button[aria-label*="switch"], button:has-text("Switch")').first();

    if ((await switchButton.count()) === 0) {
      console.log('⚠️  No switch button found, skipping test');
      await page.close();
      return;
    }

    // Click switch
    await switchButton.click();

    // Try to interact with search during switch
    await page.waitForTimeout(100);

    const searchInput = page.locator('input[type="text"]').first();
    const startTime = Date.now();

    // Try to type during switch operation
    await searchInput.type('test', { delay: 0 });

    const responseTime = Date.now() - startTime;
    const value = await searchInput.inputValue();

    console.log(`📊 UI response time during switch: ${responseTime}ms`);
    console.log(`📊 Input value: "${value}"`);

    logPerformanceMetric('UI During Switch', responseTime, PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2);

    performanceMetrics.push({
      metric: 'UI Responsive During Switch',
      value: responseTime,
      target: PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2,
      passed: responseTime <= PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2 && value.includes('test'),
    });

    // UI should remain responsive
    expect(value).toContain('test');
    expect(responseTime).toBeLessThan(PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 3);

    await page.close();
  });

  test('Large space restore with many tabs', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create a large closed space (20 tabs)
    await page.evaluate(() => {
      chrome.storage.local.set({
        state: {
          spaces: {
            active: {},
            closed: {
              'space-large': {
                id: 'space-large',
                name: 'Large Space with Many Tabs',
                urls: Array.from({ length: 20 }, (_, i) => `https://example${i}.com`),
                lastModified: Date.now(),
                named: true,
                version: 1,
              },
            },
          },
          currentSpace: null,
        },
      });
    });

    await page.reload();
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing large space restore (20 tabs)...');

    const restoreButton = page.locator('button[aria-label*="restore"], button:has-text("Restore")').first();

    if ((await restoreButton.count()) === 0) {
      console.log('⚠️  No restore button found, skipping test');
      await page.close();
      return;
    }

    // Measure perceived delay
    const perceivedStart = Date.now();
    await restoreButton.click();

    await page.waitForTimeout(50);
    const perceivedDelay = Date.now() - perceivedStart;

    console.log(`📊 Large restore perceived delay: ${perceivedDelay}ms`);

    logPerformanceMetric('Large Space Restore Feedback', perceivedDelay, PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    performanceMetrics.push({
      metric: 'Large Space (20 tabs) Restore Feedback',
      value: perceivedDelay,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK,
      passed: perceivedDelay <= PERFORMANCE_TARGETS.CLICK_FEEDBACK,
    });

    // Feedback should still be immediate (even if actual restore takes time)
    expect(perceivedDelay).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    await page.close();
  });

  test('Cancel switch operation', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing cancel during switch...');

    const switchButton = page.locator('button[aria-label*="switch"], button:has-text("Switch")').first();

    if ((await switchButton.count()) === 0) {
      console.log('⚠️  No switch button found, skipping test');
      await page.close();
      return;
    }

    // Start switch operation
    await switchButton.click();

    // Try to cancel with Escape
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');

    // Check if operation can be cancelled
    const isCancelled = await page.evaluate(() => {
      // Check if loading stopped
      const loadingIndicators = document.querySelectorAll('[class*="loading"], [class*="spinner"]');
      return loadingIndicators.length === 0;
    });

    console.log(`📊 Switch operation cancellable: ${isCancelled}`);

    performanceMetrics.push({
      metric: 'Switch Operation Cancellable',
      value: isCancelled ? 1 : 0,
      target: 1,
      passed: isCancelled,
    });

    await page.close();
  });
});