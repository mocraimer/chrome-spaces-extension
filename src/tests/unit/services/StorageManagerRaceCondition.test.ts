import { StorageManager } from '../../../background/services/StorageManager';
import { Space } from '../../../shared/types/Space';

const mockChrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn(),
        },
    },
    runtime: {
        lastError: null
    }
};

global.chrome = mockChrome as any;

describe('StorageManager Race Condition', () => {
    let storageManager: StorageManager;
    let storageStore: any = {};

    beforeEach(() => {
        storageManager = new StorageManager();
        storageStore = {
            'chrome_spaces': {
                spaces: {},
                closedSpaces: {},
                permanentIdMappings: {},
                lastModified: Date.now(),
                version: 1
            }
        };

        // Mock get to simulate delay
        mockChrome.storage.local.get.mockImplementation(async (_keys) => {
            await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
            return storageStore;
        });

        // Mock set to update store
        mockChrome.storage.local.set.mockImplementation(async (items) => {
            await new Promise(resolve => setTimeout(resolve, 10)); // 10ms delay
            storageStore = { ...storageStore, ...items };
        });
    });

    it('should handle concurrent saves correctly', async () => {
        const space1: Space = { id: '1', name: 'Space 1', urls: [], lastModified: 0, named: false, version: 1, permanentId: 'p1', createdAt: 0, lastUsed: 0, isActive: true, windowId: 1 };
        const space2: Space = { id: '2', name: 'Space 2', urls: [], lastModified: 0, named: false, version: 1, permanentId: 'p2', createdAt: 0, lastUsed: 0, isActive: false };

        // Concurrent calls
        await Promise.all([
            storageManager.saveSpaces({ '1': space1 }),
            storageManager.saveClosedSpaces({ '2': space2 })
        ]);

        // Check final state
        const finalSpaces = storageStore['chrome_spaces'].spaces;
        const finalClosedSpaces = storageStore['chrome_spaces'].closedSpaces;

        // Both should be saved
        expect(finalSpaces['1']).toBeDefined();
        expect(finalClosedSpaces['2']).toBeDefined();
    });
});
