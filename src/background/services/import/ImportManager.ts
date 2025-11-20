import { Space, SpaceState } from '../../../shared/types/Space';
import { SpaceExportData, ImportOptions, ImportResult, ValidationResult } from '../../../shared/types/ImportExport';
import { ValidationEngine } from '../validation/ValidationEngine';

export class ImportManager {
  constructor(
    private readonly stateManager: { 
      getState: () => SpaceState;
      dispatch: (action: { type: string; payload: any }) => Promise<void> | void;
      synchronizeWindowsAndSpaces?: () => Promise<void>;
    },
    private readonly validationEngine: ValidationEngine
  ) {}

  public async importSpaces(data: unknown, options: ImportOptions = {}): Promise<ImportResult> {
    // Validate import data
    const validationResult = this.validationEngine.validateExportData(data);
    
    if (!validationResult.isValid) {
      return this.createErrorResult(validationResult);
    }

    // If validation only, return success
    if (options.validateOnly) {
      return {
        success: true,
        imported: { active: 0, closed: 0 },
        errors: []
      };
    }

    const exportData = data as SpaceExportData;
    return this.processImport(exportData, options);
  }

  private async processImport(
    exportData: SpaceExportData, 
    options: ImportOptions
  ): Promise<ImportResult> {
    const currentState = this.stateManager.getState();
    const result = {
      active: 0,
      closed: 0
    };

    try {
      // Combine active and closed spaces into one collection
      const allSpaces = {
        ...exportData.spaces.active,
        ...exportData.spaces.closed
      };

      // Import all spaces as closed
      if (Object.keys(allSpaces).length > 0) {
        const closedSpaces = this.processSpaces(
          allSpaces,
          currentState.closedSpaces,
          options.replaceExisting
        );
        
        if (Object.keys(closedSpaces).length > 0) {
          await this.stateManager.dispatch({
            type: 'spaces/importClosed',
            payload: closedSpaces
          });
          result.closed = Object.keys(closedSpaces).length;
        }
      }

      // Trigger state synchronization after import if available
      if (this.stateManager.synchronizeWindowsAndSpaces) {
        await this.stateManager.synchronizeWindowsAndSpaces();
        
        // Broadcast state update to all extension pages
        chrome.runtime.sendMessage({
          type: 'SPACES_UPDATED',
          spaces: this.stateManager.getState()
        }).catch(() => {
          // Ignore errors if no listeners
        });
      }

      return {
        success: true,
        imported: result,
        errors: []
      };
    } catch (error) {
      return {
        success: false,
        imported: { active: 0, closed: 0 },
        errors: [{
          code: 'IMPORT_FAILED',
          message: error instanceof Error ? error.message : 'Import failed'
        }]
      };
    }
  }

  private processSpaces(
    importSpaces: Record<string, Space>,
    existingSpaces: Record<string, Space>,
    replaceExisting?: boolean
  ): Record<string, Space> {
    const processedSpaces: Record<string, Space> = {};

    Object.entries(importSpaces).forEach(([id, space]) => {
      const exists = id in existingSpaces;
      
      if (!exists || replaceExisting) {
        processedSpaces[id] = this.processSpace(space);
      }
    });

    return processedSpaces;
  }

  private processSpace(space: Space): Space {
    return {
      id: space.id,
      // Migrate legacy customName to name if present in imported data
      name: (space as any).customName || space.name,
      urls: [...space.urls], // Create new array
      lastModified: space.lastModified,
      named: !!((space as any).customName) || space.named,
      version: space.version || 1, // Preserve version or set default
      // Required new fields
      permanentId: space.permanentId || `import_${space.id}_${Date.now()}`,
      createdAt: space.createdAt || Date.now(),
      lastUsed: space.lastUsed || space.lastModified,
      isActive: false, // Imported spaces are initially inactive
      // Optional fields
      windowId: space.windowId,
      sourceWindowId: space.sourceWindowId,
      lastSync: space.lastSync
    };
  }

  private createErrorResult(validationResult: ValidationResult): ImportResult {
    return {
      success: false,
      imported: { active: 0, closed: 0 },
      errors: validationResult.errors
    };
  }

  public async readImportFile(file: File): Promise<unknown> {
    try {
      const text = await file.text();
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Failed to read import file: Invalid JSON format');
    }
  }
}