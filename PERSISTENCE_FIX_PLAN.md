# Chrome Spaces Extension - Persistence Fix Plan

## Executive Summary

The full persistence flow test revealed critical bugs in the space restoration logic. Named spaces are correctly saved to storage but fail to restore after browser restart. This document outlines the root causes and fix strategy.

---

## Issues Discovered

### 1. **CRITICAL: Named Spaces Not Restored After Browser Restart**

**Symptom:**
- Before restart: 3 active spaces with `isActive: true`
- After restart: 0 active spaces (all have `isActive: false`)
- Named spaces remain in storage but are never restored

**Root Cause:**
The restoration flow has a fundamental logic gap:

```
Shutdown Flow:
  handleShutdown() → marks all spaces as isActive: false → saves to storage

Startup Flow:
  initialize() → loads spaces (all isActive: false) → keeps them inactive
  restoreSpaces() → only restores from closedSpaces ❌
  synchronizeWindowsAndSpaces() → only reconciles existing open windows ❌
```

**Code Locations:**
- `src/background/services/StateManager.ts:329` - `handleShutdown()` marks all spaces inactive
- `src/background/services/StateManager.ts:118-139` - `initialize()` resets all to inactive
- `src/background/index.ts:204-218` - `restoreSpaces()` only checks `closedSpaces`

**The Gap:**
Named spaces that were active before shutdown are stored in the `spaces` object (not `closedSpaces`), but the restoration logic only looks at `closedSpaces`.

---

### 2. **Space Renaming Not Persisting (Race Condition)**

**Symptom:**
- Space 1 rename message sent: "Development Resources"
- Space saved as: "Untitled Space 847194345"
- Space 2 rename worked correctly: "Tech Documentation"

**Root Cause:**
Race condition between:
1. Window creation triggers synchronization
2. Rename message sent
3. Synchronization may overwrite the custom name before it's saved

**Code Location:**
- `src/background/services/StateManager.ts:435` - `synchronizeWindowsAndSpaces()`
- Line 482: `name: existingSpace.customName || existingSpace.name`

**The Issue:**
If synchronization runs between rename and save, it may not have the updated `customName` yet.

---

## Fix Strategy

### Phase 1: Fix Restoration Logic ✅ PRIORITY

**Goal:** Named spaces should be restored after browser restart

**Approach:** Update `restoreSpaces()` to restore from both `closedSpaces` AND inactive named spaces in `spaces`

**Implementation:**

```typescript
// src/background/index.ts - restoreSpaces()

private async restoreSpaces(): Promise<void> {
  try {
    // Get all spaces that should be restored
    const spacesToRestore: Array<{ id: string; space: Space; source: 'closed' | 'inactive' }> = [];

    // 1. Check closedSpaces for named spaces
    const closedSpaces = await this.stateManager.getClosedSpaces();
    for (const [id, space] of Object.entries(closedSpaces)) {
      if (space.named) {
        spacesToRestore.push({ id, space, source: 'closed' });
      }
    }

    // 2. NEW: Check spaces for named inactive spaces
    const allSpaces = await this.stateManager.getAllSpaces();
    for (const [id, space] of Object.entries(allSpaces)) {
      if (space.named && !space.isActive) {
        spacesToRestore.push({ id, space, source: 'inactive' });
      }
    }

    // Restore each named space
    for (const { id, space, source } of spacesToRestore) {
      console.log(`[Restore] Restoring ${source} space: ${space.name}`);
      await this.stateManager.restoreSpace(id);
    }

    console.log(`[Restore] ✅ Restored ${spacesToRestore.length} named spaces`);
  } catch (error) {
    console.error('Error restoring spaces:', error);
  }
}
```

**Required Changes:**
1. Add `getAllSpaces()` method to StateManager
2. Update `restoreSpaces()` to check both `closedSpaces` and inactive `spaces`
3. Ensure `restoreSpace()` works for spaces in the `spaces` object, not just `closedSpaces`

**Files to Modify:**
- `src/background/index.ts` - Update `restoreSpaces()` method
- `src/background/services/StateManager.ts` - Add `getAllSpaces()` method
- `src/background/services/StateManager.ts` - Verify `restoreSpace()` handles both cases

---

### Phase 2: Fix Space Renaming Race Condition

**Goal:** Ensure space names persist correctly regardless of synchronization timing

**Approach:** Add a pending operations queue for rename operations

**Implementation:**

