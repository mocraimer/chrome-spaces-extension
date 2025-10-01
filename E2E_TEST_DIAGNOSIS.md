# E2E Test Diagnosis and Fixes

## Executive Summary

E2E tests for space persistence are failing. Through detailed investigation, I've identified the root causes and created solutions.

## ✅ Issues Resolved

### 1. Wrong Test Selectors
**Problem**: Tests used `[data-testid="space-item"]` but component has `[data-testid="space-item-${id}"]`

**Solution**: Use `[data-testid^="space-item"]` (starts with selector)

**Status**: ✅ Fixed in diagnostic tests

---

### 2. Creating Tabs Instead of Windows
**Problem**: `context.newPage()` creates tabs in same window, but extension tracks windows

**Solution**: Created helper function that uses `chrome.windows.create()` API

**Status**: ✅ Fixed - see `e2e-tests/test-helpers.ts`

---

### 3. Temporary User Data Directory
**Problem**: Using empty string for user data creates temp profiles that don't persist

**Solution**: Use persistent directory path for testing

**Status**: ✅ Fixed - tests now use `.test-user-data-*` directories

---

## ❌ Critical Issue: Spaces Not Persisting as Closed Spaces

### The Problem

When browser context closes:
1. All windows are closed by Chrome
2. Extension should move them to `closedSpaces`
3. **BUT**: `closedSpaces` remains empty after restart
4. Spaces disappear completely (not restored, not in closed section)

### Evidence

**Storage after restart**:
```json
{
  "closedSpaces": {},  // ← EMPTY! Should contain closed windows
  "permanentIdMappings": {
    "1859775538": "space_i01uoibuv6qewbddmlhdm",  // ← Tracked
    "1859775540": "space_p2ryvwkhvbxpovizdz1vs"   // ← Tracked
  },
  "spaces": {
    "1859775602": { // ← Only NEW popup window exists
      "name": "Untitled Space 1859775602"
    }
  }
}
```

### Root Cause

When browser context closes:
1. Chrome fires `windows.onRemoved` events
2. Service worker is already terminating
3. Events may not be processed before termination
4. Spaces don't get moved to `closedSpaces` in storage
5. On restart, they're lost

### Where to Fix

**File**: `src/background/services/StateManager.ts`

**Likely culprit**: `handleWindowRemoved()` method

The handler needs to:
1. Immediately move closed windows to `closedSpaces` synchronously
2. Call `saveSpaces()` immediately (not debounced)
3. Ensure storage write completes before service worker can terminate

---

## 🔧 Recommended Fixes

### Priority 1: Fix Closed Space Persistence

**Location**: `src/background/services/StateManager.ts` - `handleWindowRemoved()`

```typescript
private async handleWindowRemoved(windowId: number): Promise<void> {
  console.log(`[StateManager] Window ${windowId} removed`);

  const space = this.spaces.get(windowId.toString());
  if (space) {
    // Mark as inactive immediately
    space.isActive = false;
    space.windowId = null;

    // Move to closed spaces
    this.closedSpaces.set(space.permanentId, space);
    this.spaces.delete(windowId.toString());

    // CRITICAL: Save immediately, not debounced
    // This ensures data persists even if service worker terminates
    await this.storageManager.saveSpaces(
      Array.from(this.spaces.values()),
      Array.from(this.closedSpaces.values())
    );

    console.log(`[StateManager] Space ${space.permanentId} moved to closed spaces and saved`);
  }
}
```

**Key changes**:
- Remove any debouncing for window removal
- Call `saveSpaces()` immediately with `await`
- Don't rely on batch saves or delayed writes

---

### Priority 2: Fix Service Worker Shutdown Handling

**Location**: `src/background/index.ts` - shutdown handler

```typescript
chrome.runtime.onSuspend.addListener(async () => {
  console.log('[Background] Service worker suspending - ensuring all data is saved');

  try {
    // Force immediate save of all current state
    await stateManager.forceSave();
    console.log('[Background] Final save completed before suspension');
  } catch (err) {
    console.error('[Background] Error during final save:', err);
  }
});
```

