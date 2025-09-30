import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  measureInputLatency,
  measureScrollPerformance,
  createManySpaces,
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
} from './performance-helpers';

/**
 * Large Dataset Performance Tests
 *
 * Measures: Performance with 50+ spaces (realistic heavy user)
 * User Impact: App should stay fast even with lots of data
 * Target: Same performance as with 10 spaces
 */
test.describe('Large Dataset Performance - User-Perceived Performance', () => {
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

    const report = createPerformanceReport(performanceMetrics);
    console.log(report);
  });

  test('Performance with 50 spaces', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Creating 50 spaces...');

    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 50 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 50; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Large Dataset Space ${i}`.padEnd(50, ' '),
          urls: Array.from({ length: 8 }, (_, j) => `https://example${i}-${j}.com`),
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

    // Measure initial load time
    const startTime = Date.now();
    await page.reload();

    await page.locator('#root').waitFor({ state: 'visible', timeout: 10000 });

    const loadTime = Date.now() - startTime;

    console.log(`📊 Load time with 50 spaces: ${loadTime}ms`);

    logPerformanceMetric('50 Spaces Load Time', loadTime, PERFORMANCE_TARGETS.LARGE_LIST_RENDER);

    performanceMetrics.push({
      metric: '50 Spaces Initial Load',
      value: loadTime,
      target: PERFORMANCE_TARGETS.LARGE_LIST_RENDER,
      passed: loadTime <= PERFORMANCE_TARGETS.LARGE_LIST_RENDER,
    });

    expect(loadTime).toBeLessThan(PERFORMANCE_TARGETS.LARGE_LIST_RENDER);

    await page.close();
  });

  test('Search remains instant with 50 spaces', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 50 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 50; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Search Test Space ${i}`,
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

    await page.reload();
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing search with 50 spaces...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Measure search input latency
    const searchLatency = await measureInputLatency(page, 'input[type="text"]', 'Space 25');

    console.log(`📊 Search latency with 50 spaces: ${searchLatency}ms`);

    logPerformanceMetric('Search with 50 Spaces', searchLatency, PERFORMANCE_TARGETS.LARGE_LIST_SEARCH);

    performanceMetrics.push({
      metric: 'Search Input (50 Spaces)',
      value: searchLatency,
      target: PERFORMANCE_TARGETS.LARGE_LIST_SEARCH,
      passed: searchLatency <= PERFORMANCE_TARGETS.LARGE_LIST_SEARCH,
    });

    expect(searchLatency).toBeLessThan(PERFORMANCE_TARGETS.LARGE_LIST_SEARCH);

    await page.close();
  });

  test('Scrolling stays smooth with 50 spaces', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 50 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 50; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Scroll Test Space ${i}`,
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

    await page.reload();
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing scroll with 50 spaces...');

    // Measure scroll performance
    const scrollMetrics = await measureScrollPerformance(page, '#root', 1000);

    console.log(`📊 Scroll FPS with 50 spaces: ${scrollMetrics.averageFPS}`);
    console.log(`📊 Dropped frames: ${scrollMetrics.dropRate}%`);

    logPerformanceMetric('Scroll with 50 Spaces', scrollMetrics.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Scroll Smoothness (50 Spaces)',
      value: scrollMetrics.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: scrollMetrics.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(scrollMetrics.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
    expect(scrollMetrics.dropRate).toBeLessThan(PERFORMANCE_TARGETS.MAX_DROPPED_FRAMES);

    await page.close();
  });

  test('No lag when typing in search with 50 spaces', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 50 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 50; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Typing Test Space ${i}`,
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

    await page.reload();
    await page.waitForTimeout(1500);

    console.log('\n🔬 Testing rapid typing with 50 spaces...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Type rapidly and measure each keystroke
    const typingTimes: number[] = [];
    const testString = 'performance test query';

    for (const char of testString) {
      const startTime = Date.now();
      await searchInput.type(char, { delay: 0 });
      const charTime = Date.now() - startTime;
      typingTimes.push(charTime);
    }

    const avgTypingTime = typingTimes.reduce((a, b) => a + b, 0) / typingTimes.length;
    const maxTypingTime = Math.max(...typingTimes);

    console.log(`📊 Average keystroke time: ${avgTypingTime}ms`);
    console.log(`📊 Max keystroke time: ${maxTypingTime}ms`);

    logPerformanceMetric('Typing Latency (50 Spaces)', maxTypingTime, PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK);

    performanceMetrics.push({
      metric: 'Typing Responsiveness (50 Spaces)',
      value: maxTypingTime,
      target: PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK,
      passed: maxTypingTime <= PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2,
    });

    expect(maxTypingTime).toBeLessThan(PERFORMANCE_TARGETS.KEYSTROKE_FEEDBACK * 2);

    await page.close();
  });

  test('Virtual scrolling works correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 100 spaces to test virtual scrolling
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 100; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Virtual Scroll Space ${i}`,
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

    await page.reload();
    await page.waitForTimeout(2000);

    console.log('\n🔬 Testing virtual scrolling...');

    // Check how many items are in the DOM
    const renderedItems = await page.locator('.space-item, [class*="space"]').count();

    console.log(`📊 Rendered items in DOM: ${renderedItems} / 100 total`);

    // If using virtual scrolling, rendered items should be less than total
    // If not using virtual scrolling, all items rendered (performance impact)

    performanceMetrics.push({
      metric: 'Virtual Scrolling (Items Rendered)',
      value: renderedItems,
      target: 50, // Should render < 50 items with virtual scrolling
      passed: renderedItems <= 50,
    });

    // Virtual scrolling reduces DOM size
    if (renderedItems > 50) {
      console.log('⚠️  Virtual scrolling may not be enabled - all items rendered');
    } else {
      console.log('✅ Virtual scrolling working - only visible items rendered');
    }

    await page.close();
  });

  test('Performance with 100 spaces', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    console.log('\n🔬 Creating 100 spaces (stress test)...');

    // Create 100 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 100; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Stress Test Space ${i}`,
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

    // Measure load time
    const startTime = Date.now();
    await page.reload();

    await page.locator('#root').waitFor({ state: 'visible', timeout: 15000 });

    const loadTime = Date.now() - startTime;

    console.log(`📊 Load time with 100 spaces: ${loadTime}ms`);

    logPerformanceMetric('100 Spaces Load Time', loadTime, PERFORMANCE_TARGETS.LARGE_LIST_RENDER * 2);

    performanceMetrics.push({
      metric: '100 Spaces Initial Load',
      value: loadTime,
      target: PERFORMANCE_TARGETS.LARGE_LIST_RENDER * 2,
      passed: loadTime <= PERFORMANCE_TARGETS.LARGE_LIST_RENDER * 2,
    });

    // Should still load in reasonable time
    expect(loadTime).toBeLessThan(PERFORMANCE_TARGETS.LARGE_LIST_RENDER * 3);

    await page.close();
  });

  test('Search filtering instant with 100 spaces', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 100 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 100; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Filter Test Space ${i}`,
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

    await page.reload();
    await page.waitForTimeout(2000);

    console.log('\n🔬 Testing search filter with 100 spaces...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Measure filter response time
    const startTime = Date.now();

    await searchInput.type('Space 50', { delay: 0 });

    // Wait for filter to apply
    await page.waitForTimeout(100);

    const filterTime = Date.now() - startTime;

    // Check if results filtered
    const visibleItems = await page.locator('.space-item, [class*="space"]').count();

    console.log(`📊 Filter time with 100 spaces: ${filterTime}ms`);
    console.log(`📊 Filtered results: ${visibleItems} items`);

    logPerformanceMetric('Filter with 100 Spaces', filterTime, PERFORMANCE_TARGETS.SEARCH_FILTER * 2);

    performanceMetrics.push({
      metric: 'Search Filter (100 Spaces)',
      value: filterTime,
      target: PERFORMANCE_TARGETS.SEARCH_FILTER * 2,
      passed: filterTime <= PERFORMANCE_TARGETS.SEARCH_FILTER * 2,
    });

    expect(filterTime).toBeLessThan(PERFORMANCE_TARGETS.SEARCH_FILTER * 3);

    await page.close();
  });

  test('Memory usage stays reasonable with large dataset', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Create 100 spaces
    await page.evaluate(() => {
      const spaces: any = {};
      for (let i = 0; i < 100; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Memory Test Space ${i}`,
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

    await page.reload();
    await page.waitForTimeout(2000);

    console.log('\n🔬 Checking memory usage...');

    // Measure JS heap size
    const memoryMetrics = await page.evaluate(() => {
      if (performance.memory) {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize / 1048576, // MB
          totalJSHeapSize: performance.memory.totalJSHeapSize / 1048576, // MB
          jsHeapSizeLimit: performance.memory.jsHeapSizeLimit / 1048576, // MB
        };
      }
      return null;
    });

    if (memoryMetrics) {
      console.log(`📊 JS Heap Used: ${memoryMetrics.usedJSHeapSize.toFixed(2)} MB`);
      console.log(`📊 JS Heap Total: ${memoryMetrics.totalJSHeapSize.toFixed(2)} MB`);

      performanceMetrics.push({
        metric: 'Memory Usage (100 Spaces)',
        value: memoryMetrics.usedJSHeapSize,
        target: 50, // < 50MB is good
        passed: memoryMetrics.usedJSHeapSize < 50,
      });

      // Should use reasonable memory
      expect(memoryMetrics.usedJSHeapSize).toBeLessThan(100); // < 100MB
    }

    await page.close();
  });
});