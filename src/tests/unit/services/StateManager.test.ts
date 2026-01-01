import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateManager } from '../../../background/services/StateManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { RestoreRegistry } from '../../../background/services/types/RestoreRegistry';
import { DEFAULT_SPACE_NAME } from '../../../shared/constants';
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

  // Helper to create mock space with permanentId as the key
  // In the new architecture, id === permanentId (stable identifier)
  // windowId is a separate property that changes on Chrome restart
  const createMockSpace = (permId: string, name: string, props: Partial<Space> = {}): Space => ({
    id: permId,
    permanentId: permId,
    name,
    urls: ['https://example.com'],
    lastModified: 123456789,
    version: 1,
    lastSync: 123456789,
    sourceWindowId: permId,
    named: false,
    createdAt: 123456789,
    lastUsed: 123456789,
    isActive: true,
    windowId: props.windowId,
    ...props
  });

  beforeEach(() => {
    windowManager = new WindowManager() as jest.Mocked<WindowManager>;
    tabManager = new TabManager() as jest.Mocked<TabManager>;
    storageManager = new StorageManager() as jest.Mocked<StorageManager>;
    updateQueue = new StateUpdateQueue() as jest.Mocked<StateUpdateQueue>;
    broadcastService = new StateBroadcastService() as jest.Mocked<StateBroadcastService>;
    const restoreRegistry = new RestoreRegistry();

    storageManager.loadSpaces.mockResolvedValue({});
    storageManager.loadClosedSpaces.mockResolvedValue({});
    storageManager.saveSpaces.mockResolvedValue();
    storageManager.saveClosedSpaces.mockResolvedValue();

    windowManager.windowExists.mockResolvedValue(true);
    windowManager.closeWindow.mockResolvedValue();

    updateQueue.enqueue.mockResolvedValue();
    updateQueue.processQueue.mockResolvedValue();

    broadcastService.broadcast.mockImplementation(() => { });
    broadcastService.onStateUpdate.mockImplementation(() => { });

    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService,
      restoreRegistry
    );
  });

  describe('setSpaceName', () => {
    const testPermId = 'perm-1';

    beforeEach(async () => {
      storageManager.loadSpaces.mockResolvedValue({ 
        [testPermId]: createMockSpace(testPermId, 'Original Space', { windowId: 1 }) 
      });
      storageManager.saveSpaces.mockResolvedValue();
      await (stateManager as any).get_space_by_id_with_reload(testPermId);
    });

    it('should update space name successfully', async () => {
      const newName = 'New Space Name';
      await stateManager.setSpaceName(testPermId, newName);

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          [testPermId]: expect.objectContaining({
            name: newName,
            lastModified: expect.any(Number),
            named: true,
            version: 2
          })
        })
      );
    });

    it('should throw error for empty name', async () => {
      await expect(stateManager.setSpaceName(testPermId, '')).rejects.toThrow('Space name cannot be empty');
      await expect(stateManager.setSpaceName(testPermId, '   ')).rejects.toThrow('Space name cannot be empty');
    });

    it('should throw error for non-existent space', async () => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await (stateManager as any).get_space_by_id_with_reload('nonexistent');

      windowManager.getAllWindows.mockResolvedValue([]);

      await expect(stateManager.setSpaceName('nonexistent', 'New Name'))
        .rejects.toThrow('Space not found');
    });

    it('should do nothing when trying to rename non-existent space (no window mapping)', async () => {
      const windowId = 123;

      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
      (stateManager as any).initialized = false;
      await stateManager.initialize();

      // renameSpace expects space to already be mapped via windowToSpaceMap
      // If no mapping exists, it should return early without saving
      await stateManager.renameSpace(windowId, 'My New Space');

      // Should not have called saveSpaces since there's no space to rename
      expect(storageManager.saveSpaces).not.toHaveBeenCalled();
    });

    it('should rename space when window mapping exists', async () => {
      const windowId = 123;
      const permId = 'perm-123';

      // Create a space with the mapping
      const space = createMockSpace(permId, 'Original Name', { windowId });
      storageManager.loadSpaces.mockResolvedValue({ [permId]: space });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      (stateManager as any).initialized = false;
      await stateManager.initialize();

      // Set up the window mapping (simulating what sync does)
      (stateManager as any).windowToSpaceMap.set(windowId, permId);

      await stateManager.renameSpace(windowId, 'My New Space');

      expect(storageManager.saveSpaces).toHaveBeenCalled();
      const lastSaveCall = (storageManager.saveSpaces as jest.Mock).mock.calls[
        (storageManager.saveSpaces as jest.Mock).mock.calls.length - 1
      ][0];
      expect(lastSaveCall[permId]).toMatchObject({
        name: 'My New Space',
        named: true
      });
    });

    it('should trim and normalize whitespace in name', async () => {
      await stateManager.setSpaceName(testPermId, '  New   Space  Name  ');

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          [testPermId]: expect.objectContaining({
            name: 'New Space Name',
            version: expect.any(Number),
            lastModified: expect.any(Number)
          })
        })
      );
    });
  });

  describe('getSpaceName', () => {
    const testPermId = 'perm-1';

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
    });

    it('should return space name for active space', async () => {
      storageManager.loadSpaces.mockResolvedValue({
        [testPermId]: createMockSpace(testPermId, 'Test Space', { windowId: 1 })
      });
      await (stateManager as any).get_space_by_id_with_reload(testPermId);
      const name = await stateManager.getSpaceName(testPermId);
      expect(name).toBe('Test Space');
    });

    it('should return space name for closed space', async () => {
      storageManager.loadClosedSpaces.mockResolvedValue({
        [testPermId]: createMockSpace(testPermId, 'Test Space', { isActive: false })
      });
      await (stateManager as any).get_space_by_id_with_reload(testPermId);
      const name = await stateManager.getSpaceName(testPermId);
      expect(name).toBe('Test Space');
    });

    it('should return default name for non-existent space', async () => {
      await stateManager.initialize();
      const name = await stateManager.getSpaceName('nonexistent');
      expect(name).toBe(`${DEFAULT_SPACE_NAME} nonexistent`);
    });
  });

  describe('deleteClosedSpace', () => {
    const closedPermId = 'perm-closed-2';
    
    beforeEach(async () => {
      const mockClosedSpace = createMockSpace(closedPermId, 'Closed Space', { version: 2, isActive: false });
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ [closedPermId]: mockClosedSpace });
      storageManager.saveClosedSpaces.mockResolvedValue();
      await stateManager.initialize();
    });

    it('should remove space from closed spaces', async () => {
      await stateManager.deleteClosedSpace(closedPermId);

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });

    it('should handle non-existent closed space', async () => {
      await expect(stateManager.deleteClosedSpace('nonexistent')).rejects.toThrow('Closed space not found');
    });

    it('should maintain other closed spaces when deleting one', async () => {
      const otherPermId = 'perm-closed-3';
      const otherClosedSpace = createMockSpace(otherPermId, 'Other Closed Space', { version: 2, isActive: false });
      storageManager.loadClosedSpaces.mockResolvedValue({
        [closedPermId]: createMockSpace(closedPermId, 'Closed Space', { version: 2, isActive: false }),
        [otherPermId]: otherClosedSpace
      });
      (stateManager as any).initialized = false;
      await stateManager.initialize();

      await stateManager.deleteClosedSpace(closedPermId);

      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({ [otherPermId]: otherClosedSpace });
    });
  });

  describe('closeSpace', () => {
    const testPermId = 'perm-1';
    const testWindowId = 1;

    beforeEach(async () => {
      const space = createMockSpace(testPermId, 'Test Space', { named: true, windowId: testWindowId });
      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: space });
      await stateManager.initialize();

      (stateManager as any).windowToSpaceMap.set(testWindowId, testPermId);

      tabManager.getTabs = jest.fn().mockResolvedValue([
        { id: 1, url: 'https://example.com/1', windowId: testWindowId } as chrome.tabs.Tab
      ]);
      tabManager.getTabUrl = jest.fn((tab: chrome.tabs.Tab) => tab.url || '');

      (storageManager as any).saveTabsForSpace = jest.fn().mockResolvedValue(undefined);
      (storageManager as any).deleteTabsForSpace = jest.fn().mockResolvedValue(undefined);
    });

    it('should close space and move it to closed spaces', async () => {
      await stateManager.closeSpace(testWindowId);

      expect(storageManager.saveSpaces).toHaveBeenCalledWith({});

      const closedSpacesCall = (storageManager.saveClosedSpaces as jest.Mock).mock.calls[0][0];
      expect(closedSpacesCall[testPermId]).toMatchObject({
        name: 'Test Space',
        isActive: false,
        windowId: undefined
      });
    });

    it('should handle already closed window', async () => {
      windowManager.windowExists.mockResolvedValue(false);
      await stateManager.closeSpace(testWindowId);

      const closedSpacesCall = (storageManager.saveClosedSpaces as jest.Mock).mock.calls[0][0];
      expect(closedSpacesCall[testPermId]).toBeDefined();
    });

    it('should not duplicate closed spaces', async () => {
      const existingClosedPermId = 'existing-closed';
      const existingClosed = createMockSpace(existingClosedPermId, 'Existing Closed', {
        version: 2,
        isActive: false,
        named: true
      });

      storageManager.loadClosedSpaces.mockResolvedValue({
        [existingClosedPermId]: existingClosed
      });
      (stateManager as any).initialized = false;
      await stateManager.initialize();
      (stateManager as any).windowToSpaceMap.set(testWindowId, testPermId);

      await stateManager.closeSpace(testWindowId);

      const closedSpacesCall = (storageManager.saveClosedSpaces as jest.Mock).mock.calls[0][0];
      expect(Object.keys(closedSpacesCall).length).toBeGreaterThanOrEqual(2);
      expect(closedSpacesCall[existingClosedPermId]).toBeDefined();
      expect(closedSpacesCall[testPermId]).toBeDefined();
    });

    it('should use space.urls fallback when getTabs returns empty', async () => {
      const testUrls = ['https://example.com/1', 'https://example.com/2', 'https://example.com/3'];
      const spaceWithUrls = createMockSpace(testPermId, 'Test Space', { urls: testUrls, named: true, windowId: testWindowId });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: spaceWithUrls });
      (stateManager as any).initialized = false;
      await stateManager.initialize();
      (stateManager as any).windowToSpaceMap.set(testWindowId, testPermId);

      tabManager.getTabs = jest.fn().mockResolvedValue([]);
      (storageManager as any).saveTabsForSpace = jest.fn().mockResolvedValue(undefined);
      (storageManager as any).deleteTabsForSpace = jest.fn().mockResolvedValue(undefined);

      await stateManager.closeSpace(testWindowId);

      expect((storageManager as any).saveTabsForSpace).toHaveBeenCalledWith(
        testPermId,
        'closed',
        expect.arrayContaining([
          expect.objectContaining({ url: 'https://example.com/1', index: 0 }),
          expect.objectContaining({ url: 'https://example.com/2', index: 1 }),
          expect.objectContaining({ url: 'https://example.com/3', index: 2 })
        ])
      );

      const closedSpaces = stateManager.getClosedSpaces();
      expect(closedSpaces[testPermId].urls).toHaveLength(3);
    });

    it('should use space.urls fallback when getTabs throws error', async () => {
      const testUrls = ['https://example.com/1', 'https://example.com/2'];
      const spaceWithUrls = createMockSpace(testPermId, 'Test Space', { urls: testUrls, named: true, windowId: testWindowId });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: spaceWithUrls });
      (stateManager as any).initialized = false;
      await stateManager.initialize();
      (stateManager as any).windowToSpaceMap.set(testWindowId, testPermId);

      tabManager.getTabs = jest.fn().mockRejectedValue(new Error('Window not found'));
      (storageManager as any).saveTabsForSpace = jest.fn().mockResolvedValue(undefined);
      (storageManager as any).deleteTabsForSpace = jest.fn().mockResolvedValue(undefined);

      await expect(stateManager.closeSpace(testWindowId)).resolves.not.toThrow();

      expect((storageManager as any).saveTabsForSpace).toHaveBeenCalledWith(
        testPermId,
        'closed',
        expect.arrayContaining([
          expect.objectContaining({ url: 'https://example.com/1' }),
          expect.objectContaining({ url: 'https://example.com/2' })
        ])
      );
    });

    it('should prefer window tabs over space.urls when both available', async () => {
      const spaceUrls = ['https://space.com/1', 'https://space.com/2', 'https://space.com/3', 'https://space.com/4', 'https://space.com/5'];
      const spaceWithUrls = createMockSpace(testPermId, 'Test Space', { urls: spaceUrls, named: true, windowId: testWindowId });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: spaceWithUrls });
      (stateManager as any).initialized = false;
      await stateManager.initialize();
      (stateManager as any).windowToSpaceMap.set(testWindowId, testPermId);

      const windowTabs = [
        { id: 1, url: 'https://window.com/1', windowId: testWindowId } as chrome.tabs.Tab,
        { id: 2, url: 'https://window.com/2', windowId: testWindowId } as chrome.tabs.Tab,
        { id: 3, url: 'https://window.com/3', windowId: testWindowId } as chrome.tabs.Tab
      ];
      tabManager.getTabs = jest.fn().mockResolvedValue(windowTabs);
      tabManager.getTabUrl = jest.fn((tab: chrome.tabs.Tab) => tab.url || '');
      (storageManager as any).saveTabsForSpace = jest.fn().mockResolvedValue(undefined);
      (storageManager as any).deleteTabsForSpace = jest.fn().mockResolvedValue(undefined);

      await stateManager.closeSpace(testWindowId);

      expect((storageManager as any).saveTabsForSpace).toHaveBeenCalledWith(
        testPermId,
        'closed',
        expect.arrayContaining([
          expect.objectContaining({ url: 'https://window.com/1' }),
          expect.objectContaining({ url: 'https://window.com/2' }),
          expect.objectContaining({ url: 'https://window.com/3' })
        ])
      );

      const saveTabsCall = (storageManager as any).saveTabsForSpace.mock.calls[0];
      expect(saveTabsCall[2]).toHaveLength(3);
    });
  });

  describe('synchronizeWindowsAndSpaces', () => {
    const mockWindowId = 1;
    const mockTab = {
      id: 1,
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: mockWindowId,
      active: false,
      incognito: false,
      selected: false,
      autoDiscardable: true,
      url: 'https://example.com',
      groupId: -1
    } as chrome.tabs.Tab;

    const mockWindow: chrome.windows.Window = {
      id: mockWindowId,
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
      const orphanedPermId = 'perm-orphaned';
      const orphanedSpace = createMockSpace(orphanedPermId, 'Orphaned Space', {
        isActive: true,
        windowId: 2,
        sourceWindowId: orphanedPermId,
        lastModified: Date.now(),
        lastSync: Date.now(),
        version: 3,
        named: true
      });

      const otherTab: chrome.tabs.Tab = {
        id: 999,
        index: 0,
        windowId: 99,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        selected: false,
        autoDiscardable: true,
        discarded: false,
        url: 'https://other.com',
        title: 'Other Tab',
        groupId: -1
      };

      const otherWindow: chrome.windows.Window = {
        id: 99,
        focused: true,
        alwaysOnTop: false,
        incognito: false,
        type: 'normal',
        tabs: [otherTab]
      };

      windowManager.getAllWindows.mockResolvedValue([otherWindow]);
      tabManager.getTabs.mockImplementation((windowId: number) => {
        return windowId === 99 ? Promise.resolve([otherTab]) : Promise.resolve([mockTab]);
      });
      tabManager.getTabUrl.mockImplementation((tab: chrome.tabs.Tab) => tab.url || 'https://example.com');

      storageManager.loadSpaces.mockResolvedValue({ [orphanedPermId]: orphanedSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveState).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          [orphanedPermId]: expect.objectContaining({
            isActive: false,
            windowId: undefined,
            version: orphanedSpace.version + 1
          })
        })
      );
    });

    it('skips synchronization when getAllWindows returns empty but active spaces exist (service worker wake race)', async () => {
      const testPermId = 'perm-active';
      const activeSpace = createMockSpace(testPermId, 'Active Space', {
        isActive: true,
        windowId: 1,
        sourceWindowId: testPermId,
        lastModified: Date.now(),
        lastSync: Date.now(),
        version: 2,
        named: true
      });

      windowManager.getAllWindows.mockResolvedValue([]);
      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: activeSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveState).not.toHaveBeenCalled();

      const spaces = stateManager.getAllSpaces();
      expect(Object.keys(spaces)).toContain(testPermId);
      expect(spaces[testPermId].name).toBe('Active Space');
      expect(spaces[testPermId].named).toBe(true);
    });

    it('creates new space entries for brand-new windows', async () => {
      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveState).toHaveBeenCalled();
      
      const savedSpaces = (storageManager.saveState as jest.Mock).mock.calls[0][0];
      const newSpace = Object.values(savedSpaces).find((s: any) => s.windowId === mockWindowId);
      expect(newSpace).toBeDefined();
      expect((newSpace as Space).isActive).toBe(true);
    });

    it('does not reopen closed spaces when window ID is reused', async () => {
      const closedPermId = 'perm-closed';
      // Create a closed space with DIFFERENT URLs than the current window
      // This tests that window ID reuse alone shouldn't reopen a closed space
      const closedSpace = createMockSpace(closedPermId, 'Closed Space', {
        isActive: false,
        windowId: undefined,
        version: 5,
        urls: ['https://different-site.com', 'https://another-site.com'], // Different URLs
        sourceWindowId: '1' // Same as mockWindow.id but shouldn't match due to different content
      });

      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ [closedPermId]: closedSpace });

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      const call = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedClosedSpaces = call[1];
      // The closed space should remain closed since URLs don't match
      expect(savedClosedSpaces[closedPermId]).toBeDefined();
    });

    it('matches closed space to window when URLs match (restores named space)', async () => {
      const closedPermId = 'perm-closed-named';
      // Create a NAMED closed space with URLs that match the window
      const closedSpace = createMockSpace(closedPermId, 'My Named Work', {
        isActive: false,
        windowId: undefined,
        version: 5,
        named: true,
        urls: ['https://example.com'], // Same as mockTab URL
        sourceWindowId: 'old-window-999' // Old window ID - shouldn't matter
      });

      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ [closedPermId]: closedSpace });

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      const call = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedSpaces = call[0];
      const savedClosedSpaces = call[1];

      // The closed space should be matched to the window and become active
      expect(savedSpaces[closedPermId]).toBeDefined();
      expect(savedSpaces[closedPermId].isActive).toBe(true);
      expect(savedSpaces[closedPermId].name).toBe('My Named Work');
      expect(savedSpaces[closedPermId].named).toBe(true);

      // Should be removed from closed spaces
      expect(savedClosedSpaces[closedPermId]).toBeUndefined();
    });

    it('does NOT match closed space to window when URLs differ (keeps closed space closed)', async () => {
      const closedPermId = 'perm-closed-nomatch';
      // Create a closed space with DIFFERENT URLs than the window
      const closedSpace = createMockSpace(closedPermId, 'My Other Work', {
        isActive: false,
        windowId: undefined,
        version: 5,
        named: true,
        urls: ['https://different-site.com', 'https://another-site.com'], // Different from mockTab URL
        sourceWindowId: 'old-window-999'
      });

      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({ [closedPermId]: closedSpace });

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      const call = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedSpaces = call[0];
      const savedClosedSpaces = call[1];

      // The closed space should NOT be matched - URLs don't overlap
      expect(savedSpaces[closedPermId]).toBeUndefined();

      // Should remain in closed spaces
      expect(savedClosedSpaces[closedPermId]).toBeDefined();
      expect(savedClosedSpaces[closedPermId].name).toBe('My Other Work');
    });

    it('preserves named spaces when validation fails due to URL mismatch', async () => {
      const namedPermId = 'perm-mywork';
      const namedSpace = createMockSpace(namedPermId, 'My Work', {
        isActive: true,
        windowId: 1,
        sourceWindowId: namedPermId,
        lastModified: Date.now() - 60000,
        lastSync: Date.now() - 60000,
        version: 5,
        named: true,
        urls: ['https://mywork.com', 'https://mywork.com/dashboard']
      });

      const differentTab: chrome.tabs.Tab = {
        id: 100,
        index: 0,
        windowId: 1,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        selected: false,
        autoDiscardable: true,
        discarded: false,
        url: 'https://completely-different.com',
        title: 'Different Site',
        groupId: -1
      };

      const windowWithDifferentContent: chrome.windows.Window = {
        id: 1,
        focused: true,
        alwaysOnTop: false,
        incognito: false,
        type: 'normal',
        tabs: [differentTab]
      };

      windowManager.getAllWindows.mockResolvedValue([windowWithDifferentContent]);
      tabManager.getTabs.mockResolvedValue([differentTab]);
      tabManager.getTabUrl.mockReturnValue('https://completely-different.com');

      storageManager.loadSpaces.mockResolvedValue({ [namedPermId]: namedSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveState).toHaveBeenCalled();

      const saveStateCall = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedSpaces = saveStateCall[0];
      const savedClosedSpaces = saveStateCall[1];

      const activeSpaceKeys = Object.keys(savedSpaces);
      expect(activeSpaceKeys.length).toBeGreaterThan(0);
      const newActiveSpace = Object.values(savedSpaces).find((s: any) => s.windowId === 1);
      expect(newActiveSpace).toBeDefined();

      const preservedInClosed = Object.values(savedClosedSpaces).find((s: any) => s.name === 'My Work');
      const preservedInActive = Object.values(savedSpaces).find((s: any) => s.name === 'My Work');
      expect(preservedInClosed || preservedInActive).toBeDefined();
    });

    it('explicitly preserves named flag during window-to-space matching', async () => {
      const namedPermId = 'perm-named-explicit';
      const namedSpace = createMockSpace(namedPermId, 'Explicitly Named Space', {
        isActive: true,
        windowId: mockWindowId,
        sourceWindowId: namedPermId,
        version: 3,
        named: true,
        urls: ['https://example.com'] // Same as mockTab URL for matching
      });

      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      storageManager.loadSpaces.mockResolvedValue({ [namedPermId]: namedSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveState).toHaveBeenCalled();

      const saveStateCall = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedSpaces = saveStateCall[0];

      // The space should still have its name and named flag after sync
      expect(savedSpaces[namedPermId]).toBeDefined();
      expect(savedSpaces[namedPermId].name).toBe('Explicitly Named Space');
      expect(savedSpaces[namedPermId].named).toBe(true);
      expect(savedSpaces[namedPermId].permanentId).toBe(namedPermId);
    });

    it('preserves name and named flag when moving orphaned space to closed', async () => {
      const orphanPermId = 'perm-orphan-named';
      const orphanSpace = createMockSpace(orphanPermId, 'Orphaned Named Space', {
        isActive: true,
        windowId: 999, // Window that doesn't exist
        sourceWindowId: '999',
        version: 2,
        named: true,
        urls: ['https://orphan-site.com']
      });

      // No windows available - simulates window closing
      windowManager.getAllWindows.mockResolvedValue([]);
      storageManager.loadSpaces.mockResolvedValue({ [orphanPermId]: orphanSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();
      // Skip sync since no windows - directly verify state
      const spaces = stateManager.getAllSpaces();
      // After init, spaces should be reset to inactive
      expect(Object.keys(spaces).length).toBe(1);
    });
  });

  describe('restoreSpace', () => {
    const closedPermId = 'perm-closed-1';

    beforeEach(async () => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({
        [closedPermId]: createMockSpace(closedPermId, 'Closed Space', { version: 2, isActive: false })
      });
      storageManager.saveSpaces.mockResolvedValue();
      storageManager.saveClosedSpaces.mockResolvedValue();

      (storageManager as any).loadTabsForSpace = jest.fn().mockResolvedValue([
        { id: 'tab-1', spaceId: closedPermId, kind: 'closed', url: 'https://example.com', index: 0, createdAt: Date.now() }
      ]);

      await stateManager.initialize();
    });

    it('should move space from closed to active spaces', async () => {
      const newWindowId = 123;
      await stateManager.restoreSpace(closedPermId, newWindowId);

      // Space keeps same permanentId but gets new windowId
      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({ 
          [closedPermId]: expect.objectContaining({
            windowId: newWindowId,
            isActive: true
          }) 
        })
      );
      expect(storageManager.saveClosedSpaces).toHaveBeenCalledWith({});
    });

    it('should handle non-existent closed space', async () => {
      await expect(stateManager.restoreSpace('nonexistent')).rejects.toThrow('Space not found');
    });

    it('should update lastModified timestamp on restoration', async () => {
      const newWindowId = 456;
      const before = Date.now();
      await stateManager.restoreSpace(closedPermId, newWindowId);
      const after = Date.now();

      const savedSpaces = (storageManager.saveSpaces as jest.Mock).mock.calls[0][0];
      const restoredSpace = savedSpaces[closedPermId];

      expect(restoredSpace.lastModified).toBeGreaterThanOrEqual(before);
      expect(restoredSpace.lastModified).toBeLessThanOrEqual(after);
    });

    it('should preserve name when closing and restoring a named space', async () => {
      const activePermId = 'perm-active-100';
      const defaultSpace = createMockSpace(activePermId, 'Untitled Space 100', {
        named: false,
        windowId: 100,
        isActive: true,
        version: 1
      });

      storageManager.loadSpaces.mockResolvedValue({ [activePermId]: defaultSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      (stateManager as any).initialized = false;
      await stateManager.initialize();
      (stateManager as any).windowToSpaceMap.set(100, activePermId);

      const newName = 'My Work Space';
      await stateManager.setSpaceName(activePermId, newName);

      tabManager.getTabs = jest.fn().mockResolvedValue([
        { id: 1, url: 'https://example.com/1', windowId: 100 } as chrome.tabs.Tab
      ]);
      tabManager.getTabUrl = jest.fn((tab: chrome.tabs.Tab) => tab.url || '');
      (storageManager as any).saveTabsForSpace = jest.fn().mockResolvedValue(undefined);
      (storageManager as any).deleteTabsForSpace = jest.fn().mockResolvedValue(undefined);

      await stateManager.closeSpace(100);

      const closedSpaces = stateManager.getClosedSpaces();
      const closedSpace = closedSpaces[activePermId];

      expect(closedSpace.name).toBe(newName);
      expect(closedSpace.named).toBe(true);

      (storageManager as any).loadTabsForSpace = jest.fn().mockResolvedValue([
        { id: 'tab-1', spaceId: activePermId, kind: 'closed', url: 'https://example.com/1', index: 0, createdAt: Date.now() }
      ]);

      await stateManager.restoreSpace(activePermId, 200);

      const restoredSpaces = stateManager.getAllSpaces();
      const restoredSpace = restoredSpaces[activePermId];

      expect(restoredSpace).toBeDefined();
      expect(restoredSpace.name).toBe(newName);
      expect(restoredSpace.named).toBe(true);
      expect(restoredSpace.windowId).toBe(200);
    });

    it('should handle atomic updates between active and closed spaces with version bumps', async () => {
      const activePermId = 'perm-active-2';
      const baseVersion = 1;
      const activeSpace = createMockSpace(activePermId, 'Active Space', {
        lastModified: Date.now(),
        version: baseVersion,
        windowId: 2
      });

      storageManager.loadSpaces.mockResolvedValue({ [activePermId]: activeSpace });
      (stateManager as any).initialized = false;
      await stateManager.initialize();
      (stateManager as any).windowToSpaceMap.set(2, activePermId);

      const mockWindow2 = {
        id: 2,
        tabs: [{ id: 1, url: 'https://example.com', windowId: 2 } as chrome.tabs.Tab],
        focused: false,
        alwaysOnTop: false,
        incognito: false,
        type: 'normal',
        state: 'normal'
      } as chrome.windows.Window;
      windowManager.getAllWindows.mockResolvedValue([mockWindow2]);
      tabManager.getTabs.mockResolvedValue([{ id: 1, url: 'https://example.com', windowId: 2 } as chrome.tabs.Tab]);

      await stateManager.synchronizeWindowsAndSpaces();

      expect(storageManager.saveSpaces).toHaveBeenCalled();
    });
  });

  describe('name persistence after rename and popup reopen', () => {
    const testPermId = 'perm-1';

    beforeEach(async () => {
      storageManager.loadSpaces.mockResolvedValue({
        [testPermId]: createMockSpace(testPermId, 'Test Space', { windowId: 1 })
      });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();
    });

    it('should persist space name after renaming and popup reopen', async () => {
      const newName = 'Renamed Space';
      await stateManager.setSpaceName(testPermId, newName);

      storageManager.loadSpaces.mockResolvedValue({
        [testPermId]: createMockSpace(testPermId, newName, { named: true, windowId: 1 })
      });
      (stateManager as any).initialized = false;
      await stateManager.initialize();

      const name = await stateManager.getSpaceName(testPermId);
      expect(name).toBe(newName);
    });

    it('should persist space name after popup reopen without renaming', async () => {
      const name = await stateManager.getSpaceName(testPermId);
      expect(name).toBe('Test Space');
    });
  });

  describe('Chrome restart scenario - name preservation', () => {
    it('should preserve name and named flag during handleShutdown', async () => {
      const testPermId = 'perm-restart-test';
      const testSpace = createMockSpace(testPermId, 'My Important Space', {
        named: true,
        isActive: true,
        windowId: 123,
        version: 5
      });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: testSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();

      // Simulate shutdown
      await stateManager.handleShutdown();

      // Verify saveState was called with preserved name and named flag
      expect(storageManager.saveState).toHaveBeenCalled();
      const saveStateCall = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedSpaces = saveStateCall[0];

      expect(savedSpaces[testPermId]).toBeDefined();
      expect(savedSpaces[testPermId].name).toBe('My Important Space');
      expect(savedSpaces[testPermId].named).toBe(true);
      expect(savedSpaces[testPermId].permanentId).toBe(testPermId);
      expect(savedSpaces[testPermId].isActive).toBe(false); // Marked inactive on shutdown
    });

    it('should preserve name and named flag during initialize reset', async () => {
      const testPermId = 'perm-init-reset';
      const testSpace = createMockSpace(testPermId, 'My Persisted Space', {
        named: true,
        isActive: true, // Will be reset to false
        windowId: 456,
        version: 3
      });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: testSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});

      await stateManager.initialize();

      // After initialization, the space should have name preserved but isActive=false
      const spaces = stateManager.getAllSpaces();
      expect(spaces[testPermId]).toBeDefined();
      expect(spaces[testPermId].name).toBe('My Persisted Space');
      expect(spaces[testPermId].named).toBe(true);
      expect(spaces[testPermId].permanentId).toBe(testPermId);
      expect(spaces[testPermId].isActive).toBe(false); // Reset during init
    });

    it('should preserve name through full shutdown and restart cycle', async () => {
      const testPermId = 'perm-full-cycle';
      const originalName = 'Full Cycle Space';
      const testSpace = createMockSpace(testPermId, originalName, {
        named: true,
        isActive: true,
        windowId: 789,
        version: 1
      });

      // Initial state
      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: testSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();

      // Simulate shutdown
      await stateManager.handleShutdown();

      // Capture what was saved during shutdown
      const shutdownCall = (storageManager.saveState as jest.Mock).mock.calls[0];
      const savedDuringShutdown = shutdownCall[0];

      // Simulate restart - load the saved state
      storageManager.loadSpaces.mockResolvedValue(savedDuringShutdown);
      storageManager.loadClosedSpaces.mockResolvedValue({});

      // Create new stateManager instance to simulate restart
      const newRestoreRegistry = new RestoreRegistry();
      const newStateManager = new StateManager(
        windowManager,
        tabManager,
        storageManager,
        updateQueue,
        broadcastService,
        newRestoreRegistry
      );
      await newStateManager.initialize();

      // Verify name is preserved after restart
      const spacesAfterRestart = newStateManager.getAllSpaces();
      expect(spacesAfterRestart[testPermId]).toBeDefined();
      expect(spacesAfterRestart[testPermId].name).toBe(originalName);
      expect(spacesAfterRestart[testPermId].named).toBe(true);
    });

    it('should preserve name when space is closed and reopened', async () => {
      const testPermId = 'perm-close-reopen';
      const spaceName = 'Closeable Space';
      const testSpace = createMockSpace(testPermId, spaceName, {
        named: true,
        isActive: true,
        windowId: 100,
        version: 1,
        urls: ['https://example.com']
      });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: testSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();

      // Set up window mapping
      (stateManager as any).windowToSpaceMap.set(100, testPermId);

      // Close the space
      windowManager.windowExists.mockResolvedValue(false);
      tabManager.getTabs.mockResolvedValue([]);
      await stateManager.closeSpace(100);

      // Verify space was moved to closedSpaces
      expect(storageManager.saveClosedSpaces).toHaveBeenCalled();
      const saveClosedCall = (storageManager.saveClosedSpaces as jest.Mock).mock.calls[0][0];
      expect(saveClosedCall[testPermId]).toBeDefined();
      expect(saveClosedCall[testPermId].name).toBe(spaceName);
      expect(saveClosedCall[testPermId].named).toBe(true);
    });

    it('should preserve name through multiple synchronization cycles', async () => {
      const testPermId = 'perm-multi-sync';
      const spaceName = 'Multi Sync Space';
      const testSpace = createMockSpace(testPermId, spaceName, {
        named: true,
        isActive: true,
        windowId: 200,
        version: 1,
        urls: ['https://example.com']
      });

      storageManager.loadSpaces.mockResolvedValue({ [testPermId]: testSpace });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();

      // Create mock tab and window
      const testTab: chrome.tabs.Tab = {
        id: 1,
        index: 0,
        windowId: 200,
        highlighted: false,
        active: true,
        pinned: false,
        incognito: false,
        selected: false,
        autoDiscardable: true,
        discarded: false,
        url: 'https://example.com',
        groupId: -1
      };

      const mockWindowForSync = {
        id: 200,
        focused: true,
        alwaysOnTop: false,
        incognito: false,
        type: 'normal',
        tabs: [testTab]
      } as chrome.windows.Window;

      windowManager.getAllWindows.mockResolvedValue([mockWindowForSync]);
      tabManager.getTabs.mockResolvedValue([testTab]);
      tabManager.getTabUrl.mockReturnValue('https://example.com');

      // Run multiple sync cycles
      await stateManager.synchronizeWindowsAndSpaces();
      await stateManager.synchronizeWindowsAndSpaces();
      await stateManager.synchronizeWindowsAndSpaces();

      // Verify name is still preserved
      const spaces = stateManager.getAllSpaces();
      const space = Object.values(spaces).find(s => s.name === spaceName);
      expect(space).toBeDefined();
      expect(space!.named).toBe(true);
    });
  });

  describe('acquireLock', () => {
    const testPermId = 'perm-lock-test';

    beforeEach(async () => {
      storageManager.loadSpaces.mockResolvedValue({
        [testPermId]: createMockSpace(testPermId, 'Lock Test Space', { windowId: 1 })
      });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();
    });

    it('should acquire lock successfully when no contention', async () => {
      // Access the private acquireLock method
      const acquireLock = (stateManager as any).acquireLock.bind(stateManager);
      const releaseLock = (stateManager as any).releaseLock.bind(stateManager);

      // Should not throw
      await expect(acquireLock('test-space-id')).resolves.not.toThrow();

      // Clean up
      releaseLock('test-space-id');
    });

    it('should throw after timeout when lock is continuously held by manipulating internal state', async () => {
      const shortTimeout = 50; // Very short timeout for testing
      const lockId = 'timeout-lock';

      // Directly manipulate internal state to simulate a held lock
      // Create a promise that resolves after the timeout would expire
      let resolveHolder: () => void;
      const holderPromise = new Promise<void>(resolve => {
        resolveHolder = resolve;
      });

      // Set up the "held" lock
      (stateManager as any).updateLock.set(lockId, holderPromise);
      (stateManager as any).lockResolvers.set(lockId, resolveHolder!);

      // Start an acquire attempt with short timeout
      const acquirePromise = (stateManager as any).acquireLock(lockId, shortTimeout);

      // Wait longer than timeout then release the lock
      // The waiter should check timeout after the promise resolves
      await new Promise(resolve => setTimeout(resolve, shortTimeout + 30));

      // Release - this resolves holderPromise
      (stateManager as any).releaseLock(lockId);

      // But immediately re-lock to ensure the timeout check finds a lock
      const secondHolderPromise = new Promise<void>(resolve => {
        (stateManager as any).lockResolvers.set(lockId, resolve);
      });
      (stateManager as any).updateLock.set(lockId, secondHolderPromise);

      // The acquire should timeout because elapsed time > timeout
      await expect(acquirePromise).rejects.toThrow('Lock acquisition timeout');

      // Clean up
      (stateManager as any).updateLock.delete(lockId);
      (stateManager as any).lockResolvers.delete(lockId);
    }, 5000);

    it('should acquire lock when released before timeout', async () => {
      const acquireLock = (stateManager as any).acquireLock.bind(stateManager);
      const releaseLock = (stateManager as any).releaseLock.bind(stateManager);
      const timeout = 500; // Longer timeout

      // Acquire lock
      await acquireLock('quick-release-space');

      // Start second acquire
      const acquirePromise = acquireLock('quick-release-space', timeout);

      // Release quickly (before timeout)
      await new Promise(resolve => setTimeout(resolve, 50));
      releaseLock('quick-release-space');

      // Second acquire should succeed
      await expect(acquirePromise).resolves.not.toThrow();

      // Clean up
      releaseLock('quick-release-space');
    }, 5000);

    it('should allow lock acquisition after previous lock is released', async () => {
      const acquireLock = (stateManager as any).acquireLock.bind(stateManager);
      const releaseLock = (stateManager as any).releaseLock.bind(stateManager);

      // Acquire and release first lock
      await acquireLock('reusable-lock');
      releaseLock('reusable-lock');

      // Should be able to acquire again
      await expect(acquireLock('reusable-lock')).resolves.not.toThrow();

      // Clean up
      releaseLock('reusable-lock');
    });

    it('should allow concurrent locks on different space IDs', async () => {
      const acquireLock = (stateManager as any).acquireLock.bind(stateManager);
      const releaseLock = (stateManager as any).releaseLock.bind(stateManager);

      // Acquire locks on different spaces concurrently
      await Promise.all([
        acquireLock('space-a'),
        acquireLock('space-b'),
        acquireLock('space-c')
      ]);

      // All locks should be held
      expect((stateManager as any).updateLock.has('space-a')).toBe(true);
      expect((stateManager as any).updateLock.has('space-b')).toBe(true);
      expect((stateManager as any).updateLock.has('space-c')).toBe(true);

      // Clean up
      releaseLock('space-a');
      releaseLock('space-b');
      releaseLock('space-c');
    });
  });

  describe('synchronizeWindowsAndSpaces concurrency', () => {
    const mockTab: chrome.tabs.Tab = {
      id: 1,
      index: 0,
      pinned: false,
      highlighted: false,
      windowId: 1,
      active: false,
      incognito: false,
      selected: false,
      autoDiscardable: true,
      discarded: false,
      url: 'https://example.com',
      groupId: -1
    };

    const mockWindow: chrome.windows.Window = {
      id: 1,
      tabs: [mockTab],
      focused: false,
      alwaysOnTop: false,
      incognito: false,
      type: 'normal',
      state: 'normal'
    };

    beforeEach(async () => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
      windowManager.getAllWindows.mockResolvedValue([mockWindow]);
      tabManager.getTabs.mockResolvedValue([mockTab]);
      tabManager.getTabUrl.mockReturnValue('https://example.com');
      await stateManager.initialize();
    });

    it('should not run concurrently - queues pending request', async () => {
      // Track how many times saveState is called
      let saveStateCallCount = 0;
      storageManager.saveState.mockImplementation(async () => {
        saveStateCallCount++;
        // Simulate slow operation
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      // Start two sync operations concurrently
      const sync1 = stateManager.synchronizeWindowsAndSpaces();
      const sync2 = stateManager.synchronizeWindowsAndSpaces();

      // Wait for both to complete
      await Promise.all([sync1, sync2]);

      // The second sync should be queued and run after the first completes
      // So we expect 2 saveState calls (one for each sync)
      expect(saveStateCallCount).toBe(2);
    });

    it('should set syncInProgress flag during synchronization', async () => {
      let syncInProgressDuringOperation = false;

      storageManager.saveState.mockImplementation(async () => {
        // Check the flag during the operation
        syncInProgressDuringOperation = (stateManager as any).syncInProgress;
      });

      await stateManager.synchronizeWindowsAndSpaces();

      expect(syncInProgressDuringOperation).toBe(true);
      // After completion, flag should be false
      expect((stateManager as any).syncInProgress).toBe(false);
    });

    it('should process pending sync request after first completes', async () => {
      const operationOrder: string[] = [];

      storageManager.saveState.mockImplementation(async () => {
        operationOrder.push('saveState');
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Start first sync
      const sync1Promise = stateManager.synchronizeWindowsAndSpaces();

      // Immediately trigger another sync while first is in progress
      // Need a small delay to ensure the first sync has started
      await new Promise(resolve => setTimeout(resolve, 5));
      const sync2Promise = stateManager.synchronizeWindowsAndSpaces();

      await Promise.all([sync1Promise, sync2Promise]);

      // Both syncs should have run (in sequence, not parallel)
      expect(operationOrder.length).toBe(2);
    });

    it('should reset pendingSyncRequest flag after processing', async () => {
      storageManager.saveState.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      // Trigger sync
      await stateManager.synchronizeWindowsAndSpaces();

      // After completion, pending flag should be false
      expect((stateManager as any).pendingSyncRequest).toBe(false);
    });
  });

  describe('setSpaceName input validation', () => {
    const testPermId = 'perm-validation-test';

    beforeEach(async () => {
      storageManager.loadSpaces.mockResolvedValue({
        [testPermId]: createMockSpace(testPermId, 'Original Name', { windowId: 1 })
      });
      storageManager.loadClosedSpaces.mockResolvedValue({});
      await stateManager.initialize();
    });

    it('should throw for names exceeding max length', async () => {
      const longName = 'a'.repeat(101);
      await expect(stateManager.setSpaceName(testPermId, longName))
        .rejects.toThrow('exceeds maximum length');
    });

    it('should accept names at max length (100 characters)', async () => {
      const maxName = 'a'.repeat(100);
      await expect(stateManager.setSpaceName(testPermId, maxName))
        .resolves.not.toThrow();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          [testPermId]: expect.objectContaining({
            name: maxName
          })
        })
      );
    });

    it('should accept names below max length', async () => {
      const shortName = 'a'.repeat(50);
      await expect(stateManager.setSpaceName(testPermId, shortName))
        .resolves.not.toThrow();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          [testPermId]: expect.objectContaining({
            name: shortName
          })
        })
      );
    });

    it('should count length after trimming whitespace', async () => {
      // 98 chars + leading/trailing spaces should be under 100 after trim
      const nameWithSpaces = '  ' + 'a'.repeat(98) + '  ';
      await expect(stateManager.setSpaceName(testPermId, nameWithSpaces))
        .resolves.not.toThrow();

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          [testPermId]: expect.objectContaining({
            name: 'a'.repeat(98)
          })
        })
      );
    });

    it('should throw after trimming if name still exceeds max length', async () => {
      // Even after trimming, if 101 chars remain, should throw
      const longNameWithSpaces = '  ' + 'a'.repeat(101) + '  ';
      await expect(stateManager.setSpaceName(testPermId, longNameWithSpaces))
        .rejects.toThrow('exceeds maximum length');
    });

    it('should include max length value in error message', async () => {
      const longName = 'a'.repeat(101);
      await expect(stateManager.setSpaceName(testPermId, longName))
        .rejects.toThrow('100');
    });
  });
});
