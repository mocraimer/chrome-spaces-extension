# Space Name Editing - Implementation Plan

## Current State Analysis

### ✅ Already Implemented:
- Basic editing UI (input field appears on double-click)
- `editingSpaceId` and `editingName` state management
- `startEditing()` function triggered by double-click
- Input field with focus and selection
- Cancel editing with ESC key
- F2 key to start editing

### ❌ Missing Implementation:
- **Persistent storage** of custom names
- **Save functionality** that actually persists names
- **Visual feedback** for saved vs unsaved states
- **Validation** of name input
- **Synchronization** between active and closed spaces

## Implementation Plan

### 1. Persistent Storage System
**Storage Structure:**
```typescript
interface SpaceNameStorage {
  [windowId: string]: {
    customName: string;
    lastModified: number;
    originalName: string;
  }
}
```

**Storage Key:** `'spaceCustomNames'`

### 2. Core Functions to Implement
1. `loadCustomNames()` - Load custom names from storage
2. `saveCustomName(spaceId, customName)` - Save individual name
3. `deleteCustomName(spaceId)` - Remove custom name
4. `syncSpaceNames()` - Sync names between active/closed spaces

### 3. Enhanced UX Features
- **Auto-save** on blur or Enter key
- **Validation**: No empty names, max length limit
- **Visual indicators**: Show when name is custom vs auto-generated
- **Undo functionality**: Reset to auto-generated name
- **Conflict resolution**: Handle window ID changes

### 4. Edge Cases to Handle
- Window ID changes (rare but possible)
- Names for closed spaces that get restored
- Very long names (truncation/validation)
- Special characters in names
- Duplicate names (allow but show indicator)

## Questions for Clarification

### 1. **Name Validation**
- Should there be a character limit? (suggested: 50 chars)
- Allow special characters (emojis, symbols)?
- Prevent duplicate names or allow them?

### 2. **Visual Design**
- Show indicator when name is custom vs auto-generated?
- How to show "edit mode" - border, background change?
- Show "reset to auto-generated" option?

### 3. **Persistence Strategy**
- Store names by window ID (can change) or generate unique space ID?
- How long to keep custom names for closed spaces?
- Export/import custom names with spaces?

### 4. **UX Behaviors**
- Auto-save on blur or require explicit save?
- Allow canceling edit with ESC to revert changes?
- Show tooltip/hint about double-click to edit?

### 5. **Keyboard Shortcuts**
- F2 to edit (already implemented)
- Enter to save and exit edit mode?
- Ctrl+Z to reset to auto-generated name?

## Suggested Implementation Approach

### Phase 1: Basic Persistence ✅
- Implement storage functions
- Save/load custom names
- Update handleSaveEdit to actually persist

### Phase 2: Enhanced UX
- Add validation and feedback
- Visual indicators for custom names
- Reset to auto-generated option

### Phase 3: Polish
- Keyboard shortcuts refinement
- Animation/transitions
- Error handling improvements

## Technical Considerations

### Storage Performance
- Use chrome.storage.local for fast access
- Batch operations when possible
- Clean up old entries periodically

### Memory Management
- Don't store all names in React state
- Load on-demand for large numbers of spaces
- Efficient updates without full reloads

### Synchronization
- Handle race conditions between multiple popups
- Sync names when windows are created/closed
- Update both active and closed space records

Would you like me to proceed with this plan? Any specific preferences for the questions above?