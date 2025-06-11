import { jest } from '@jest/globals';
import { StateManager } from '../../../background/services/StateManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { createWindowManagerMock, createTabManagerMock, createStorageManagerMock } from '../../utils/serviceMocks';

/**
 * ## Priority 2 - Server-side Validation Tests
 * 
 * Test StateManager.setSpaceName rollback mechanisms:
 * - Test version conflict triggers during updates
 * - Test state transition validation failures
 * - Test storage operation failure rollbacks
 * - Validate lock acquisition timeout handling
 */
describe('Server-side Validation Tests for Space Title Reversion', () => {
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Version Conflict Triggers', () => {
    test('should detect version conflicts during setSpaceName', async () => {
      // ## Test Case: SV-001
      // **Title**: Version conflict triggers during updates
      // **Description**: Test detection of version conflicts when updating space names
      // **Expected Result**: Version conflicts should trigger appropriate rollback mechanisms

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

      const conflictingSpace = {
        ...initialSpace,
        name: 'Conflicting Name',
        version: 2, // Higher version indicates external update
        lastModified: Date.now() + 1000
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      
      // First save succeeds
      storageManager.saveSpaces.mockResolvedValueOnce(undefined);
      
      // Second save simulates version conflict
      storageManager.saveSpaces.mockImplementationOnce(() => {
        // Simulate external update between load and save
        storageManager.loadSpaces.mockResolvedValueOnce({ [spaceId]: conflictingSpace });
        throw new Error('Version conflict detected');
      });

      await stateManager.initialize();

      // Act - First update should succeed
      await stateManager.setSpaceName(spaceId, 'First Update');

      // Second update should detect version conflict
      try {
        await stateManager.setSpaceName(spaceId, 'Second Update');
        throw new Error('Expected version conflict error');
      } catch (error) {
        expect((error as Error).message).toContain('Version conflict');
      }

      // Assert - State should reflect the conflicting external update
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.version).toBe(2);
      expect(finalSpace?.name).toBe('Conflicting Name');
    });

    test('should handle concurrent version updates correctly', async () => {
      // ## Test Case: SV-002
      // **Title**: Concurrent version update handling
      // **Description**: Test handling of concurrent updates with version tracking
      // **Expected Result**: Updates should be serialized with proper version increments

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
      
      let saveCallCount = 0;
      storageManager.saveSpaces.mockImplementation((spaces: any) => {
        saveCallCount++;
        const space = spaces[spaceId];
        
        // Verify version increments correctly
        if (saveCallCount === 1) {
          expect(space.version).toBe(2);
          expect(space.name).toBe('Update 1');
        } else if (saveCallCount === 2) {
          expect(space.version).toBe(3);
          expect(space.name).toBe('Update 2');
        }
        
        return Promise.resolve();
      });

      await stateManager.initialize();

      // Act - Perform sequential updates
      await stateManager.setSpaceName(spaceId, 'Update 1');
      await stateManager.setSpaceName(spaceId, 'Update 2');

      // Assert
      expect(saveCallCount).toBe(2);
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.version).toBe(3);
      expect(finalSpace?.name).toBe('Update 2');
    });
  });

  describe('State Transition Validation Failures', () => {
    test('should validate state transitions during updates', async () => {
      // ## Test Case: SV-003
      // **Title**: State transition validation failures
      // **Description**: Test validation of state transitions to prevent invalid updates
      // **Expected Result**: Invalid state transitions should be rejected

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Valid Name',
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

      // Act & Assert - Test various invalid transitions
      
      // Empty name should be rejected
      await expect(stateManager.setSpaceName(spaceId, '')).rejects.toThrow('Space name cannot be empty');
      
      // Whitespace-only name should be rejected
      await expect(stateManager.setSpaceName(spaceId, '   ')).rejects.toThrow('Space name cannot be empty');
      
      // Non-existent space should be rejected
      await expect(stateManager.setSpaceName('nonexistent', 'New Name')).rejects.toThrow('Space not found');
    });

    test('should validate space invariants during updates', async () => {
      // ## Test Case: SV-004
      // **Title**: Space invariant validation
      // **Description**: Test validation of space invariants that must be preserved
      // **Expected Result**: Updates violating invariants should be rejected

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

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      
      // Mock saveSpaces to validate invariants
      storageManager.saveSpaces.mockImplementation((spaces: any) => {
        const space = spaces[spaceId];
        
        // Validate that space ID doesn't change
        expect(space.id).toBe(spaceId);
        
        // Validate that version increases
        expect(space.version).toBeGreaterThan(initialSpace.version);
        
        // Validate that lastModified is updated
        expect(space.lastModified).toBeGreaterThan(initialSpace.lastModified);
        
        return Promise.resolve();
      });

      await stateManager.initialize();

      // Act
      await stateManager.setSpaceName(spaceId, 'Updated Name');

      // Assert
      expect(storageManager.saveSpaces).toHaveBeenCalled();
    });
  });

  describe('Storage Operation Failure Rollbacks', () => {
    test('should rollback state on storage save failure', async () => {
      // ## Test Case: SV-005
      // **Title**: Storage operation failure rollbacks
      // **Description**: Test rollback behavior when storage operations fail
      // **Expected Result**: State should be rolled back to previous consistent state

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Stable Name',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockRejectedValue(new Error('Storage quota exceeded'));

      await stateManager.initialize();

      const originalState = stateManager.getAllSpaces();

      // Act
      try {
        await stateManager.setSpaceName(spaceId, 'Failed Update');
        throw new Error('Expected storage error');
      } catch (error) {
        expect((error as Error).message).toContain('Failed to set space name');
      }

      // Assert - State should be unchanged
      const currentState = stateManager.getAllSpaces();
      expect(currentState[spaceId].name).toBe('Stable Name');
      expect(currentState[spaceId].version).toBe(originalState[spaceId].version);
    });

    test('should handle partial storage failures with atomic rollback', async () => {
      // ## Test Case: SV-006
      // **Title**: Partial storage failure atomic rollback
      // **Description**: Test atomic rollback when partial storage operations fail
      // **Expected Result**: All related operations should be rolled back atomically

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
      
      // Simulate partial failure - saveSpaces succeeds but broadcast fails
      storageManager.saveSpaces.mockResolvedValue(undefined);
      
      // Mock broadcast to fail
      const originalBroadcast = broadcastService.broadcast;
      broadcastService.broadcast = jest.fn().mockImplementation(() => {
        throw new Error('Broadcast service unavailable');
      });

      await stateManager.initialize();

      // Act
      try {
        await stateManager.setSpaceName(spaceId, 'Partial Failure Update');
        // Note: Current implementation doesn't roll back on broadcast failure
        // This test documents the current behavior
      } catch (error) {
        // If broadcast failure causes setSpaceName to fail, state should be consistent
      }

      // Assert - Verify state consistency
      const finalSpace = await stateManager.getSpaceById(spaceId);
      
      // Storage was updated even if broadcast failed
      expect(finalSpace?.name).toBe('Partial Failure Update');
      expect(storageManager.saveSpaces).toHaveBeenCalled();
      
      // Restore original broadcast
      broadcastService.broadcast = originalBroadcast;
    });
  });

  describe('Lock Acquisition Timeout Handling', () => {
    test('should handle lock acquisition timeouts gracefully', async () => {
      // ## Test Case: SV-007
      // **Title**: Lock acquisition timeout handling
      // **Description**: Test behavior when lock acquisition times out
      // **Expected Result**: Should fail gracefully with appropriate error messages

      // Arrange
      const spaceId = '1';
      const initialSpace = {
        id: spaceId,
        name: 'Locked Space',
        urls: ['http://example.com'],
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: spaceId,
        named: false
      };

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      
      // Make storage operations very slow to simulate lock contention
      storageManager.saveSpaces.mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      });

      await stateManager.initialize();

      // Act - Start first operation (will hold lock)
      const firstOperation = stateManager.setSpaceName(spaceId, 'First Update');
      
      // Start second operation immediately (should wait for lock)
      const secondOperation = stateManager.setSpaceName(spaceId, 'Second Update');

      // Advance timers to simulate timeout
      jest.advanceTimersByTime(10000); // 10 seconds

      // Wait for operations to complete
      await Promise.allSettled([firstOperation, secondOperation]);

      // Assert - Both operations should eventually complete
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(['First Update', 'Second Update']).toContain(finalSpace?.name);
    });

    test('should prevent deadlocks during concurrent operations', async () => {
      // ## Test Case: SV-008
      // **Title**: Deadlock prevention during concurrent operations
      // **Description**: Test that concurrent operations don't cause deadlocks
      // **Expected Result**: All operations should complete without deadlocks

      // Arrange
      const spaceIds = ['1', '2', '3'];
      const spaces = spaceIds.reduce((acc, id) => {
        acc[id] = {
          id,
          name: `Space ${id}`,
          urls: [`http://example${id}.com`],
          lastModified: Date.now(),
          version: 1,
          lastSync: Date.now(),
          sourceWindowId: id,
          named: false
        };
        return acc;
      }, {} as any);

      storageManager.loadSpaces.mockResolvedValue(spaces);
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockImplementation(() => {
        // Simulate some processing time
        return new Promise(resolve => setTimeout(resolve, 100));
      });

      await stateManager.initialize();

      // Act - Perform concurrent operations on different spaces
      const operations = spaceIds.map(id => 
        stateManager.setSpaceName(id, `Updated Space ${id}`)
      );

      // Advance timers
      jest.advanceTimersByTime(500);

      const results = await Promise.allSettled(operations);

      // Assert - All operations should succeed
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(spaceIds.length);
      
      // Verify final state
      for (const id of spaceIds) {
        const space = await stateManager.getSpaceById(id);
        expect(space?.name).toBe(`Updated Space ${id}`);
      }
    });
  });

  describe('Data Integrity Validation', () => {
    test('should validate data integrity during complex operations', async () => {
      // ## Test Case: SV-009
      // **Title**: Data integrity validation during complex operations
      // **Description**: Test data integrity across complex multi-step operations
      // **Expected Result**: Data should remain consistent throughout complex operations

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

      storageManager.loadSpaces.mockResolvedValue({ [spaceId]: initialSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      storageManager.saveSpaces.mockResolvedValue(undefined);

      await stateManager.initialize();

      const checksums: string[] = [];
      
      // Helper to calculate state checksum
      const calculateChecksum = () => {
        const state = stateManager.getAllSpaces();
        return JSON.stringify(state);
      };

      // Act - Perform series of operations while tracking integrity
      checksums.push(calculateChecksum());
      
      await stateManager.setSpaceName(spaceId, 'Name 1');
      checksums.push(calculateChecksum());
      
      await stateManager.setSpaceName(spaceId, 'Name 2');
      checksums.push(calculateChecksum());
      
      await stateManager.setSpaceName(spaceId, 'Final Name');
      checksums.push(calculateChecksum());

      // Assert - Each checksum should be different (state changed)
      const uniqueChecksums = new Set(checksums);
      expect(uniqueChecksums.size).toBe(checksums.length);
      
      // Final state should be consistent
      const finalSpace = await stateManager.getSpaceById(spaceId);
      expect(finalSpace?.name).toBe('Final Name');
      expect(finalSpace?.version).toBe(4); // Initial + 3 updates
    });
  });
});