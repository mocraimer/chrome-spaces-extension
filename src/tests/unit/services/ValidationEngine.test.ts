import { ValidationEngine } from '../../../background/services/validation/ValidationEngine';
import { Space } from '../../../shared/types/Space';
import { SpaceExportData } from '../../../shared/types/ImportExport';

describe('ValidationEngine', () => {
  let validationEngine: ValidationEngine;
  
  const validSpace: Space = {
    id: 'space-1',
    name: 'Test Space',
    urls: ['https://example.com'],
    lastModified: Date.now(),
    named: true,
    version: 1
  };

  const validExportData: SpaceExportData = {
    version: '1.0.0',
    timestamp: Date.now(),
    spaces: {
      active: { 'space-1': validSpace },
      closed: {}
    },
    metadata: {
      exportedBy: 'test-user'
    }
  };

  beforeEach(() => {
    validationEngine = new ValidationEngine();
  });

  describe('validateExportData', () => {
    it('should validate correct export data structure', () => {
      const result = validationEngine.validateExportData(validExportData);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject null or undefined data', () => {
      const result = validationEngine.validateExportData(null);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toEqual({
        code: 'INVALID_STRUCTURE',
        message: 'Invalid export data structure'
      });
    });

    it('should reject non-object data', () => {
      const result = validationEngine.validateExportData('not an object');
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_STRUCTURE');
    });

    it('should require all mandatory fields', () => {
      const invalidData = {
        version: '1.0.0',
        // missing timestamp
        spaces: validExportData.spaces,
        metadata: validExportData.metadata
      };
      
      const result = validationEngine.validateExportData(invalidData);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_STRUCTURE');
    });
  });

  describe('version validation', () => {
    it('should validate correct version format', () => {
      const result = validationEngine.validateExportData(validExportData);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid version formats', () => {
      const invalidVersions = ['1', '1.0', 'a.b.c', '1.0.0.0'];
      
      invalidVersions.forEach(version => {
        const data = { ...validExportData, version };
        const result = validationEngine.validateExportData(data);
        expect(result.isValid).toBe(false);
        expect(result.errors[0]).toEqual({
          code: 'INVALID_VERSION',
          message: 'Invalid version format',
          field: 'version'
        });
      });
    });
  });

  describe('spaces validation', () => {
    it('should validate valid spaces structure', () => {
      const result = validationEngine.validateExportData(validExportData);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid spaces structure', () => {
      const invalidSpaces = {
        ...validExportData,
        spaces: 'not an object'
      };
      
      const result = validationEngine.validateExportData(invalidSpaces);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_SPACES');
    });

    it('should validate multiple spaces', () => {
      const data = {
        ...validExportData,
        spaces: {
          active: {
            'space-1': validSpace,
            'space-2': validSpace
          },
          closed: {
            'space-3': validSpace
          }
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(true);
    });
  });

  describe('space fields validation', () => {
    it('should validate required space fields', () => {
      const result = validationEngine.validateExportData(validExportData);
      expect(result.isValid).toBe(true);
    });

    it('should reject space without id', () => {
      const invalidSpace = { ...validSpace, id: '' };
      const data = {
        ...validExportData,
        spaces: {
          active: { 'space-1': invalidSpace },
          closed: {}
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_SPACE_ID');
    });

    it('should reject space without name', () => {
      const invalidSpace = { ...validSpace, name: '' };
      const data = {
        ...validExportData,
        spaces: {
          active: { 'space-1': invalidSpace },
          closed: {}
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_SPACE_NAME');
    });
  });

  describe('URL validation', () => {
    it('should validate valid URLs', () => {
      const space = {
        ...validSpace,
        urls: ['https://example.com', 'http://test.com']
      };
      const data = {
        ...validExportData,
        spaces: {
          active: { 'space-1': space },
          closed: {}
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid URLs', () => {
      const space = {
        ...validSpace,
        urls: ['not-a-url', 'http:/invalid.com']
      };
      const data = {
        ...validExportData,
        spaces: {
          active: { 'space-1': space },
          closed: {}
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_URL');
    });

    it('should reject non-array urls field', () => {
      const space = {
        ...validSpace,
        urls: 'https://example.com' as any
      };
      const data = {
        ...validExportData,
        spaces: {
          active: { 'space-1': space },
          closed: {}
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_URLS');
    });
  });

  describe('metadata validation', () => {
    it('should validate valid metadata', () => {
      const result = validationEngine.validateExportData(validExportData);
      expect(result.isValid).toBe(true);
    });

    it('should reject missing exportedBy', () => {
      const data = {
        ...validExportData,
        metadata: {
          ...validExportData.metadata,
          exportedBy: ''
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('MISSING_EXPORTER');
    });

    it('should validate optional description', () => {
      const data = {
        ...validExportData,
        metadata: {
          ...validExportData.metadata,
          description: 'Test description'
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid description type', () => {
      const data = {
        ...validExportData,
        metadata: {
          ...validExportData.metadata,
          description: 123 as any
        }
      };
      
      const result = validationEngine.validateExportData(data);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_DESCRIPTION');
    });
  });
});