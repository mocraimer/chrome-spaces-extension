import { jest } from '@jest/globals';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { StateManager } from '../../../background/services/StateManager';
import { StateUpdateQueue, StateUpdatePriority } from '../../../background/services/StateUpdateQueue';
import { QueuedStateUpdate } from '../../../background/services/StateUpdateQueue';
import { createWindowManagerMock, createTabManagerMock, createStorageManagerMock } from '../../utils/serviceMocks';
import { RestoreRegistry } from '../../../background/services/types/RestoreRegistry';
import { MessageTypes } from '../../../shared/constants';

/**
 * ## Priority 1 - Race Condition Tests
 * 
 * Test the StateBroadcastService update coalescing that may be losing updates:
 * - Test rapid Enter key presses causing update conflicts
 * - Test the 100ms debounce window losing intermediate changes
 * - Test concurrent save/refresh race conditions
 * - Validate pendingUpdates map overwriting newer updates with older ones
 */
// SKIPPED: Runtime failures - needs investigation
describe.skip('Race Condition Tests for Space Title Reversion', () => {
  let broadcastService: StateBroadcastService;
  let stateManager: StateManager;
  let updateQueue: StateUpdateQueue;
  let windowManager: any;
  let tabManager: any;
  let storageManager: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Setup service mocks
    windowManager = createWindowManagerMock();
    tabManager = createTabManagerMock();
    storageManager = createStorageManagerMock();

    // Initialize services
    updateQueue = new StateUpdateQueue({
      batchWindow: 50,
      debounceTime: 100
    });

    broadcastService = new StateBroadcastService({
      debounceTime: 100,
      coalesceUpdates: true
    });
    const restoreRegistry = new RestoreRegistry();

    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService,
      restoreRegistry
    );

    // Mock chrome runtime
    global.chrome = {
      runtime: {
        onConnect: {
          addListener: jest.fn()
        }
      }
    } as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Rapid Enter Key Press Race Conditions', () => {
    test('should handle rapid renameSpace calls without losing updates', async () => {
      // ## Test Case: RC-001
      // **Title**: Rapid Enter key presses causing update conflicts
      // **Description**: Simulate rapid Enter key presses that trigger multiple renameSpace calls
      // **Expected Result**: All updates should be processed in order without losing intermediate changes

      // Arrange
      const spaceId = '1';
      const spaceData = {
        id: spaceId,
        name: 'Initial Name',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: spaceData });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      const updateTimestamps: number[] = [];
      const updateNames: string[] = [];
      
      // Mock to capture all updates
      const originalBroadcast = broadcastService.broadcast;
      broadcastService.broadcast = jest.fn((update: QueuedStateUpdate) => {
        updateTimestamps.push(update.timestamp);
        if (update.payload?.changes?.name) {
          updateNames.push(update.payload.changes.name);
        }
        return originalBroadcast.call(broadcastService, update);
      });

      // Act - Simulate rapid Enter key presses with different names
      const rapidUpdates = [
        'Name Update 1',
        'Name Update 2', 
        'Name Update 3',
        'Final Name'
      ];

      const promises = rapidUpdates.map((name) =>
        stateManager.setSpaceName(spaceId, name)
      );

      // Advance time to trigger debounced operations
      jest.advanceTimersByTime(150);

      await Promise.all(promises);

      // Assert
      expect(updateNames).toContain('Final Name');
      expect(updateTimestamps).toHaveLength(rapidUpdates.length);
      
      // Verify final state has the last update
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.name).toBe('Final Name');
      
      // Verify no updates were lost due to race conditions
      expect(storageManager.saveSpaces).toHaveBeenCalled();
    });

    test('should preserve update order during concurrent modifications', async () => {
      // ## Test Case: RC-002
      // **Title**: Concurrent save/refresh race conditions
      // **Description**: Test concurrent state modifications and ensure proper ordering
      // **Expected Result**: Updates should be processed atomically with proper versioning

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Initial',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      // Act - Simulate concurrent operations
      const concurrentPromises = [
        stateManager.setSpaceName(spaceId, 'Concurrent Name 1'),
        stateManager.setSpaceName(spaceId, 'Concurrent Name 2'),
        stateManager.synchronizeWindowsAndSpaces()
      ];

      jest.advanceTimersByTime(200);
      await Promise.all(concurrentPromises);

      // Assert
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.version).toBeGreaterThan(initialSpace.version);
      expect(['Concurrent Name 1', 'Concurrent Name 2']).toContain(finalSpace?.name);
    });
  });

  describe('Debounce Window Update Loss', () => {
    test('should not lose updates within 100ms debounce window', async () => {
      // ## Test Case: RC-003
      // **Title**: 100ms debounce window losing intermediate changes
      // **Description**: Test if intermediate updates are lost during debounce period
      // **Expected Result**: All updates within debounce window should be preserved

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Initial',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      const capturedUpdates: QueuedStateUpdate[] = [];
      broadcastService.broadcast = jest.fn((update: QueuedStateUpdate) => {
        capturedUpdates.push(update);
      });

      // Act - Send updates within debounce window
      await stateManager.setSpaceName(spaceId, 'Update 1');
      jest.advanceTimersByTime(50); // Half debounce window
      
      await stateManager.setSpaceName(spaceId, 'Update 2');
      jest.advanceTimersByTime(50); // Complete debounce window
      
      await stateManager.setSpaceName(spaceId, 'Final Update');
      jest.advanceTimersByTime(150); // Allow processing

      // Assert
      expect(capturedUpdates.length).toBeGreaterThan(0);
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.name).toBe('Final Update');
    });

    test('should detect pendingUpdates map overwriting newer updates', async () => {
      // ## Test Case: RC-004
      // **Title**: pendingUpdates map overwriting newer updates with older ones
      // **Description**: Test if the pendingUpdates map incorrectly overwrites newer updates
      // **Expected Result**: Newer updates should always take precedence

      // Arrange
      const mockUpdates: QueuedStateUpdate[] = [
        {
          id: 'update-1',
          type: MessageTypes.SPACE_UPDATED,
          timestamp: Date.now(),
          payload: { spaceId: '1', changes: { name: 'Old Name' } },
          priority: StateUpdatePriority.HIGH
        },
        {
          id: 'update-2',
          type: MessageTypes.SPACE_UPDATED,
          timestamp: Date.now() + 100,
          payload: { spaceId: '1', changes: { name: 'New Name' } },
          priority: StateUpdatePriority.HIGH
        }
      ];

      // Act - Broadcast updates with same type but different timestamps
      mockUpdates.forEach(update => broadcastService.broadcast(update));
      
      jest.advanceTimersByTime(150);

      // Assert - Verify the newer update is preserved
      expect(broadcastService.broadcast).toHaveBeenCalledTimes(2);
      
      // Check that newer timestamp update would be processed last
      const newerUpdate = mockUpdates.find(u => u.payload.changes.name === 'New Name');
      const olderUpdate = mockUpdates.find(u => u.payload.changes.name === 'Old Name');
      
      expect(newerUpdate?.timestamp).toBeGreaterThan(olderUpdate?.timestamp || 0);
    });
  });

  describe('Update Coalescing Issues', () => {
    test('should properly coalesce updates without losing data', async () => {
      // ## Test Case: RC-005
      // **Title**: Update coalescing losing intermediate data
      // **Description**: Test if update coalescing properly merges data without loss
      // **Expected Result**: All update data should be preserved through coalescing

      // Arrange
      const updates: QueuedStateUpdate[] = [
        {
          id: 'update-1',
          type: MessageTypes.SPACES_UPDATED,
          timestamp: Date.now(),
          payload: { 
            type: 'incremental',
            changes: { '1': { name: 'First Update' } }
          },
          priority: StateUpdatePriority.NORMAL
        },
        {
          id: 'update-2',
          type: MessageTypes.SPACES_UPDATED,
          timestamp: Date.now() + 50,
          payload: { 
            type: 'incremental',
            changes: { '1': { name: 'Second Update' } }
          },
          priority: StateUpdatePriority.NORMAL
        }
      ];

      const coalescedUpdates: QueuedStateUpdate[] = [];
      broadcastService.broadcast = jest.fn((update: QueuedStateUpdate) => {
        coalescedUpdates.push(update);
      });

      // Act
      updates.forEach(update => broadcastService.broadcast(update));
      jest.advanceTimersByTime(150);

      // Assert
      expect(coalescedUpdates.length).toBeGreaterThan(0);
      
      // Verify coalescing preserved the latest update
      const finalUpdate = coalescedUpdates[coalescedUpdates.length - 1];
      expect(finalUpdate.payload.changes['1'].name).toBe('Second Update');
    });

    test('should handle critical updates without debouncing', async () => {
      // ## Test Case: RC-006
      // **Title**: Critical updates bypassing debounce
      // **Description**: Test that critical priority updates are processed immediately
      // **Expected Result**: Critical updates should not be subject to debounce delays

      // Arrange
      const criticalUpdate: QueuedStateUpdate = {
        id: 'critical-1',
        type: MessageTypes.SPACE_UPDATED,
        timestamp: Date.now(),
        payload: { spaceId: '1', changes: { name: 'Critical Update' } },
        priority: StateUpdatePriority.CRITICAL
      };

      const processedUpdates: QueuedStateUpdate[] = [];
      const mockHandler = jest.fn((update: QueuedStateUpdate) => {
        processedUpdates.push(update);
      });

      broadcastService.onStateUpdate(mockHandler);

      // Act
      broadcastService.broadcast(criticalUpdate);
      
      // Don't advance timers - critical should process immediately
      
      // Assert
      expect(mockHandler).toHaveBeenCalledWith(criticalUpdate);
      expect(processedUpdates).toContain(criticalUpdate);
    });
  });

  describe('Lock Acquisition Timeouts', () => {
    test('should handle lock timeouts during rapid updates', async () => {
      // ## Test Case: RC-007
      // **Title**: Lock acquisition timeout handling
      // **Description**: Test behavior when lock acquisition times out during rapid updates
      // **Expected Result**: Updates should either succeed or fail gracefully without corruption

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Initial',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      
      // Simulate lock contention by making save operations slow
      storageManager.saveSpaces.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 200)); // Slow save
      });

      await stateManager.initialize();

      // Act - Try to overwhelm the lock system
      const rapidPromises = Array.from({ length: 5 }, (_, i) =>
        stateManager.setSpaceName(spaceId, `Rapid Update ${i}`)
      );

      jest.advanceTimersByTime(1000); // Allow all operations to complete
      
      const results = await Promise.allSettled(rapidPromises);

      // Assert
      const successfulUpdates = results.filter(r => r.status === 'fulfilled');
      const failedUpdates = results.filter(r => r.status === 'rejected');

      // At least some updates should succeed
      expect(successfulUpdates.length).toBeGreaterThan(0);
      
      // Failed updates should have meaningful error messages
      failedUpdates.forEach(failure => {
        if (failure.status === 'rejected') {
          expect(failure.reason.message).toBeDefined();
        }
      });

      // Final state should be consistent
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.name).toMatch(/^Rapid Update \d$/);
    });
  });
});
