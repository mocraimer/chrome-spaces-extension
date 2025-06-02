# Chrome Spaces Popup - UX Specification

## Overview
The popup should provide a fast, keyboard-friendly interface for managing browser window spaces with search, navigation, and space management capabilities.

## Core Features

### 1. Search-First Interface
- **Auto-focus**: Search input is automatically focused when popup opens
- **Real-time search**: Filter spaces as user types (by space name, tab titles, URLs)
- **Search scope**: Search both active spaces and closed/archived spaces
- **Clear search**: ESC key clears search and returns focus to input

### 2. Keyboard Navigation
- **Enter key**: Switch to top search result (if any)
- **Arrow keys**: Navigate through space list
- **Tab key**: Quick switch between spaces in order
- **Number keys (1-9)**: Quick switch to space by position
- **ESC**: Clear search or close popup

### 3. Space Management
- **Active Spaces**: Currently open windows/spaces
- **Closed Spaces**: Previously saved spaces that can be restored
- **Remove spaces**: Delete key or context menu to remove/close spaces
- **Restore spaces**: Enter key or click to restore closed spaces

### 4. Visual Hierarchy
- Clear distinction between active and closed spaces
- Current space highlighted
- Search results prioritized (exact matches first)
- Tab count and preview for each space

## Detailed Requirements

### Search Behavior
- **Placeholder**: "Search spaces..." 
- **Search criteria**: 
  - Space names (custom or auto-generated)
  - Tab titles
  - Domain names
- **Results ordering**: 
  1. Exact space name matches
  2. Partial space name matches
  3. Tab title matches
  4. Domain matches

### Keyboard Shortcuts
- **Enter**: Switch to highlighted space (top result)
- **Shift+Enter**: Restore closed space in new window
- **Delete/Backspace**: Remove highlighted space
- **Tab**: Cycle through spaces (quick switch)
- **Ctrl+N**: Create new space
- **Arrow Up/Down**: Navigate list
- **ESC**: Clear search → Close popup (double ESC)

### Space Actions
- **Switch**: Change focus to existing space window
- **Restore**: Recreate closed space with original tabs
- **Remove**: Close active space or delete closed space
- **Rename**: Double-click or F2 to rename space

## Questions for Clarification

1. **Space Naming**: 
   - Should spaces have auto-generated names based on content (e.g., "GitHub - Work", "Gmail - Personal")?
   - Allow custom naming?

2. **Closed Spaces Storage**:
   - How long should closed spaces be kept?
   - Should there be a limit on number of stored spaces?
   - Export/import functionality needed?

3. **Tab Switching within Spaces**:
   - You mentioned "quick way to switch tab between spaces" - do you mean:
     a) Switch between tabs within a space, or
     b) Switch between different spaces?

4. **Space Restoration**:
   - Should restored spaces maintain original tab order?
   - Handle tabs that no longer exist/load?
   - Restore in same window or always new window?

5. **Visual Design**:
   - Preferred popup size (current: 400px wide)?
   - Dark mode support needed?
   - Icons for different space types?

6. **Performance**:
   - Maximum number of spaces to display at once?
   - Pagination or infinite scroll for large lists?

7. **Context Menu**:
   - Right-click menu for additional actions?
   - What actions should be available?

8. **Multi-selection**:
   - Should users be able to select multiple spaces for batch operations?

Please clarify these points so I can create the perfect popup implementation!