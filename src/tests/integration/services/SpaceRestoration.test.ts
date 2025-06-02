import { RestoreSpaceTransaction } from '../../../background/services/RestoreSpaceTransaction';
import { WindowManager } from '../../../background/services/WindowManager';
import { StateManager } from '../../../background/services/StateManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import type { Space } from '../../../shared/types/Space';

describe('Space Restoration Integration Tests', () => {
  let restoreSpaceTransaction: RestoreSpaceTransaction;
  let windowManager: WindowManager;
  let stateManager: StateManager;
  let tabManager: TabManager;
  let storageManager: StorageManager;
  let updateQueue: StateUpdateQueue;
  let broadcastService: StateBroadcastService;
  let mockWindowId: number;

  beforeEach(() => {
    // Initialize services
    windowManager = new WindowManager();
    tabManager = new TabManager();
    storageManager = new StorageManager();
    updateQueue = new StateUpdateQueue();
    broadcastService = new StateBroadcastService();

    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService
    );

    restoreSpaceTransaction = new RestoreSpaceTransaction(
      windowManager,
      stateManager,
      tabManager
    );

    // Mock window creation
    mockWindowId = 1234;
    jest.spyOn(windowManager, 'createWindow').mockResolvedValue({
      id: mockWindowId,
      focused: true,
      type: 'normal'
    } as chrome.windows.Window);

    // Mock tab operations
    jest.spyOn(tabManager, 'getTabs').mockResolvedValue([
      { id: 1, url: 'https://example.com' } as chrome.tabs.Tab,
      { id: 2, url: 'https://github.com' } as chrome.tabs.Tab
    ]);
    jest.spyOn(tabManager, 'getTabUrl').mockImplementation((tab: chrome.tabs.Tab) => tab.url || '');
  });

  describe('State Update Queue', () => {
    it('should process updates in order during restoration', async () => {
      await stateManager.createSpace(mockWindowId);
      const queueSpy = jest.spyOn(updateQueue, 'enqueue');

      await restoreSpaceTransaction.restore(mockWindowId.toString());

      expect(queueSpy).toHaveBeenCalled();
      expect(updateQueue.isProcessing).toBe(false);
    });

    it('should prevent concurrent modifications during restoration', async () => {
      await stateManager.createSpace(mockWindowId);
      
      // Start restoration
      const restoration = restoreSpaceTransaction.restore(mockWindowId.toString());
      
      // Attempt concurrent modification
      const modification = stateManager.setSpaceName(
        mockWindowId.toString(),
        'New Name'
      );

      await restoration;
      await modification;

      // Verify modification was queued and processed after restoration
      const space = await stateManager.getSpaceById(mockWindowId.toString());
      expect(space?.name).toBe('New Name');
    });

    it('should handle queue overflow gracefully', async () => {
      await stateManager.createSpace(mockWindowId);
      
      // Force queue processing by exceeding maxQueueSize
      const processSpy = jest.spyOn(updateQueue, 'processQueue');
      
      // Generate many concurrent updates
      const updates = Array(150).fill(0).map((_, i) =>
        stateManager.setSpaceName(mockWindowId.toString(), `Name ${i}`)
      );
      
      await Promise.all(updates);
      
      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('Atomic State Updates', () => {
    it('should roll back all changes if any step fails', async () => {
      await stateManager.createSpace(mockWindowId);
      const initialState = await stateManager.getSpaceById(mockWindowId.toString());

      // Force tab creation to fail
      jest.spyOn(tabManager, 'createTabs').mockRejectedValueOnce(
        new Error('Tab creation failed')
      );

      // Attempt restoration
      await expect(
        restoreSpaceTransaction.restore(mockWindowId.toString())
      ).rejects.toThrow('Tab creation failed');

      // Verify state was rolled back
      const finalState = await stateManager.getSpaceById(mockWindowId.toString());
      expect(finalState).toEqual(initialState);
    });

    it('should ensure version consistency during updates', async () => {
      await stateManager.createSpace(mockWindowId);
      const initialSpace = await stateManager.getSpaceById(mockWindowId.toString());
      
      // Simulate concurrent updates
      const updates = Array(5).fill(0).map((_, i) =>
        stateManager.setSpaceName(mockWindowId.toString(), `Space ${i}`)
      );
      
      await Promise.all(updates);
      
      const finalSpace = await stateManager.getSpaceById(mockWindowId.toString());
      expect(finalSpace!.version).toBe(initialSpace!.version + 5);
    });
  });

  describe('Batched Operations', () => {
    it('should batch multiple tab creations', async () => {
      const space: Space = {
        id: mockWindowId.toString(),
        name: 'Test Space',
        urls: Array(10).fill(0).map((_, i) => `https://example${i}.com`),
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: mockWindowId.toString(),
        named: false
      };

      jest.spyOn(stateManager, 'getSpaceById').mockResolvedValue(space);
      const createTabsSpy = jest.spyOn(tabManager, 'createTabs');

      await restoreSpaceTransaction.restore(mockWindowId.toString());

      // Should create tabs in batches
      expect(createTabsSpy).toHaveBeenCalledTimes(2);
    });

    it('should maintain tab order in batched operations', async () => {
      const urls = Array(10).fill(0).map((_, i) => `https://example${i}.com`);
      const space: Space = {
        id: mockWindowId.toString(),
        name: 'Test Space',
        urls,
        lastModified: Date.now(),
        version: 1,
        lastSync: Date.now(),
        sourceWindowId: mockWindowId.toString(),
        named: false
      };

      jest.spyOn(stateManager, 'getSpaceById').mockResolvedValue(space);
      const createTabsSpy = jest.spyOn(tabManager, 'createTabs');

      await restoreSpaceTransaction.restore(mockWindowId.toString());

      // Verify first batch contains first 5 URLs
      expect(createTabsSpy).toHaveBeenNthCalledWith(
        1,
        mockWindowId,
        urls.slice(0, 5)
      );

      // Verify second batch contains next 5 URLs
      expect(createTabsSpy).toHaveBeenNthCalledWith(
        2,
        mockWindowId,
        urls.slice(5, 10)
      );
    });
  });

  describe('Error Recovery', () => {
    it('should retry failed tab creations with exponential backoff', async () => {
      const failOnFirstTry = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce([{ id: 1 }]);

      jest.spyOn(tabManager, 'createTabs').mockImplementation(failOnFirstTry);
      
      await restoreSpaceTransaction.restore(mockWindowId.toString());
      
      expect(failOnFirstTry).toHaveBeenCalledTimes(2);
    });

    it('should handle permanent failures gracefully', async () => {
      jest.spyOn(tabManager, 'createTabs').mockRejectedValue(
        new Error('Permanent failure')
      );

      const onError = jest.fn();
      restoreSpaceTransaction.onError(onError);

      await expect(
        restoreSpaceTransaction.restore(mockWindowId.toString())
      ).rejects.toThrow('Permanent failure');

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
      expect(windowManager.closeWindow).toHaveBeenCalledWith(mockWindowId);
    });
  });
});