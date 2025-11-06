import { ImportManager } from '../../../background/services/import/ImportManager';
import { ValidationEngine } from '../../../background/services/validation/ValidationEngine';
import { Space } from '../../../shared/types/Space';
import { SpaceExportData } from '../../../shared/types/ImportExport';
import { createMockSpace } from '../../mocks/mockTypes';

describe('ImportManager', () => {
  let importManager: ImportManager;
  let mockStateManager: {
    getState: jest.Mock;
    dispatch: jest.Mock;
  };
  let mockValidationEngine: jest.Mocked<ValidationEngine>;
  
  const mockSpace: Space = createMockSpace('space-1', 'Test Space', {
    urls: ['https://example.com'],
    named: true
  });

  const mockExportData: SpaceExportData = {
    version: '1.0.0',
    timestamp: Date.now(),
    spaces: {
      active: { 'space-1': mockSpace },
      closed: {}
    },
    metadata: {
      exportedBy: 'test-user'
    }
  };

  beforeEach(() => {
    mockStateManager = {
      getState: jest.fn(),
      dispatch: jest.fn()
    };

    mockValidationEngine = {
      validateExportData: jest.fn()
    } as unknown as jest.Mocked<ValidationEngine>;

    mockStateManager.getState.mockReturnValue({
      spaces: {},
      closedSpaces: {},
      currentWindowId: null,
      isLoading: false,
      error: null
    });

    importManager = new ImportManager(mockStateManager, mockValidationEngine);
  });

  describe('readImportFile', () => {
    it('should read and parse JSON file correctly', async () => {
      // Arrange
      const fileContent = JSON.stringify(mockExportData);
      const file = new File([fileContent], 'test.json', { type: 'application/json' });

      // Act
      const result = await importManager.readImportFile(file);

      // Assert
      expect(result).toEqual(mockExportData);
    });

    it('should reject invalid JSON file', async () => {
      // Arrange
      const file = new File(['invalid json'], 'test.json', { type: 'application/json' });

      // Act & Assert
      await expect(importManager.readImportFile(file))
        .rejects
        .toThrow('Failed to read import file: Invalid JSON format');
    });

    it('should handle empty file', async () => {
      // Arrange
      const file = new File([''], 'empty.json', { type: 'application/json' });

      // Act & Assert
      await expect(importManager.readImportFile(file))
        .rejects
        .toThrow('Failed to read import file: Invalid JSON format');
    });
  });

  describe('importSpaces', () => {
    beforeEach(() => {
      mockValidationEngine.validateExportData.mockReturnValue({
        isValid: true,
        errors: []
      });
    });

    it('should validate import data first', async () => {
      // Act
      await importManager.importSpaces(mockExportData);

      // Assert
      expect(mockValidationEngine.validateExportData).toHaveBeenCalledWith(mockExportData);
    });

    it('should return validation errors if validation fails', async () => {
      // Arrange
      const validationError = {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data'
      };
      mockValidationEngine.validateExportData.mockReturnValue({
        isValid: false,
        errors: [validationError]
      });

      // Act
      const result = await importManager.importSpaces(mockExportData);

      // Assert
      expect(result).toEqual({
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [validationError]
      });
      expect(mockStateManager.dispatch).not.toHaveBeenCalled();
    });

    it('should only validate when validateOnly option is true', async () => {
      // Act
      const result = await importManager.importSpaces(mockExportData, { validateOnly: true });

      // Assert
      expect(result).toEqual({
        success: true,
        imported: { active: 0, closed: 0 },
        errors: []
      });
      expect(mockStateManager.dispatch).not.toHaveBeenCalled();
    });

    it('should import active spaces', async () => {
      // Act
      const result = await importManager.importSpaces(mockExportData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.imported.active).toBe(1);
      expect(mockStateManager.dispatch).toHaveBeenCalledWith({
        type: 'spaces/importActive',
        payload: { 'space-1': mockSpace }
      });
    });

    it('should import closed spaces', async () => {
      // Arrange
      const dataWithClosedSpaces = {
        ...mockExportData,
        spaces: {
          active: {},
          closed: { 'space-1': mockSpace }
        }
      };

      // Act
      const result = await importManager.importSpaces(dataWithClosedSpaces);

      // Assert
      expect(result.success).toBe(true);
      expect(result.imported.closed).toBe(1);
      expect(mockStateManager.dispatch).toHaveBeenCalledWith({
        type: 'spaces/importClosed',
        payload: { 'space-1': mockSpace }
      });
    });

    it('should not replace existing spaces by default', async () => {
      // Arrange
      mockStateManager.getState.mockReturnValue({
        spaces: { 'space-1': createMockSpace('space-1', 'Existing Space') },
        closedSpaces: {},
        currentWindowId: null,
        isLoading: false,
        error: null
      });

      // Act
      const result = await importManager.importSpaces(mockExportData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.imported.active).toBe(0);
      expect(mockStateManager.dispatch).not.toHaveBeenCalled();
    });

    it('should replace existing spaces when replaceExisting is true', async () => {
      // Arrange
      mockStateManager.getState.mockReturnValue({
        spaces: { 'space-1': createMockSpace('space-1', 'Existing Space') },
        closedSpaces: {},
        currentWindowId: null,
        isLoading: false,
        error: null
      });

      // Act
      const result = await importManager.importSpaces(mockExportData, { replaceExisting: true });

      // Assert
      expect(result.success).toBe(true);
      expect(result.imported.active).toBe(1);
      expect(mockStateManager.dispatch).toHaveBeenCalledWith({
        type: 'spaces/importActive',
        payload: { 'space-1': mockSpace }
      });
    });

    it('should handle import errors gracefully', async () => {
      // Arrange
      mockStateManager.dispatch.mockImplementation(() => {
        throw new Error('Dispatch failed');
      });

      // Act
      const result = await importManager.importSpaces(mockExportData);

      // Assert
      expect(result).toEqual({
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [{
          code: 'IMPORT_FAILED',
          message: 'Dispatch failed'
        }]
      });
    });
  });
});