import { ExportManager } from '../../../background/services/export/ExportManager';
import { Space, SpaceState } from '../../../shared/types/Space';
import { ExportOptions, SpaceExportData } from '../../../shared/types/ImportExport';

describe('ExportManager', () => {
  let exportManager: ExportManager;
  let mockStateManager: {
    getState: jest.Mock;
  };

  const mockSpace: Space = {
    id: 'space-1',
    name: 'Test Space',
    urls: ['https://example.com'],
    lastModified: Date.now(),
    named: true,
    version: 1
  };

  const mockState: SpaceState = {
    spaces: { 'space-1': mockSpace },
    closedSpaces: { 'space-2': { ...mockSpace, id: 'space-2' } },
    currentWindowId: null,
    isLoading: false,
    error: null
  };

  beforeEach(() => {
    mockStateManager = {
      getState: jest.fn()
    };

    mockStateManager.getState.mockReturnValue(mockState);

    // Mock chrome.downloads API
    global.chrome = {
      downloads: {
        download: jest.fn()
      },
      runtime: {
        lastError: undefined
      }
    } as unknown as typeof chrome;

    exportManager = new ExportManager(mockStateManager);
  });

  describe('exportSpaces', () => {
    it('should export both active and closed spaces by default', async () => {
      // Act
      const result = await exportManager.exportSpaces();

      // Assert
      expect(result.spaces.active).toHaveProperty('space-1');
      expect(result.spaces.closed).toHaveProperty('space-2');
      expect(result.version).toBe('1.0.0');
      expect(result.metadata.exportedBy).toBe('Chrome Spaces Extension');
    });

    it('should respect includeActive option', async () => {
      // Act
      const result = await exportManager.exportSpaces({ includeActive: false });

      // Assert
      expect(result.spaces.active).toEqual({});
      expect(result.spaces.closed).toHaveProperty('space-2');
    });

    it('should respect includeClosed option', async () => {
      // Act
      const result = await exportManager.exportSpaces({ includeClosed: false });

      // Assert
      expect(result.spaces.active).toHaveProperty('space-1');
      expect(result.spaces.closed).toEqual({});
    });

    it('should include description in metadata when provided', async () => {
      // Act
      const result = await exportManager.exportSpaces({
        description: 'Test export'
      });

      // Assert
      expect(result.metadata.description).toBe('Test export');
    });

    it('should filter out invalid spaces', async () => {
      // Arrange
      const invalidSpace = {
        ...mockSpace,
        urls: 'not-an-array' as any
      };
      mockStateManager.getState.mockReturnValue({
        ...mockState,
        spaces: { 'space-1': invalidSpace }
      });

      // Act
      const result = await exportManager.exportSpaces();

      // Assert
      expect(result.spaces.active).toEqual({});
    });

    it('should sanitize spaces during export', async () => {
      // Arrange
      const spaceWithEmptyUrls = {
        ...mockSpace,
        urls: ['https://example.com', '', '  ', 'https://valid.com']
      };
      mockStateManager.getState.mockReturnValue({
        ...mockState,
        spaces: { 'space-1': spaceWithEmptyUrls }
      });

      // Act
      const result = await exportManager.exportSpaces();

      // Assert
      expect(result.spaces.active['space-1'].urls).toEqual([
        'https://example.com',
        'https://valid.com'
      ]);
    });
  });

  describe('generateExportBlob', () => {
    it('should generate valid JSON blob', async () => {
      // Arrange
      const exportData: SpaceExportData = {
        version: '1.0.0',
        timestamp: Date.now(),
        spaces: {
          active: {},
          closed: {}
        },
        metadata: {
          exportedBy: 'test'
        }
      };

      // Act
      const blob = await exportManager.generateExportBlob(exportData);

      // Assert
      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('application/json');

      // Verify blob content
      const reader = new FileReader();
      const content = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(blob);
      });
      expect(JSON.parse(content)).toEqual(exportData);
    });
  });

  describe('downloadExport', () => {
    beforeEach(() => {
      global.URL.createObjectURL = jest.fn().mockReturnValue('blob:url');
      global.URL.revokeObjectURL = jest.fn();
    });

    it('should trigger download with correct options', async () => {
      // Arrange
      const blob = new Blob(['test'], { type: 'application/json' });
      const filename = 'test-export.json';
      (chrome.downloads.download as jest.Mock).mockImplementation(
        (options, callback) => callback(123)
      );

      // Act
      await exportManager.downloadExport(blob, filename);

      // Assert
      expect(chrome.downloads.download).toHaveBeenCalledWith(
        {
          url: 'blob:url',
          filename,
          saveAs: true
        },
        expect.any(Function)
      );
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
    });

    it('should handle download errors', async () => {
      // Arrange
      const blob = new Blob(['test'], { type: 'application/json' });
      chrome.runtime.lastError = { message: 'Download failed' };
      (chrome.downloads.download as jest.Mock).mockImplementation(
        (options, callback) => callback(undefined)
      );

      // Act & Assert
      await expect(exportManager.downloadExport(blob)).rejects.toThrow('Download failed');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:url');
      
      // Cleanup
      chrome.runtime.lastError = undefined;
    });

    it('should use default filename if none provided', async () => {
      // Arrange
      const blob = new Blob(['test'], { type: 'application/json' });
      (chrome.downloads.download as jest.Mock).mockImplementation(
        (options, callback) => callback(123)
      );

      // Act
      await exportManager.downloadExport(blob);

      // Assert
      expect(chrome.downloads.download).toHaveBeenCalledWith(
        expect.objectContaining({
          filename: 'spaces-export.json'
        }),
        expect.any(Function)
      );
    });
  });
});