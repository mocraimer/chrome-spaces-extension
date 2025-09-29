import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

/**
 * Performance Benchmark Tests for Chrome Spaces Extension
 *
 * This test suite establishes performance baselines and verifies that the extension
 * maintains acceptable performance under various load conditions:
 *
 * 1. Large space counts (20+, 50+, 100+)
 * 2. Memory usage monitoring
 * 3. UI responsiveness benchmarks
 * 4. Tab restoration performance
 * 5. Storage operation benchmarks
 * 6. Popup load time metrics
 */
test.describe('Chrome Spaces Performance Benchmarks', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  // Performance baselines (can be adjusted based on requirements)
  const PERFORMANCE_BASELINES = {
    POPUP_LOAD_TIME: 5000,        // 5 seconds max
    SPACE_CREATION_TIME: 2000,    // 2 seconds per space max
    RESTORATION_TIME_PER_TAB: 500, // 500ms per tab max
    LARGE_LIST_SCROLL_TIME: 1000,  // 1 second for scroll operations
    STORAGE_OPERATION_TIME: 1000,  // 1 second for storage ops
    MEMORY_USAGE_LIMIT: 100 * 1024 * 1024, // 100MB rough limit
  };

  /**
   * Robust browser context launch with performance monitoring
   */
  const launchBrowser = async (): Promise<{ context: BrowserContext; extensionId: string }> => {
    const newContext = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
        '--enable-logging=stderr',
        '--vmodule=*/browser/extensions/*=1',
        '--enable-service-worker-script-debugging',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        // Performance monitoring flags
        '--enable-precise-memory-info',
        '--enable-memory-info',
        '--js-flags="--expose-gc"',
      ],
    });

    let [background] = newContext.serviceWorkers();
    if (!background) {
      background = await newContext.waitForEvent('serviceworker', { timeout: 30000 });
    }

    const newExtensionId = background.url().split('/')[2];
    console.log(`[Performance] Extension loaded with ID: ${newExtensionId}`);

    return { context: newContext, extensionId: newExtensionId };
  };

  /**
   * Open popup with performance timing
   */
  const openPopupWithTiming = async (ctx: BrowserContext, extId: string): Promise<{ popup: Page; loadTime: number }> => {
    const startTime = Date.now();

    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Wait for extension to initialize
    await popup.waitForSelector('[data-testid="space-item"], .space-item, text=No spaces', { timeout: 15000 });

    const loadTime = Date.now() - startTime;
    return { popup, loadTime };
  };

  /**
   * Create multiple spaces for performance testing
   */
  const createSpacesWithTiming = async (
    ctx: BrowserContext,
    extId: string,
    spaceCount: number
  ): Promise<{ totalTime: number; averageTime: number }> => {
    const startTime = Date.now();
    const spaceTimes: number[] = [];

    for (let i = 1; i <= spaceCount; i++) {
      const spaceStartTime = Date.now();

      // Create tabs for this space
      const tabUrls = [
        `https://example.com/space-${i}`,
        `https://github.com/space-${i}`,
      ];

      for (const url of tabUrls) {
        const page = await ctx.newPage();
        await page.goto(url, { waitUntil: 'networkidle' });
      }

      // Name the space
      const { popup } = await openPopupWithTiming(ctx, extId);

      const spaceItem = popup.locator('[data-testid="space-item"], .space-item').last();
      await spaceItem.waitFor({ state: 'visible', timeout: 10000 });
      await spaceItem.focus();
      await popup.keyboard.press('F2');

      const nameInput = popup.locator('[data-testid="space-name-input"], input.edit-input');
      await nameInput.waitFor({ state: 'visible', timeout: 5000 });
      await nameInput.fill(`Performance Test Space ${i}`);
      await nameInput.press('Enter');

      await popup.close();

      const spaceTime = Date.now() - spaceStartTime;
      spaceTimes.push(spaceTime);

      // Brief pause to prevent overwhelming
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[Performance] Created ${i}/${spaceCount} spaces`);
      }
    }

    const totalTime = Date.now() - startTime;
    const averageTime = spaceTimes.reduce((sum, time) => sum + time, 0) / spaceTimes.length;

    return { totalTime, averageTime };
  };

  /**
   * Measure memory usage
   */
  const measureMemoryUsage = async (popup: Page): Promise<{ usedJSHeapSize: number; totalJSHeapSize: number }> => {
    return await popup.evaluate(() => {
      if ('memory' in performance) {
        return {
          usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
          totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        };
      }
      return { usedJSHeapSize: 0, totalJSHeapSize: 0 };
    });
  };

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  // =================================================================
  // POPUP LOAD PERFORMANCE TESTS
  // =================================================================

  test('should load popup within performance baseline with no spaces', async () => {
    console.log('[Performance] Testing popup load time with empty state');

    ({ context, extensionId } = await launchBrowser());

    // Measure popup load time with no spaces
    const { popup, loadTime } = await openPopupWithTiming(context, extensionId);

    console.log(`[Performance] Popup load time (empty): ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_BASELINES.POPUP_LOAD_TIME);

    // Measure memory usage
    const memoryUsage = await measureMemoryUsage(popup);
    console.log(`[Performance] Memory usage (empty): ${Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`);

    await popup.close();
  });

  test('should maintain popup load performance with 20+ spaces', async () => {
    console.log('[Performance] Testing popup load time with 20+ spaces');

    ({ context, extensionId } = await launchBrowser());

    // Create 25 spaces
    const spaceCount = 25;
    const { totalTime, averageTime } = await createSpacesWithTiming(context, extensionId, spaceCount);

    console.log(`[Performance] Created ${spaceCount} spaces in ${totalTime}ms (avg: ${Math.round(averageTime)}ms per space)`);

    // Measure popup load time with many spaces
    const { popup, loadTime } = await openPopupWithTiming(context, extensionId);

    console.log(`[Performance] Popup load time (${spaceCount} spaces): ${loadTime}ms`);
    expect(loadTime).toBeLessThan(PERFORMANCE_BASELINES.POPUP_LOAD_TIME);

    // Verify all spaces are displayed
    const spaceItems = popup.locator('[data-testid="space-item"], .space-item');
    const displayedSpaceCount = await spaceItems.count();
    console.log(`[Performance] Displayed ${displayedSpaceCount}/${spaceCount} spaces`);

    expect(displayedSpaceCount).toBeGreaterThanOrEqual(spaceCount * 0.9); // Allow for some variance

    // Measure memory usage with many spaces
    const memoryUsage = await measureMemoryUsage(popup);
    console.log(`[Performance] Memory usage (${spaceCount} spaces): ${Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024)}MB`);

    await popup.close();
  });

  test('should handle scrolling performance with large space lists', async () => {
    console.log('[Performance] Testing scroll performance with large space list');

    ({ context, extensionId } = await launchBrowser());

    // Create 50 spaces for scroll testing
    const spaceCount = 50;
    await createSpacesWithTiming(context, extensionId, spaceCount);

    const { popup } = await openPopupWithTiming(context, extensionId);

    // Test scroll performance
    const scrollStartTime = Date.now();

    // Scroll to bottom
    await popup.keyboard.press('End');
    await popup.waitForTimeout(100);

    // Scroll to top
    await popup.keyboard.press('Home');
    await popup.waitForTimeout(100);

    // Page down scroll
    for (let i = 0; i < 5; i++) {
      await popup.keyboard.press('PageDown');
      await popup.waitForTimeout(50);
    }

    // Page up scroll
    for (let i = 0; i < 5; i++) {
      await popup.keyboard.press('PageUp');
      await popup.waitForTimeout(50);
    }

    const scrollTime = Date.now() - scrollStartTime;
    console.log(`[Performance] Scroll operations completed in ${scrollTime}ms`);

    expect(scrollTime).toBeLessThan(PERFORMANCE_BASELINES.LARGE_LIST_SCROLL_TIME);

    await popup.close();
  });

  // =================================================================
  // SPACE OPERATION PERFORMANCE TESTS
  // =================================================================

  test('should maintain space creation performance under load', async () => {
    console.log('[Performance] Testing space creation performance under load');

    ({ context, extensionId } = await launchBrowser());

    // Test different batch sizes
    const batchSizes = [5, 10, 20];

    for (const batchSize of batchSizes) {
      console.log(`[Performance] Testing batch size: ${batchSize}`);

      const { totalTime, averageTime } = await createSpacesWithTiming(context, extensionId, batchSize);

      console.log(`[Performance] Batch ${batchSize}: ${totalTime}ms total, ${Math.round(averageTime)}ms avg per space`);

      // Average time per space should be reasonable
      expect(averageTime).toBeLessThan(PERFORMANCE_BASELINES.SPACE_CREATION_TIME);

      // Clean up between batches
      const pages = context.pages().filter(page => !page.url().startsWith('chrome-extension://'));
      for (const page of pages) {
        await page.close();
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test('should maintain space restoration performance', async () => {
    console.log('[Performance] Testing space restoration performance');

    ({ context, extensionId } = await launchBrowser());

    // Create spaces with various tab counts
    const spaceConfigs = [
      { name: 'Single Tab Space', tabCount: 1 },
      { name: 'Small Space', tabCount: 3 },
      { name: 'Medium Space', tabCount: 6 },
      { name: 'Large Space', tabCount: 12 },
    ];

    for (const config of spaceConfigs) {
      console.log(`[Performance] Testing restoration: ${config.name} (${config.tabCount} tabs)`);

      // Create space with specified tab count
      const tabUrls = Array.from({ length: config.tabCount }, (_, i) =>
        `https://example.com/${config.name.toLowerCase().replace(/\s+/g, '-')}-tab-${i + 1}`
      );

      const pages = [];
      for (const url of tabUrls) {
        const page = await context.newPage();
        await page.goto(url);
        pages.push(page);
      }

      // Name the space
      const { popup } = await openPopupWithTiming(context, extensionId);
      const spaceItem = popup.locator('[data-testid="space-item"], .space-item').last();
      await spaceItem.focus();
      await popup.keyboard.press('F2');

      const nameInput = popup.locator('[data-testid="space-name-input"], input.edit-input');
      await nameInput.fill(config.name);
      await nameInput.press('Enter');
      await popup.close();

      // Close the space
      for (const page of pages) {
        await page.close();
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      // Measure restoration time
      const restoreStartTime = Date.now();

      const restorePopup = await context.newPage();
      await restorePopup.goto(`chrome-extension://${extensionId}/popup.html`);

      // Find and click restore button
      const closedToggle = restorePopup.locator('button:has-text("Closed"), .toggle-closed');
      if (await closedToggle.isVisible()) {
        await closedToggle.click();
      }

      const restoreButton = restorePopup.locator('button:has-text("Restore")').first();
      if (await restoreButton.isVisible()) {
        await restoreButton.click();

        // Wait for restoration to complete
        await new Promise(resolve => setTimeout(resolve, config.tabCount * 500));

        const restoreTime = Date.now() - restoreStartTime;
        const timePerTab = restoreTime / config.tabCount;

        console.log(`[Performance] ${config.name}: ${restoreTime}ms total, ${Math.round(timePerTab)}ms per tab`);

        expect(timePerTab).toBeLessThan(PERFORMANCE_BASELINES.RESTORATION_TIME_PER_TAB);
      }

      await restorePopup.close();

      // Clean up restored pages
      await new Promise(resolve => setTimeout(resolve, 1000));
      const restoredPages = context.pages().filter(page => !page.url().startsWith('chrome-extension://'));
      for (const page of restoredPages) {
        await page.close();
      }
    }
  });

  // =================================================================
  // STORAGE PERFORMANCE TESTS
  // =================================================================

  test('should maintain storage operation performance', async () => {
    console.log('[Performance] Testing storage operation performance');

    ({ context, extensionId } = await launchBrowser());

    const { popup } = await openPopupWithTiming(context, extensionId);

    // Test various storage operations
    const storageTests = [
      { operation: 'small_write', data: { test: 'small data' } },
      { operation: 'medium_write', data: { test: Array(100).fill('medium data').join(' ') } },
      { operation: 'large_write', data: { test: Array(1000).fill('large data').join(' ') } },
    ];

    for (const storageTest of storageTests) {
      console.log(`[Performance] Testing storage: ${storageTest.operation}`);

      const storageStartTime = Date.now();

      await popup.evaluate(async (data) => {
        await chrome.storage.local.set(data);
      }, storageTest.data);

      const writeTime = Date.now() - storageStartTime;

      // Test read operation
      const readStartTime = Date.now();

      await popup.evaluate(async () => {
        await chrome.storage.local.get(null);
      });

      const readTime = Date.now() - readStartTime;

      console.log(`[Performance] ${storageTest.operation}: write ${writeTime}ms, read ${readTime}ms`);

      expect(writeTime).toBeLessThan(PERFORMANCE_BASELINES.STORAGE_OPERATION_TIME);
      expect(readTime).toBeLessThan(PERFORMANCE_BASELINES.STORAGE_OPERATION_TIME);
    }

    await popup.close();
  });

  // =================================================================
  // MEMORY USAGE BENCHMARKS
  // =================================================================

  test('should maintain reasonable memory usage with large datasets', async () => {
    console.log('[Performance] Testing memory usage with large datasets');

    ({ context, extensionId } = await launchBrowser());

    // Measure baseline memory
    const { popup: baselinePopup } = await openPopupWithTiming(context, extensionId);
    const baselineMemory = await measureMemoryUsage(baselinePopup);
    console.log(`[Performance] Baseline memory: ${Math.round(baselineMemory.usedJSHeapSize / 1024 / 1024)}MB`);
    await baselinePopup.close();

    // Create increasingly large datasets
    const testSizes = [10, 25, 50];

    for (const size of testSizes) {
      console.log(`[Performance] Testing memory with ${size} spaces`);

      await createSpacesWithTiming(context, extensionId, size);

      const { popup } = await openPopupWithTiming(context, extensionId);
      const memoryUsage = await measureMemoryUsage(popup);

      const memoryMB = Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024);
      const memoryIncrease = memoryUsage.usedJSHeapSize - baselineMemory.usedJSHeapSize;
      const memoryIncreaseMB = Math.round(memoryIncrease / 1024 / 1024);

      console.log(`[Performance] ${size} spaces: ${memoryMB}MB total (+${memoryIncreaseMB}MB)`);

      // Memory should not exceed baseline limits
      expect(memoryUsage.usedJSHeapSize).toBeLessThan(PERFORMANCE_BASELINES.MEMORY_USAGE_LIMIT);

      await popup.close();

      // Clean up for next test
      const pages = context.pages().filter(page => !page.url().startsWith('chrome-extension://'));
      for (const page of pages) {
        await page.close();
      }
    }
  });

  // =================================================================
  // CONCURRENT OPERATION PERFORMANCE
  // =================================================================

  test('should handle concurrent operations efficiently', async () => {
    console.log('[Performance] Testing concurrent operation performance');

    ({ context, extensionId } = await launchBrowser());

    // Create some initial spaces
    await createSpacesWithTiming(context, extensionId, 10);

    // Test concurrent popup operations
    const concurrentStartTime = Date.now();

    const concurrentPromises = Array.from({ length: 5 }, async (_, i) => {
      const { popup, loadTime } = await openPopupWithTiming(context, extensionId);

      // Perform operations in each popup
      await popup.waitForSelector('[data-testid="space-item"], .space-item', { timeout: 10000 });

      // Simulate user interactions
      await popup.keyboard.press('ArrowDown');
      await popup.waitForTimeout(100);
      await popup.keyboard.press('ArrowUp');
      await popup.waitForTimeout(100);

      await popup.close();
      return loadTime;
    });

    const concurrentResults = await Promise.all(concurrentPromises);
    const concurrentTotalTime = Date.now() - concurrentStartTime;

    const averageConcurrentTime = concurrentResults.reduce((sum, time) => sum + time, 0) / concurrentResults.length;

    console.log(`[Performance] Concurrent operations: ${concurrentTotalTime}ms total, ${Math.round(averageConcurrentTime)}ms avg load time`);

    // Concurrent operations should not significantly degrade performance
    expect(averageConcurrentTime).toBeLessThan(PERFORMANCE_BASELINES.POPUP_LOAD_TIME * 1.5);
  });

  // =================================================================
  // PERFORMANCE REGRESSION DETECTION
  // =================================================================

  test('should establish performance regression baselines', async () => {
    console.log('[Performance] Establishing regression baselines');

    ({ context, extensionId } = await launchBrowser());

    // Create standardized test dataset
    const standardSpaceCount = 30;
    const { totalTime, averageTime } = await createSpacesWithTiming(context, extensionId, standardSpaceCount);

    // Measure key performance metrics
    const { popup, loadTime } = await openPopupWithTiming(context, extensionId);
    const memoryUsage = await measureMemoryUsage(popup);

    // Record baseline metrics
    const baselineMetrics = {
      spaceCreationTime: averageTime,
      popupLoadTime: loadTime,
      memoryUsageMB: Math.round(memoryUsage.usedJSHeapSize / 1024 / 1024),
      spaceCount: standardSpaceCount,
      timestamp: new Date().toISOString(),
    };

    console.log('[Performance] Baseline Metrics:', JSON.stringify(baselineMetrics, null, 2));

    // Store baseline for future regression testing
    await popup.evaluate(async (metrics) => {
      await chrome.storage.local.set({ performanceBaseline: metrics });
    }, baselineMetrics);

    // Verify metrics are within acceptable ranges
    expect(baselineMetrics.spaceCreationTime).toBeLessThan(PERFORMANCE_BASELINES.SPACE_CREATION_TIME);
    expect(baselineMetrics.popupLoadTime).toBeLessThan(PERFORMANCE_BASELINES.POPUP_LOAD_TIME);
    expect(baselineMetrics.memoryUsageMB).toBeLessThan(PERFORMANCE_BASELINES.MEMORY_USAGE_LIMIT / 1024 / 1024);

    await popup.close();

    console.log('[Performance] ✅ Performance baseline established successfully');
  });
});