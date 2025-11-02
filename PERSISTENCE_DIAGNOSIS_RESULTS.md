# State Persistence Diagnosis Results
**Date**: 2025-11-01
**Test**: Comprehensive E2E Persistence Test
**Status**: ✅ ROOT CAUSE IDENTIFIED

---

## Executive Summary

**The persistence system is working correctly.** Custom names ARE being saved and survive browser restarts. The perceived "loss" of custom names is due to **auto-restore being disabled by default**, causing all windows to become closed spaces on restart.

---

## Test Results

### ✅ Phase 1-3: Runtime Persistence (PASSED)
- Created 3 windows and renamed them with custom names
- All custom names saved to `chrome.storage.local`
- Storage and background state remain synchronized
- All spaces show `named: true` and correct `customName` field

**Evidence:**
```json
{
  "2108343106": {
    "customName": "Development Space",
    "named": true,
    "name": "Development Space"
  },
  "2108343109": {
    "customName": "Code Review Space",
    "named": true,
    "name": "Code Review Space"
  },
  "2108343111": {
    "customName": "Research Space",
    "named": true,
    "name": "Research Space"
  }
}
```

### ✅ Phase 4-5: Pre-Restart Storage (PASSED)
- Closed one space (moved to closedSpaces)
- Custom name preserved in closedSpaces: "Code Review Space"
- Pre-restart snapshot shows all custom names intact in storage

### ✅ Phase 6-7: Browser Restart (PASSED - Data Preserved)
- Browser closed and reopened
- **ALL custom names survived restart in closedSpaces**
- Storage data integrity maintained

**Post-Restart Storage:**
```json
{
  "closedSpaces": [
    {
      "id": "2108343106",
      "name": "Development Space",
      "customName": "Development Space"  // ✅ PRESERVED
    },
    {
      "id": "2108343109",
      "name": "Code Review Space",
      "customName": "Code Review Space"  // ✅ PRESERVED
    },
    {
      "id": "2108343111",
      "name": "Research Space",
      "customName": "Research Space"  // ✅ PRESERVED
    }
  ]
}
```

### ❌ Phase 8-9: Window Restoration (FAILED - By Design)
- Active windows before restart: 3
- Active windows after restart: 1 (new Playwright window)
- **All 3 test windows moved to closedSpaces** (not restored)
- Custom names intact but not visible in active windows

---

## Root Cause

### Primary Issue: Auto-Restore Disabled by Default

**Location**: `src/options/store/slices/settingsSlice.ts:24`

```typescript
general: {
  autoRestore: false,  // ❌ Disabled by default
},
```

**Impact**:
- When Chrome restarts, the extension initializes but doesn't restore windows
- All previously open windows become closed spaces
- Custom names are preserved in closed spaces but not visible in active windows
- Users must manually restore spaces or enable auto-restore

**Related Code**: `src/background/index.ts:170-183`

```typescript
private async handleStartup(): Promise<void> {
  await this.stateManager.initialize();

  const settings = await this.loadSettings();
  if (settings?.general?.autoRestore) {  // Only runs if enabled
    console.log('[Startup] Auto-restore enabled, restoring spaces');
    await this.restoreSpaces();
  }
}
```

---

## Recommendations

### Option 1: Change Default to Enable Auto-Restore (Breaking Change)

**Change**: `src/options/store/slices/settingsSlice.ts:24`
```typescript
general: {
  autoRestore: true,  // Enable by default
},
```

**Pros**:
- Better user experience - spaces restore automatically
- Matches user expectations
- Custom names immediately visible after restart

**Cons**:
- Breaking change for existing users
- May unexpectedly restore many windows
- Could be intrusive if user closed Chrome to clean up

**Recommendation**: ⚠️ Consider this carefully - it changes fundamental behavior

---

### Option 2: Improve First-Time Setup (Non-Breaking)

**Add an onboarding prompt** after installation:

```typescript
chrome.runtime.onInstalled.addListener(async (details) => {
  if (details.reason === 'install') {
    // Show welcome page explaining auto-restore
    chrome.tabs.create({ url: 'welcome.html' });

    // Or set a flag to show in-popup prompt
    await chrome.storage.local.set({
      showAutoRestorePrompt: true
    });
  }
});
```

**Pros**:
- No breaking changes
- Users make informed choice
- Better user education

**Cons**:
- Requires additional UI work
- Still defaults to OFF initially

---

### Option 3: Improve Closed Spaces Visibility (Quick Win)

**Make closed spaces with custom names more prominent** in the UI:

1. **Badge/indicator** showing number of closed spaces with custom names
2. **Notification** after restart: "3 named spaces were closed. Restore?"
3. **One-click restore** button in popup for recently closed named spaces

