# Error UX Testing Suite

## Overview

This test suite validates how users experience and recover from errors, edge cases, and failure scenarios in the Chrome Spaces extension. Good UX isn't just about happy paths - it's about how gracefully the system handles failures and helps users recover.

## Philosophy

**Error UX Principles:**
- Errors should be user-friendly, not technical
- Always provide a recovery path
- Never lose user data
- Show errors near their source
- Be accessible (screen readers)
- Log technical details to console (for debugging)
- Don't spam users with repetitive errors

## Test Files

### 1. `network-failure-ux.test.ts`
**Tests network-related failures:**
- Offline mode handling
- Network timeouts
- Connection refused
- DNS resolution failures
- Slow network conditions
- Intermittent connectivity

**Key Assertions:**
- User-friendly error messages (not "Failed to fetch")
- Retry functionality is available
- State consistency after network recovery
- No data loss when network fails
- Graceful degradation in offline mode

**Example:**
```typescript
// User tries to restore space while offline
// ✓ Shows: "Unable to restore space. Please check your internet connection."
// ✓ Has: "Retry" button
// ✗ Bad: "Error: net::ERR_INTERNET_DISCONNECTED"
```

### 2. `validation-error-ux.test.ts`
**Tests input validation errors:**
- Empty space names
- Names that are too long
- Special characters
- Duplicate names
- Real-time validation feedback

**Key Assertions:**
- Clear, actionable validation messages
- Error appears near the input field
- User can fix and retry immediately
- Input is preserved when validation fails
- Has `role="alert"` for accessibility

**Example:**
```typescript
// User tries to save empty name
// ✓ Shows: "Space name is required" (near input)
// ✓ Input stays in edit mode, focused
// ✓ User types valid name → error disappears
// ✗ Bad: Generic "Validation failed"
```

### 3. `permission-denied-ux.test.ts`
**Tests Chrome permission errors:**
- Tabs permission denied
- Storage permission denied
- Clear explanation of why permission is needed
- Guidance on how to grant permission
- Graceful degradation without permission

**Key Assertions:**
- Explains WHY permission is needed
- Provides actionable steps to grant permission
- Shows "Grant Permission" or "Settings" button
- Doesn't repeatedly prompt after denial
- Extension remains usable (degraded mode)

**Example:**
```typescript
// Permission denied
// ✓ Shows: "Chrome Spaces needs permission to manage tabs so it can organize your spaces"
// ✓ Has: "Grant Permission" button
// ✗ Bad: "Permission denied"
```

### 4. `storage-quota-exceeded-ux.test.ts`
**Tests extension storage limits:**
- Storage quota exceeded
- Clear error with storage usage info
- Options to free up space
- Prevents data loss
- Shows space needed vs available

**Key Assertions:**
- Shows storage usage (e.g., "4.8 MB / 5 MB used")
- Offers to delete old closed spaces
- Has "Manage Storage" link
- Doesn't lose unsaved changes
- Warns before quota is reached

**Example:**
```typescript
// Storage full
// ✓ Shows: "Storage is full (5 MB / 5 MB). Delete old closed spaces to free up room."
// ✓ Has: "Delete Old Spaces" button
// ✗ Bad: "QUOTA_BYTES_PER_ITEM quota exceeded"
```

### 5. `concurrent-modification-ux.test.ts`
**Tests concurrent modification conflicts:**
- Two popups modify same space
- Clear conflict resolution message
- Shows what changed
- Last-write-wins with notification
- Doesn't silently discard changes

**Key Assertions:**
- Notifies user of concurrent modification
- One change wins (documented behavior)
- No silent data loss
- Changes sync across popups
- Handles rapid sequential edits

**Example:**
```typescript
// Two popups rename same space
// ✓ Shows: "This space was updated in another window"
// ✓ Shows final saved name
// ✗ Bad: Silently overwrites without notification
```

### 6. `chrome-api-failure-ux.test.ts`
**Tests Chrome API failures:**
- `chrome.windows.create()` fails
- `chrome.tabs.query()` fails
- `chrome.storage.local.set()` fails
- User-friendly translation of API errors
- Retry options

**Key Assertions:**
- Translates technical errors to user language
- "Couldn't restore space" NOT "windows.create() failed"
- Logs technical details to console
- Provides retry option
- Context-specific error messages

**Example:**
```typescript
// windows.create() fails
// ✓ User sees: "Unable to restore space. Please try again."
// ✓ Console logs: "Error: chrome.windows.create() failed: ..."
// ✗ Bad: "TypeError: chrome.windows.create is not a function"
```

### 7. `data-corruption-recovery-ux.test.ts`
**Tests data corruption scenarios:**
- Corrupt storage data detected
- Automatic repair attempt
- Clear message about what happened
- Backup restoration option
- Graceful fallback to clean state

**Key Assertions:**
- Detects corruption
- Attempts auto-repair
- Explains issue to user
- Offers backup restoration
- Doesn't lose all data

