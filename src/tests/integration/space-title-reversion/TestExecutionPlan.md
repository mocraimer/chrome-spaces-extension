# Space Title Reversion - Comprehensive Test Execution Plan

## Overview
This document outlines the comprehensive test suite designed to identify the root cause of space title reversion after pressing Enter in the Chrome Spaces Extension.

## Test Suite Structure

### 📁 Priority 1 Tests (Critical Path)

#### 1. Race Condition Tests (`RaceConditionTests.test.ts`)
**Focus**: StateBroadcastService update coalescing and race conditions

**Test Cases**:
- `RC-001`: Rapid Enter key presses causing update conflicts
- `RC-002`: Concurrent save/refresh race conditions  
- `RC-003`: 100ms debounce window losing intermediate changes
- `RC-004`: pendingUpdates map overwriting newer updates with older ones
- `RC-005`: Update coalescing losing intermediate data
- `RC-006`: Critical updates bypassing debounce
- `RC-007`: Lock acquisition timeout handling

**Key Scenarios**:
```typescript
// Test rapid renameSpace calls
const rapidUpdates = ['Name 1', 'Name 2', 'Name 3', 'Final Name'];
const promises = rapidUpdates.map(name => stateManager.setSpaceName(spaceId, name));
await Promise.all(promises);
// Expected: Final state should have 'Final Name'
```

#### 2. Caching Layer Tests (`CachingLayerTests.test.ts`) 
**Focus**: StateManager caching interference

**Test Cases**:
- `CC-001`: 5-minute TTL cache serving stale data during updates
- `CC-002`: Cache TTL expiration timing
- `CC-003`: Cache invalidation timing issues
- `CC-004`: Cache invalidation race conditions
- `CC-005`: Incremental vs full update threshold conflicts
- `CC-006`: Data preservation during threshold transitions
- `CC-007`: Cache key conflicts between operations
- `CC-008`: Global cache operations integrity

**Key Scenarios**:
```typescript
// Test cache invalidation during updates
await stateManager.setSpaceName(spaceId, 'Updated Name');
jest.advanceTimersByTime(2 * 60 * 1000); // 2 minutes < 5min TTL
const cachedSpace = await stateManager.getSpaceById(spaceId);
// Expected: Should NOT serve stale cached data
```

#### 3. State Synchronization Tests (`StateSynchronizationTests.test.ts`)
**Focus**: Redux state divergence from background state

**Test Cases**:
- `SS-001`: Frontend state not reflecting successful backend saves
- `SS-002`: Backend save failure rollback handling
- `SS-003`: Missing optimistic updates with rollback
- `SS-004`: Partial optimistic update handling
- `SS-005`: State broadcast delays causing UI reversion
- `SS-006`: Local state priority over delayed broadcasts
- `SS-007`: useEffect dependency array causing unwanted resets
- `SS-008`: Rapid currentSpace updates during editing
- `SS-009`: currentSpace becoming null during editing
- `SS-010`: Version conflict detection during updates
- `SS-011`: Broadcast version conflict handling

**Key Scenarios**:
```typescript
// Test delayed broadcast not reverting UI
const delayedBroadcast = {
  timestamp: Date.now() - 1000, // Older timestamp
  payload: { spaces: { '1': { name: 'Old Name', version: 1 } } }
};
// Expected: UI should maintain 'New Name', not revert to 'Old Name'
```

### 📁 Priority 2 Tests (Server-side Validation)

#### 4. Server Validation Tests (`ServerValidationTests.test.ts`)
**Focus**: StateManager.setSpaceName rollback mechanisms

**Test Cases**:
- `SV-001`: Version conflict triggers during updates
- `SV-002`: Concurrent version update handling
- `SV-003`: State transition validation failures
- `SV-004`: Space invariant validation
- `SV-005`: Storage operation failure rollbacks
- `SV-006`: Partial storage failure atomic rollback
- `SV-007`: Lock acquisition timeout handling
- `SV-008`: Deadlock prevention during concurrent operations
- `SV-009`: Data integrity validation during complex operations

**Key Scenarios**:
```typescript
// Test version conflict detection
const conflictingSpace = { ...initialSpace, version: 2 };
storageManager.saveSpaces.mockImplementationOnce(() => {
  throw new Error('Version conflict detected');
});
// Expected: Should detect conflict and handle appropriately
```

### 📁 Priority 3 Tests (Event Handler Interference)

#### 5. Event Handler Tests (`EventHandlerTests.test.ts`)
**Focus**: SpaceHeader event conflicts

**Test Cases**:
- `EH-001`: onBlur auto-save overriding user intent
- `EH-002`: Blur handling during rapid edit-cancel cycles
- `EH-003`: Rapid keystroke events without debouncing
- `EH-004`: Keystroke event order preservation
- `EH-005`: Escape key conflicts with auto-save
- `EH-006`: Escape prevention during critical operations
- `EH-007`: Focus management during async operations
- `EH-008`: Focus conflict resolution during rapid operations

**Key Scenarios**:
```typescript
// Test Escape cancellation preventing auto-save
fireEvent.keyDown(input, { key: 'Escape' }); // User cancels
fireEvent.blur(input); // Should NOT auto-save
// Expected: No save operation should occur
```

## Execution Strategy

