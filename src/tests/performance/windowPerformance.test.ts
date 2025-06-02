import { PerformanceMonitor, generateMockTabs } from './utils/performanceUtils';
import { createMockServices } from './utils/mockServices';

describe('Window Performance Tests', () => {
  const performanceMonitor = new PerformanceMonitor();
  const services = createMockServices();
  
  const THRESHOLDS = {
    WINDOW_CREATE_SMALL: 200,  // 200ms for spaces with <=10 tabs
    WINDOW_CREATE_LARGE: 500,  // 500ms for spaces with >10 tabs
    STATE_SYNC: 100,          // 100ms for state sync
    POPUP_INTERACTION: 16     // 16ms for 60fps smoothness
  };

  beforeEach(() => {
    performanceMonitor.clear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Window Creation Performance', () => {
    test('should create window with single tab within threshold', async () => {
      const urls = ['https://example.com'];
      
      const metric = await performanceMonitor.measureAsync(
        'Window creation (1 tab)',
        async () => {
          await services.windowManager.createWindow(urls);
        },
        THRESHOLDS.WINDOW_CREATE_SMALL
      );

      expect(metric.passed).toBe(true);
      expect(metric.duration).toBeLessThanOrEqual(THRESHOLDS.WINDOW_CREATE_SMALL);
    });

    test('should create window with 10 tabs within threshold', async () => {
      const urls = Array.from({ length: 10 }, (_, i) => `https://example.com/page${i + 1}`);
      
      const metric = await performanceMonitor.measureAsync(
        'Window creation (10 tabs)',
        async () => {
          await services.windowManager.createWindow(urls);
        },
        THRESHOLDS.WINDOW_CREATE_SMALL
      );

      expect(metric.passed).toBe(true);
      expect(metric.duration).toBeLessThanOrEqual(THRESHOLDS.WINDOW_CREATE_SMALL);
    });

    test('should create window with 100 tabs within large threshold', async () => {
      const urls = Array.from({ length: 100 }, (_, i) => `https://example.com/page${i + 1}`);
      
      const metric = await performanceMonitor.measureAsync(
        'Window creation (100 tabs)',
        async () => {
          await services.windowManager.createWindow(urls);
        },
        THRESHOLDS.WINDOW_CREATE_LARGE
      );

      expect(metric.passed).toBe(true);
      expect(metric.duration).toBeLessThanOrEqual(THRESHOLDS.WINDOW_CREATE_LARGE);
    });
  });

  describe('State Synchronization Performance', () => {
    test('should sync state between windows within threshold', async () => {
      // Create two windows
      const window1Urls = ['https://example.com/1'];
      const window2Urls = ['https://example.com/2'];
      
      const window1 = await services.windowManager.createWindow(window1Urls);
      const window2 = await services.windowManager.createWindow(window2Urls);

      if (!window1.id || !window2.id) {
        throw new Error('Window creation failed');
      }

      // Measure state sync performance
      const metric = await performanceMonitor.measureAsync(
        'State sync between windows',
        async () => {
          await services.stateManager.createSpace(window1.id!);
          await services.stateManager.createSpace(window2.id!);
          // Force sync by creating a new space
          await services.stateManager.synchronizeWindowsAndSpaces();
        },
        THRESHOLDS.STATE_SYNC
      );

      expect(metric.passed).toBe(true);
      expect(metric.duration).toBeLessThanOrEqual(THRESHOLDS.STATE_SYNC);
    });
  });

  describe('Popup Interaction Performance', () => {
    test('should maintain responsive popup during heavy state updates', async () => {
      // Create multiple windows and spaces to simulate load
      const windowPromises = Array.from({ length: 10 }, async (_, i) => {
        const urls = [`https://example.com/window${i + 1}`];
        const window = await services.windowManager.createWindow(urls);
        if (!window.id) throw new Error('Window creation failed');
        return window;
      });

      const windows = await Promise.all(windowPromises);

      // Measure popup responsiveness during rapid state updates
      const metric = await performanceMonitor.measureAsync(
        'Popup interaction during state updates',
        async () => {
          // Create spaces for all windows
          await Promise.all(
            windows.map(window => 
              services.stateManager.createSpace(window.id!)
            )
          );

          // Force sync to simulate heavy state updates
          await services.stateManager.synchronizeWindowsAndSpaces();
        },
        THRESHOLDS.POPUP_INTERACTION
      );

      expect(metric.passed).toBe(true);
      expect(metric.duration).toBeLessThanOrEqual(THRESHOLDS.POPUP_INTERACTION);
    });
  });

  afterAll(() => {
    const report = performanceMonitor.generateReport();
    
    // Log detailed performance report
    console.log('\nPerformance Test Report:');
    console.log('=======================');
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passedTests}`);
    console.log(`Failed: ${report.summary.failedTests}`);
    console.log('\nDetailed Metrics:');
    report.metrics.forEach(metric => {
      console.log(`\n${metric.name}:`);
      console.log(`  Duration: ${metric.duration.toFixed(2)}ms`);
      console.log(`  Threshold: ${metric.threshold}ms`);
      console.log(`  Passed: ${metric.passed ? '✓' : '✗'}`);
    });
  });
});