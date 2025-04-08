import { SpaceImportExportService } from '../../../background/services/SpaceImportExportService';
import { StateManager } from '../../../background/services/StateManager';
import { ExportManager } from '../../../background/services/export/ExportManager';
import { ImportManager } from '../../../background/services/import/ImportManager';
import { ValidationEngine } from '../../../background/services/validation/ValidationEngine';
import { StateManagerAdapter } from '../../../background/services/adapters/StateManagerAdapter';
import { ExportOptions, ImportOptions, ImportResult, SpaceExportData } from '../../../shared/types/ImportExport';

// Mock dependencies
jest.mock('../../../background/services/export/ExportManager');
jest.mock('../../../background/services/import/ImportManager');
jest.mock('../../../background/services/validation/ValidationEngine');
jest.mock('../../../background/services/adapters/StateManagerAdapter');

describe('SpaceImportExportService', () => {
  let service: SpaceImportExportService;
  let stateManager: jest.Mocked<StateManager>;
  let exportManager: jest.Mocked<ExportManager>;
  let importManager: jest.Mocked<ImportManager>;
  let validationEngine: jest.Mocked<ValidationEngine>;
  let stateManagerAdapter: jest.Mocked<StateManagerAdapter>;

  const mockExportData: SpaceExportData = {
    version: '1.0',
    timestamp: Date.now(),
    spaces: {
      active: {},
      closed: {}
    },
    metadata: {
      exportedBy: 'test'
    }
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    exportManager = {
      exportSpaces: jest.fn(),
      generateExportBlob: jest.fn(),
      downloadExport: jest.fn()
    } as unknown as jest.Mocked<ExportManager>;

    importManager = {
      readImportFile: jest.fn(),
      importSpaces: jest.fn()
    } as unknown as jest.Mocked<ImportManager>;

    validationEngine = new ValidationEngine() as jest.Mocked<ValidationEngine>;
    stateManager = {} as jest.Mocked<StateManager>;
    stateManagerAdapter = new StateManagerAdapter(stateManager) as jest.Mocked<StateManagerAdapter>;

    (ExportManager as jest.Mock).mockImplementation(() => exportManager);
    (ImportManager as jest.Mock).mockImplementation(() => importManager);
    (ValidationEngine as jest.Mock).mockImplementation(() => validationEngine);
    (StateManagerAdapter as jest.Mock).mockImplementation(() => stateManagerAdapter);

    service = new SpaceImportExportService(stateManager);
  });

  describe('exportToFile', () => {
    it('should export spaces to a file with default options', async () => {
      // Arrange
      const blob = new Blob(['test']);
      exportManager.exportSpaces.mockResolvedValue(mockExportData);
      exportManager.generateExportBlob.mockResolvedValue(blob);
      exportManager.downloadExport.mockResolvedValue();

      // Act
      await service.exportToFile();

      // Assert
      expect(exportManager.exportSpaces).toHaveBeenCalledWith({});
      expect(exportManager.generateExportBlob).toHaveBeenCalledWith(mockExportData);
      expect(exportManager.downloadExport).toHaveBeenCalled();
    });

    it('should handle export errors', async () => {
      // Arrange
      exportManager.exportSpaces.mockRejectedValue(new Error('Export failed'));

      // Act & Assert
      await expect(service.exportToFile()).rejects.toThrow('Failed to export spaces');
    });
  });

  describe('importFromFile', () => {
    it('should import spaces from a file with default options', async () => {
      // Arrange
      const file = new File(['test'], 'test.json');
      const mockResult: ImportResult = {
        success: true,
        imported: { active: 1, closed: 0 },
        errors: []
      };
      importManager.readImportFile.mockResolvedValue(mockExportData);
      importManager.importSpaces.mockResolvedValue(mockResult);

      // Act
      const result = await service.importFromFile(file);

      // Assert
      expect(result).toEqual(mockResult);
      expect(importManager.readImportFile).toHaveBeenCalledWith(file);
      expect(importManager.importSpaces).toHaveBeenCalledWith(mockExportData, {});
    });

    it('should handle import errors', async () => {
      // Arrange
      const file = new File(['test'], 'test.json');
      importManager.readImportFile.mockRejectedValue(new Error('Import failed'));

      // Act
      const result = await service.importFromFile(file);

      // Assert
      expect(result).toEqual({
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [{
          code: 'IMPORT_FAILED',
          message: 'Import failed'
        }]
      });
    });
  });

  describe('validateImportFile', () => {
    it('should validate file without importing', async () => {
      // Arrange
      const file = new File(['test'], 'test.json');
      const mockResult: ImportResult = {
        success: true,
        imported: { active: 0, closed: 0 },
        errors: []
      };
      importManager.readImportFile.mockResolvedValue(mockExportData);
      importManager.importSpaces.mockResolvedValue(mockResult);

      // Act
      const result = await service.validateImportFile(file);

      // Assert
      expect(result).toEqual(mockResult);
      expect(importManager.importSpaces).toHaveBeenCalledWith(mockExportData, { validateOnly: true });
    });

    it('should handle validation errors', async () => {
      // Arrange
      const file = new File(['test'], 'test.json');
      importManager.readImportFile.mockRejectedValue(new Error('Validation failed'));

      // Act
      const result = await service.validateImportFile(file);

      // Assert
      expect(result).toEqual({
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [{
          code: 'VALIDATION_FAILED',
          message: 'Validation failed'
        }]
      });
    });
  });

  describe('getExportData', () => {
    it('should return export data without saving to file', async () => {
      // Arrange
      exportManager.exportSpaces.mockResolvedValue(mockExportData);
      const options: ExportOptions = { includeActive: true };

      // Act
      const result = await service.getExportData(options);

      // Assert
      expect(result).toEqual(mockExportData);
      expect(exportManager.exportSpaces).toHaveBeenCalledWith(options);
    });

    it('should handle errors when getting export data', async () => {
      // Arrange
      exportManager.exportSpaces.mockRejectedValue(new Error('Export failed'));

      // Act & Assert
      await expect(service.getExportData()).rejects.toThrow('Export failed');
    });
  });
});