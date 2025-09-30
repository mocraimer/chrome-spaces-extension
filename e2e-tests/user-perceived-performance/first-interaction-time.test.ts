import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  measureTimeToInteractive,
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
} from './performance-helpers';

/**
 * First Interaction Time Tests
 *
 * Measures: Time from popup open to first possible user action
 * User Impact: How quickly can user start using the extension
 * Target: < 500ms (feels instant to users)
 */
test.describe('First Interaction Time - User-Perceived Performance', () => {
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
  });

  test.afterAll(async () => {
    await context.close();

    // Print performance report
    const report = createPerformanceReport(performanceMetrics);
    console.log(report);
  });

  test('TTI: Popup becomes interactive within 500ms', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Measuring Time to Interactive (TTI)...');

    // Measure TTI - time until search input is interactive
    const tti = await measureTimeToInteractive(page, extensionId, '#root');

    logPerformanceMetric('Time to Interactive', tti, PERFORMANCE_TARGETS.POPUP_TTI);

    performanceMetrics.push({
      metric: 'Popup Time to Interactive',
      value: tti,
      target: PERFORMANCE_TARGETS.POPUP_TTI,
      passed: tti <= PERFORMANCE_TARGETS.POPUP_TTI,
    });

    // User expectation: Extension should feel instant
    expect(tti).toBeLessThan(PERFORMANCE_TARGETS.POPUP_TTI);

    await page.close();
  });

  test('TTI: Search input focused immediately on load', async () => {
    const page = await context.newPage();

    const startTime = Date.now();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for search input to be visible and focusable
    const searchInput = page.locator('[data-testid="search-input"]').or(page.locator('input[type="text"]').first());

    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // Check if it's auto-focused or can be focused immediately
    const canFocus = await searchInput.evaluate(el => {
      (el as HTMLElement).focus();
      return document.activeElement === el;
    });

    const focusTime = Date.now() - startTime;

    logPerformanceMetric('Search Input Focus Ready', focusTime, PERFORMANCE_TARGETS.SEARCH_READY);

    performanceMetrics.push({
      metric: 'Search Input Focus Ready',
      value: focusTime,
      target: PERFORMANCE_TARGETS.SEARCH_READY,
      passed: focusTime <= PERFORMANCE_TARGETS.SEARCH_READY && canFocus,
    });

    expect(canFocus).toBe(true);
    expect(focusTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_READY);

    await page.close();
  });

  test('TTI: Spaces list renders progressively', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Testing progressive rendering...');

    // Setup test data
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 20; i++) {
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

    // Reload popup to measure initial render with data
    const startTime = Date.now();
    await page.reload();

    // Check for progressive rendering: First item appears quickly
    const firstItem = page.locator('.space-item, [class*="space"]').first();
    await firstItem.waitFor({ state: 'visible', timeout: 5000 });

    const firstItemTime = Date.now() - startTime;

    logPerformanceMetric('First Space Item Visible', firstItemTime, PERFORMANCE_TARGETS.SEARCH_READY);

    performanceMetrics.push({
      metric: 'First Space Item Visible (Progressive Render)',
      value: firstItemTime,
      target: PERFORMANCE_TARGETS.SEARCH_READY,
      passed: firstItemTime <= PERFORMANCE_TARGETS.SEARCH_READY,
    });

    // Progressive rendering should show first items quickly
    expect(firstItemTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_READY);

    // Check that all items eventually load
    const allItems = page.locator('.space-item, [class*="space"]');
    const itemCount = await allItems.count();

    console.log(`📊 Rendered ${itemCount} space items`);
    expect(itemCount).toBeGreaterThan(0);

    await page.close();
  });

  test('TTI: No blank screen during initial load', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Checking for blank screen flashes...');

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Sample screen content at intervals
    const samples: boolean[] = [];

    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(50); // 50ms intervals

      const hasContent = await page.evaluate(() => {
        const body = document.body;
        return body.textContent && body.textContent.trim().length > 0;
      });

      samples.push(hasContent);
    }

    // Calculate how many samples showed content
    const contentSamples = samples.filter(s => s).length;
    const contentPercentage = (contentSamples / samples.length) * 100;

    console.log(`📊 Content visible in ${contentPercentage}% of samples`);

    // At least 70% of samples should show content (no long blank screens)
    expect(contentPercentage).toBeGreaterThan(70);

    await page.close();
  });

  test('TTI: Interaction possible before all resources load', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Testing early interactivity...');

    const startTime = Date.now();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Check if we can interact BEFORE page is fully loaded
    const searchInput = page.locator('input[type="text"]').first();

    // Try to focus and type immediately
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });
    await searchInput.focus();

    const interactionTime = Date.now() - startTime;

    // Try typing
    await searchInput.type('test', { delay: 0 });
    const value = await searchInput.inputValue();

    logPerformanceMetric('Early Interaction Time', interactionTime, PERFORMANCE_TARGETS.SEARCH_READY);

    performanceMetrics.push({
      metric: 'Early Interaction (Before Full Load)',
      value: interactionTime,
      target: PERFORMANCE_TARGETS.SEARCH_READY,
      passed: interactionTime <= PERFORMANCE_TARGETS.SEARCH_READY && value.includes('test'),
    });

    // Should be able to type before everything loads
    expect(value).toContain('test');
    expect(interactionTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_READY);

    await page.close();
  });

  test('TTI: Keyboard shortcuts work immediately', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Testing keyboard shortcut responsiveness...');

    const startTime = Date.now();

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Wait for page to be ready
    await page.waitForLoadState('domcontentloaded');

    const readyTime = Date.now() - startTime;

    // Try keyboard shortcut (e.g., Escape to close, Tab to navigate)
    await page.keyboard.press('Tab');
    await page.waitForTimeout(50);

    // Check if focus moved (keyboard navigation working)
    const focusedElement = await page.evaluate(() => {
      return document.activeElement?.tagName;
    });

    logPerformanceMetric('Keyboard Ready Time', readyTime, PERFORMANCE_TARGETS.SEARCH_READY);

    performanceMetrics.push({
      metric: 'Keyboard Shortcuts Ready',
      value: readyTime,
      target: PERFORMANCE_TARGETS.SEARCH_READY,
      passed: readyTime <= PERFORMANCE_TARGETS.SEARCH_READY && focusedElement !== 'BODY',
    });

    // Keyboard should work quickly
    expect(focusedElement).not.toBe('BODY'); // Focus should have moved
    expect(readyTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_READY);

    await page.close();
  });

  test('TTI: Performance with empty state', async () => {
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

    // Measure TTI with empty state
    const startTime = Date.now();
    await page.reload();

    const root = page.locator('#root');
    await root.waitFor({ state: 'visible', timeout: 5000 });

    const emptyStateTTI = Date.now() - startTime;

    logPerformanceMetric('Empty State TTI', emptyStateTTI, PERFORMANCE_TARGETS.POPUP_TTI);

    performanceMetrics.push({
      metric: 'Empty State Time to Interactive',
      value: emptyStateTTI,
      target: PERFORMANCE_TARGETS.POPUP_TTI,
      passed: emptyStateTTI <= PERFORMANCE_TARGETS.POPUP_TTI,
    });

    // Empty state should load even faster
    expect(emptyStateTTI).toBeLessThan(PERFORMANCE_TARGETS.POPUP_TTI);

    await page.close();
  });
});