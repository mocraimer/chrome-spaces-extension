import { jest } from '@jest/globals';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { StateUpdatePriority } from '../../../background/services/StateUpdateQueue';
import { MessageTypes } from '../../../shared/constants';

/**
 * ## Fix Verification Test
 * 
 * Validates that the space title reversion fix is working correctly:
 * - Space name updates bypass debouncing
 * - Updates are processed immediately 
 * - No race conditions in rapid name changes
 */
describe('Space Title Reversion Fix Verification', () => {
  let broadcastService: StateBroadcastService;
  let processedUpdates: any[];

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    
    // Mock chrome runtime
    global.chrome = {
      runtime: {
        onConnect: {
          addListener: jest.fn()
        }
      }
    } as any;

    processedUpdates = [];
    
    broadcastService = new StateBroadcastService({
      debounceTime: 100,
      coalesceUpdates: true
    });

    // Mock the handleStateUpdate method to track processing
    const originalHandleStateUpdate = (broadcastService as any).handleStateUpdate;
    (broadcastService as any).handleStateUpdate = jest.fn((update: any) => {
      processedUpdates.push({
        type: update.type,
        timestamp: Date.now(),
        spaceId: update.payload?.spaceId,
        name: update.payload?.changes?.name
      });
      return originalHandleStateUpdate.call(broadcastService, update, -1);
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Space Name Update Fix', () => {
    test('should process space name updates immediately (bypassing debounce)', () => {
      // ## Test Case: Verify space name updates bypass debounce
      // **Expected**: Space name updates processed immediately, not debounced
      
      // Arrange
      const spaceNameUpdate = {
        id: 'test-1',
        type: MessageTypes.SPACE_UPDATED,
        timestamp: Date.now(),
        priority: StateUpdatePriority.HIGH,
        payload: {
          spaceId: 'space-1',
          changes: { name: 'New Space Name' },
          version: 2
        }
      };

      const normalUpdate = {
        id: 'test-2', 
        type: 'NORMAL_UPDATE',
        timestamp: Date.now(),
        priority: StateUpdatePriority.NORMAL,
        payload: {
          someData: 'test'
        }
      };

      // Act - Send both updates
      broadcastService.broadcast(spaceNameUpdate);
      broadcastService.broadcast(normalUpdate);

      // Don't advance timers yet - space name should already be processed
      
      // Assert - Space name update processed immediately
      expect(processedUpdates).toHaveLength(1);
      expect(processedUpdates[0].type).toBe(MessageTypes.SPACE_UPDATED);
      expect(processedUpdates[0].name).toBe('New Space Name');
      
      console.log('✅ VERIFICATION: Space name update processed immediately');
      console.log('📊 Processed updates before debounce:', processedUpdates.length);

      // Advance timers to process debounced updates
      jest.advanceTimersByTime(150);
      
      // Now normal update should be processed  
      expect(processedUpdates).toHaveLength(2);
      expect(processedUpdates[1].type).toBe('NORMAL_UPDATE');
      
      console.log('📊 Total processed updates after debounce:', processedUpdates.length);
    });

    test('should handle rapid space name changes without loss', () => {
      // ## Test Case: Rapid space name updates without debounce interference
      // **Expected**: All space name updates processed in order immediately
      
      // Arrange - Multiple rapid space name updates
      const rapidNameUpdates = [
        'Name 1',
        'Name 2', 
        'Name 3',
        'Final Name'
      ].map((name, index) => ({
        id: `rapid-${index}`,
        type: MessageTypes.SPACE_UPDATED,
        timestamp: Date.now() + index,
        priority: StateUpdatePriority.HIGH,
        payload: {
          spaceId: 'space-1',
          changes: { name },
          version: index + 1
        }
      }));

      // Act - Send all updates rapidly
      rapidNameUpdates.forEach(update => {
        broadcastService.broadcast(update);
      });

      // Assert - All processed immediately (no debounce delay)
      expect(processedUpdates).toHaveLength(4);
      
      const processedNames = processedUpdates.map(u => u.name);
      expect(processedNames).toEqual(['Name 1', 'Name 2', 'Name 3', 'Final Name']);
      
      console.log('✅ VERIFICATION: All rapid name changes processed immediately');
      console.log('📊 Processed names:', processedNames);
      
      // Verify final state has correct name
      const finalUpdate = processedUpdates[processedUpdates.length - 1];
      expect(finalUpdate.name).toBe('Final Name');
      
      console.log('🎯 RACE CONDITION RESOLVED: No updates lost to debouncing');
    });

    test('should still debounce non-critical updates', () => {
      // ## Test Case: Verify non-critical updates still get debounced
      // **Expected**: Only space name updates bypass debounce, others are delayed
      
      // Arrange
      const normalUpdate1 = {
        id: 'normal-1',
        type: 'NORMAL_UPDATE',
        timestamp: Date.now(),
        priority: StateUpdatePriority.NORMAL,
        payload: { data: 'normal1' }
      };

      const normalUpdate2 = {
        id: 'normal-2', 
        type: 'NORMAL_UPDATE',
        timestamp: Date.now(),
        priority: StateUpdatePriority.NORMAL,
        payload: { data: 'normal2' }
      };

      // Act - Send normal updates
      broadcastService.broadcast(normalUpdate1);
      broadcastService.broadcast(normalUpdate2);
      
      // Assert - No immediate processing (debounced)
      expect(processedUpdates).toHaveLength(0);
      
      console.log('✅ VERIFICATION: Normal updates properly debounced');
      
      // Advance timers to process debounced updates
      jest.advanceTimersByTime(150);
      
      // Should have processed the coalesced update
      expect(processedUpdates.length).toBeGreaterThan(0);
      
      console.log('📊 Debounced updates processed after timer:', processedUpdates.length);
    });
  });

  describe('Critical Update Processing', () => {
    test('should process truly critical updates immediately', () => {
      // ## Test Case: Verify critical priority updates still work
      // **Expected**: CRITICAL priority updates processed immediately
      
      // Arrange
      const criticalUpdate = {
        id: 'critical-1',
        type: 'CRITICAL_SYSTEM_UPDATE',
        timestamp: Date.now(),
        priority: StateUpdatePriority.CRITICAL,
        payload: { critical: true }
      };

      // Act
      broadcastService.broadcast(criticalUpdate);

      // Assert - Processed immediately
      expect(processedUpdates).toHaveLength(1);
      expect(processedUpdates[0].type).toBe('CRITICAL_SYSTEM_UPDATE');
      
      console.log('✅ VERIFICATION: Critical updates still processed immediately');
    });
  });
});