import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateManager } from '../../../background/services/StateManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { DEFAULT_SPACE_NAME, SPACE_NAME_MAX_LENGTH } from '../../../shared/constants';
import type { Space } from '../../../shared/types/Space';

// Mock dependencies
jest.mock('../../../background/services/WindowManager');
jest.mock('../../../background/services/TabManager');
jest.mock('../../../background/services/StorageManager');
jest.mock('../../../background/services/StateUpdateQueue');
jest.mock('../../../background/services/StateBroadcastService');

describe('StateManager', () => {
  let stateManager: StateManager;
  let windowManager: jest.Mocked<WindowManager>;
  let tabManager: jest.Mocked<TabManager>;
  let storageManager: jest.Mocked<StorageManager>;
  let updateQueue: jest.Mocked<StateUpdateQueue>;
  let broadcastService: jest.Mocked<StateBroadcastService>;

  const createMockSpace = (id: string, name: string, props: Partial<Space> = {}): Space => ({
    id,
    name,
    urls: ['https://example.com'],
    lastModified: 123456789,
    version: 1,
    lastSync: 123456789,
    sourceWindowId: id,
    named: false,
    permanentId: `perm-${id}`,
    createdAt: 123456789,
    lastUsed: 123456789,
    isActive: true,
    windowId: Number(id),
    ...props
  });

  const mockSpace = createMockSpace('1', 'Test Space');

  beforeEach(() => {
    windowManager = new WindowManager() as jest.Mocked<WindowManager>;
    tabManager = new TabManager() as jest.Mocked<TabManager>;
    storageManager = new StorageManager() as jest.Mocked<StorageManager>;
    updateQueue = new StateUpdateQueue() as jest.Mocked<StateUpdateQueue>;
    broadcastService = new StateBroadcastService() as jest.Mocked<StateBroadcastService>;

    storageManager.loadSpaces.mockResolvedValue({});
    storageManager.loadClosedSpaces.mockResolvedValue({});
    storageManager.saveSpaces.mockResolvedValue();
    storageManager.saveClosedSpaces.mockResolvedValue();

    windowManager.windowExists.mockResolvedValue(true);
    windowManager.closeWindow.mockResolvedValue();

    updateQueue.enqueue.mockResolvedValue();
    updateQueue.processQueue.mockResolvedValue();

    broadcastService.broadcast.mockImplementation(() => {});
    broadcastService.onStateUpdate.mockImplementation(() => {});
    
    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService
    );
  });

  describe('setSpaceName', () => {

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({ '1': createMockSpace('1', 'Original Space') });
      storageManager.saveSpaces.mockResolvedValue();
    });

    it('should update space name successfully', async () => {
      const newName = 'New Space Name';
      await stateManager.setSpaceName('1', newName);

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            ...createMockSpace('1', newName),
            lastModified: expect.any(Number)
          })
        })
      );
    });

    it('should throw error for empty name', async () => {
      await expect(stateManager.setSpaceName('1', '')).rejects.toThrow('Space name cannot be empty');
      await expect(stateManager.setSpaceName('1', '   ')).rejects.toThrow('Space name cannot be empty');
    });

    it('should throw error for name exceeding max length', async () => {
      const longName = 'a'.repeat(SPACE_NAME_MAX_LENGTH + 1);
      await expect(stateManager.setSpaceName('1', longName))
        .rejects.toThrow(`Space name cannot exceed ${SPACE_NAME_MAX_LENGTH} characters`);
    });

    it('should throw error for non-existent space', async () => {
      storageManager.loadSpaces.mockResolvedValue({});
      await expect(stateManager.setSpaceName('1', 'New Name'))
        .rejects.toThrow('Space not found');
    });

    it('should trim and normalize whitespace in name', async () => {
      await stateManager.setSpaceName('1', '  New   Space  Name  ');

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            name: 'New Space Name',
            version: expect.any(Number),
            lastModified: expect.any(Number),
            lastSync: expect.any(Number),
            sourceWindowId: expect.any(String)
          })
        })
      );
    });
  });

  describe('getSpaceName', () => {

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
    });

    it('should return space name for active space', async () => {
      storageManager.loadSpaces.mockResolvedValue({
        '1': createMockSpace('1', 'Test Space')
      });
      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });

    it('should return space name for closed space', async () => {
      storageManager.loadClosedSpaces.mockResolvedValue({
        '1': createMockSpace('1', 'Test Space')
      });
      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });

    it('should return default name for non-existent space', async () => {
      const name = await stateManager.getSpaceName('999');
      expect(name).toBe(`${DEFAULT_SPACE_NAME} 999`);
    });
  });

  describe('deleteClosedSpace', () => {
    beforeEach(() => {
      const mockClosedSpace = createMockSpace('2', 'Closed Space', { version: 2 });
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ '2': mockClosedSpace });
      storageManager.saveClosedSpaces.mockResolvedValue();
    });

    it('should remove space from closed spaces', async () => {
      await stateManager.deleteClosedSpace('2');

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });

    it('should handle non-existent closed space', async () => {
      await expect(stateManager.deleteClosedSpace('nonexistent')).rejects.toThrow('Closed space not found');
    });

    it('should maintain other closed spaces when deleting one', async () => {
      const otherClosedSpace = createMockSpace('3', 'Other Closed Space', { version: 2 });
      storageManager.loadClosedSpaces.mockResolvedValue({
        '2': createMockSpace('2', 'Closed Space', { version: 2 }),
        '3': otherClosedSpace
      });

      await stateManager.deleteClosedSpace('2');

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({ '3': { ...otherClosedSpace, named: false } });
    });
  });

  describe('closeSpace', () => {
    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({
        '1': createMockSpace('1', 'Test Space')
      });
    });

    it('should close space and move it to closed spaces', async () => {
      await stateManager.closeSpace(1);

      expect(windowManager.closeWindow).toHaveBeenCalledWith(1);
      expect(storageManager.saveSpaces).toHaveBeenCalledWith({});
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            ...mockSpace,
            version: expect.any(Number),
            lastModified: expect.any(Number),
            lastSync: expect.any(Number)
          })
        })
      );
    });

    it('should handle already closed window', async () => {
      windowManager.windowExists.mockResolvedValue(false);
      await stateManager.closeSpace(1);

      expect(windowManager.closeWindow).not.toHaveBeenCalled();
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            ...mockSpace,
            lastModified: expect.any(Number)
          })
        })
      );
    });

    it('should not duplicate closed spaces', async () => {
      const closedSpace = createMockSpace('1', 'Closed Space', {
        lastModified: Date.now(),
        version: 2
      });

      storageManager.loadClosedSpaces.mockResolvedValue({
        '1': createMockSpace('1', 'Closed Space', { version: 2 })
      });

      await stateManager.closeSpace(1);

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({
        '1': closedSpace
      });
    });
  });

  describe('synchronizeWindowsAndSpaces', () => {
    const mockTab = {
      id: 1,
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: false,
      incognito: false,
      selected: false,
      autoDiscardable: true,
      url: 'https://example.com',
      groupId: -1
    } as chrome.tabs.Tab;

    const mockWindow: chrome.windows.Window = {
      id: 1,
      tabs: [mockTab],
      focused: false,
      alwaysOnTop: false,
      incognito: false,
      type: 'normal',
      state: 'normal'
    };

    beforeEach(() => {
      tabManager.getTabs.mockResolvedValue([mockTab]);
      tabManager.getTabUrl.mockReturnValue('https://example.com');
    });

    it('moves orphaned active spaces into closed storage', async () => {
      const orphanedSpace = createMockSpace('2', 'Orphaned Space', {
        isActive: true,
        windowId: 2,
        sourceWindowId: '2',
        lastModified: Date.now(),
        lastSync: Date.now(),
        version: 3
      });

      windowManager.getAllWindows.mockResolvedValue([]);
      storageManager.loadSpaces.mockResolvedValue({ '2': orphanedSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith({});
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '2': expect.objectContaining({
            isActive: false,
            windowId: undefined,
            version: orphanedSpace.version + 1
          })
        })
      );
    });

    it('creates new space entries for brand-new windows', async () => {
      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            id: '1',
            sourceWindowId: '1',
            windowId: 1,
            isActive: true
          })
        })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });

    it('reopens previously closed spaces when their window returns', async () => {
      const closedSpace = createMockSpace('1', 'Closed Space', {
        isActive: false,
        windowId: undefined,
        version: 5
      });

      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ '1': closedSpace });

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            isActive: true,
            windowId: 1,
            version: closedSpace.version + 1
          })
        })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });
  });

  describe('restoreSpace', () => {
    const mockClosedSpace = createMockSpace('1', 'Closed Space', { version: 2 });

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({
        '1': createMockSpace('1', 'Closed Space', { version: 2 })
      });
      storageManager.saveSpaces.mockResolvedValue();
      storageManager.saveClosedSpaces.mockResolvedValue();
    });

    it('should move space from closed to active spaces', async () => {
      await stateManager.restoreSpace('1');

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({ '1': expect.any(Object) })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });

    it('should handle non-existent closed space', async () => {
      await expect(stateManager.restoreSpace('nonexistent')).rejects.toThrow('Closed space not found');
    });

    it('should update lastModified timestamp on restoration', async () => {
      const before = Date.now();
      await stateManager.restoreSpace('1');
      const after = Date.now();

      const savedSpaces = (storageManager.saveSpaces as jest.Mock).mock.calls[0][0];
      const restoredSpace = savedSpaces['1'];

      expect(restoredSpace.lastModified).toBeGreaterThanOrEqual(before);
      expect(restoredSpace.lastModified).toBeLessThanOrEqual(after);
    });

    it('should handle atomic updates between active and closed spaces with version bumps', async () => {
      const baseVersion = 1;
      const activeSpace = createMockSpace('2', 'Active Space', {
        lastModified: Date.now(),
        version: baseVersion
      });

      storageManager.loadSpaces.mockResolvedValue({ '2': activeSpace });
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.any(Object),
          '2': expect.any(Object)
        })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });
  });

  describe('name persistence after rename and popup reopen', () => {
    it('should persist space name after renaming and popup reopen', async () => {
      const newName = 'Renamed Space';
      await stateManager.setSpaceName('1', newName);

      // Simulate popup reopen
      await stateManager.initialize();

      const name = await stateManager.getSpaceName('1');
      expect(name).toBe(newName);
    });

    it('should persist space name after popup reopen without renaming', async () => {
      // Simulate popup reopen
      await stateManager.initialize();

      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });
  });
});
