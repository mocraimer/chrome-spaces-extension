import { IndexedDbStorageManager } from '../../../../background/services/storage/IndexedDbStorageManager';
import { Space } from '../../../../shared/types/Space';
import { getDb } from '../../../../shared/db/indexedDb';
import { executeChromeApi } from '../../../../shared/utils';

// Mock the executeChromeApi for bootstrap import
jest.mock('../../../../shared/utils', () => ({
  executeChromeApi: jest.fn(),
  typeGuards: {
    space: jest.fn((x: any) => {
      return x && typeof x === 'object' && typeof x.id === 'string' && Array.isArray(x.urls);
    })
  }
}));

describe('IndexedDbStorageManager', () => {
  let storageManager: IndexedDbStorageManager;
  let db: Awaited<ReturnType<typeof getDb>>;

  beforeEach(async () => {
    // Clear IndexedDB before each test
    db = await getDb();
    await db.clear('spaces');
    await db.clear('closedSpaces');
    await db.clear('tabs');
    await db.clear('meta');

    storageManager = new IndexedDbStorageManager();
    jest.clearAllMocks();
    (executeChromeApi as jest.Mock).mockResolvedValue({});
  });

  afterEach(async () => {
    await db.clear('spaces');
    await db.clear('closedSpaces');
    await db.clear('tabs');
    await db.clear('meta');
  });

  const createMockSpace = (id: string, overrides?: Partial<Space>): Space => ({
    id,
    name: `Space ${id}`,
    urls: [`https://example.com/${id}`],
    lastModified: Date.now(),
    named: false,
    version: 1,
    permanentId: `perm_${id}`,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    isActive: true,
    ...overrides
  });

  describe('saveSpaces and loadSpaces', () => {
    it('should save and load spaces', async () => {
      const spaces: Record<string, Space> = {
        '1': createMockSpace('1'),
        '2': createMockSpace('2')
      };

      await storageManager.saveSpaces(spaces);
      const loaded = await storageManager.loadSpaces();

      expect(Object.keys(loaded)).toHaveLength(2);
      expect(loaded['1']?.id).toBe('1');
      expect(loaded['2']?.id).toBe('2');
    });

    it('should replace existing spaces on save', async () => {
      const initial: Record<string, Space> = {
        '1': createMockSpace('1', { name: 'Initial' })
      };
      await storageManager.saveSpaces(initial);

      const updated: Record<string, Space> = {
        '2': createMockSpace('2', { name: 'Updated' })
      };
      await storageManager.saveSpaces(updated);

      const loaded = await storageManager.loadSpaces();
      expect(Object.keys(loaded)).toHaveLength(1);
      expect(loaded['2']?.name).toBe('Updated');
      expect(loaded['1']).toBeUndefined();
    });
  });

  describe('saveClosedSpaces and loadClosedSpaces', () => {
    it('should save and load closed spaces', async () => {
      const closedSpaces: Record<string, Space> = {
        'uuid-1': createMockSpace('uuid-1', { isActive: false }),
        'uuid-2': createMockSpace('uuid-2', { isActive: false })
      };

      await storageManager.saveClosedSpaces(closedSpaces);
      const loaded = await storageManager.loadClosedSpaces();

      expect(Object.keys(loaded)).toHaveLength(2);
      expect(loaded['uuid-1']?.id).toBe('uuid-1');
      expect(loaded['uuid-2']?.id).toBe('uuid-2');
    });

    it('should replace existing closed spaces on save', async () => {
      const initial: Record<string, Space> = {
        'uuid-1': createMockSpace('uuid-1', { name: 'Initial Closed' })
      };
      await storageManager.saveClosedSpaces(initial);

      const updated: Record<string, Space> = {
        'uuid-2': createMockSpace('uuid-2', { name: 'Updated Closed' })
      };
      await storageManager.saveClosedSpaces(updated);

      const loaded = await storageManager.loadClosedSpaces();
      expect(Object.keys(loaded)).toHaveLength(1);
      expect(loaded['uuid-2']?.name).toBe('Updated Closed');
      expect(loaded['uuid-1']).toBeUndefined();
    });
  });

  describe('loadClosedSpaces with tabs', () => {
    it('should populate urls from tabs store when loading closed spaces', async () => {
      const spaceId = 'uuid-closed-1';

      // Save a closed space with empty urls
      const closedSpace: Record<string, Space> = {
        [spaceId]: createMockSpace(spaceId, {
          isActive: false,
          urls: [] // Empty initially
        })
      };
      await storageManager.saveClosedSpaces(closedSpace);

      // Save tabs for this closed space
      const tabs = [
        {
          id: 'tab-1',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/tab1',
          index: 0,
          createdAt: Date.now()
        },
        {
          id: 'tab-2',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/tab2',
          index: 1,
          createdAt: Date.now()
        },
        {
          id: 'tab-3',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/tab3',
          index: 2,
          createdAt: Date.now()
        }
      ];
      await storageManager.saveTabsForSpace(spaceId, 'closed', tabs);

      // Load closed spaces - should populate urls from tabs
      const loaded = await storageManager.loadClosedSpaces();

      expect(loaded[spaceId]).toBeDefined();
      expect(loaded[spaceId].urls).toHaveLength(3);
      expect(loaded[spaceId].urls[0]).toBe('https://example.com/tab1');
      expect(loaded[spaceId].urls[1]).toBe('https://example.com/tab2');
      expect(loaded[spaceId].urls[2]).toBe('https://example.com/tab3');
    });

    it('should handle closed space with no tabs', async () => {
      const spaceId = 'uuid-closed-2';

      // Save a closed space with empty urls and no tabs
      const closedSpace: Record<string, Space> = {
        [spaceId]: createMockSpace(spaceId, {
          isActive: false,
          urls: []
        })
      };
      await storageManager.saveClosedSpaces(closedSpace);

      // Don't save any tabs for this space

      // Load closed spaces - should return space with empty urls (no crash)
      const loaded = await storageManager.loadClosedSpaces();

      expect(loaded[spaceId]).toBeDefined();
      expect(loaded[spaceId].urls).toHaveLength(0);
    });

    it('should load tabs for multiple closed spaces', async () => {
      const spaceId1 = 'uuid-closed-3';
      const spaceId2 = 'uuid-closed-4';

      // Save two closed spaces
      const closedSpaces: Record<string, Space> = {
        [spaceId1]: createMockSpace(spaceId1, { isActive: false, urls: [] }),
        [spaceId2]: createMockSpace(spaceId2, { isActive: false, urls: [] })
      };
      await storageManager.saveClosedSpaces(closedSpaces);

      // Save 2 tabs for first space
      const tabs1 = [
        {
          id: 'tab-1-1',
          spaceId: spaceId1,
          kind: 'closed' as const,
          url: 'https://space1.com/tab1',
          index: 0,
          createdAt: Date.now()
        },
        {
          id: 'tab-1-2',
          spaceId: spaceId1,
          kind: 'closed' as const,
          url: 'https://space1.com/tab2',
          index: 1,
          createdAt: Date.now()
        }
      ];
      await storageManager.saveTabsForSpace(spaceId1, 'closed', tabs1);

      // Save 3 tabs for second space
      const tabs2 = [
        {
          id: 'tab-2-1',
          spaceId: spaceId2,
          kind: 'closed' as const,
          url: 'https://space2.com/tab1',
          index: 0,
          createdAt: Date.now()
        },
        {
          id: 'tab-2-2',
          spaceId: spaceId2,
          kind: 'closed' as const,
          url: 'https://space2.com/tab2',
          index: 1,
          createdAt: Date.now()
        },
        {
          id: 'tab-2-3',
          spaceId: spaceId2,
          kind: 'closed' as const,
          url: 'https://space2.com/tab3',
          index: 2,
          createdAt: Date.now()
        }
      ];
      await storageManager.saveTabsForSpace(spaceId2, 'closed', tabs2);

      // Load closed spaces
      const loaded = await storageManager.loadClosedSpaces();

      // Verify first space has 2 urls
      expect(loaded[spaceId1]).toBeDefined();
      expect(loaded[spaceId1].urls).toHaveLength(2);
      expect(loaded[spaceId1].urls[0]).toBe('https://space1.com/tab1');
      expect(loaded[spaceId1].urls[1]).toBe('https://space1.com/tab2');

      // Verify second space has 3 urls
      expect(loaded[spaceId2]).toBeDefined();
      expect(loaded[spaceId2].urls).toHaveLength(3);
      expect(loaded[spaceId2].urls[0]).toBe('https://space2.com/tab1');
      expect(loaded[spaceId2].urls[1]).toBe('https://space2.com/tab2');
      expect(loaded[spaceId2].urls[2]).toBe('https://space2.com/tab3');
    });

    it('should preserve correct tab order based on index field', async () => {
      const spaceId = 'uuid-closed-5';

      // Save closed space
      const closedSpace: Record<string, Space> = {
        [spaceId]: createMockSpace(spaceId, { isActive: false, urls: [] })
      };
      await storageManager.saveClosedSpaces(closedSpace);

      // Save tabs with non-sequential indices (out of order)
      const tabs = [
        {
          id: 'tab-3',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/third',
          index: 2,
          createdAt: Date.now()
        },
        {
          id: 'tab-1',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/first',
          index: 0,
          createdAt: Date.now()
        },
        {
          id: 'tab-2',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/second',
          index: 1,
          createdAt: Date.now()
        }
      ];
      await storageManager.saveTabsForSpace(spaceId, 'closed', tabs);

      // Load closed spaces - should sort by index
      const loaded = await storageManager.loadClosedSpaces();

      expect(loaded[spaceId].urls).toHaveLength(3);
      expect(loaded[spaceId].urls[0]).toBe('https://example.com/first');
      expect(loaded[spaceId].urls[1]).toBe('https://example.com/second');
      expect(loaded[spaceId].urls[2]).toBe('https://example.com/third');
    });
  });

  describe('tabs operations', () => {
    it('should save and load tabs for a space', async () => {
      const spaceId = 'test-space-1';
      const tabs = [
        {
          id: 'tab-1',
          spaceId,
          kind: 'active' as const,
          url: 'https://example.com/1',
          index: 0,
          createdAt: Date.now()
        },
        {
          id: 'tab-2',
          spaceId,
          kind: 'active' as const,
          url: 'https://example.com/2',
          index: 1,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveTabsForSpace(spaceId, 'active', tabs);
      const loaded = await storageManager.loadTabsForSpace(spaceId, 'active');

      expect(loaded).toHaveLength(2);
      expect(loaded[0].url).toBe('https://example.com/1');
      expect(loaded[1].url).toBe('https://example.com/2');
    });

    it('should replace existing tabs when saving', async () => {
      const spaceId = 'test-space-1';
      const initialTabs = [
        {
          id: 'tab-1',
          spaceId,
          kind: 'active' as const,
          url: 'https://example.com/old',
          index: 0,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveTabsForSpace(spaceId, 'active', initialTabs);

      const updatedTabs = [
        {
          id: 'tab-2',
          spaceId,
          kind: 'active' as const,
          url: 'https://example.com/new',
          index: 0,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveTabsForSpace(spaceId, 'active', updatedTabs);
      const loaded = await storageManager.loadTabsForSpace(spaceId, 'active');

      expect(loaded).toHaveLength(1);
      expect(loaded[0].url).toBe('https://example.com/new');
      expect(loaded[0].id).toBe('tab-2');
    });

    it('should handle separate active and closed tabs for same spaceId', async () => {
      const spaceId = 'test-space-1';
      const activeTabs = [
        {
          id: 'active-tab-1',
          spaceId,
          kind: 'active' as const,
          url: 'https://example.com/active',
          index: 0,
          createdAt: Date.now()
        }
      ];
      const closedTabs = [
        {
          id: 'closed-tab-1',
          spaceId,
          kind: 'closed' as const,
          url: 'https://example.com/closed',
          index: 0,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveTabsForSpace(spaceId, 'active', activeTabs);
      await storageManager.saveTabsForSpace(spaceId, 'closed', closedTabs);

      const loadedActive = await storageManager.loadTabsForSpace(spaceId, 'active');
      const loadedClosed = await storageManager.loadTabsForSpace(spaceId, 'closed');

      expect(loadedActive).toHaveLength(1);
      expect(loadedActive[0].kind).toBe('active');
      expect(loadedClosed).toHaveLength(1);
      expect(loadedClosed[0].kind).toBe('closed');
    });

    it('should delete tabs for a space', async () => {
      const spaceId = 'test-space-1';
      const tabs = [
        {
          id: 'tab-1',
          spaceId,
          kind: 'active' as const,
          url: 'https://example.com/1',
          index: 0,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveTabsForSpace(spaceId, 'active', tabs);
      await storageManager.deleteTabsForSpace(spaceId, 'active');

      const loaded = await storageManager.loadTabsForSpace(spaceId, 'active');
      expect(loaded).toHaveLength(0);
    });
  });

  describe('createSpace', () => {
    it('should create a space with tabs', async () => {
      const windowId = 123;
      const name = 'Custom Named Space';
      const urls = ['https://example.com/1', 'https://example.com/2'];
      const named = true;

      const space = await storageManager.createSpace(windowId, name, urls, named);

      expect(space.id).toBe('123');
      expect(space.name).toBe(name);
      expect(space.urls).toEqual(urls);
      expect(space.named).toBe(true);
      expect(space.isActive).toBe(true);

      // Verify tabs were created
      const tabs = await storageManager.loadTabsForSpace('123', 'active');
      expect(tabs).toHaveLength(2);
      expect(tabs[0].url).toBe('https://example.com/1');
      expect(tabs[1].url).toBe('https://example.com/2');
    });

    it('should create space with auto-generated name', async () => {
      const space = await storageManager.createSpace(456, 'Default Space', ['https://example.com'], false);

      expect(space.named).toBe(false);
      expect(space.name).toBe('Default Space');
    });
  });

  describe('exportData and importData', () => {
    it('should export spaces, closed spaces, and tabs', async () => {
      const spaces = { '1': createMockSpace('1') };
      const closedSpaces = { 'uuid-1': createMockSpace('uuid-1', { isActive: false }) };
      const tabs = [
        {
          id: 'tab-1',
          spaceId: '1',
          kind: 'active' as const,
          url: 'https://example.com',
          index: 0,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveSpaces(spaces);
      await storageManager.saveClosedSpaces(closedSpaces);
      await storageManager.saveTabsForSpace('1', 'active', tabs);

      const exported = await storageManager.exportData();
      const parsed = JSON.parse(exported);

      expect(parsed.spaces).toHaveLength(1);
      expect(parsed.closedSpaces).toHaveLength(1);
      expect(parsed.tabs).toHaveLength(1);
    });

    it('should import exported data', async () => {
      const spaces = { '1': createMockSpace('1') };
      const closedSpaces = { 'uuid-1': createMockSpace('uuid-1', { isActive: false }) };
      const tabs = [
        {
          id: 'tab-1',
          spaceId: '1',
          kind: 'active' as const,
          url: 'https://example.com',
          index: 0,
          createdAt: Date.now()
        }
      ];

      await storageManager.saveSpaces(spaces);
      await storageManager.saveClosedSpaces(closedSpaces);
      await storageManager.saveTabsForSpace('1', 'active', tabs);

      const exported = await storageManager.exportData();

      // Clear and reimport
      await storageManager.clear();
      await storageManager.importData(exported);

      const loadedSpaces = await storageManager.loadSpaces();
      const loadedClosed = await storageManager.loadClosedSpaces();
      const loadedTabs = await storageManager.loadTabsForSpace('1', 'active');

      expect(Object.keys(loadedSpaces)).toHaveLength(1);
      expect(Object.keys(loadedClosed)).toHaveLength(1);
      expect(loadedTabs).toHaveLength(1);
    });
  });

  describe('bootstrap import', () => {
    it('should import from chrome.storage.local when IDB is empty', async () => {
      const legacyData = {
        'chrome_spaces': {
          spaces: {
            '1': createMockSpace('1')
          },
          closedSpaces: {
            '2': createMockSpace('2', { isActive: false })
          }
        }
      };

      (executeChromeApi as jest.Mock).mockResolvedValue(legacyData);

      // First load should trigger bootstrap
      const spaces = await storageManager.loadSpaces();
      const closed = await storageManager.loadClosedSpaces();

      expect(Object.keys(spaces)).toHaveLength(1);
      expect(Object.keys(closed)).toHaveLength(1);
      expect(executeChromeApi).toHaveBeenCalled();
    });

    it('should not bootstrap if IDB already has data', async () => {
      // Pre-populate IDB
      await storageManager.saveSpaces({ '1': createMockSpace('1') });

      const spaces = await storageManager.loadSpaces();
      expect(Object.keys(spaces)).toHaveLength(1);
      expect(executeChromeApi).not.toHaveBeenCalled();
    });

    it('should continue with empty IDB if bootstrap fails', async () => {
      (executeChromeApi as jest.Mock).mockRejectedValue(new Error('Bootstrap failed'));

      const spaces = await storageManager.loadSpaces();
      const closed = await storageManager.loadClosedSpaces();

      expect(Object.keys(spaces)).toHaveLength(0);
      expect(Object.keys(closed)).toHaveLength(0);
    });
  });

  describe('clear', () => {
    it('should clear all stores', async () => {
      await storageManager.saveSpaces({ '1': createMockSpace('1') });
      await storageManager.saveClosedSpaces({ 'uuid-1': createMockSpace('uuid-1', { isActive: false }) });
      await storageManager.saveTabsForSpace('1', 'active', [{
        id: 'tab-1',
        spaceId: '1',
        kind: 'active',
        url: 'https://example.com',
        index: 0,
        createdAt: Date.now()
      }]);

      await storageManager.clear();

      const spaces = await storageManager.loadSpaces();
      const closed = await storageManager.loadClosedSpaces();
      const tabs = await storageManager.loadTabsForSpace('1', 'active');

      expect(Object.keys(spaces)).toHaveLength(0);
      expect(Object.keys(closed)).toHaveLength(0);
      expect(tabs).toHaveLength(0);
    });
  });

  describe('updatePermanentIdMapping', () => {
    it('should save permanent ID mapping', async () => {
      await storageManager.updatePermanentIdMapping(123, 'perm-123');

      const meta = await db.get('meta', 'permanentIdMappings');
      expect(meta?.value['123']).toBe('perm-123');
    });

    it('should update existing mapping', async () => {
      await storageManager.updatePermanentIdMapping(123, 'perm-123');
      await storageManager.updatePermanentIdMapping(123, 'perm-456');

      const meta = await db.get('meta', 'permanentIdMappings');
      expect(meta?.value['123']).toBe('perm-456');
    });
  });
});

