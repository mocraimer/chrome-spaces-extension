import { StateUpdateQueue, QueuedStateUpdate, StateUpdateError } from '../../../background/services/StateUpdateQueue';

describe('StateUpdateQueue', () => {
  let queue: StateUpdateQueue;

  beforeEach(() => {
    queue = new StateUpdateQueue({
      debounceTime: 50,
      maxQueueSize: 3,
      validateUpdates: true
    });
  });

  describe('enqueue', () => {
    it('should add updates to the queue', async () => {
      const update: Omit<QueuedStateUpdate, 'timestamp'> = {
        id: '1',
        type: 'TEST_UPDATE',
        payload: { value: 'test' }
      };

      await queue.enqueue(update);
      expect(queue.length).toBe(1);
    });

    it('should validate updates before enqueueing', async () => {
      const invalidUpdate = {
        id: '',
        type: 'TEST_UPDATE',
        payload: { value: 'test' }
      };

      await expect(queue.enqueue(invalidUpdate)).rejects.toThrow(StateUpdateError);
    });

    it('should process queue when max size is reached', async () => {
      const updates = Array.from({ length: 3 }, (_, i) => ({
        id: `${i + 1}`,
        type: 'TEST_UPDATE',
        payload: { value: `test-${i + 1}` }
      }));

      for (const update of updates) {
        await queue.enqueue(update);
      }

      expect(queue.length).toBe(0);
    });
  });

  describe('processQueue', () => {
    it('should process updates in priority order', async () => {
      const updates = [
        { id: '1', type: 'TEST', payload: 'low', priority: 4 },     // LOW = 4
        { id: '2', type: 'TEST', payload: 'high', priority: 2 },    // HIGH = 2
        { id: '3', type: 'TEST', payload: 'medium', priority: 3 }   // NORMAL = 3
      ];

      const processedUpdates: QueuedStateUpdate[] = [];
      const processUpdatesFn = (updates: QueuedStateUpdate[]) => {
        processedUpdates.push(...updates);
        return Promise.resolve();
      };

      const mockProcessUpdates = jest
        .spyOn(queue as any, 'processUpdates')
        .mockImplementation(processUpdatesFn as any);

      for (const update of updates) {
        await queue.enqueue(update);
      }
      
      await queue.processQueue();
      mockProcessUpdates.mockRestore();

      expect(processedUpdates[0].id).toBe('2'); // HIGH priority (2)
      expect(processedUpdates[1].id).toBe('3'); // NORMAL priority (3)
      expect(processedUpdates[2].id).toBe('1'); // LOW priority (4)
    });

    it('should handle errors and rollback', async () => {
      const updates = [
        { id: '1', type: 'TEST', payload: 'test1' },
        { id: '2', type: 'TEST', payload: 'test2' }
      ];

      const mockProcessUpdates = jest
        .spyOn(queue as any, 'processUpdates')
        .mockRejectedValue(new Error('Test error'));

      for (const update of updates) {
        await queue.enqueue(update);
      }

      await expect(queue.processQueue()).rejects.toThrow('Test error');
      expect(queue.length).toBe(2); // Updates should be rolled back
      mockProcessUpdates.mockRestore();
    });
  });

  describe('clear', () => {
    it('should clear all pending updates', async () => {
      const updates = [
        { id: '1', type: 'TEST', payload: 'test1' },
        { id: '2', type: 'TEST', payload: 'test2' }
      ];

      for (const update of updates) {
        await queue.enqueue(update);
      }

      queue.clear();
      expect(queue.length).toBe(0);
    });
  });

  describe('debouncing', () => {
    it('should debounce multiple rapid updates', async () => {
      jest.useFakeTimers();
      const processQueueSpy = jest.spyOn(queue, 'processQueue');

      await queue.enqueue({ id: '1', type: 'TEST', payload: 'test1' });
      await queue.enqueue({ id: '2', type: 'TEST', payload: 'test2' });
      
      expect(processQueueSpy).not.toHaveBeenCalled();

      jest.runAllTimers();
      
      expect(processQueueSpy).toHaveBeenCalledTimes(1);
      processQueueSpy.mockRestore();
      jest.useRealTimers();
    });
  });

  describe('error handling', () => {
    it('should throw StateUpdateError for invalid updates', async () => {
      const invalidUpdate = {
        id: '1',
        type: '',  // Invalid: empty type
        payload: null
      };

      await expect(queue.enqueue(invalidUpdate)).rejects.toThrow(StateUpdateError);
    });

    it('should maintain queue state after failed processing', async () => {
      const update = { id: '1', type: 'TEST', payload: 'test' };
      await queue.enqueue(update);

      const mockProcessUpdates = jest
        .spyOn(queue as any, 'processUpdates')
        .mockRejectedValue(new Error('Processing failed'));
        
      await expect(queue.processQueue()).rejects.toThrow('Processing failed');
      expect(queue.length).toBe(1); // Original update should still be in queue
      mockProcessUpdates.mockRestore();
    });
  });
});