# Spaces Import/Export Guide

## Overview

The Spaces Import/Export functionality allows users to backup, transfer, and restore their spaces across different Chrome installations. It provides a robust way to manage space data through file-based import and export operations.

## User Guide

### Exporting Spaces

To export your spaces:

1. Navigate to the Options page
2. Click the "Export" button
3. Choose export options:
   - Include active spaces (default: true)
   - Include closed spaces (default: false)
   - Add description (optional)
4. Click "Export Spaces" to download the export file

The exported file will be named `spaces-export-YYYY-MM-DD.json` with the current date.

### Importing Spaces

To import spaces:

1. Navigate to the Options page
2. Click the "Import" button
3. Select your export file
4. Choose import options:
   - Replace existing spaces (default: false)
5. Click "Import Spaces"

The import process will validate the file before importing and show results including:
- Number of spaces imported
- Any errors encountered

## Technical Documentation

### Architecture

The import/export system consists of several components:

- `SpaceImportExportService`: Main service coordinating import/export operations
- `ExportManager`: Handles space export and file generation
- `ImportManager`: Manages import operations and validation
- `ValidationEngine`: Validates import data structure and content
- `StateManagerAdapter`: Interfaces with the state management system

### Export Format

Exports are JSON files with the following structure:

```typescript
{
  version: string;          // Format version
  timestamp: number;        // Export timestamp
  spaces: {
    active: Record<string, Space>;    // Active spaces
    closed: Record<string, Space>;    // Closed spaces
  };
  metadata: {
    exportedBy: string;    // Extension version
    description?: string;  // User-provided description
  };
}
```

### API Reference

#### Export API

```typescript
interface ExportOptions {
  includeActive?: boolean;    // Export active spaces
  includeClosed?: boolean;    // Export closed spaces
  description?: string;       // Export description
}

// Export to file
exportToFile(options?: ExportOptions, filename?: string): Promise<void>

// Get export data without saving
getExportData(options?: ExportOptions): Promise<SpaceExportData>
```

#### Import API

```typescript
interface ImportOptions {
  replaceExisting?: boolean;  // Replace existing spaces
  validateOnly?: boolean;     // Validate without importing
}

interface ImportResult {
  success: boolean;
  imported: {
    active: number;
    closed: number;
  };
  errors: ValidationError[];
}

// Import from file
importFromFile(file: File, options?: ImportOptions): Promise<ImportResult>

// Validate file without importing
validateImportFile(file: File): Promise<ImportResult>
```

## Testing Requirements

The import/export functionality includes:

### Unit Tests

- Service tests for `SpaceImportExportService`
- Validation tests for `ValidationEngine`
- Format validation tests
- Error handling tests

### Integration Tests

- End-to-end import/export workflow
- File handling tests
- State management integration

### Test Cases

1. Export validation:
   - Export with different combinations of active/closed spaces
   - Export with custom filename
   - Export with description

2. Import validation:
   - Valid import file
   - Invalid format
   - Duplicate spaces handling
   - Large file handling

3. Error handling:
   - Network errors
   - File system errors
   - Invalid data errors
   - Permission errors

## Error Handling

The system provides detailed error feedback:

```typescript
interface ValidationError {
  code: string;     // Error code
  message: string;  // User-friendly message
  field?: string;   // Field causing error
}
```

Common error codes:
- `IMPORT_FAILED`: General import failure
- `VALIDATION_FAILED`: File validation failure
- `INVALID_FORMAT`: Invalid file format
- `VERSION_MISMATCH`: Incompatible version
- `DUPLICATE_SPACE`: Duplicate space ID