```typescript
// src/background/services/StateManager.ts

private pendingRenames = new Map<string, { name: string; timestamp: number }>();

async renameSpace(spaceId: string, customName: string): Promise<void> {
  // Mark rename as pending
  this.pendingRenames.set(spaceId, { name: customName, timestamp: Date.now() });

  try {
    const space = this.spaces[spaceId];
    if (!space) {
      throw new Error(`Space ${spaceId} not found`);
    }

    // Update space with custom name
    this.spaces[spaceId] = {
      ...space,
      customName,
      name: customName,
      named: true,
      lastModified: Date.now(),
      version: space.version + 1
    };

    // Save immediately
    await this.storageManager.saveSpaces(this.spaces);

    // Clear pending rename
    this.pendingRenames.delete(spaceId);

    console.log(`[StateManager] ✅ Renamed space ${spaceId} to "${customName}"`);
  } catch (error) {
    this.pendingRenames.delete(spaceId);
    throw error;
  }
}

// In synchronizeWindowsAndSpaces():
// Check for pending renames before overwriting names
const pendingRename = this.pendingRenames.get(existingSpace.id);
updatedSpaces[existingSpace.id] = {
  ...existingSpace,
  urls,
  windowId: window.id,
  isActive: true,
  // Use pending rename if available
  name: pendingRename?.name || existingSpace.customName || existingSpace.name,
  customName: pendingRename?.name || existingSpace.customName,
  named: pendingRename ? true : existingSpace.named,
  // ... rest of properties
};
```

**Files to Modify:**
- `src/background/services/StateManager.ts` - Add pending renames tracking
- `src/background/services/StateManager.ts` - Update `renameSpace()` method
- `src/background/services/StateManager.ts` - Update `synchronizeWindowsAndSpaces()` to respect pending renames

---

### Phase 3: Improve Reconciliation Logic

**Goal:** Better handle window-to-space mapping on startup

**Current Issue:**
- `synchronizeWindowsAndSpaces()` only reconciles existing windows
- No windows exist after restart, so nothing to reconcile

**Approach:** Already fixed by Phase 1 (restoration will create windows)

**Additional Validation:**
- Add logging to track which spaces are being restored
- Add metrics to monitor restoration success rate
- Add fallback logic if restoration fails

---

## Testing Strategy

### 1. Manual Test with Full Persistence Flow

```bash
# Run the comprehensive test
npx playwright test e2e-tests/full-persistence-flow.test.ts --reporter=list
```

**Expected Results:**
- ✅ 2 windows created with 5 tabs each
- ✅ Both spaces named correctly
- ✅ Browser restart
- ✅ 2 windows restored with 5 tabs each
- ✅ Both space names preserved
- ✅ All tabs restored correctly

### 2. Edge Case Testing

**Test Cases:**
1. Restart with auto-restore disabled → No restoration
2. Restart with mix of named/unnamed spaces → Only named restored
3. Restart with closed spaces → Closed spaces restored
4. Rapid rename operations → No race conditions

### 3. Regression Testing

Run existing persistence tests:
```bash
npm run test:e2e -- --grep "persistence|restore|session"
```

---

## Implementation Order

1. **[PRIORITY]** Phase 1: Fix restoration logic
   - Add `getAllSpaces()` method
   - Update `restoreSpaces()` to check inactive named spaces
   - Test with full-persistence-flow

2. **[HIGH]** Phase 2: Fix renaming race condition
   - Add pending operations tracking
   - Update rename and sync methods
   - Test rapid rename scenarios

3. **[MEDIUM]** Phase 3: Add validation & logging
   - Enhanced logging for debugging
   - Metrics for restoration success
   - Fallback mechanisms

---

## Success Criteria

✅ Full persistence flow test passes completely
✅ Named spaces restore after browser restart
✅ Space names persist correctly
✅ All tabs restored with correct URLs
✅ No regression in existing tests
✅ Clear logging for debugging

---

## Risk Assessment

**Low Risk:**
- Phase 1 changes are additive (doesn't break existing functionality)
- Phase 2 adds safety net without changing core logic

**Medium Risk:**
- Restoration may interact with existing synchronization
- Need to ensure no duplicate windows created

**Mitigation:**
- Comprehensive testing before/after changes
- Feature flag for new restoration logic
- Detailed logging for production debugging

---

## Timeline Estimate

- **Phase 1:** 2-3 hours (implementation + testing)
- **Phase 2:** 1-2 hours (implementation + testing)
- **Phase 3:** 1 hour (logging + validation)
- **Total:** 4-6 hours

---

## Notes

- The test successfully validated the persistence layer works correctly
- The bug is in the restoration logic, not the storage layer
- Fix is straightforward: expand restoration to include inactive named spaces
- Automated test now exists to prevent regression

---

## Next Steps

1. Review and approve this plan
2. Implement Phase 1 (restoration logic)
3. Run full-persistence-flow test to validate
4. Implement Phase 2 (renaming fix)
5. Run all persistence tests
6. Deploy and monitor

---

**Document Status:** ✅ Ready for Implementation
**Last Updated:** 2025-11-01
**Test Coverage:** e2e-tests/full-persistence-flow.test.ts
