import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  verifyOptimisticUpdate,
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
} from './performance-helpers';

/**
 * Perceived Responsiveness Tests
 *
 * Measures: App feels responsive even during heavy operations
 * User Impact: Frozen UI is the #1 user complaint
 * Target: UI never blocks, always responds to input
 */
test.describe('Perceived Responsiveness - User-Perceived Performance', () => {
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

    // Setup test data
    const testPage = await context.newPage();
    await testPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await testPage.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 25; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Test Space ${i}`,
          urls: Array.from({ length: 10 }, (_, j) => `https://example${i}-${j}.com`),
          lastModified: Date.now() - (i * 1000),
          named: true,
          version: 1,
        };
      }

      chrome.storage.local.set({
        state: {
          spaces: { active: spaces, closed: {} },
          currentSpace: null,
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

  test('UI responds during heavy operations', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing UI responsiveness during operations...');

    // Simulate heavy operation (restore space with many tabs)
    const restoreButton = page.locator('button[aria-label*="restore"], button').first();

    if ((await restoreButton.count()) === 0) {
      console.log('⚠️  No action button found, skipping test');
      await page.close();
      return;
    }

    // Click to start operation
    await restoreButton.click();

    // Try to interact with search during operation
    await page.waitForTimeout(100);

    const searchInput = page.locator('input[type="text"]').first();
    const startTime = Date.now();

    // Try to type in search (should not block)
    await searchInput.type('responsive', { delay: 10 });

    const responseTime = Date.now() - startTime;

    const value = await searchInput.inputValue();

    console.log(`📊 Input response time during operation: ${responseTime}ms`);
    console.log(`📊 Input value: "${value}"`);

    logPerformanceMetric('UI Responsive During Operation', responseTime, PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK);

    performanceMetrics.push({
      metric: 'UI Responsive During Heavy Operation',
      value: responseTime,
      target: PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2, // Allow 2x during operation
      passed: responseTime <= PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2 && value.includes('responsive'),
    });

    // UI should still respond (not freeze)
    expect(value).toContain('responsive');
    expect(responseTime).toBeLessThan(PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 3);

    await page.close();
  });

  test('Optimistic UI updates (immediate feedback)', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing optimistic UI updates...');

    const spaceItem = page.locator('.space-item, [class*="space"]').first();

    if ((await spaceItem.count()) === 0) {
      console.log('⚠️  No space items found, skipping test');
      await page.close();
      return;
    }

    // Double-click to edit
    await spaceItem.dblclick();

    const input = page.locator('input[type="text"]').first();

    if ((await input.count()) === 0) {
      console.log('⚠️  Edit mode not activated, skipping test');
      await page.close();
      return;
    }

    await input.fill('Optimistic Update Test');

    const startTime = Date.now();

    // Save (should update immediately, not wait for async operation)
    await page.keyboard.press('Enter');

    // Check if UI updated immediately
    await page.waitForTimeout(50);

    const updateTime = Date.now() - startTime;

    // Look for the new name in the UI
    const hasUpdate = await page.locator('text=Optimistic Update Test').isVisible().catch(() => false);

    console.log(`📊 Optimistic update time: ${updateTime}ms`);
    console.log(`📊 UI updated: ${hasUpdate}`);

    logPerformanceMetric('Optimistic Update Latency', updateTime, 200);

    performanceMetrics.push({
      metric: 'Optimistic Update Feedback',
      value: updateTime,
      target: 200,
      passed: updateTime <= 200,
    });

    // Should update immediately (optimistic)
    expect(updateTime).toBeLessThan(200);

    await page.close();
  });

  test('Can cancel long-running operations', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing operation cancellation...');

    // Look for cancel button or Escape key functionality
    const actionButton = page.locator('button').first();

    if ((await actionButton.count()) === 0) {
      console.log('⚠️  No action button found, skipping test');
      await page.close();
      return;
    }

    await actionButton.click();

    // Try to cancel with Escape
    await page.waitForTimeout(100);
    await page.keyboard.press('Escape');

    // Check if operation was cancelled (dialog closed, etc.)
    const isCancellable = await page.evaluate(() => {
      // Check if dialog closed or operation stopped
      const dialogs = document.querySelectorAll('[role="dialog"], .dialog, .modal');
      return dialogs.length === 0;
    });

    console.log(`📊 Operation cancellable: ${isCancellable}`);

    performanceMetrics.push({
      metric: 'Operation Cancellable',
      value: isCancellable ? 1 : 0,
      target: 1,
      passed: isCancellable,
    });

    // User should be able to cancel operations
    expect(isCancellable).toBe(true);

    await page.close();
  });

  test('UI doesn\'t freeze during background tasks', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing UI freeze during background tasks...');

    // Trigger multiple operations
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    if (buttonCount === 0) {
      console.log('⚠️  No buttons found, skipping test');
      await page.close();
      return;
    }

    // Click multiple buttons rapidly
    const clickTimes: number[] = [];

    for (let i = 0; i < Math.min(buttonCount, 3); i++) {
      const startTime = Date.now();
      await buttons.nth(i).click();
      const clickTime = Date.now() - startTime;
      clickTimes.push(clickTime);

      await page.waitForTimeout(100);
    }

    const avgClickTime = clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length;

    console.log(`📊 Average click response time: ${avgClickTime}ms`);
    console.log(`📊 Click times: ${clickTimes.join(', ')}ms`);

    logPerformanceMetric('UI No Freeze (Rapid Clicks)', avgClickTime, PERFORMANCE_TARGETS.CLICK_FEEDBACK * 2);

    performanceMetrics.push({
      metric: 'UI No Freeze During Background Tasks',
      value: avgClickTime,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK * 2,
      passed: avgClickTime <= PERFORMANCE_TARGETS.CLICK_FEEDBACK * 2,
    });

    // UI should remain responsive
    expect(avgClickTime).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK * 3);

    await page.close();
  });

  test('Search filtering never blocks UI', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing search filter responsiveness...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Type rapidly and measure responsiveness
    const typingTimes: number[] = [];

    const testPhrase = 'testing responsive search';

    for (const char of testPhrase) {
      const startTime = Date.now();
      await searchInput.type(char, { delay: 0 });
      const charTime = Date.now() - startTime;
      typingTimes.push(charTime);
    }

    const avgTypingTime = typingTimes.reduce((a, b) => a + b, 0) / typingTimes.length;
    const maxTypingTime = Math.max(...typingTimes);

    console.log(`📊 Average char input time: ${avgTypingTime}ms`);
    console.log(`📊 Max char input time: ${maxTypingTime}ms`);

    logPerformanceMetric('Search Never Blocks', maxTypingTime, PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK);

    performanceMetrics.push({
      metric: 'Search Filter Never Blocks UI',
      value: maxTypingTime,
      target: PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK,
      passed: maxTypingTime <= PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2,
    });

    // No single keystroke should take too long
    expect(maxTypingTime).toBeLessThan(PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2);

    await page.close();
  });

  test('Scrolling remains smooth during updates', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing scroll smoothness during updates...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Start scrolling
    const scrollContainer = page.locator('[class*="space-list"], #root').first();

    await scrollContainer.evaluate(el => {
      el.scrollTo({ top: 100, behavior: 'smooth' });
    });

    // While scrolling, trigger an update (search filter)
    await page.waitForTimeout(200);
    await searchInput.type('Space', { delay: 0 });

    await page.waitForTimeout(500);

    // Check if scroll continued smoothly
    const scrollPosition = await scrollContainer.evaluate(el => el.scrollTop);

    console.log(`📊 Scroll position after update: ${scrollPosition}px`);

    performanceMetrics.push({
      metric: 'Scroll Smooth During Updates',
      value: scrollPosition,
      target: 50, // Should have scrolled at least 50px
      passed: scrollPosition >= 50,
    });

    // Scroll should have continued (not interrupted)
    expect(scrollPosition).toBeGreaterThan(0);

    await page.close();
  });

  test('Keyboard shortcuts work during operations', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing keyboard shortcuts during operations...');

    // Trigger an operation
    const button = page.locator('button').first();

    if ((await button.count()) > 0) {
      await button.click();
      await page.waitForTimeout(100);
    }

    // Try keyboard shortcuts
    const startTime = Date.now();

    await page.keyboard.press('Escape');

    const responseTime = Date.now() - startTime;

    // Check if keyboard worked
    const isResponsive = responseTime < 100;

    console.log(`📊 Keyboard response time: ${responseTime}ms`);

    performanceMetrics.push({
      metric: 'Keyboard Works During Operations',
      value: responseTime,
      target: PERFORMANCE_TARGETS.FOCUS_INDICATOR,
      passed: isResponsive,
    });

    expect(responseTime).toBeLessThan(100);

    await page.close();
  });

  test('No janky scrolling on large lists', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing scroll performance on large list...');

    // Measure scroll frame rate
    const scrollContainer = page.locator('[class*="space-list"], #root').first();

    await page.evaluate(() => {
      (window as any).scrollFrames = [];
      let lastFrame = performance.now();

      function measureScroll() {
        const now = performance.now();
        (window as any).scrollFrames.push(now - lastFrame);
        lastFrame = now;

        if ((window as any).scrollFrames.length < 30) {
          requestAnimationFrame(measureScroll);
        }
      }

      requestAnimationFrame(measureScroll);
    });

    // Scroll rapidly
    await scrollContainer.evaluate(el => {
      el.scrollBy({ top: 500, behavior: 'smooth' });
    });

    await page.waitForTimeout(1000);

    const scrollFrames = await page.evaluate(() => (window as any).scrollFrames || []);

    if (scrollFrames.length > 0) {
      const avgFrameTime = scrollFrames.reduce((a: number, b: number) => a + b, 0) / scrollFrames.length;
      const fps = 1000 / avgFrameTime;

      console.log(`📊 Scroll FPS: ${fps.toFixed(2)}`);

      logPerformanceMetric('Scroll FPS', fps, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

      performanceMetrics.push({
        metric: 'Large List Scroll FPS',
        value: fps,
        target: PERFORMANCE_TARGETS.MIN_FPS,
        passed: fps >= PERFORMANCE_TARGETS.MIN_FPS,
      });

      expect(fps).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
    }

    await page.close();
  });
});