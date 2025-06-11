# Unified State Management Plan

## Current Problems

1. **Multiple Space Type Definitions**
   - Background service uses `Space` from shared types
   - Popup uses its own `Space` interface with different fields

2. **Fragmented Storage**
   - Background: `chrome_spaces` key with spaces/closedSpaces
   - Popup: Separate keys for custom names, permanent IDs, legacy closed spaces
   - No synchronization between systems

3. **Naming System Conflicts**
   - Background service has `space.named` boolean and `space.name`
   - Popup has separate `spaceCustomNames` storage with custom names
   - Changes in popup don't update background service

## Solution: Unified State Architecture

### Phase 1: Unify Space Type Definition

**Single Source of Truth**: Extend the shared `Space` type to include all needed fields:

```typescript
// src/shared/types/Space.ts
export interface Space {
  // Core fields (existing)
  id: string;
  name: string;
  urls: string[];
  lastModified: number;
  named: boolean;
  version: number;
  sourceWindowId?: string;
  lastSync?: number;
  
  // UI fields (add these)
  permanentId: string;        // Stable ID across browser restarts
  customName?: string;        // User-defined custom name
  createdAt: number;          // When space was first created
  lastUsed: number;           // Last time space was accessed
  isActive: boolean;          // Whether window is currently open
  windowId?: number;          // Current window ID (if active)
}
```

### Phase 2: Centralize Storage Management

**Single Storage Key**: Use only `chrome_spaces` key with extended structure:

```typescript
interface ChromeSpacesStorage {
  spaces: Record<string, Space>;
  closedSpaces: Record<string, Space>;
  permanentIdMappings: Record<string, string>; // windowId -> permanentId
  lastModified: number;
  version: number; // Schema version for migrations
}
```

### Phase 3: Update Background Service

**StorageManager Enhancements**:
- Add permanent ID management
- Add custom name handling
- Maintain backward compatibility
- Add data migration logic

**StateManager Enhancements**:
- Update `renameSpace()` to set both `name`, `customName`, and `named: true`
- Update `createSpace()` to generate permanent IDs
- Ensure space restoration preserves all fields

### Phase 4: Update Popup

**Remove Direct Storage Access**:
- Remove `spaceCustomNames`, `spacePermanentIds`, `closedSpaces` direct storage
- Use Redux store that communicates with background service only
- All state changes go through background service actions

**Updated Redux Slice**:
- Remove local storage logic from `EnhancedPopup.tsx`
- Use only `fetchSpaces`, `renameSpace`, etc. actions
- Background service returns complete space objects

### Phase 5: Data Migration

**Migration Strategy**:
1. Detect old storage format
2. Migrate `spaceCustomNames` data into space objects
3. Migrate permanent ID mappings
4. Clean up old storage keys
5. Update version number

## Implementation Steps

### Step 1: Update Shared Types
- [ ] Extend `Space` interface with all fields
- [ ] Add migration types
- [ ] Update type guards

### Step 2: Update Background Service
- [ ] Enhance `StorageManager` with permanent ID support
- [ ] Update `StateManager.renameSpace()` to handle custom names properly
- [ ] Add migration logic
- [ ] Update space creation to include all fields

### Step 3: Update Popup
- [ ] Remove direct storage access from `EnhancedPopup.tsx`
- [ ] Update Redux actions to use unified space objects
- [ ] Remove legacy storage code
- [ ] Test with unified state

### Step 4: Update Options (if needed)
- [ ] Ensure options still work with new system
- [ ] Update any space-related settings

### Step 5: Testing
- [ ] Test space creation, renaming, closing, restoration
- [ ] Test browser restart functionality
- [ ] Test migration from old to new format
- [ ] E2E test for session persistence

## Benefits

1. **Single Source of Truth**: All space data in one place
2. **Consistent State**: Background service and popup see same data
3. **Reliable Persistence**: Names and state preserved across restarts
4. **Simpler Architecture**: No need to sync multiple storage systems
5. **Better Testing**: Easier to test with unified state

## Breaking Changes

- Popup `Space` interface will change (internal only)
- Storage keys will be consolidated (migration handles this)
- Some popup logic will be simplified

## Migration Safety

- Detect and migrate existing data automatically
- Preserve user's custom space names
- Maintain backward compatibility during transition
- Rollback capability if needed 