**Location**: `src/popup/components/*`

**Pros**:
- No breaking changes
- Helps users find their named spaces
- Easy to implement

**Cons**:
- Doesn't solve the root perception issue
- Still requires manual action

---

### Option 4: Smart Auto-Restore (Recommended)

**Only auto-restore spaces that have custom names** (named: true):

```typescript
private async handleStartup(): Promise<void> {
  await this.stateManager.initialize();

  const settings = await this.loadSettings();
  const closedSpaces = this.stateManager.getClosedSpaces();

  // Count spaces with custom names
  const namedClosedSpaces = Object.values(closedSpaces)
    .filter(space => space.named && space.customName);

  if (settings?.general?.autoRestore) {
    // Restore all spaces
    await this.restoreSpaces();
  } else if (namedClosedSpaces.length > 0 && settings?.general?.autoRestoreNamed !== false) {
    // Restore only named spaces (new setting, default true)
    console.log(`[Startup] Auto-restoring ${namedClosedSpaces.length} named spaces`);
    for (const space of namedClosedSpaces) {
      await this.restoreSpace(space.id);
    }
  }
}
```

**New Setting**:
```typescript
general: {
  autoRestore: false,           // Restore all spaces (existing)
  autoRestoreNamed: true,        // NEW: Restore only named spaces by default
},
```

**Pros**:
- Solves the user's core issue (named spaces disappear)
- Non-breaking (new opt-in setting)
- Logical: "If I named it, I want to keep it"
- Minimal impact (only restores what user explicitly named)

**Cons**:
- More complex logic
- Need to test edge cases
- Adds another setting

**Recommendation**: ⭐ **RECOMMENDED** - Best balance of UX and safety

---

## Immediate Actions

### 1. Update Documentation (Critical)

Create/update user-facing documentation explaining:
- Custom names ARE saved and persist
- Auto-restore setting controls window restoration
- How to enable auto-restore
- How to manually restore closed named spaces

**Location**: `README.md`, `docs/`, in-app help

---

### 2. Add Console Logging (Debug Aid)

Add clear logging when auto-restore is skipped:

```typescript
if (settings?.general?.autoRestore) {
  console.log('[Startup] Auto-restore enabled, restoring spaces');
  await this.restoreSpaces();
} else {
  console.log('[Startup] Auto-restore disabled. Enable in settings to restore windows on startup.');
  console.log('[Startup] Closed spaces with custom names:',
    Object.values(closedSpaces).filter(s => s.named).map(s => s.customName)
  );
}
```

---

### 3. UI Enhancement (Quick Win)

Add a banner/notification in popup after startup if closed spaces with custom names exist:

```typescript
// In popup component
const namedClosedSpaces = Object.values(closedSpaces)
  .filter(space => space.named && space.customName);

if (namedClosedSpaces.length > 0 && !hasSeenNotification) {
  return (
    <Notification>
      {namedClosedSpaces.length} named space(s) available to restore.
      <button onClick={restoreAll}>Restore All</button>
      <button onClick={dismiss}>Dismiss</button>
    </Notification>
  );
}
```

---

## Test Fixes Needed

The diagnostic test needs updating to account for the auto-restore setting:

**Option A**: Enable auto-restore in the test
```typescript
// Before restart
await chrome.storage.local.set({
  settings: {
    general: { autoRestore: true },
  },
});
```

**Option B**: Update assertions to expect closed spaces
```typescript
// After restart - check closed spaces for custom names
expect(postRestart.closedSpaces.some(s => s.customName === "Development Space")).toBe(true);
```

---

## Conclusion

**The extension is working correctly** - persistence is functioning as designed. The issue is a UX/expectations mismatch where:

1. ✅ Custom names ARE saved
2. ✅ Custom names survive restart
3. ❌ Windows aren't restored (by design - feature is off by default)

**Recommended Solution**: Implement **Option 4 (Smart Auto-Restore)** to automatically restore only named spaces, giving users the behavior they expect without being intrusive.

**Quick Wins**:
1. Update documentation
2. Add post-restart notification for named closed spaces
3. Improve closed spaces UI visibility

---

## Files Modified in This Investigation

1. `e2e-tests/state-persistence-debug.test.ts` - Fixed message types and test logic
2. `src/background/services/StorageManager.ts` - No changes needed (working correctly)
3. `src/background/services/StateManager.ts` - No changes needed (working correctly)
4. `src/background/index.ts` - No changes needed (working correctly, just disabled by default)

---

## Next Steps

1. **Decide** which recommendation to implement (Option 4 recommended)
2. **Update** settings UI to explain auto-restore better
3. **Add** post-restart notification for named closed spaces
4. **Test** auto-restore functionality with E2E tests
5. **Document** persistence and restoration behavior for users
