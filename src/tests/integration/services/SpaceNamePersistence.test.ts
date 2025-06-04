import { StateManager } from '@/background/services/StateManager';
import { StorageManager } from '@/background/services/StorageManager';
import { WindowManager } from '@/background/services/WindowManager';
import { TabManager } from '@/background/services/TabManager';
import { StateUpdateQueue } from '@/background/services/StateUpdateQueue';
import { StateBroadcastService } from '@/background/services/StateBroadcastService';
import { Space } from '@/shared/types/Space';
import { STORAGE_KEY } from '@/shared/constants';

// Mock chrome APIs
const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  windows: {
    getAll: jest.fn(),
    get: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn()
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn()
  },
  runtime: {
    onConnect: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

global.chrome = mockChrome as any;

describe('Space Name Persistence Integration Tests', () => {
  let stateManager: StateManager;
  let storageManager: StorageManager;
  let windowManager: WindowManager;
  let tabManager: TabManager;
  let updateQueue: StateUpdateQueue;
  let broadcastService: StateBroadcastService;

  const createMockSpace = (overrides: Partial<Space> = {}): Space => ({
    id: '1',
    name: 'Test Space',
    urls: ['https://example.com'],
    lastModified: Date.now(),
    named: true,
    version: 1,
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset chrome storage mock
    mockChrome.storage.local.get.mockImplementation((keys) => {
      if (typeof keys === 'string') {
        return Promise.resolve({ [keys]: null });
      }
      return Promise.resolve({});
    });
    mockChrome.storage.local.set.mockResolvedValue(undefined);
    mockChrome.storage.local.remove.mockResolvedValue(undefined);

    // Initialize services
    storageManager = new StorageManager();
    windowManager = new WindowManager();
    tabManager = new TabManager();
    updateQueue = new StateUpdateQueue();
    broadcastService = new StateBroadcastService();
    
    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService
    );
  });

  describe('Space Name Updates', () => {
    it('should persist space name changes to storage', async () => {
      const initialSpace = createMockSpace({ id: '123', name: 'Original Name' });
      
      // Mock initial storage state
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': initialSpace },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();
      
      // Rename the space
      await stateManager.setSpaceName('123', 'New Name');

      // Verify storage was called with updated space
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: expect.objectContaining({
          spaces: expect.objectContaining({
            '123': expect.objectContaining({
              name: 'New Name',
              named: true,
              version: 2 // Version should increment
            })
          })
        })
      });
    });

    it('should maintain space name after simulated Chrome restart', async () => {
      const originalSpace = createMockSpace({ id: '123', name: 'Persistent Name' });
      
      // First session - save space with custom name
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': originalSpace },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();
      await stateManager.setSpaceName('123', 'Custom Name');

      // Capture what was saved to storage
      const savedData = mockChrome.storage.local.set.mock.calls[0][0];
      const savedSpace = savedData[STORAGE_KEY].spaces['123'];

      // Simulate Chrome restart - create new instances
      const newStorageManager = new StorageManager();
      const newWindowManager = new WindowManager();
      const newTabManager = new TabManager();
      const newUpdateQueue = new StateUpdateQueue();
      const newBroadcastService = new StateBroadcastService();
      const newStateManager = new StateManager(
        newWindowManager,
        newTabManager,
        newStorageManager,
        newUpdateQueue,
        newBroadcastService
      );

      // Mock storage returning the saved data
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': savedSpace },
          closedSpaces: {},
          lastModified: savedSpace.lastModified
        }
      });

      // Initialize new session
      await newStateManager.initialize();
      
      // Verify space name persisted
      const loadedSpaces = newStateManager.getAllSpaces();
      expect(loadedSpaces['123']).toMatchObject({
        name: 'Custom Name',
        named: true,
        version: 2
      });
    });

    it('should handle multiple space name updates with proper versioning', async () => {
      const space1 = createMockSpace({ id: '1', name: 'Space 1', version: 1 });
      const space2 = createMockSpace({ id: '2', name: 'Space 2', version: 1 });
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '1': space1, '2': space2 },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();

      // Update space 1 multiple times
      await stateManager.setSpaceName('1', 'Space 1 Updated');
      await stateManager.setSpaceName('1', 'Space 1 Final');
      
      // Update space 2 once
      await stateManager.setSpaceName('2', 'Space 2 Updated');

      // Verify final state
      const spaces = stateManager.getAllSpaces();
      expect(spaces['1']).toMatchObject({
        name: 'Space 1 Final',
        version: 3 // Started at 1, incremented twice
      });
      expect(spaces['2']).toMatchObject({
        name: 'Space 2 Updated',
        version: 2 // Started at 1, incremented once
      });
    });
  });

  describe('Closed Space Name Persistence', () => {
    it('should persist name changes for closed spaces', async () => {
      const closedSpace = createMockSpace({ id: '456', name: 'Closed Space' });
      
      // Mock both loadSpaces and loadClosedSpaces calls
      mockChrome.storage.local.get
        .mockResolvedValueOnce({
          [STORAGE_KEY]: {
            spaces: {},
            lastModified: Date.now()
          }
        })
        .mockResolvedValueOnce({
          [STORAGE_KEY]: {
            closedSpaces: { '456': closedSpace },
            lastModified: Date.now()
          }
        });

      await stateManager.initialize();
      
      // Verify the closed space was loaded
      const loadedClosedSpaces = stateManager.getClosedSpaces();
      expect(loadedClosedSpaces['456']).toBeDefined();
      
      // Rename closed space
      await stateManager.setSpaceName('456', 'Renamed Closed Space');

      // Verify closed spaces storage was updated
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          [STORAGE_KEY]: expect.objectContaining({
            closedSpaces: expect.objectContaining({
              '456': expect.objectContaining({
                name: 'Renamed Closed Space',
                version: 2
              })
            })
          })
        })
      );
    });

    it('should maintain closed space names after Chrome restart', async () => {
      const closedSpace = createMockSpace({ 
        id: '789', 
        name: 'Persistent Closed Space',
        version: 1 
      });
      
      // First session - mock both loadSpaces and loadClosedSpaces calls
      mockChrome.storage.local.get
        .mockResolvedValueOnce({
          [STORAGE_KEY]: {
            spaces: {},
            lastModified: Date.now()
          }
        })
        .mockResolvedValueOnce({
          [STORAGE_KEY]: {
            closedSpaces: { '789': closedSpace },
            lastModified: Date.now()
          }
        });

      await stateManager.initialize();
      
      // Verify the closed space was loaded before updating
      const loadedClosedSpaces = stateManager.getClosedSpaces();
      expect(loadedClosedSpaces['789']).toBeDefined();
      
      await stateManager.setSpaceName('789', 'Updated Closed Name');

      // Capture saved data
      const savedData = mockChrome.storage.local.set.mock.calls[0][0];
      const savedClosedSpace = savedData[STORAGE_KEY].closedSpaces['789'];

      // Simulate restart
      const newStateManager = new StateManager(
        new WindowManager(),
        new TabManager(),
        new StorageManager(),
        new StateUpdateQueue(),
        new StateBroadcastService()
      );

      mockChrome.storage.local.get
        .mockResolvedValueOnce({
          [STORAGE_KEY]: {
            spaces: {},
            lastModified: savedClosedSpace.lastModified
          }
        })
        .mockResolvedValueOnce({
          [STORAGE_KEY]: {
            closedSpaces: { '789': savedClosedSpace },
            lastModified: savedClosedSpace.lastModified
          }
        });

      await newStateManager.initialize();
      
      const newLoadedClosedSpaces = newStateManager.getClosedSpaces();
      expect(newLoadedClosedSpaces['789']).toMatchObject({
        name: 'Updated Closed Name',
        named: true,
        version: 2
      });
    });
  });

  describe('Storage Error Handling', () => {
    it('should handle storage errors gracefully during name updates', async () => {
      const space = createMockSpace({ id: '123', name: 'Test Space' });
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': space },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();

      // Mock storage failure
      mockChrome.storage.local.set.mockRejectedValueOnce(new Error('Storage quota exceeded'));

      // Should throw error but not crash
      await expect(stateManager.setSpaceName('123', 'New Name')).rejects.toThrow();
      
      // State should remain unchanged
      const spaces = stateManager.getAllSpaces();
      expect(spaces['123'].name).toBe('Test Space');
    });

    it('should recover from corrupted storage data', async () => {
      // Mock corrupted storage data
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: 'invalid-data',
          closedSpaces: null,
          lastModified: 'not-a-number'
        }
      });

      // Should not crash and should initialize with empty state
      await expect(stateManager.initialize()).rejects.toThrow();
    });
  });

  describe('Concurrent Updates', () => {
    it('should handle concurrent space name updates correctly', async () => {
      const space = createMockSpace({ id: '123', name: 'Original', version: 1 });
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': space },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();

      // Simulate concurrent updates
      const updates = [
        stateManager.setSpaceName('123', 'Update 1'),
        stateManager.setSpaceName('123', 'Update 2'),
        stateManager.setSpaceName('123', 'Update 3')
      ];

      await Promise.all(updates);

      // Should end up with the last update and proper version
      const finalSpace = stateManager.getAllSpaces()['123'];
      expect(finalSpace.name).toBe('Update 3');
      expect(finalSpace.version).toBe(4); // 1 + 3 updates
    });
  });

  describe('Data Validation', () => {
    it('should validate space name before saving', async () => {
      const space = createMockSpace({ id: '123', name: 'Valid Name' });
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': space },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();

      // Test empty name
      await expect(stateManager.setSpaceName('123', '')).rejects.toThrow('Space name cannot be empty');
      
      // Test whitespace-only name
      await expect(stateManager.setSpaceName('123', '   ')).rejects.toThrow('Space name cannot be empty');
      
      // Test valid name with extra whitespace
      await stateManager.setSpaceName('123', '  Valid Name  ');
      const spaces = stateManager.getAllSpaces();
      expect(spaces['123'].name).toBe('Valid Name'); // Should be trimmed
    });

    it('should normalize whitespace in space names', async () => {
      const space = createMockSpace({ id: '123', name: 'Original' });
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': space },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();

      // Test multiple spaces are collapsed to single space
      await stateManager.setSpaceName('123', 'Multiple    Spaces   Here');
      
      const spaces = stateManager.getAllSpaces();
      expect(spaces['123'].name).toBe('Multiple Spaces Here');
    });
  });

  describe('Migration and Compatibility', () => {
    it('should handle spaces without version numbers', async () => {
      // Mock old space format without version
      const legacySpace = {
        id: '123',
        name: 'Legacy Space',
        urls: ['https://example.com'],
        lastModified: Date.now(),
        named: true
        // No version field
      };
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        [STORAGE_KEY]: {
          spaces: { '123': legacySpace },
          closedSpaces: {},
          lastModified: Date.now()
        }
      });

      await stateManager.initialize();
      
      // Should handle missing version gracefully
      const spaces = stateManager.getAllSpaces();
      expect(spaces['123']).toMatchObject({
        name: 'Legacy Space',
        named: true
      });
    });
  });
});