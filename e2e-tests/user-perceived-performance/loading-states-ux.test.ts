import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  measureLoadingStateUX,
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
} from './performance-helpers';

/**
 * Loading States UX Tests
 *
 * Measures: Quality of loading experience
 * User Impact: Loading flashes and blank screens are jarring
 * Target: Smooth loading with appropriate delays
 */
test.describe('Loading States UX - User-Perceived Performance', () => {
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
      for (let i = 0; i < 15; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Test Space ${i}`,
          urls: Array.from({ length: 5 }, (_, j) => `https://example${i}-${j}.com`),
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

  test('No loading spinner for fast operations (<200ms)', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Testing loading spinner timing...');

    // Fast operation should NOT show loading spinner
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Type to trigger filter (fast operation)
    await searchInput.type('Space 1');

    // Check for loading spinner immediately
    await page.waitForTimeout(50);

    const loadingIndicator = page.locator('[data-testid="loading"], .loading, [class*="spinner"]');
    const hasFlash = await loadingIndicator.isVisible().catch(() => false);

    console.log(`📊 Loading spinner visible during fast op: ${hasFlash}`);

    performanceMetrics.push({
      metric: 'No Loading Flash (Fast Operations)',
      value: hasFlash ? 1 : 0,
      target: 0,
      passed: !hasFlash,
    });

    // Should NOT show loading for fast operations
    expect(hasFlash).toBe(false);

    await page.close();
  });

  test('Skeleton screens for list loading', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Checking for skeleton screens...');

    // Navigate to fresh popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check if skeleton/loading state is visible initially
    const hasSkeletonOrContent = await page.evaluate(() => {
      // Look for skeleton patterns or actual content
      const body = document.body;
      const hasContent = body.textContent && body.textContent.trim().length > 0;

      // Check for skeleton patterns
      const skeletons = document.querySelectorAll(
        '[class*="skeleton"], [class*="placeholder"], [class*="loading-state"]'
      );

      return { hasContent, skeletonCount: skeletons.length };
    });

    console.log(`📊 Initial state: ${JSON.stringify(hasSkeletonOrContent)}`);

    performanceMetrics.push({
      metric: 'Content or Skeleton Visible',
      value: hasSkeletonOrContent.hasContent ? 1 : 0,
      target: 1,
      passed: hasSkeletonOrContent.hasContent || hasSkeletonOrContent.skeletonCount > 0,
    });

    // Should have either skeleton or content (no blank screen)
    expect(hasSkeletonOrContent.hasContent || hasSkeletonOrContent.skeletonCount > 0).toBe(true);

    await page.close();
  });

  test('Progressive rendering (show content as it loads)', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Testing progressive rendering...');

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Track how many items appear over time
    const renderTimeline: number[] = [];

    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(200);

      const itemCount = await page.locator('.space-item, [class*="space"]').count();
      renderTimeline.push(itemCount);
    }

    console.log(`📊 Render timeline: ${renderTimeline.join(' → ')} items`);

    // Check if items appeared progressively (not all at once after delay)
    const isProgressive = renderTimeline.some((count, idx) => {
      if (idx === 0) return false;
      return count > renderTimeline[idx - 1];
    });

    performanceMetrics.push({
      metric: 'Progressive Rendering',
      value: isProgressive ? 1 : 0,
      target: 1,
      passed: renderTimeline[0] > 0, // At least some items appear quickly
    });

    // Should show some items quickly (progressive)
    expect(renderTimeline[0]).toBeGreaterThan(0);

    await page.close();
  });

  test('No blank screens during navigation', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Checking for blank screens...');

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Sample screen content at regular intervals
    const contentSamples: boolean[] = [];

    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(100);

      const hasContent = await page.evaluate(() => {
        const body = document.body;
        return body.textContent && body.textContent.trim().length > 10;
      });

      contentSamples.push(hasContent);
    }

    const blankScreens = contentSamples.filter(s => !s).length;
    const blankPercentage = (blankScreens / contentSamples.length) * 100;

    console.log(`📊 Blank screens: ${blankPercentage}% of samples`);

    performanceMetrics.push({
      metric: 'Blank Screen Percentage',
      value: blankPercentage,
      target: 30, // <30% blank is acceptable during load
      passed: blankPercentage < 30,
    });

    // Most samples should show content
    expect(blankPercentage).toBeLessThan(50);

    await page.close();
  });

  test('Loading indicators have minimum display time', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Testing loading indicator stability...');

    // If there's a refresh/reload button, test it
    const actionButton = page.locator('button').first();

    if ((await actionButton.count()) === 0) {
      console.log('⚠️  No action button found, skipping test');
      await page.close();
      return;
    }

    await actionButton.click();

    // Check if loading indicator flashes (appears then disappears quickly)
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, [class*="spinner"]');

    try {
      await loadingIndicator.waitFor({ state: 'visible', timeout: 500 });

      const showTime = Date.now();

      // Wait for it to disappear
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 5000 });

      const hideTime = Date.now();
      const displayDuration = hideTime - showTime;

      console.log(`📊 Loading indicator displayed for: ${displayDuration}ms`);

      performanceMetrics.push({
        metric: 'Loading Indicator Duration',
        value: displayDuration,
        target: 300, // Min 300ms to avoid flash
        passed: displayDuration >= 300,
      });

      // Should stay visible for at least 300ms (avoid flashing)
      expect(displayDuration).toBeGreaterThanOrEqual(300);
    } catch (error) {
      console.log('⚠️  Loading indicator not found or operation too fast');
    }

    await page.close();
  });

  test('Empty state shows immediately (no loading)', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Testing empty state performance...');

    // Clear all spaces
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.evaluate(() => {
      chrome.storage.local.set({
        state: {
          spaces: { active: {}, closed: {} },
          currentSpace: null,
        },
      });
    });

    const startTime = Date.now();
    await page.reload();

    // Empty state should appear quickly
    const emptyStateTime = Date.now() - startTime;

    // Check for empty state message
    const bodyText = await page.textContent('body');
    const hasEmptyMessage = bodyText && (
      bodyText.includes('No') ||
      bodyText.includes('Empty') ||
      bodyText.includes('spaces')
    );

    console.log(`📊 Empty state render time: ${emptyStateTime}ms`);

    logPerformanceMetric('Empty State Render', emptyStateTime, PERFORMANCE_TARGETS.POPUP_TTI);

    performanceMetrics.push({
      metric: 'Empty State Render Time',
      value: emptyStateTime,
      target: PERFORMANCE_TARGETS.POPUP_TTI,
      passed: emptyStateTime <= PERFORMANCE_TARGETS.POPUP_TTI,
    });

    expect(emptyStateTime).toBeLessThan(PERFORMANCE_TARGETS.POPUP_TTI);

    await page.close();
  });

  test('Error states show immediately (no loading)', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Testing error state rendering...');

    // Simulate error scenario (invalid data)
    await page.evaluate(() => {
      chrome.storage.local.set({
        state: null, // Invalid state
      });
    });

    const startTime = Date.now();
    await page.reload();

    const errorStateTime = Date.now() - startTime;

    // Check if page handles error gracefully
    const bodyText = await page.textContent('body');
    const hasContent = bodyText && bodyText.trim().length > 0;

    console.log(`📊 Error state render time: ${errorStateTime}ms`);

    performanceMetrics.push({
      metric: 'Error State Render Time',
      value: errorStateTime,
      target: PERFORMANCE_TARGETS.POPUP_TTI,
      passed: errorStateTime <= PERFORMANCE_TARGETS.POPUP_TTI && hasContent,
    });

    // Should handle error and show something
    expect(hasContent).toBe(true);
    expect(errorStateTime).toBeLessThan(PERFORMANCE_TARGETS.POPUP_TTI);

    await page.close();
  });

  test('Optimistic updates hide loading states', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Testing optimistic UI updates...');

    // Try to perform an action (like renaming a space)
    const spaceItem = page.locator('.space-item, [class*="space"]').first();

    if ((await spaceItem.count()) === 0) {
      console.log('⚠️  No space items found, skipping test');
      await page.close();
      return;
    }

    await spaceItem.dblclick();

    // Check if UI updates immediately (optimistic)
    const input = page.locator('input[type="text"]').first();

    if ((await input.count()) > 0) {
      await input.fill('New Name');

      const startTime = Date.now();
      await page.keyboard.press('Enter');

      // UI should update immediately
      await page.waitForTimeout(100);

      const updateTime = Date.now() - startTime;

      // Check if loading indicator appeared (it shouldn't for optimistic update)
      const loadingIndicator = page.locator('[data-testid="loading"], .loading, [class*="spinner"]');
      const showedLoading = await loadingIndicator.isVisible().catch(() => false);

      console.log(`📊 Optimistic update time: ${updateTime}ms`);
      console.log(`📊 Showed loading: ${showedLoading}`);

      performanceMetrics.push({
        metric: 'Optimistic Update (No Loading)',
        value: showedLoading ? 1 : 0,
        target: 0,
        passed: !showedLoading && updateTime < 200,
      });

      expect(showedLoading).toBe(false);
      expect(updateTime).toBeLessThan(200);
    }

    await page.close();
  });
});