**Example:**
```typescript
// Corrupted data
// ✓ Shows: "Some data was corrupted. We recovered what we could."
// ✓ Has: "Restore from Backup" option
// ✗ Bad: Crashes or shows blank state
```

### 8. `browser-restart-during-operation-ux.test.ts`
**Tests browser restart scenarios:**
- Browser closes during space creation
- Browser closes during rename
- State consistency on restart
- No orphaned/duplicate spaces
- Operation completes or rolls back

**Key Assertions:**
- State is consistent after restart
- No duplicate spaces
- Closed spaces are preserved
- Incomplete operations roll back
- No orphaned data

## Error Simulation Helpers

### `error-simulation-helpers.ts`

Provides utilities to simulate failure scenarios:

#### Network Failures
```typescript
const cleanup = await simulateNetworkFailure(page, {
  type: 'offline', // 'offline' | 'timeout' | 'connection-refused' | 'dns-error'
  urlPattern: '**/*',
  delay: 0
});

// Run tests...

await cleanup(); // Restore network
```

#### Storage Quota
```typescript
const cleanup = await simulateStorageQuotaExceeded(page, {
  currentUsage: 5 * 1024 * 1024, // 5MB
  maxQuota: 5 * 1024 * 1024,
  throwImmediately: true
});
```

#### Permission Denied
```typescript
const cleanup = await simulatePermissionDenied(page, 'tabs');
```

#### Chrome API Failure
```typescript
const cleanup = await simulateAPIFailure(page, {
  api: 'windows.create',
  errorMessage: 'API temporarily unavailable',
  failAlways: false
});
```

#### Data Corruption
```typescript
await simulateDataCorruption(page, 'partial'); // 'partial' | 'invalid-json' | 'missing-fields' | 'wrong-types'
```

#### Error Verification
```typescript
const errorInfo = await verifyErrorMessage(page);
// Returns:
// {
//   isVisible: boolean,
//   message: string,
//   isUserFriendly: boolean,  // No technical jargon
//   hasActionableGuidance: boolean,  // "Try..." "Click..."
//   hasRetryOption: boolean
// }

const visual = await verifyVisualErrorIndicators(page);
// Returns:
// {
//   hasErrorColor: boolean,  // Red color scheme
//   hasErrorIcon: boolean,
//   isNearSource: boolean,  // Close to input that caused error
//   isAccessible: boolean  // role="alert"
// }
```

## Error UX Best Practices

### DO ✓

1. **Use Plain Language**
   - ✓ "Unable to save changes. Please try again."
   - ✗ "Error: ECONNREFUSED at line 42"

2. **Provide Context**
   - ✓ "Can't restore space because network is offline"
   - ✗ "Network error"

3. **Offer Recovery Path**
   - ✓ Show "Retry" button
   - ✓ Link to "Settings" or "Help"
   - ✗ Just show error with no action

4. **Preserve User Data**
   - ✓ Keep input value when validation fails
   - ✓ Offer to save/export before reset
   - ✗ Clear form on error

5. **Position Near Source**
   - ✓ Show validation error below input field
   - ✗ Show generic error at top of page

6. **Be Accessible**
   - ✓ Use `role="alert"` for errors
   - ✓ Screen reader announces error
   - ✗ Visual-only error indication

7. **Log Technical Details**
   - ✓ User sees: "Unable to save"
   - ✓ Console shows: "Error: chrome.storage.set() QUOTA_EXCEEDED"
   - ✗ Show stack trace to user

### DON'T ✗

1. **Don't Use Technical Jargon**
   - ✗ "TypeError: Cannot read property 'id' of undefined"
   - ✗ "QUOTA_BYTES_PER_ITEM quota exceeded"
   - ✗ "chrome.windows.create() failed"

2. **Don't Hide Errors**
   - ✗ Only log to console
   - ✗ Show briefly then hide
   - ✗ Silent failure

3. **Don't Lose User Data**
   - ✗ Clear input on error
   - ✗ Discard unsaved changes
   - ✗ Reset form without warning

4. **Don't Block Everything**
   - ✗ Modal that can't be dismissed
   - ✗ Block all features due to one error
   - ✗ Require page refresh

5. **Don't Spam Users**
   - ✗ Show same error repeatedly
   - ✗ Multiple error dialogs
   - ✗ Re-prompt immediately after dismissal

## Common Error Scenarios

### Network Errors
**Good:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Unable to Restore Space              │
│                                         │
│ Please check your internet connection  │
│ and try again.                          │
│                                         │
│ [Retry]  [Dismiss]                      │
└─────────────────────────────────────────┘
```

**Bad:**
```
Error: Failed to fetch
```

### Validation Errors
**Good:**
```
Space Name: [________________]
            ⚠️ Space name is required

[Save]  [Cancel]
```

**Bad:**
```
Space Name: [________________]

[Save]  [Cancel]