### Phase 1: Race Condition Detection (Priority 1A)
1. Run `RaceConditionTests.test.ts`
2. Focus on rapid Enter key scenarios
3. Monitor update coalescing behavior
4. Check for lost intermediate updates

### Phase 2: Caching Analysis (Priority 1B)
1. Run `CachingLayerTests.test.ts`
2. Test cache invalidation timing
3. Verify TTL behavior during updates
4. Check incremental vs full update thresholds

### Phase 3: State Synchronization (Priority 1C)
1. Run `StateSynchronizationTests.test.ts`
2. Test Redux-Background state sync
3. Verify optimistic update rollbacks
4. Check broadcast delay handling

### Phase 4: Validation & Events (Priority 2-3)
1. Run `ServerValidationTests.test.ts`
2. Run `EventHandlerTests.test.ts`
3. Verify edge cases and error handling

## Expected Failure Patterns

### High Probability Root Causes

1. **Race Condition in StateBroadcastService**
   - Symptom: Rapid Enter presses lose intermediate updates
   - Location: `StateBroadcastService.broadcast()` update coalescing
   - Test: `RC-001`, `RC-004`

2. **Cache Invalidation Timing**
   - Symptom: Stale cache served during updates
   - Location: `StateManager` 5-minute TTL cache
   - Test: `CC-001`, `CC-003`

3. **Redux State Broadcast Delays**
   - Symptom: UI reverts due to delayed state broadcasts
   - Location: Frontend state update handling
   - Test: `SS-005`, `SS-006`

### Medium Probability Root Causes

4. **Version Conflict Handling**
   - Symptom: Concurrent updates cause reversion
   - Location: `StateManager.setSpaceName()` version checks
   - Test: `SV-001`, `SV-002`

5. **Event Handler Conflicts**
   - Symptom: onBlur auto-save overrides user intent
   - Location: `SpaceHeader` event handlers
   - Test: `EH-001`, `EH-005`

## Test Execution Commands

```bash
# Run all space title reversion tests
npm test -- --testPathPattern="space-title-reversion"

# Run specific priority levels
npm test -- RaceConditionTests.test.ts
npm test -- CachingLayerTests.test.ts  
npm test -- StateSynchronizationTests.test.ts
npm test -- ServerValidationTests.test.ts
npm test -- EventHandlerTests.test.ts

# Run with verbose output for debugging
npm test -- --verbose --testPathPattern="space-title-reversion"

# Run with coverage to identify untested code paths
npm test -- --coverage --testPathPattern="space-title-reversion"
```

## Test Environment Setup

```bash
# Install dependencies
npm install

# Setup test environment
npm run test:setup

# Mock Chrome APIs
export CHROME_TEST_MODE=true

# Enable debug logging
export DEBUG_SPACE_TESTS=true
```

## Success Criteria

### Test Completion
- [ ] All Priority 1 tests execute successfully
- [ ] Race condition tests identify timing issues
- [ ] Cache tests reveal invalidation problems
- [ ] State sync tests show broadcast delays

### Root Cause Identification
- [ ] At least one test consistently reproduces the reversion bug
- [ ] Failure pattern points to specific code location
- [ ] Test logs reveal timing/sequence issues
- [ ] Mock verification shows unexpected call patterns

### Fix Validation
- [ ] Identified root cause has clear fix path
- [ ] Tests can validate fix effectiveness
- [ ] No regression in other functionality
- [ ] Performance impact is acceptable

## Test Data Collection

### Metrics to Track
1. **Update Timing**: Time between Enter press and state persistence
2. **Cache Hit Rates**: Cache hits vs misses during updates
3. **Broadcast Delays**: Time between state change and UI update
4. **Version Conflicts**: Frequency of version mismatch errors
5. **Event Ordering**: Sequence of keyboard/focus events

### Debug Information
1. **State Snapshots**: Before/after each update operation
2. **Call Stacks**: Trace of function calls during reversion
3. **Async Operations**: Timing of Promise resolutions
4. **Lock Contention**: Wait times for state locks
5. **Error Patterns**: Types and frequency of errors

## Troubleshooting

### Common Test Issues
1. **Timing Problems**: Use `jest.useFakeTimers()` for deterministic timing
2. **Async Races**: Wrap assertions in `waitFor()` calls
3. **Mock Pollution**: Ensure `jest.clearAllMocks()` in beforeEach
4. **State Cleanup**: Reset all services between tests

### Debug Techniques
1. **Console Logging**: Add debug logs to service methods
2. **Breakpoints**: Use debugger in critical code paths
3. **State Inspection**: Log full state before/after operations
4. **Event Tracing**: Track all events in chronological order

## Next Steps After Test Execution

1. **Analyze Results**: Review test outputs and failure patterns
2. **Isolate Root Cause**: Focus on consistently failing tests
3. **Develop Fix**: Create targeted solution for identified issue
4. **Validate Fix**: Re-run tests to confirm resolution
5. **Regression Testing**: Ensure no new issues introduced
6. **Performance Testing**: Verify fix doesn't impact performance
7. **Documentation**: Update docs with findings and solution

This comprehensive test suite provides systematic coverage of all identified potential root causes for the space title reversion issue, with clear execution paths and success criteria for identifying and resolving the bug.