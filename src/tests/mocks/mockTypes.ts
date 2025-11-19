import type { Space } from '@/shared/types/Space';

/**
 * Creates a mock Space object with specified ID and name
 * Support two signatures:
 * 1. (id: string, name: string, options?: Partial<Space>)
 * 2. (options: Partial<Space> & { name?: string, id?: string })
 */
export function createMockSpace(
  idOrOptions: string | (Partial<Space> & { name?: string, id?: string }),
  name?: string,
  options?: Partial<Space>
): Space {
  let finalId = '1';
  let finalName = 'Test Space';
  let finalOptions: Partial<Space> = {};

  if (typeof idOrOptions === 'string') {
    finalId = idOrOptions;
    finalName = name || 'Test Space';
    finalOptions = options || {};
  } else {
    finalId = idOrOptions.id || '1';
    finalName = idOrOptions.name || 'Test Space';
    finalOptions = idOrOptions;
  }

  return {
    id: finalId,
    name: finalName,
    urls: [],
    lastModified: Date.now(),
    version: 1,
    lastSync: Date.now(),
    sourceWindowId: '1', // Default source window
    named: false,
    // New required fields
    permanentId: `perm_${finalId}`,
    createdAt: Date.now(),
    lastUsed: Date.now(),
    isActive: true,
    windowId: parseInt(finalId, 10),
    // Apply any overrides
    ...finalOptions
  };
}

export const mockSpaces: Record<string, Space> = {
  '1': createMockSpace('1', 'Test Space 1'),
  '2': createMockSpace('2', 'Test Space 2'),
  '3': createMockSpace('3', 'Test Space 3')
};

export const mockClosedSpaces: Record<string, Space> = {
  '4': createMockSpace('4', 'Closed Space 1')
};
