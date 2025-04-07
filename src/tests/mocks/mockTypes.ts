import type { Space } from '@/shared/types/Space';

export const createMockSpace = (id: string, name: string): Space => ({
  id,
  name,
  urls: [],
  lastModified: Date.now()
});

export const mockSpaces: Record<string, Space> = {
  '1': createMockSpace('1', 'Test Space 1'),
  '2': createMockSpace('2', 'Test Space 2'),
  '3': createMockSpace('3', 'Test Space 3')
};

export const mockClosedSpaces: Record<string, Space> = {
  '4': createMockSpace('4', 'Closed Space 1')
};