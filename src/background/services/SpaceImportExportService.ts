import { StateManager } from './StateManager';
import { ExportManager } from './export/ExportManager';
import { ImportManager } from './import/ImportManager';
import { ValidationEngine } from './validation/ValidationEngine';
import { StateManagerAdapter } from './adapters/StateManagerAdapter';
import { ExportOptions, ImportOptions, ImportResult, SpaceExportData } from '../../shared/types/ImportExport';

export class SpaceImportExportService {
  private readonly exportManager: ExportManager;
  private readonly importManager: ImportManager;
  private readonly validationEngine: ValidationEngine;
  private readonly stateManagerAdapter: StateManagerAdapter;

  constructor(private readonly stateManager: StateManager) {
    this.validationEngine = new ValidationEngine();
    this.stateManagerAdapter = new StateManagerAdapter(stateManager);
    this.exportManager = new ExportManager(this.stateManagerAdapter);
    this.importManager = new ImportManager(this.stateManagerAdapter, this.validationEngine);
  }

  /**
   * Export spaces to a file
   * @param options Export configuration options
   * @param filename Optional custom filename
   */
  public async exportToFile(
    options: ExportOptions = {},
    filename?: string
  ): Promise<void> {
    try {
      // Generate export data
      const exportData = await this.exportManager.exportSpaces(options);

      // Create blob and trigger download
      const blob = await this.exportManager.generateExportBlob(exportData);
      
      // Generate filename if not provided
      const exportFilename = filename || this.generateExportFilename();
      
      await this.exportManager.downloadExport(blob, exportFilename);
    } catch (error) {
      console.error('Export failed:', error);
      throw new Error('Failed to export spaces');
    }
  }

  /**
   * Import spaces from a file
   * @param file File to import
   * @param options Import configuration options
   */
  public async importFromFile(
    file: File,
    options: ImportOptions = {}
  ): Promise<ImportResult> {
    try {
      // Read and parse file
      const data = await this.importManager.readImportFile(file);
      
      // Import spaces
      return await this.importManager.importSpaces(data, options);
    } catch (error) {
      console.error('Import failed:', error);
      return {
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [{
          code: 'IMPORT_FAILED',
          message: error instanceof Error ? error.message : 'Failed to import spaces'
        }]
      };
    }
  }

  /**
   * Validate an export file without importing
   * @param file File to validate
   */
  public async validateImportFile(file: File): Promise<ImportResult> {
    try {
      const data = await this.importManager.readImportFile(file);
      return await this.importManager.importSpaces(data, { validateOnly: true });
    } catch (error) {
      console.error('Validation failed:', error);
      return {
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [{
          code: 'VALIDATION_FAILED',
          message: error instanceof Error ? error.message : 'Failed to validate import file'
        }]
      };
    }
  }

  /**
   * Get export data without saving to file
   * Useful for programmatic access to export data
   * @param options Export configuration options
   */
  public async getExportData(options: ExportOptions = {}): Promise<SpaceExportData> {
    return await this.exportManager.exportSpaces(options);
  }

  private generateExportFilename(): string {
    const date = new Date().toISOString().split('T')[0];
    return `spaces-export-${date}.json`;
  }
}