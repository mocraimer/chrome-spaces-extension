import { Page, BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Performance Targets - Based on User-Perceived Performance
 * These are what users actually notice, not backend benchmarks
 */
export const PERFORMANCE_TARGETS = {
  // Time to Interactive
  POPUP_TTI: 500,                  // 500ms - feels instant
  SEARCH_READY: 300,               // 300ms - search field ready

  // Input Latency
  KEYSTROKE_FEEDBACK: 100,         // 100ms - imperceptible
  CLICK_FEEDBACK: 100,             // 100ms - button responds

  // Visual Feedback
  HOVER_TRANSITION: 150,           // 150ms - smooth hover
  FOCUS_INDICATOR: 50,             // 50ms - immediate focus

  // Operation Speed
  SEARCH_FILTER: 100,              // 100ms - instant filter
  SPACE_SWITCH: 1000,              // 1s - acceptable for window switch
  SPACE_RESTORE: 2000,             // 2s - acceptable for tab creation

  // Smoothness
  MIN_FPS: 55,                     // 55fps - smooth animations
  MAX_DROPPED_FRAMES: 10,          // <10% dropped - acceptable

  // Loading States
  LOADING_DELAY: 200,              // 200ms - don't show loading immediately
  SKELETON_TIMEOUT: 3000,          // 3s - max time for skeleton

  // Large Datasets
  LARGE_LIST_RENDER: 1000,         // 1s - 100 items render
  LARGE_LIST_SCROLL: 100,          // 100ms - scroll feels smooth
  LARGE_LIST_SEARCH: 150,          // 150ms - search stays instant
};

export interface PerformanceMetrics {
  metric: string;
  value: number;
  target: number;
  passed: boolean;
  percentile?: number;
}

export interface FPSMetrics {
  averageFPS: number;
  minFPS: number;
  maxFPS: number;
  droppedFrames: number;
  totalFrames: number;
  dropRate: number;
}

/**
 * Measure Time to Interactive (TTI)
 * Time from popup open to first user action possible
 */
export async function measureTimeToInteractive(
  page: Page,
  extensionId: string,
  interactiveSelector: string = '[data-testid="search-input"]'
): Promise<number> {
  const startTime = Date.now();

  // Navigate to popup
  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  // Wait for the interactive element
  const interactiveElement = page.locator(interactiveSelector);
  await interactiveElement.waitFor({ state: 'visible', timeout: 10000 });

  // Verify it's truly interactive (can be focused)
  await interactiveElement.focus();
  await page.waitForTimeout(50); // Small delay for focus to settle

  const isFocused = await interactiveElement.evaluate(el => el === document.activeElement);
  if (!isFocused) {
    throw new Error('Element is visible but not focusable - not truly interactive');
  }

  const ttiTime = Date.now() - startTime;

  return ttiTime;
}

/**
 * Measure input latency
 * Time from keystroke to visible change
 */
export async function measureInputLatency(
  page: Page,
  inputSelector: string,
  testInput: string = 'test'
): Promise<number> {
  const input = page.locator(inputSelector);

  // Ensure input is ready
  await input.waitFor({ state: 'visible' });
  await input.focus();

  const startTime = Date.now();

  // Type without delay to measure raw latency
  await input.type(testInput, { delay: 0 });

  // Wait for value to update
  await input.waitFor({ state: 'attached' });

  const latency = Date.now() - startTime;

  // Verify the input actually changed
  const value = await input.inputValue();
  if (!value.includes(testInput)) {
    throw new Error('Input did not update - latency measurement invalid');
  }

  return latency;
}

/**
 * Measure FPS during animation or interaction
 * Returns detailed frame rate metrics
 */
export async function measureFPS(
  page: Page,
  durationMs: number = 1000
): Promise<FPSMetrics> {
  // Inject frame measurement script
  await page.evaluate((duration) => {
    (window as any).frameTimings = [];
    (window as any).measurementComplete = false;

    let lastFrame = performance.now();
    let frameCount = 0;
    const targetFrames = Math.ceil((duration / 1000) * 60); // Expect 60fps

    function measureFrame(timestamp: number) {
      if (frameCount >= targetFrames) {
        (window as any).measurementComplete = true;
        return;
      }

      const frameDuration = timestamp - lastFrame;
      (window as any).frameTimings.push(frameDuration);
      lastFrame = timestamp;
      frameCount++;

      requestAnimationFrame(measureFrame);
    }

    requestAnimationFrame(measureFrame);
  }, durationMs);

  // Wait for measurement to complete
  await page.waitForFunction(
    () => (window as any).measurementComplete === true,
    { timeout: durationMs + 2000 }
  );

  // Get frame timings
  const frameTimings: number[] = await page.evaluate(() => (window as any).frameTimings);

  if (frameTimings.length === 0) {
    throw new Error('No frame timings captured');
  }

  // Calculate metrics
  const totalFrames = frameTimings.length;
  const droppedFrames = frameTimings.filter(timing => timing > 20).length; // >20ms = dropped frame
  const averageFrameTime = frameTimings.reduce((a, b) => a + b, 0) / totalFrames;
  const averageFPS = 1000 / averageFrameTime;

  const minFrameTime = Math.min(...frameTimings);
  const maxFrameTime = Math.max(...frameTimings);
  const maxFPS = 1000 / minFrameTime;
  const minFPS = 1000 / maxFrameTime;

  const dropRate = (droppedFrames / totalFrames) * 100;

  return {
    averageFPS: Math.round(averageFPS * 100) / 100,
    minFPS: Math.round(minFPS * 100) / 100,
    maxFPS: Math.round(maxFPS * 100) / 100,
    droppedFrames,
    totalFrames,
    dropRate: Math.round(dropRate * 100) / 100,
  };
}

/**
 * Measure scroll performance
 * Returns FPS metrics during scrolling
 */
export async function measureScrollPerformance(
  page: Page,
  scrollableSelector: string,
  scrollAmount: number = 1000
): Promise<FPSMetrics> {
  const scrollable = page.locator(scrollableSelector);
  await scrollable.waitFor({ state: 'visible' });

  // Start FPS measurement
  const fpsPromise = measureFPS(page, 2000);

  // Trigger smooth scroll
  await page.evaluate(
    ({ selector, amount }) => {
      const element = document.querySelector(selector);
      if (element) {
        element.scrollTo({ top: amount, behavior: 'smooth' });
      }
    },
    { selector: scrollableSelector, amount: scrollAmount }
  );

  // Get FPS metrics during scroll
  const metrics = await fpsPromise;

  return metrics;
}

/**
 * Verify optimistic UI update
 * Ensures UI responds immediately, not waiting for async operations
 */
export async function verifyOptimisticUpdate(
  page: Page,
  actionSelector: string,
  expectedChangeSelector: string,
  maxLatency: number = 200
): Promise<boolean> {
  const startTime = Date.now();

  // Trigger action
  await page.locator(actionSelector).click();

  // Check for immediate UI change
  try {
    await page.locator(expectedChangeSelector).waitFor({
      state: 'visible',
      timeout: maxLatency,
    });

    const updateTime = Date.now() - startTime;

    return updateTime < maxLatency;
  } catch (error) {
    return false;
  }
}

/**
 * Setup extension context with realistic data
 */
export async function setupPopupWithData(
  context: BrowserContext,
  numSpaces: number = 5
): Promise<string> {
  // Wait for extension to load
  const startTime = Date.now();
  let extensionId = '';

  while (Date.now() - startTime < 10000) {
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const swUrl = serviceWorkers[0].url();
      const urlParts = swUrl.split('/');
      if (urlParts[0] === 'chrome-extension:' && urlParts[2]) {
        extensionId = urlParts[2];
        break;
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  if (!extensionId) {
    throw new Error('Extension not loaded');
  }

  // Create test spaces
  const testPage = await context.newPage();
  await testPage.goto(`chrome-extension://${extensionId}/popup.html`);

  await testPage.evaluate((count) => {
    const spaces: any = {};
    for (let i = 0; i < count; i++) {
      spaces[`space-${i}`] = {
        id: `space-${i}`,
        name: `Test Space ${i}`,
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
  }, numSpaces);

  await testPage.close();

  return extensionId;
}

/**
 * Create performance report
 */
export function createPerformanceReport(metrics: PerformanceMetrics[]): string {
  const passed = metrics.filter(m => m.passed).length;
  const total = metrics.length;
  const passRate = Math.round((passed / total) * 100);

  let report = '\n=== User-Perceived Performance Report ===\n\n';

  report += `Overall: ${passed}/${total} tests passed (${passRate}%)\n\n`;

  for (const metric of metrics) {
    const status = metric.passed ? '✅' : '❌';
    const percentOfTarget = Math.round((metric.value / metric.target) * 100);

    report += `${status} ${metric.metric}\n`;
    report += `   Value: ${metric.value}ms (target: ${metric.target}ms)\n`;
    report += `   Performance: ${percentOfTarget}% of target\n`;

    if (!metric.passed) {
      const overage = metric.value - metric.target;
      report += `   ⚠️  Exceeded target by ${overage}ms\n`;
    }

    report += '\n';
  }

  return report;
}

/**
 * Log performance metric with color coding
 */
export function logPerformanceMetric(
  name: string,
  value: number,
  target: number,
  unit: string = 'ms'
): void {
  const passed = value <= target;
  const icon = passed ? '✅' : '❌';
  const percent = Math.round((value / target) * 100);

  console.log(`${icon} ${name}: ${value}${unit} (target: ${target}${unit}, ${percent}%)`);
}

/**
 * Measure visual feedback latency
 * Time from user action to visual state change
 */
export async function measureVisualFeedback(
  page: Page,
  triggerSelector: string,
  expectedStateSelector: string,
  action: 'click' | 'hover' | 'focus' = 'click'
): Promise<number> {
  const startTime = Date.now();

  // Trigger action
  const trigger = page.locator(triggerSelector);

  switch (action) {
    case 'click':
      await trigger.click();
      break;
    case 'hover':
      await trigger.hover();
      break;
    case 'focus':
      await trigger.focus();
      break;
  }

  // Wait for visual state change
  await page.locator(expectedStateSelector).waitFor({
    state: 'visible',
    timeout: 1000,
  });

  const feedbackLatency = Date.now() - startTime;

  return feedbackLatency;
}

/**
 * Measure loading state UX
 * Verifies loading indicators appear correctly (not too early, not too late)
 */
export async function measureLoadingStateUX(
  page: Page,
  actionSelector: string,
  loadingIndicatorSelector: string,
  minLoadingDelay: number = 200
): Promise<{ showedTooEarly: boolean; neverShowed: boolean; latency: number }> {
  const startTime = Date.now();

  // Trigger slow operation
  await page.locator(actionSelector).click();

  // Check if loading showed too early (bad UX - flash of loading)
  await page.waitForTimeout(minLoadingDelay);

  try {
    const loadingIndicator = page.locator(loadingIndicatorSelector);
    const isVisible = await loadingIndicator.isVisible();

    const showTime = Date.now() - startTime;

    if (isVisible && showTime < minLoadingDelay) {
      return { showedTooEarly: true, neverShowed: false, latency: showTime };
    }

    if (!isVisible) {
      // Wait a bit more to see if it appears
      await loadingIndicator.waitFor({ state: 'visible', timeout: 2000 });
      const finalShowTime = Date.now() - startTime;
      return { showedTooEarly: false, neverShowed: false, latency: finalShowTime };
    }

    return { showedTooEarly: false, neverShowed: false, latency: showTime };
  } catch (error) {
    // Loading indicator never showed
    return { showedTooEarly: false, neverShowed: true, latency: -1 };
  }
}

/**
 * Helper to create many spaces for large dataset testing
 */
export async function createManySpaces(
  context: BrowserContext,
  count: number
): Promise<void> {
  const serviceWorkers = context.serviceWorkers();
  if (serviceWorkers.length === 0) {
    throw new Error('Extension not loaded');
  }

  const swUrl = serviceWorkers[0].url();
  const extensionId = swUrl.split('/')[2];

  const testPage = await context.newPage();
  await testPage.goto(`chrome-extension://${extensionId}/popup.html`);

  await testPage.evaluate((spaceCount) => {
    const spaces: any = {};
    for (let i = 0; i < spaceCount; i++) {
      spaces[`space-${i}`] = {
        id: `space-${i}`,
        name: `Performance Test Space ${i}`.padEnd(50, ' '), // Longer names for realism
        urls: [
          `https://example${i}.com`,
          `https://test${i}.com`,
          `https://demo${i}.com`,
        ],
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
  }, count);

  await testPage.close();
}