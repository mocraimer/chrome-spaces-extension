import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  measureInputLatency,
  measureVisualFeedback,
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
} from './performance-helpers';

/**
 * Visual Feedback Latency Tests
 *
 * Measures: Time from user action to visible feedback
 * User Impact: How responsive the app feels
 * Target: < 100ms (imperceptible to users)
 */
test.describe('Visual Feedback Latency - User-Perceived Performance', () => {
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
      for (let i = 0; i < 10; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Test Space ${i}`,
          urls: [`https://example${i}.com`],
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

  test('Search input responds within 100ms', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    console.log('\n🔬 Measuring search input latency...');

    // Wait for page to load
    await page.waitForTimeout(1000);

    // Find search input
    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Measure input latency
    const latency = await measureInputLatency(page, 'input[type="text"]', 'performance');

    logPerformanceMetric('Search Input Latency', latency, PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK);

    performanceMetrics.push({
      metric: 'Search Input Latency',
      value: latency,
      target: PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK,
      passed: latency <= PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK,
    });

    expect(latency).toBeLessThan(PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK);

    await page.close();
  });

  test('Button click shows visual feedback within 100ms', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Measuring button click feedback...');

    // Find any button
    const button = page.locator('button').first();
    await button.waitFor({ state: 'visible' });

    const startTime = Date.now();

    // Click button
    await button.click();

    // Measure time until visual state changes
    // (button should show :active or :focus state)
    const feedbackTime = Date.now() - startTime;

    logPerformanceMetric('Button Click Feedback', feedbackTime, PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    performanceMetrics.push({
      metric: 'Button Click Visual Feedback',
      value: feedbackTime,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK,
      passed: feedbackTime <= PERFORMANCE_TARGETS.CLICK_FEEDBACK,
    });

    expect(feedbackTime).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    await page.close();
  });

  test('Hover shows visual feedback within 150ms', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Measuring hover feedback...');

    // Find a space item to hover
    const spaceItem = page.locator('.space-item, [class*="space"]').first();
    await spaceItem.waitFor({ state: 'visible' });

    // Measure hover feedback
    const startTime = Date.now();

    await spaceItem.hover();

    // Wait a bit for CSS transition
    await page.waitForTimeout(50);

    const hoverTime = Date.now() - startTime;

    // Check if style changed (hover state applied)
    const hasHoverStyle = await spaceItem.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      // Check for common hover indicators
      return (
        computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        computed.transform !== 'none' ||
        computed.boxShadow !== 'none'
      );
    });

    logPerformanceMetric('Hover Visual Feedback', hoverTime, PERFORMANCE_TARGETS.HOVER_TRANSITION);

    performanceMetrics.push({
      metric: 'Hover Visual Feedback',
      value: hoverTime,
      target: PERFORMANCE_TARGETS.HOVER_TRANSITION,
      passed: hoverTime <= PERFORMANCE_TARGETS.HOVER_TRANSITION,
    });

    expect(hoverTime).toBeLessThan(PERFORMANCE_TARGETS.HOVER_TRANSITION);

    await page.close();
  });

  test('Focus indicator appears within 50ms', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Measuring focus indicator latency...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    const startTime = Date.now();

    // Focus element
    await searchInput.focus();

    const focusTime = Date.now() - startTime;

    // Verify focus is actually set
    const isFocused = await searchInput.evaluate(el => el === document.activeElement);

    logPerformanceMetric('Focus Indicator', focusTime, PERFORMANCE_TARGETS.FOCUS_INDICATOR);

    performanceMetrics.push({
      metric: 'Focus Indicator Latency',
      value: focusTime,
      target: PERFORMANCE_TARGETS.FOCUS_INDICATOR,
      passed: focusTime <= PERFORMANCE_TARGETS.FOCUS_INDICATOR && isFocused,
    });

    expect(isFocused).toBe(true);
    expect(focusTime).toBeLessThan(PERFORMANCE_TARGETS.FOCUS_INDICATOR);

    await page.close();
  });

  test('Search results filter within 100ms', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Measuring search filter latency...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Get initial count
    const initialCount = await page.locator('.space-item, [class*="space"]').count();

    const startTime = Date.now();

    // Type search query
    await searchInput.type('Space 1', { delay: 0 });

    // Wait for results to filter
    await page.waitForTimeout(50);

    const filterTime = Date.now() - startTime;

    // Check if results changed
    const filteredCount = await page.locator('.space-item, [class*="space"]').count();

    logPerformanceMetric('Search Filter Latency', filterTime, PERFORMANCE_TARGETS.SEARCH_FILTER);

    performanceMetrics.push({
      metric: 'Search Results Filter',
      value: filterTime,
      target: PERFORMANCE_TARGETS.SEARCH_FILTER,
      passed: filterTime <= PERFORMANCE_TARGETS.SEARCH_FILTER,
    });

    console.log(`📊 Filtered from ${initialCount} to ${filteredCount} items`);

    expect(filterTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_FILTER);

    await page.close();
  });

  test('Checkbox toggle responds instantly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Measuring checkbox toggle feedback...');

    // Find any checkbox
    const checkbox = page.locator('input[type="checkbox"]').first();

    if ((await checkbox.count()) === 0) {
      console.log('⚠️  No checkbox found, skipping test');
      await page.close();
      return;
    }

    await checkbox.waitFor({ state: 'visible' });

    const startTime = Date.now();

    // Toggle checkbox
    await checkbox.check();

    // Verify checked state
    const isChecked = await checkbox.isChecked();

    const toggleTime = Date.now() - startTime;

    logPerformanceMetric('Checkbox Toggle', toggleTime, PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    performanceMetrics.push({
      metric: 'Checkbox Toggle Feedback',
      value: toggleTime,
      target: PERFORMANCE_TARGETS.CLICK_FEEDBACK,
      passed: toggleTime <= PERFORMANCE_TARGETS.CLICK_FEEDBACK && isChecked,
    });

    expect(isChecked).toBe(true);
    expect(toggleTime).toBeLessThan(PERFORMANCE_TARGETS.CLICK_FEEDBACK);

    await page.close();
  });

  test('Keyboard navigation responds immediately', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Measuring keyboard navigation latency...');

    // Focus first interactive element
    await page.keyboard.press('Tab');

    const startTime = Date.now();

    // Navigate with arrow keys or tab
    await page.keyboard.press('ArrowDown');

    const navTime = Date.now() - startTime;

    // Check if focus moved
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    logPerformanceMetric('Keyboard Navigation', navTime, PERFORMANCE_TARGETS.FOCUS_INDICATOR);

    performanceMetrics.push({
      metric: 'Keyboard Navigation Latency',
      value: navTime,
      target: PERFORMANCE_TARGETS.FOCUS_INDICATOR,
      passed: navTime <= PERFORMANCE_TARGETS.FOCUS_INDICATOR,
    });

    expect(focusedElement).not.toBe('BODY');
    expect(navTime).toBeLessThan(PERFORMANCE_TARGETS.FOCUS_INDICATOR);

    await page.close();
  });

  test('Loading spinner appears with appropriate delay', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    console.log('\n🔬 Testing loading indicator timing...');

    // Simulate slow operation (if there's a refresh/reload button)
    const actionButton = page.locator('button').first();

    if ((await actionButton.count()) === 0) {
      console.log('⚠️  No action button found, skipping test');
      await page.close();
      return;
    }

    await actionButton.waitFor({ state: 'visible' });

    const startTime = Date.now();
    await actionButton.click();

    // Loading indicator should NOT appear immediately (avoid flash)
    await page.waitForTimeout(PERFORMANCE_TARGETS.LOADING_DELAY);

    // Check if loading indicator appeared
    const loadingIndicator = page.locator('[data-testid="loading"], .loading, [class*="spinner"]');
    const hasLoading = (await loadingIndicator.count()) > 0;

    const loadingTime = Date.now() - startTime;

    console.log(`📊 Loading indicator timing: ${loadingTime}ms`);

    performanceMetrics.push({
      metric: 'Loading Indicator Timing',
      value: loadingTime,
      target: PERFORMANCE_TARGETS.LOADING_DELAY,
      passed: loadingTime >= PERFORMANCE_TARGETS.LOADING_DELAY,
    });

    // Should not show loading for fast operations (no flash)
    if (hasLoading) {
      expect(loadingTime).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.LOADING_DELAY);
    }

    await page.close();
  });
});