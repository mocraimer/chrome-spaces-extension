import { Space } from './Space';

export interface SpaceExportData {
  version: string;
  timestamp: number;
  spaces: {
    active: Record<string, Space>;
    closed: Record<string, Space>;
  };
  metadata: {
    exportedBy: string;
    description?: string;
  };
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
}

export interface ImportResult {
  success: boolean;
  imported: {
    active: number;
    closed: number;
  };
  errors: ValidationError[];
}

export interface ExportOptions {
  includeActive?: boolean;
  includeClosed?: boolean;
  description?: string;
}

export interface ImportOptions {
  replaceExisting?: boolean;
  validateOnly?: boolean;
}