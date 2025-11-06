import { Space } from '@/shared/types/Space';

/**
 * Preserve critical space identity and naming fields while applying updates.
 * This centralizes the logic for maintaining space identity across operations like
 * closing, restoring, re-keying, etc.
 *
 * @param space The original space
 * @param updates Partial updates to apply
 * @returns A new space with identity preserved and updates applied
 */
export function preserveSpaceIdentity(
  space: Space,
  updates: Partial<Space> = {}
): Space {
  const now = Date.now();

  return {
    ...space,
    ...updates,
    // CRITICAL: Explicitly preserve all naming and identity fields
    name: updates.name ?? space.name,
    named: updates.named ?? space.named,
    permanentId: updates.permanentId ?? space.permanentId,
    createdAt: updates.createdAt ?? space.createdAt,
    // Update metadata
    lastModified: updates.lastModified ?? now,
    version: updates.version ?? ((space.version || 0) + 1),
    lastUsed: updates.lastUsed ?? now
  };
}

/**
 * Create a TabRecord object with consistent structure
 */
export interface TabRecord {
  id: string;
  spaceId: string;
  kind: 'active' | 'closed';
  url: string;
  index: number;
  createdAt: number;
}

/**
 * Create a tab record with proper structure
 * @param spaceId The space this tab belongs to
 * @param url The tab URL
 * @param index The tab index/order
 * @param kind Whether this is an active or closed tab
 * @returns A TabRecord
 */
export function createTabRecord(
  spaceId: string,
  url: string,
  index: number,
  kind: 'active' | 'closed'
): TabRecord {
  // Import here to avoid circular dependency
  const { generateUUID } = require('./uuid');

  return {
    id: generateUUID('tab'),
    spaceId,
    kind,
    url,
    index,
    createdAt: Date.now()
  };
}
