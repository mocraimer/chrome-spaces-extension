import type { Space } from '@/shared/types/Space';

/**
 * Creates a mock Space object with specified ID and name
 * @param id - Space ID
 * @param name - Space name
 * @param options - Optional overrides for specific fields
 */
export const createMockSpace = (
  id: string,
  name: string,
  options?: Partial<Space>
): Space => ({
  id,
  name,
  urls: [],
  lastModified: Date.now(),
  version: 1,
  lastSync: Date.now(),
  sourceWindowId: '1', // Default source window
  named: false,
  // New required fields
  permanentId: `perm_${id}`,
  createdAt: Date.now(),
  lastUsed: Date.now(),
  isActive: true,
  windowId: parseInt(id, 10),
  // Apply any overrides
  ...options
});

export const mockSpaces: Record<string, Space> = {
  '1': createMockSpace('1', 'Test Space 1'),
  '2': createMockSpace('2', 'Test Space 2'),
  '3': createMockSpace('3', 'Test Space 3')
};

export const mockClosedSpaces: Record<string, Space> = {
  '4': createMockSpace('4', 'Closed Space 1')
};