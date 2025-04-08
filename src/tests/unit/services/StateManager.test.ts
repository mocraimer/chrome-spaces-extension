import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateManager } from '../../../background/services/StateManager';
import { DEFAULT_SPACE_NAME, SPACE_NAME_MAX_LENGTH } from '../../../shared/constants';

// Mock dependencies
jest.mock('../../../background/services/WindowManager');
jest.mock('../../../background/services/TabManager');
jest.mock('../../../background/services/StorageManager');

describe('StateManager', () => {
  let stateManager: StateManager;
  let windowManager: jest.Mocked<WindowManager>;
  let tabManager: jest.Mocked<TabManager>;
  let storageManager: jest.Mocked<StorageManager>;

  const mockSpace = {
    id: '1',
    name: 'Test Space',
    urls: ['https://example.com'],
    lastModified: 123456789
  };

  beforeEach(() => {
    windowManager = new WindowManager() as jest.Mocked<WindowManager>;
    tabManager = new TabManager() as jest.Mocked<TabManager>;
    storageManager = new StorageManager() as jest.Mocked<StorageManager>;

    storageManager.loadSpaces.mockResolvedValue({});
    storageManager.loadClosedSpaces.mockResolvedValue({});
    storageManager.saveSpaces.mockResolvedValue();
    storageManager.saveClosedSpaces.mockResolvedValue();

    windowManager.windowExists.mockResolvedValue(true);
    windowManager.closeWindow.mockResolvedValue();
    
    stateManager = new StateManager(windowManager, tabManager, storageManager);
  });

  describe('setSpaceName', () => {
    const mockSpace = {
      id: '1',
      name: 'Original Space',
      urls: ['https://example.com'],
      lastModified: 123456789
    };

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({ '1': { ...mockSpace, named: false } });
      storageManager.saveSpaces.mockResolvedValue();
    });

    it('should update space name successfully', async () => {
      const newName = 'New Space Name';
      await stateManager.setSpaceName('1', newName);

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            ...mockSpace,
            name: newName,
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
            lastModified: expect.any(Number)
          })
        })
      );
    });
  });

  describe('getSpaceName', () => {
    const mockSpace = {
      id: '1',
      name: 'Test Space',
      urls: ['https://example.com'],
      lastModified: 123456789
    };

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
    });

    it('should return space name for active space', async () => {
      storageManager.loadSpaces.mockResolvedValue({ '1': { ...mockSpace, named: false } });
      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });

    it('should return space name for closed space', async () => {
      storageManager.loadClosedSpaces.mockResolvedValue({ '1': { ...mockSpace, named: false } });
      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });

    it('should return default name for non-existent space', async () => {
      const name = await stateManager.getSpaceName('999');
      expect(name).toBe(`${DEFAULT_SPACE_NAME} 999`);
    });
  });

  describe('deleteClosedSpace', () => {
    const mockClosedSpace = {
      id: '2',
      name: 'Closed Space',
      urls: ['https://example.com'],
      lastModified: 123456789
    };

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ '2': { ...mockClosedSpace, named: false } });
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
      const otherClosedSpace = {
        id: '3',
        name: 'Other Closed Space',
        urls: ['https://example.com'],
        lastModified: 123456789
      };

      storageManager.loadClosedSpaces.mockResolvedValue({ '2': { ...mockClosedSpace, named: false }, '3': { ...otherClosedSpace, named: false } });

      await stateManager.deleteClosedSpace('2');

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({ '3': { ...otherClosedSpace, named: false } });
    });
  });

  describe('closeSpace', () => {
    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({ '1': { ...mockSpace, named: false } });
    });

    it('should close space and move it to closed spaces', async () => {
      await stateManager.closeSpace(1);

      expect(windowManager.closeWindow).toHaveBeenCalledWith(1);
      expect(storageManager.saveSpaces).toHaveBeenCalledWith({});
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            ...mockSpace,
            lastModified: expect.any(Number)
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
      const closedSpace = {
        id: '1',
        name: 'Closed Space',
        urls: ['https://example.com'],
        lastModified: Date.now()
      };

      storageManager.loadClosedSpaces.mockResolvedValue({ '1': { ...closedSpace, named: false } });

      await stateManager.closeSpace(1);

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({ '1': { ...closedSpace, named: false } });
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
      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      tabManager.getTabUrl.mockReturnValue('https://example.com');
    });

    it('should not recreate closed spaces', async () => {
      const closedSpace = {
        id: '1',
        name: 'Closed Space',
        urls: ['https://example.com'],
        lastModified: Date.now()
      };

      storageManager.loadClosedSpaces.mockResolvedValue({ '1': { ...closedSpace, named: false } });

      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.not.objectContaining({ '1': expect.any(Object) })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith(
        expect.objectContaining({ '1': expect.any(Object) })
      );
    });

    it('should handle new windows without affecting closed spaces', async () => {
      const newClosedSpace = {
        id: '2',
        name: 'New Closed Space',
        urls: ['https://example.com'],
        lastModified: Date.now()
      };

      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({ '1': expect.any(Object) })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith(
        expect.objectContaining({ '2': expect.any(Object) })
      );
    });
  });

  describe('restoreSpace', () => {
    const mockClosedSpace = {
      id: '1',
      name: 'Closed Space',
      urls: ['https://example.com'],
      lastModified: 123456789
    };

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ '1': { ...mockClosedSpace, named: false } });
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

    it('should handle atomic updates between active and closed spaces', async () => {
      const activeSpace = {
        id: '2',
        name: 'Active Space',
        urls: ['https://example.com'],
        lastModified: Date.now()
      };

      storageManager.loadSpaces.mockResolvedValue({ '2': { ...activeSpace, named: false } });

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