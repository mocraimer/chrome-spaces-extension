import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';
import { waitForServiceWorker } from '../helpers';
import {
  measureFPS,
  measureScrollPerformance,
  PERFORMANCE_TARGETS,
  logPerformanceMetric,
  PerformanceMetrics,
  createPerformanceReport,
  FPSMetrics,
} from './performance-helpers';

/**
 * Animation Smoothness Tests
 *
 * Measures: Frame rate during animations and interactions
 * User Impact: Jank and stuttering ruin the UX
 * Target: 55+ FPS (smooth to users)
 */
test.describe('Animation Smoothness - User-Perceived Performance', () => {
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
      for (let i = 0; i < 30; i++) {
        spaces[`space-${i}`] = {
          id: `space-${i}`,
          name: `Performance Test Space ${i}`,
          urls: [`https://example${i}.com`, `https://test${i}.com`],
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

  test('Hover transitions maintain 60fps', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring hover animation smoothness...');

    const spaceItem = page.locator('.space-item, [class*="space"]').first();
    await spaceItem.waitFor({ state: 'visible' });

    // Start FPS measurement and trigger hover
    const fpsPromise = measureFPS(page, 1000);

    // Hover multiple times during measurement
    await spaceItem.hover();
    await page.waitForTimeout(300);
    await page.mouse.move(0, 0); // Move away
    await page.waitForTimeout(300);
    await spaceItem.hover();
    await page.waitForTimeout(400);

    const fpsMetrics: FPSMetrics = await fpsPromise;

    console.log(`📊 Hover FPS Metrics:`);
    console.log(`   Average FPS: ${fpsMetrics.averageFPS}`);
    console.log(`   Min FPS: ${fpsMetrics.minFPS}`);
    console.log(`   Dropped frames: ${fpsMetrics.droppedFrames}/${fpsMetrics.totalFrames} (${fpsMetrics.dropRate}%)`);

    logPerformanceMetric('Hover Animation FPS', fpsMetrics.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Hover Animation Smoothness',
      value: fpsMetrics.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: fpsMetrics.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(fpsMetrics.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
    expect(fpsMetrics.dropRate).toBeLessThan(PERFORMANCE_TARGETS.MAX_DROPPED_FRAMES);

    await page.close();
  });

  test('List scrolling is jank-free', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring scroll smoothness...');

    // Find scrollable container
    const scrollableContainer = page.locator('[class*="space-list"], .space-container, #root').first();
    await scrollableContainer.waitFor({ state: 'visible' });

    // Measure scroll performance
    const scrollMetrics = await measureScrollPerformance(page, '[class*="space-list"], .space-container, #root', 500);

    console.log(`📊 Scroll FPS Metrics:`);
    console.log(`   Average FPS: ${scrollMetrics.averageFPS}`);
    console.log(`   Min FPS: ${scrollMetrics.minFPS}`);
    console.log(`   Dropped frames: ${scrollMetrics.droppedFrames}/${scrollMetrics.totalFrames} (${scrollMetrics.dropRate}%)`);

    logPerformanceMetric('Scroll FPS', scrollMetrics.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'List Scroll Smoothness',
      value: scrollMetrics.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: scrollMetrics.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(scrollMetrics.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
    expect(scrollMetrics.dropRate).toBeLessThan(PERFORMANCE_TARGETS.MAX_DROPPED_FRAMES);

    await page.close();
  });

  test('Dialog open/close animations smooth', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring dialog animation smoothness...');

    // Find button that opens dialog (settings, export, etc.)
    const dialogTrigger = page.locator('button[aria-label*="settings"], button[aria-label*="menu"], button').first();

    if ((await dialogTrigger.count()) === 0) {
      console.log('⚠️  No dialog trigger found, skipping test');
      await page.close();
      return;
    }

    await dialogTrigger.waitFor({ state: 'visible' });

    // Measure FPS during dialog open
    const fpsPromise = measureFPS(page, 800);

    await dialogTrigger.click();
    await page.waitForTimeout(800);

    const dialogFPS = await fpsPromise;

    console.log(`📊 Dialog Animation FPS: ${dialogFPS.averageFPS}`);

    logPerformanceMetric('Dialog Animation FPS', dialogFPS.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Dialog Open Animation',
      value: dialogFPS.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: dialogFPS.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(dialogFPS.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);

    await page.close();
  });

  test('No layout shifts during load', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Measuring Cumulative Layout Shift (CLS)...');

    // Inject CLS tracking
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Track layout shifts
    const clsScore = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let cls = 0;

        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if ((entry as any).hadRecentInput) {
              continue; // Ignore user-initiated shifts
            }
            cls += (entry as any).value;
          }
        });

        observer.observe({ type: 'layout-shift', buffered: true });

        // Measure for 2 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(cls);
        }, 2000);
      });
    });

    console.log(`📊 Cumulative Layout Shift: ${clsScore.toFixed(4)}`);

    performanceMetrics.push({
      metric: 'Cumulative Layout Shift (CLS)',
      value: clsScore,
      target: 0.1, // Good CLS score
      passed: clsScore < 0.1,
    });

    // Good CLS score is < 0.1
    expect(clsScore).toBeLessThan(0.25); // Allow some layout shift during initial load

    await page.close();
  });

  test('Fast keyboard navigation (no frame drops)', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring keyboard navigation smoothness...');

    // Start FPS measurement
    const fpsPromise = measureFPS(page, 1500);

    // Rapid keyboard navigation
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
    }

    const keyboardFPS = await fpsPromise;

    console.log(`📊 Keyboard Navigation FPS: ${keyboardFPS.averageFPS}`);

    logPerformanceMetric('Keyboard Navigation FPS', keyboardFPS.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Keyboard Navigation Smoothness',
      value: keyboardFPS.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: keyboardFPS.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(keyboardFPS.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);

    await page.close();
  });

  test('Search filtering maintains smooth framerate', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring search filter animation smoothness...');

    const searchInput = page.locator('input[type="text"]').first();
    await searchInput.waitFor({ state: 'visible' });

    // Start FPS measurement
    const fpsPromise = measureFPS(page, 1500);

    // Type search query to trigger filtering animation
    await searchInput.type('Space', { delay: 100 });

    await page.waitForTimeout(300);

    // Clear search
    await searchInput.clear();
    await searchInput.type('Test', { delay: 100 });

    const searchFPS = await fpsPromise;

    console.log(`📊 Search Filter FPS: ${searchFPS.averageFPS}`);

    logPerformanceMetric('Search Filter Animation FPS', searchFPS.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Search Filter Animation',
      value: searchFPS.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: searchFPS.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(searchFPS.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);

    await page.close();
  });

  test('Rapid interactions maintain performance', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1500);

    console.log('\n🔬 Measuring rapid interaction smoothness...');

    const spaceItems = page.locator('.space-item, [class*="space"]');
    await spaceItems.first().waitFor({ state: 'visible' });

    // Start FPS measurement
    const fpsPromise = measureFPS(page, 2000);

    // Rapid hover interactions
    const itemCount = await spaceItems.count();
    const itemsToHover = Math.min(itemCount, 10);

    for (let i = 0; i < itemsToHover; i++) {
      await spaceItems.nth(i).hover();
      await page.waitForTimeout(150);
    }

    const rapidFPS = await fpsPromise;

    console.log(`📊 Rapid Interaction FPS: ${rapidFPS.averageFPS}`);
    console.log(`📊 Dropped frames: ${rapidFPS.dropRate}%`);

    logPerformanceMetric('Rapid Interaction FPS', rapidFPS.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Rapid Interaction Smoothness',
      value: rapidFPS.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: rapidFPS.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(rapidFPS.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);
    expect(rapidFPS.dropRate).toBeLessThan(PERFORMANCE_TARGETS.MAX_DROPPED_FRAMES);

    await page.close();
  });

  test('Page transitions are smooth', async () => {
    const page = await context.newPage();

    console.log('\n🔬 Measuring page transition smoothness...');

    // Navigate to popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);

    // Measure FPS during initial load/transition
    await page.waitForTimeout(200);
    const transitionFPS = await measureFPS(page, 1000);

    console.log(`📊 Page Transition FPS: ${transitionFPS.averageFPS}`);

    logPerformanceMetric('Page Transition FPS', transitionFPS.averageFPS, PERFORMANCE_TARGETS.MIN_FPS, 'fps');

    performanceMetrics.push({
      metric: 'Page Transition Smoothness',
      value: transitionFPS.averageFPS,
      target: PERFORMANCE_TARGETS.MIN_FPS,
      passed: transitionFPS.averageFPS >= PERFORMANCE_TARGETS.MIN_FPS,
    });

    expect(transitionFPS.averageFPS).toBeGreaterThanOrEqual(PERFORMANCE_TARGETS.MIN_FPS);

    await page.close();
  });
});