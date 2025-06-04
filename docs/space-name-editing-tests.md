# Space Name Editing Tests

This document describes the comprehensive test suite for space name editing functionality, including persistence across Chrome restarts.

## Test Overview

The space name editing feature has been thoroughly tested across multiple layers:

1. **Unit Tests** - Component behavior and UI interactions
2. **Integration Tests** - Storage persistence and state management
3. **End-to-End Tests** - Full user workflow across Chrome restarts
4. **Validation Tests** - Input validation and edge cases

## Test Files

### 1. UI Component Tests
**File**: `src/tests/unit/components/SpaceNameEditing.test.tsx`

Tests the SpaceItem component's editing functionality:

- **Display Mode**: Renders space names and tab counts correctly
- **Edit Mode**: Shows input field, save/cancel buttons, and auto-focus
- **Keyboard Navigation**: Enter to save, Escape to cancel, event propagation
- **Button Actions**: Save/cancel button functionality
- **Loading States**: Skeleton loading during data fetch
- **Redux Integration**: State updates and edit mode toggling
- **Edge Cases**: Empty names, very long names, special characters

### 2. Storage Persistence Tests
**File**: `src/tests/integration/services/SpaceNamePersistence.test.ts`

Tests data persistence across Chrome sessions:

- **Space Name Updates**: Persistence to Chrome storage
- **Chrome Restart Simulation**: Name retention after restart
- **Version Management**: Proper versioning of space updates
- **Closed Space Persistence**: Names persist for closed spaces
- **Storage Error Handling**: Graceful handling of storage failures
- **Concurrent Updates**: Multiple simultaneous name changes
- **Data Validation**: Input sanitization and normalization

### 3. End-to-End Tests
**File**: `e2e-tests/space-name-persistence.test.ts`

Tests complete user workflows:

- **Full Chrome Restart**: Edit name, restart browser, verify persistence
- **Multiple Space Edits**: Rename several spaces and verify all persist
- **Closed Space Editing**: Edit closed space names and verify persistence
- **Input Validation**: Test empty names, special characters, length limits
- **Concurrent Editing**: Multiple popup instances editing simultaneously
- **Edit State Management**: Edit mode doesn't persist across popup reopens

### 4. Validation Tests
**File**: `src/tests/unit/services/SpaceNameValidation.test.ts`

Tests input validation and security:

- **Basic Validation**: Empty names, whitespace trimming, normalization
- **Length Validation**: Short and very long names
- **Character Support**: Unicode, emojis, special characters
- **Edge Cases**: Null/undefined inputs, non-string types
- **Security**: XSS attempts, SQL injection attempts
- **Performance**: Efficient validation of large inputs
- **State Consistency**: Proper state after validation failures

## Running the Tests

### Run All Space Name Tests
```bash
./scripts/test-space-names.sh
```

### Run Individual Test Suites
```bash
# UI component tests
npm run test -- --testPathPattern="SpaceNameEditing"

# Storage persistence tests
npm run test -- --testPathPattern="SpaceNamePersistence"

# Validation tests
npm run test -- --testPathPattern="SpaceNameValidation"

# E2E tests (requires built extension)
npm run test:e2e -- --grep "Space Name Persistence"
```

### Run Specific Test Cases
```bash
# Test only keyboard navigation
npm run test -- --testPathPattern="SpaceNameEditing" --testNamePattern="Keyboard"

# Test only persistence across restarts
npm run test -- --testPathPattern="SpaceNamePersistence" --testNamePattern="restart"
```

## Test Scenarios Covered

### User Interaction Scenarios
- ✅ Click edit button to enter edit mode
- ✅ Double-click space name to edit
- ✅ Type new name in input field
- ✅ Press Enter to save changes
- ✅ Press Escape to cancel changes
- ✅ Click Save button to confirm
- ✅ Click Cancel button to revert

### Persistence Scenarios
- ✅ Name persists after closing/reopening extension popup
- ✅ Name persists after closing/reopening Chrome browser
- ✅ Name persists after Chrome crash/restart
- ✅ Multiple space names persist independently
- ✅ Closed space names persist after becoming closed
- ✅ Names persist with proper version tracking

### Edge Cases
- ✅ Empty space names (rejected)
- ✅ Very long space names (handled gracefully)
- ✅ Special characters and Unicode
- ✅ Multiple consecutive spaces (normalized)
- ✅ Leading/trailing whitespace (trimmed)
- ✅ Concurrent editing from multiple popups
- ✅ Storage quota exceeded scenarios
- ✅ Corrupted storage data recovery

### Validation
- ✅ Input sanitization
- ✅ XSS prevention (stored as-is, sanitization in UI)
- ✅ Performance with large inputs
- ✅ Type safety (rejects non-strings)
- ✅ State consistency after failures

## Architecture Integration

The tests verify integration across the entire architecture:

1. **Frontend (SpaceItem component)**: UI interactions and state management
2. **State Management (Redux)**: Action dispatching and state updates
3. **Background Services**: Message handling and storage operations
4. **Storage Layer**: Chrome storage API and data persistence
5. **Validation Layer**: Input validation and security

## Performance Considerations

The tests include performance validations:

- Name validation completes within reasonable time limits
- Storage operations don't block the UI
- Concurrent updates are handled efficiently
- Large input strings are processed quickly

## Security Testing

Security aspects are thoroughly tested:

- XSS payload handling (stored as-is for flexibility)
- SQL injection attempt handling
- Input type validation
- Buffer overflow prevention for large inputs

## Future Test Expansion

Areas for additional test coverage:

1. **Accessibility**: Screen reader compatibility, keyboard navigation
2. **Internationalization**: RTL text, complex Unicode handling
3. **Performance**: Large-scale concurrent editing (100+ spaces)
4. **Network**: Offline editing and sync when online
5. **Migration**: Upgrading from older data formats

## Dependencies

Test dependencies and their purposes:

- `@testing-library/react`: Component testing utilities
- `@testing-library/user-event`: User interaction simulation
- `@playwright/test`: End-to-end browser testing
- `jest`: Test runner and assertion framework
- `redux-mock-store`: Redux state mocking

## Maintenance

When modifying space name editing functionality:

1. Update relevant test files to match new behavior
2. Add tests for any new edge cases or features
3. Ensure all existing tests continue to pass
4. Update this documentation with new test scenarios
5. Run the full test suite before committing changes