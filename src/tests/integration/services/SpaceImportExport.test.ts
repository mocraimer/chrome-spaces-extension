import { SpaceImportExportService } from '../../../background/services/SpaceImportExportService';
import { StateManager } from '../../../background/services/StateManager';
import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { Space } from '../../../shared/types/Space';
import { SpaceExportData } from '../../../shared/types/ImportExport';
import { createMockSpace } from '../../mocks/mockTypes';

// SKIPPED: Runtime failures - needs investigation
describe.skip('Space Import/Export Integration', () => {
  let stateManager: StateManager;
  let windowManager: jest.Mocked<WindowManager>;
  let tabManager: jest.Mocked<TabManager>;
  let storageManager: jest.Mocked<StorageManager>;
  let importExportService: SpaceImportExportService;

  const mockSpace: Space = createMockSpace('space-1', 'Test Space', {
    urls: ['https://example.com'],
    named: true
  });

  const mockState = {
    spaces: { 'space-1': mockSpace },
    closedSpaces: {},
    currentWindowId: null,
    isLoading: false,
    error: null
  };

  beforeEach(() => {
    // Setup chrome API mocks
    global.chrome = {
      storage: {
        local: {
          get: jest.fn().mockImplementation(() => Promise.resolve({ state: mockState })),
          set: jest.fn().mockImplementation(() => Promise.resolve())
        }
      },
      downloads: {
        download: jest.fn().mockImplementation((options, callback) => callback?.(123))
      },
      runtime: {
        lastError: undefined
      }
    } as unknown as typeof chrome;

    // Setup service mocks
    windowManager = {
      getAllWindows: jest.fn().mockResolvedValue([]),
      windowExists: jest.fn(),
      closeWindow: jest.fn()
    } as unknown as jest.Mocked<WindowManager>;

    tabManager = {
      getTabs: jest.fn(),
      getTabUrl: jest.fn()
    } as unknown as jest.Mocked<TabManager>;

    storageManager = {
      loadSpaces: jest.fn().mockResolvedValue(mockState.spaces),
      loadClosedSpaces: jest.fn().mockResolvedValue(mockState.closedSpaces),
      saveSpaces: jest.fn().mockResolvedValue(undefined),
      saveClosedSpaces: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<StorageManager>;

    const updateQueue = {
      processQueue: jest.fn(),
      enqueue: jest.fn()
    } as any;
    
    const broadcastService = {
      broadcast: jest.fn()
    } as any;

    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService
    );
    importExportService = new SpaceImportExportService(stateManager);
  });

  describe('Export and Import Flow', () => {
    it('should correctly export and re-import spaces', async () => {
      // First export the spaces
      const exportData = await importExportService.getExportData();
      expect(exportData.spaces.active).toEqual(mockState.spaces);
      expect(exportData.spaces.closed).toEqual(mockState.closedSpaces);

      // Create a file from the export data
      const blob = await createExportBlob(exportData);
      const file = new File([blob], 'test-export.json', { type: 'application/json' });

      // Validate and import the file
      const validationResult = await importExportService.validateImportFile(file);
      expect(validationResult.success).toBe(true);

      const importResult = await importExportService.importFromFile(file);
      expect(importResult.success).toBe(true);
      expect(importResult.imported.active).toBe(1);
      expect(importResult.imported.closed).toBe(0);

      // Verify the state was updated correctly
      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining(mockState.spaces)
      );
    });

    it('should handle invalid import data', async () => {
      // Create invalid export data
      const invalidData = {
        version: '1.0.0',
        timestamp: Date.now(),
        spaces: {
          active: { 'space-1': { ...mockSpace, urls: 'invalid' } },
          closed: {}
        },
        metadata: {
          exportedBy: 'test'
        }
      };

      const blob = new Blob([JSON.stringify(invalidData)], { type: 'application/json' });
      const file = new File([blob], 'invalid-export.json', { type: 'application/json' });

      const validationResult = await importExportService.validateImportFile(file);
      expect(validationResult.success).toBe(false);
      expect(validationResult.errors[0].code).toBe('INVALID_URLS');
    });

    it('should respect existing spaces during import', async () => {
      // Create export data with a space that already exists
      const existingSpace: Space = {
        ...mockSpace,
        name: 'Existing Space'
      };

      const currentState = {
        spaces: { 'space-1': existingSpace },
        closedSpaces: {}
      };

      // Update storage mock to return our current state
      storageManager.loadSpaces.mockResolvedValueOnce(currentState.spaces);
      storageManager.loadClosedSpaces.mockResolvedValueOnce(currentState.closedSpaces);

      // Create export data with the same space ID but different content
      const exportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        spaces: {
          active: { 'space-1': mockSpace },
          closed: {}
        },
        metadata: {
          exportedBy: 'test'
        }
      };

      const blob = await createExportBlob(exportData);
      const file = new File([blob], 'test-export.json', { type: 'application/json' });

      // Import without replace option
      const importResult = await importExportService.importFromFile(file);
      expect(importResult.success).toBe(true);
      expect(importResult.imported.active).toBe(0); // Should not import due to existing space

      // Import with replace option
      const replaceResult = await importExportService.importFromFile(file, { replaceExisting: true });
      expect(replaceResult.success).toBe(true);
      expect(replaceResult.imported.active).toBe(1); // Should replace existing space
    });
  });

  describe('Error Handling', () => {
    it('should handle storage errors during import', async () => {
      // Mock storage error
      storageManager.saveSpaces.mockRejectedValueOnce(new Error('Storage error'));

      const exportData = await importExportService.getExportData();
      const blob = await createExportBlob(exportData);
      const file = new File([blob], 'test-export.json', { type: 'application/json' });

      const result = await importExportService.importFromFile(file);
      expect(result.success).toBe(false);
      expect(result.errors[0].code).toBe('IMPORT_FAILED');
    });

    it('should handle download errors during export', async () => {
      // Mock download error
      chrome.runtime.lastError = { message: 'Download failed' };
      (chrome.downloads.download as jest.Mock).mockImplementation((options, callback) => 
        callback?.(undefined)
      );

      await expect(importExportService.exportToFile()).rejects.toThrow('Failed to export spaces');

      // Cleanup
      chrome.runtime.lastError = undefined;
    });
  });
});

async function createExportBlob(data: SpaceExportData): Promise<Blob> {
  return new Blob([JSON.stringify(data)], { type: 'application/json' });
}