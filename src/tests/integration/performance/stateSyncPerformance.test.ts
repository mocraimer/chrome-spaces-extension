import { PerformanceMonitor, generateMockTabs } from '../../performance/utils/performanceUtils';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { WindowManager } from '../../../background/services/WindowManager';
import { StateManager } from '../../../background/services/StateManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { TabManager } from '../../../background/services/TabManager';
import { StateUpdateQueue, StateUpdatePriority } from '../../../background/services/StateUpdateQueue';
import '../../../tests/performance/setup';

describe('State Synchronization Performance Tests', () => {
  let performanceMonitor: PerformanceMonitor;
  let stateBroadcastService: StateBroadcastService;
  let windowManager: WindowManager;
  let stateManager: StateManager;
  let storageManager: StorageManager;
  let tabManager: TabManager;
  let updateQueue: StateUpdateQueue;

  const MEMORY_THRESHOLD = 50 * 1024 * 1024; // 50MB

  beforeEach(() => {
    performanceMonitor = new PerformanceMonitor();
    storageManager = new StorageManager();
    windowManager = new WindowManager();
    tabManager = new TabManager();
    updateQueue = new StateUpdateQueue();
    stateBroadcastService = new StateBroadcastService();
    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      stateBroadcastService
    );
  });

  describe('Combined State Broadcasting and Progressive Loading', () => {
    it('should efficiently broadcast state changes while loading spaces progressively', async () => {
      const result = await performanceMonitor.measureAsync(
        'State broadcast with progressive loading',
        async () => {
          // Generate test dataset
          const mockTabs = generateMockTabs(50);
          
          // Simulate progressive loading of spaces
          for (let i = 0; i < mockTabs.length; i += 10) {
            const windowId = i + 1;
            await stateManager.createSpace(windowId, `Test Space ${i}`);
          }

          // Synchronize all spaces
          await stateManager.synchronizeWindowsAndSpaces();

          // Verify synchronization
          const spaces = stateManager.getAllSpaces();
          expect(Object.keys(spaces).length).toBeGreaterThanOrEqual(5);
        },
        1000
      );

      expect(result.passed).toBe(true);
      expect(result.duration).toBeLessThan(1000);
    });
  });

  describe('Memory Usage Monitoring', () => {
    it('should maintain memory usage within acceptable bounds', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      await performanceMonitor.measureAsync(
        'Memory usage during intensive operations',
        async () => {
          // Create multiple spaces with many tabs
          for (let i = 0; i < 50; i++) {
            const windowId = i + 1;
            await stateManager.createSpace(windowId, `Large Space ${i}`);
          }

          // Force synchronization
          await stateManager.synchronizeWindowsAndSpaces();
          
          // Allow time for garbage collection
          await new Promise(resolve => setTimeout(resolve, 200));
        },
        1000
      );

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
    console.log('Performance Test Results:', JSON.stringify(report, null, 2));
  });
});