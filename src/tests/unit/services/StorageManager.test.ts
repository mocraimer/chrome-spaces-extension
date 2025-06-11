import { StorageManager } from '../../../background/services/StorageManager';
import { Space } from '../../../shared/types/Space';

const mockChrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn(),
    },
  },
};

global.chrome = mockChrome as any;

describe('StorageManager', () => {
  let storageManager: StorageManager;

  beforeEach(() => {
    storageManager = new StorageManager();
    jest.clearAllMocks();
  });

  describe('saveSpaces', () => {
    it('should save spaces to chrome storage', async () => {
      const spaces: Record<string, Space> = {
        '1': {
          id: '1',
          name: 'Test Space',
          urls: [],
          lastModified: 123,
          named: false,
          version: 1,
          permanentId: 'perm_1',
          createdAt: 123,
          lastUsed: 123,
          isActive: true
        },
      };

      mockChrome.storage.local.get.mockResolvedValueOnce({});
      await storageManager.saveSpaces(spaces);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        'chrome-spaces': {
          spaces,
          lastModified: expect.any(Number),
        },
      });
    });

    it('should merge with existing storage data', async () => {
      const existingData = {
        'chrome-spaces': {
          closedSpaces: { '2': { id: '2', name: 'Closed' } },
          lastModified: 100
        }
      };
      
      const newSpaces: Record<string, Space> = {
        '1': {
          id: '1',
          name: 'New Space',
          urls: ['https://example.com'],
          lastModified: 200,
          named: true,
          version: 1,
          permanentId: 'perm_1',
          createdAt: 200,
          lastUsed: 200,
          isActive: true
        }
      };

      mockChrome.storage.local.get.mockResolvedValueOnce(existingData);
      await storageManager.saveSpaces(newSpaces);

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        'chrome-spaces': {
          closedSpaces: { '2': { id: '2', name: 'Closed' } },
          spaces: newSpaces,
          lastModified: expect.any(Number),
        },
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(storageManager.saveSpaces({})).rejects.toThrow('STORAGE_ERROR');
    });
  });

  describe('loadSpaces', () => {
    it('should load and validate spaces from storage', async () => {
      const storedSpaces = {
        '1': {
          id: '1',
          name: 'Test Space',
          urls: ['https://test.com'],
          lastModified: 123,
          named: true,
          version: 1,
          permanentId: 'perm_1',
          createdAt: 123,
          lastUsed: 123,
          isActive: true
        }
      };

      mockChrome.storage.local.get.mockResolvedValueOnce({
        'chrome-spaces': { spaces: storedSpaces }
      });

      const result = await storageManager.loadSpaces();
      expect(result).toEqual(storedSpaces);
    });

    it('should return empty object when no spaces exist', async () => {
      mockChrome.storage.local.get.mockResolvedValueOnce({});
      
      const result = await storageManager.loadSpaces();
      expect(result).toEqual({});
    });

    it('should validate space data and throw on corruption', async () => {
      const corruptedData = {
        '1': { id: '1', name: 'Test' } // Missing required fields
      };

      mockChrome.storage.local.get.mockResolvedValueOnce({
        'chrome-spaces': { spaces: corruptedData }
      });

      await expect(storageManager.loadSpaces()).rejects.toThrow('Invalid space data');
    });
  });

  describe('importData', () => {
    it('should import valid JSON data', async () => {
      const validData = {
        spaces: {
          '1': {
            id: '1',
            name: 'Imported Space',
            urls: ['https://imported.com'],
            lastModified: 456,
            named: true,
            version: 1,
            permanentId: 'perm_import_1',
            createdAt: 456,
            lastUsed: 456,
            isActive: false
          }
        }
      };

      await storageManager.importData(JSON.stringify(validData));

      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        'chrome-spaces': {
          ...validData,
          lastModified: expect.any(Number)
        }
      });
    });

    it('should reject invalid JSON', async () => {
      await expect(storageManager.importData('invalid json')).rejects.toThrow('Invalid import data');
    });

    it('should validate imported space data', async () => {
      const invalidData = {
        spaces: {
          '1': { id: '1' } // Missing required fields
        }
      };

      await expect(storageManager.importData(JSON.stringify(invalidData)))
        .rejects.toThrow('Invalid import data');
    });
  });

  describe('clear', () => {
    it('should remove all stored data', async () => {
      await storageManager.clear();
      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith('chrome-spaces');
    });
  });
}); 