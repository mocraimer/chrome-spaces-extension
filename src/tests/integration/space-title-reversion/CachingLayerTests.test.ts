import { jest } from '@jest/globals';
import { StateManager } from '../../../background/services/StateManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { createWindowManagerMock, createTabManagerMock, createStorageManagerMock } from '../../utils/serviceMocks';

/**
 * ## Priority 1 - Caching Layer Tests
 * 
 * Test StateManager caching interference:
 * - Test 5-minute TTL cache serving stale data during updates
 * - Test cache invalidation timing issues
 * - Test incremental vs full update threshold conflicts
 * - Validate cache key conflicts between operations
 */
describe('Caching Layer Tests for Space Title Reversion', () => {
  let stateManager: StateManager;
  let updateQueue: StateUpdateQueue;
  let broadcastService: StateBroadcastService;
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

    updateQueue = new StateUpdateQueue();
    broadcastService = new StateBroadcastService();
    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService
    );

    // Mock chrome runtime
    global.chrome = {
      runtime: {
        onConnect: {
          addListener: jest.fn()
        }
      }
    } as any;

    // Reset the change counter before each test to ensure a clean slate
    (stateManager as any).changeCounter.set('spaces', 0);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('5-Minute TTL Cache Issues', () => {
    test('should not serve stale data during active updates', async () => {
      // ## Test Case: CC-001
      // **Title**: 5-minute TTL cache serving stale data during updates
      // **Description**: Test if cache serves stale data when updates are happening
      // **Expected Result**: Cache should be invalidated on updates and serve fresh data

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Initial Name',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };


      // First load returns initial space
      storageManager.loadSpaces.mockResolvedValueOnce({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      // Act - Get space (should cache it)
      const cachedSpace1 = await stateManager.getSpaceById(spaceId);
      expect(cachedSpace1?.name).toBe('Initial Name');

      // Update the space
      await stateManager.setSpaceName(spaceId, 'Updated Name');

      // Advance time by 2 minutes (less than 5-minute TTL)
      jest.advanceTimersByTime(2 * 60 * 1000);

      // Get space again - should NOT serve stale cached data
      const cachedSpace2 = await stateManager.getSpaceById(spaceId);

      // Assert
      expect(cachedSpace2?.name).toBe('Updated Name');
      expect(cachedSpace2?.version).toBe(2);
      
      // Verify cache was invalidated, not just TTL expired
      expect(cachedSpace2?.name).not.toBe('Initial Name');
    });

    test('should handle cache TTL expiration correctly', async () => {
      // ## Test Case: CC-002
      // **Title**: Cache TTL expiration timing
      // **Description**: Test cache behavior when TTL expires
      // **Expected Result**: Cache should refresh data after TTL expiration

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Cached Name',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      const freshSpace = {
        ...initialSpace,
        name: 'Fresh Name',
        version: 2
      };

      storageManager.loadSpaces.mockResolvedValueOnce({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();

      // Act - Get space (caches it)
      const cached = await stateManager.getSpaceById(spaceId);
      expect(cached?.name).toBe('Cached Name');

      // Simulate external update (outside of StateManager)
      storageManager.loadSpaces.mockResolvedValueOnce({ [spaceId]: freshSpace });

      // Advance time beyond 5-minute TTL
      jest.advanceTimersByTime(6 * 60 * 1000);

      // Get space again - should fetch fresh data
      const fresh = await stateManager.getSpaceById(spaceId);

      // Assert
      expect(fresh?.name).toBe('Fresh Name');
      expect(storageManager.loadSpaces).toHaveBeenCalledTimes(2);
    });
  });

  describe('Cache Invalidation Timing Issues', () => {
    test('should invalidate cache immediately on state changes', async () => {
      // ## Test Case: CC-003
      // **Title**: Cache invalidation timing issues
      // **Description**: Test if cache invalidation happens at the right time
      // **Expected Result**: Cache should be invalidated before state changes are visible

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Before Update',
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

      // Cache the space
      await stateManager.getSpaceById(spaceId);

      // Act - Update the space name
      await stateManager.setSpaceName(spaceId, 'After Update');

      // Get the space immediately after update
      const updatedSpace = await stateManager.getSpaceById(spaceId);

      // Assert
      expect(updatedSpace?.name).toBe('After Update');
    });

    test('should handle cache invalidation race conditions', async () => {
      // ## Test Case: CC-004
      // **Title**: Cache invalidation race conditions
      // **Description**: Test cache invalidation during concurrent operations
      // **Expected Result**: Cache should remain consistent during concurrent invalidations

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

      // Act - Trigger concurrent operations that would invalidate cache
      const operations = [
        stateManager.setSpaceName(spaceId, 'Update 1'),
        stateManager.setSpaceName(spaceId, 'Update 2'),
        stateManager.getSpaceById(spaceId),
        stateManager.getSpaceById(spaceId)
      ];

      const results = await Promise.allSettled(operations);

      // Assert
      const successfulResults = results.filter(r => r.status === 'fulfilled');
      expect(successfulResults.length).toBe(results.length);

      // Final state should be consistent
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(['Update 1', 'Update 2']).toContain(finalSpace?.name);
    });
  });

  describe('Incremental vs Full Update Threshold Conflicts', () => {
    test('should handle incremental update threshold correctly', async () => {
      // ## Test Case: CC-005
      // **Title**: Incremental vs full update threshold conflicts
      // **Description**: Test behavior when incremental update threshold is reached
      // **Expected Result**: Should switch to full updates without losing data

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

      const updateHistory: string[] = [];
      
      // Mock broadcast to capture update types
      const broadcastSpy = jest.spyOn(broadcastService, 'broadcast');

      // Act - Perform multiple updates to cross the threshold (10 updates)
      for (let i = 1; i <= 12; i++) {
        await stateManager.setSpaceName(spaceId, `Update ${i}`);
        // Manually trigger broadcastStateUpdate to check incremental logic
        await (stateManager as any).broadcastStateUpdate();
      }

      // Collect update types from broadcast calls
      broadcastSpy.mock.calls.forEach(call => {
        const update = call[0] as any;
        if (update.payload?.type) {
          updateHistory.push(update.payload.type);
        }
      });

      // Assert
      expect(updateHistory).toContain('incremental');
      expect(updateHistory).toContain('full');
      
      // Verify final state is correct
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.name).toBe('Update 12');
    });

    test('should preserve data during threshold transitions', async () => {
      // ## Test Case: CC-006
      // **Title**: Data preservation during update type transitions
      // **Description**: Test data integrity when switching between incremental and full updates
      // **Expected Result**: No data should be lost during transition

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

      // Track all state snapshots
      const stateSnapshots: any[] = [];
      
      const originalGetAllSpaces = stateManager.getAllSpaces;
      (stateManager as any).getAllSpaces = jest.fn(() => {
        const spaces = originalGetAllSpaces.call(stateManager);
        stateSnapshots.push(JSON.parse(JSON.stringify(spaces)));
        return spaces;
      });

      // Act - Cross the incremental threshold
      const updateNames = [];
      for (let i = 1; i <= 15; i++) {
        const name = `Threshold Update ${i}`;
        updateNames.push(name);
        await stateManager.setSpaceName(spaceId, name);
      }

      // Assert
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.name).toBe('Threshold Update 15');
      
      // Verify version incremented properly
      expect(finalSpace?.version).toBeGreaterThan(initialSpace.version);
      
      // Verify no intermediate data was lost
      expect(updateNames).toContain(finalSpace?.name);
    });
  });

  describe('Cache Key Conflicts', () => {
    test('should handle cache key conflicts between operations', async () => {
      // ## Test Case: CC-007
      // **Title**: Cache key conflicts between operations
      // **Description**: Test cache behavior when different operations use similar keys
      // **Expected Result**: Cache keys should be unique and not conflict

      // Arrange
      const spaceId1 = '1';
      const spaceId2 = '2';
      
      const space1 = {
        id: spaceId1,
        name: 'Space 1',
        urls: ['http://example1.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId1,
        named: false
      };

      const space2 = {
        id: spaceId2,
        name: 'Space 2',
        urls: ['http://example2.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId2,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ 
        [spaceId1]: space1,
        [spaceId2]: space2 
      });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      // Act - Access both spaces and update them
      const retrievedSpace1 = await stateManager.getSpaceById(spaceId1);
      const retrievedSpace2 = await stateManager.getSpaceById(spaceId2);

      await stateManager.setSpaceName(spaceId1, 'Updated Space 1');
      await stateManager.setSpaceName(spaceId2, 'Updated Space 2');

      const updatedSpace1 = await stateManager.getSpaceById(spaceId1);
      const updatedSpace2 = await stateManager.getSpaceById(spaceId2);

      // Assert
      expect(retrievedSpace1?.name).toBe('Space 1');
      expect(retrievedSpace2?.name).toBe('Space 2');
      expect(updatedSpace1?.name).toBe('Updated Space 1');
      expect(updatedSpace2?.name).toBe('Updated Space 2');
      
      // Verify spaces didn't get mixed up due to cache key conflicts
      expect(updatedSpace1?.id).toBe(spaceId1);
      expect(updatedSpace2?.id).toBe(spaceId2);
    });

    test('should handle global cache operations correctly', async () => {
      // ## Test Case: CC-008
      // **Title**: Global cache operations integrity
      // **Description**: Test that global cache operations don't interfere with specific space caches
      // **Expected Result**: Global and specific caches should operate independently

      // Arrange
      const spaces = {
        '1': {
          id: '1',
          name: 'Space 1',
          urls: ['http://example1.com'],
          lastModified: Date.now(),
          version: 1,
          lastSync: Date.now(),
          sourceWindowId: '1',
          named: false
        },
        '2': {
          id: '2',
          name: 'Space 2',
          urls: ['http://example2.com'],
          lastModified: Date.now(),
          version: 1,
          lastSync: Date.now(),
          sourceWindowId: '2',
          named: false
        }
      };

      storageManager.loadSpaces.mockResolvedValue(spaces);
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      // Act - Mix global and specific operations
      const allSpaces1 = stateManager.getAllSpaces();
      const specificSpace = await stateManager.getSpaceById('1');
      
      await stateManager.setSpaceName('1', 'Updated Space 1');
      
      const allSpaces2 = stateManager.getAllSpaces();
      const updatedSpecificSpace = await stateManager.getSpaceById('1');

      // Assert
      expect(Object.keys(allSpaces1)).toHaveLength(2);
      expect(specificSpace?.name).toBe('Space 1');
      expect(Object.keys(allSpaces2)).toHaveLength(2);
      expect(updatedSpecificSpace?.name).toBe('Updated Space 1');
      
      // Verify global cache reflects the update
      expect(allSpaces2['1'].name).toBe('Updated Space 1');
      expect(allSpaces2['2'].name).toBe('Space 2'); // Should not be affected
    });
  });
}); 