Add `forceSave()` method to StateManager:
```typescript
public async forceSave(): Promise<void> {
  await this.storageManager.saveSpaces(
    Array.from(this.spaces.values()),
    Array.from(this.closedSpaces.values())
  );
}
```

---

### Priority 3: Test Closed Spaces Section

Create E2E test that verifies closed spaces:

```typescript
test('closed spaces should be preserved after restart', async () => {
  // 1. Create windows
  // 2. Close them explicitly (not via context.close())
  // 3. Verify they appear in closed spaces section
  // 4. Restart
  // 5. Verify they're still in closed spaces section
});
```

---

## 📋 Test Files Created

### 1. `e2e-tests/diagnostic-persistence.test.ts`
Diagnostic test that reveals:
- ✅ Selectors work with `^=`
- ✅ Windows are created
- ⚠️ Only 1 window tracked (needs chrome.windows.create)

### 2. `e2e-tests/test-helpers.ts`
Helper functions:
- `createChromeWindow()` - Creates actual Chrome windows
- `openExtensionPopup()` - Opens popup reliably
- `waitForSpaceItems()` - Waits for spaces to load
- `getSpaceItems()` - Gets space items with correct selector
- `renameSpace()` - Renames via F2 (avoids popup close)
- `getDiagnosticInfo()` - Gets extension state info

### 3. `e2e-tests/space-persistence-fixed.test.ts`
Improved persistence tests (partially working):
- ✅ Creates actual Chrome windows
- ✅ Uses persistent user data
- ⚠️ Rename functionality needs more work

### 4. `e2e-tests/simple-persistence.test.ts`
Direct API testing:
- ✅ Creates windows via chrome.windows.create()
- ✅ Attempts to rename via messages
- ❌ Reveals closed spaces not persisting

---

## 🎯 Next Steps

### Immediate (Fix the Extension):
1. **Fix `handleWindowRemoved()`** - Save immediately, no debouncing
2. **Fix `onSuspend` handler** - Force save all state before termination
3. **Test manually** - Close browser, reopen, verify closed spaces exist

### After Extension Fix (Fix the Tests):
4. **Update E2E tests** - Check for closed spaces after restart
5. **Fix rename message handling** - Background service message handler
6. **Add more comprehensive tests** - Cover edge cases

---

## 📊 Test Results Summary

| Test | Status | Issue |
|------|--------|-------|
| Diagnostic | ✅ Pass | Confirmed selectors and window creation work |
| Simple Persistence | ❌ Fail | Spaces don't persist as closed spaces |
| Fixed Persistence | ⚠️ Partial | Windows created, but rename and persistence incomplete |

---

## 🔍 Key Learnings

1. **Playwright + Extensions**: Need chrome.windows.create() for actual windows
2. **Data Testids**: Component uses dynamic IDs like `space-item-${id}`
3. **User Data**: Must use persistent directory to test real persistence
4. **Service Worker Lifecycle**: Critical to save immediately on window close
5. **Closed Spaces**: Are the key to persistence across restarts

---

## ✅ Success Criteria

Tests should verify:
- [x] Windows can be created programmatically
- [x] Extension tracks created windows
- [ ] Windows moved to closed spaces when closed
- [ ] Closed spaces persist after browser restart
- [ ] Closed spaces visible in popup after restart
- [ ] Space names persist with closed spaces

---

## 📝 Code Locations

- **StateManager**: `src/background/services/StateManager.ts`
- **Storage**: `src/background/services/StorageManager.ts`
- **Background**: `src/background/index.ts`
- **Popup**: `src/popup/components/UnifiedPopup.tsx`
- **Space Item**: `src/popup/components/UnifiedSpaceItem.tsx`
- **Test Helpers**: `e2e-tests/test-helpers.ts`

---

*Generated: 2025-09-30*
*Diagnosis complete - ready for implementation*