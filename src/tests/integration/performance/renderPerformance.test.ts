import { PerformanceMonitor } from '../../performance/utils/performanceUtils';
import { WindowManager } from '../../../background/services/WindowManager';
import { performance } from 'perf_hooks';
import '../../../tests/performance/setup';

describe('Render Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let windowManager: WindowManager;

  // Performance thresholds
  const WINDOW_CREATE_THRESHOLD = 200; // ms
  const POPUP_RENDER_THRESHOLD = 100; // ms
  const TARGET_FPS = 60;
  const MIN_ACCEPTABLE_FPS = 55;
  const MEMORY_THRESHOLD = 10 * 1024 * 1024; // 10MB

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    windowManager = new WindowManager();
  });

  describe('Window Creation Performance', () => {
    it('should create new windows within time threshold', async () => {
      const result = await performanceMonitor.measureAsync(
        'Window creation time',
        async () => {
          // Create multiple windows to test performance
          const promises = Array.from({ length: 5 }, (_, i) => 
            windowManager.createWindow(
              [`chrome://newtab?id=${i}`],
              {
                width: 800,
                height: 600
              }
            )
          );
          await Promise.all(promises);
        },
        WINDOW_CREATE_THRESHOLD * 5
      );

      expect(result.duration / 5).toBeLessThan(WINDOW_CREATE_THRESHOLD);
      expect(result.passed).toBe(true);
    });
  });

  describe('Popup Render Performance', () => {
    it('should render popup within time threshold', async () => {
      const result = await performanceMonitor.measureAsync(
        'Popup initial render',
        async () => {
          await windowManager.createWindow(
            ['chrome://newtab'],
            {
              type: 'popup',
              width: 400,
              height: 600
            }
          );
        },
        POPUP_RENDER_THRESHOLD
      );

      expect(result.duration).toBeLessThan(POPUP_RENDER_THRESHOLD);
      expect(result.passed).toBe(true);
    });
  });

  describe('Scroll Performance', () => {
    it('should maintain target FPS during scrolling', async () => {
      let frameCount = 0;
      let startTime: number;
      
      // Setup FPS measurement
      const measureFPS = () => {
        frameCount++;
        requestAnimationFrame(measureFPS);
      };

      const result = await performanceMonitor.measureAsync(
        'Scroll performance',
        async () => {
          // Start FPS measurement
          startTime = performance.now();
          requestAnimationFrame(measureFPS);

          // Simulate scrolling operation
          for (let i = 0; i < 100; i += 10) {
            window.dispatchEvent(new Event('scroll'));
            await new Promise(resolve => setTimeout(resolve, 16)); // ~60fps interval
          }

          // Calculate average FPS
          const endTime = performance.now();
          const duration = (endTime - startTime) / 1000; // Convert to seconds
          const fps = frameCount / duration;

          expect(fps).toBeGreaterThanOrEqual(MIN_ACCEPTABLE_FPS);
        },
        1000
      );

      expect(result.passed).toBe(true);
    });
  });

  describe('Memory Leak Detection', () => {
    it('should not increase memory usage significantly after multiple renders', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform multiple render cycles
      for (let i = 0; i < 10; i++) {
        await performanceMonitor.measureAsync(
          `Render cycle ${i + 1}`,
          async () => {
            const popup = await windowManager.createWindow(
              ['chrome://newtab'],
              {
                type: 'popup',
                width: 400,
                height: 600
              }
            );

            await new Promise(resolve => setTimeout(resolve, 100));

            if (popup.id) {
              await windowManager.closeWindow(popup.id);
            }
          },
          500
        );
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      expect(memoryIncrease).toBeLessThan(MEMORY_THRESHOLD);
    });
  });

  afterEach(() => {
    performanceMonitor.clear();
  });

  afterAll(() => {
    const report = performanceMonitor.generateReport();
    console.log('Render Performance Test Results:', JSON.stringify(report, null, 2));
  });
});