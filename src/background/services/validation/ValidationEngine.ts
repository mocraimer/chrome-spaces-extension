import { Space } from '../../../shared/types/Space';
import { SpaceExportData, ValidationResult, ValidationError } from '../../../shared/types/ImportExport';

export class ValidationEngine {
  private errors: ValidationError[] = [];

  public validateExportData(data: unknown): ValidationResult {
    this.errors = [];

    if (!this.isValidExportDataStructure(data)) {
      return {
        isValid: false,
        errors: [{
          code: 'INVALID_STRUCTURE',
          message: 'Invalid export data structure'
        }]
      };
    }

    const exportData = data as SpaceExportData;
    
    this.validateVersion(exportData.version);
    this.validateSpaces(exportData.spaces);
    this.validateMetadata(exportData.metadata);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors
    };
  }

  private isValidExportDataStructure(data: unknown): boolean {
    if (!data || typeof data !== 'object') return false;
    
    const requiredFields = ['version', 'timestamp', 'spaces', 'metadata'];
    return requiredFields.every(field => field in (data as Record<string, unknown>));
  }

  private validateVersion(version: string): void {
    if (!version || !version.match(/^\d+\.\d+\.\d+$/)) {
      this.errors.push({
        code: 'INVALID_VERSION',
        message: 'Invalid version format',
        field: 'version'
      });
    }
  }

  private validateSpaces(spaces: { active: Record<string, Space>; closed: Record<string, Space> }): void {
    if (!spaces || typeof spaces !== 'object') {
      this.errors.push({
        code: 'INVALID_SPACES',
        message: 'Invalid spaces data structure'
      });
      return;
    }

    this.validateSpaceCollection(spaces.active, 'active');
    this.validateSpaceCollection(spaces.closed, 'closed');
  }

  private validateSpaceCollection(spaces: Record<string, Space>, type: string): void {
    if (!spaces || typeof spaces !== 'object') {
      this.errors.push({
        code: 'INVALID_SPACE_COLLECTION',
        message: `Invalid ${type} spaces collection`,
        field: `spaces.${type}`
      });
      return;
    }

    Object.entries(spaces).forEach(([id, space]) => {
      this.validateSpace(space, `${type}.${id}`);
    });
  }

  private validateSpace(space: Space, path: string): void {
    if (!space.id) {
      this.errors.push({
        code: 'MISSING_SPACE_ID',
        message: 'Space ID is required',
        field: `${path}.id`
      });
    }

    if (!space.name) {
      this.errors.push({
        code: 'MISSING_SPACE_NAME',
        message: 'Space name is required',
        field: `${path}.name`
      });
    }

    if (!Array.isArray(space.urls)) {
      this.errors.push({
        code: 'INVALID_URLS',
        message: 'URLs must be an array',
        field: `${path}.urls`
      });
    } else {
      space.urls.forEach((url, index) => {
        if (typeof url !== 'string' || !this.isValidUrl(url)) {
          this.errors.push({
            code: 'INVALID_URL',
            message: 'Invalid URL format',
            field: `${path}.urls[${index}]`
          });
        }
      });
    }
  }

  private validateMetadata(metadata: SpaceExportData['metadata']): void {
    if (!metadata || typeof metadata !== 'object') {
      this.errors.push({
        code: 'INVALID_METADATA',
        message: 'Invalid metadata structure'
      });
      return;
    }

    if (!metadata.exportedBy) {
      this.errors.push({
        code: 'MISSING_EXPORTER',
        message: 'Exporter information is required',
        field: 'metadata.exportedBy'
      });
    }

    if (metadata.description && typeof metadata.description !== 'string') {
      this.errors.push({
        code: 'INVALID_DESCRIPTION',
        message: 'Description must be a string',
        field: 'metadata.description'
      });
    }
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}