⚠️ Validation failed (error at top of page, disconnected from input)
```

### Storage Quota
**Good:**
```
┌─────────────────────────────────────────┐
│ ⚠️ Storage Full                         │
│                                         │
│ You're using 5 MB / 5 MB of storage.   │
│ Delete old closed spaces to free up    │
│ room.                                   │
│                                         │
│ [Delete Old Spaces]  [Manage Storage]  │
└─────────────────────────────────────────┘
```

**Bad:**
```
QuotaExceededError: QUOTA_BYTES_PER_ITEM quota exceeded
```

## Running the Tests

```bash
# Run all error UX tests
npm run test:e2e -- e2e-tests/error-ux/

# Run specific test file
npm run test:e2e -- e2e-tests/error-ux/network-failure-ux.test.ts

# Run in headed mode (see browser)
npm run test:e2e -- e2e-tests/error-ux/ --headed

# Debug mode
npm run test:e2e -- e2e-tests/error-ux/ --debug
```

## Current Error Handling Assessment

### Strengths
1. ✓ **ErrorBoundary Component**
   - Catches React errors
   - Attempts auto-recovery
   - Shows retry option
   - Logs to console

2. ✓ **Validation Engine**
   - Validates import/export data
   - Provides error codes
   - Field-level validation

3. ✓ **State Management**
   - Redux error handling
   - Error state in store
   - Can clear errors

### Weaknesses to Address

1. ⚠️ **Generic Error Messages**
   - Need more user-friendly translations
   - Technical jargon exposed in some places
   - Missing context for errors

2. ⚠️ **Limited Recovery Options**
   - Some errors don't have retry buttons
   - Missing "Manage Storage" links
   - No backup/export before reset

3. ⚠️ **Network Error Handling**
   - Doesn't show offline indicator
   - No automatic retry on network recovery
   - Errors not always user-friendly

4. ⚠️ **Validation UX**
   - No real-time validation feedback
   - Validation errors not always positioned near input
   - Missing character count for long names

5. ⚠️ **Permission Handling**
   - Doesn't explain why permission is needed
   - No guidance on how to grant permission
   - No graceful degradation

6. ⚠️ **Storage Management**
   - No proactive warnings before quota exceeded
   - Missing storage usage visualization
   - No easy way to delete old spaces

7. ⚠️ **Concurrent Modification**
   - No conflict resolution UI
   - Silent overwrites possible
   - No sync notifications

## Priority Fixes

### High Priority (User-Facing)
1. **Add User-Friendly Error Translation Layer**
   - Map technical errors to plain language
   - Add context to all errors
   - Ensure all errors have recovery path

2. **Improve Validation UX**
   - Real-time validation feedback
   - Position errors near inputs
   - Keep edit mode on validation failure

3. **Add Network Status Indicator**
   - Show offline indicator
   - Auto-retry on reconnection
   - Queue operations for later

### Medium Priority (Quality of Life)
4. **Storage Management**
   - Show storage usage
   - Warn at 80% capacity
   - Easy deletion of old spaces

5. **Permission Guidance**
   - Explain why each permission is needed
   - Link to settings
   - Graceful degradation

6. **Concurrent Modification Handling**
   - Sync changes across popups
   - Notify of conflicts
   - Document last-write-wins behavior

### Low Priority (Edge Cases)
7. **Data Corruption Recovery**
   - Auto-repair attempts
   - Backup restoration
   - Export before reset

8. **API Failure Handling**
   - Specific messages for each API
   - Automatic retry for transient failures
   - Fallback strategies

## Testing Checklist

When adding new features, verify error UX:

- [ ] All errors have user-friendly messages
- [ ] Errors positioned near their source
- [ ] All errors have `role="alert"`
- [ ] Recovery path available (retry, settings link, etc.)
- [ ] User data is preserved on error
- [ ] Technical details logged to console
- [ ] Errors don't block all functionality
- [ ] Network failures handled gracefully
- [ ] Permission errors explained clearly
- [ ] Storage limits handled proactively

## Future Improvements

1. **Error Telemetry**
   - Track which errors users encounter most
   - Measure recovery success rate
   - Identify confusing error messages

2. **Contextual Help**
   - Help links in error messages
   - In-app documentation
   - Tutorial for first-time errors

3. **Proactive Error Prevention**
   - Validate before submission
   - Warn before limits
   - Suggest alternatives

4. **Better Error Recovery**
   - Automatic retry with exponential backoff
   - Queue failed operations
   - Sync when network returns

## Resources

- [Material Design Error Messages](https://material.io/design/communication/errors.html)
- [Nielsen Norman Group - Error Messages](https://www.nngroup.com/articles/error-message-guidelines/)
- [Web Content Accessibility Guidelines (WCAG) - Error Handling](https://www.w3.org/WAI/WCAG21/Understanding/error-identification.html)

---

**Remember:** Every error is an opportunity to help the user. Make errors friendly, actionable, and recoverable.