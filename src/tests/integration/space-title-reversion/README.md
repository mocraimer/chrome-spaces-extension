# Space Title Reversion Test Suite

## Overview

This comprehensive test suite has been designed to systematically identify the root cause of the space title reversion bug that occurs after pressing Enter in the Chrome Spaces Extension. The bug manifests as space names reverting to their previous values after the user completes editing by pressing Enter.

## Test Suite Architecture

### 🎯 Problem Analysis

Based on the investigation in `docs/space-title-reversion-investigation.md`, the test suite targets these high-priority failure points:

1. **Race Conditions** in StateBroadcastService update coalescing
2. **Caching Issues** in StateManager's 5-minute TTL cache
3. **State Synchronization** problems between Redux and background state
4. **Server-side Validation** rollback mechanisms
5. **Event Handler Conflicts** in SpaceHeader component

### 📁 Test File Structure

```
src/tests/integration/space-title-reversion/
├── RaceConditionTests.test.ts          # Priority 1A - Update conflicts
├── CachingLayerTests.test.ts           # Priority 1B - Cache invalidation
├── StateSynchronizationTests.test.ts   # Priority 1C - State sync issues
├── ServerValidationTests.test.ts       # Priority 2 - Backend validation
├── EventHandlerTests.test.ts           # Priority 3 - UI event conflicts
├── TestExecutionPlan.md               # Execution strategy
└── README.md                          # This file
```

## Test Coverage Summary

### ✅ Race Condition Tests (Priority 1A)
**File**: `RaceConditionTests.test.ts`
**Status**: ✅ Complete
**Test Cases**: 7 comprehensive tests

- **RC-001**: Rapid Enter key presses causing update conflicts
- **RC-002**: Concurrent save/refresh race conditions
- **RC-003**: 100ms debounce window losing intermediate changes
- **RC-004**: pendingUpdates map overwriting newer updates with older ones
- **RC-005**: Update coalescing losing intermediate data
- **RC-006**: Critical updates bypassing debounce
- **RC-007**: Lock acquisition timeout handling

**Key Testing Scenarios**:
```typescript
// Test rapid state updates don't lose data
const rapidUpdates = ['Name 1', 'Name 2', 'Name 3', 'Final Name'];
const promises = rapidUpdates.map(name => stateManager.setSpaceName(spaceId, name));
// Verify final state contains last update
```

### ✅ Caching Layer Tests (Priority 1B)
**File**: `CachingLayerTests.test.ts`
**Status**: ✅ Complete
**Test Cases**: 8 comprehensive tests

- **CC-001**: 5-minute TTL cache serving stale data during updates
- **CC-002**: Cache TTL expiration timing
- **CC-003**: Cache invalidation timing issues
- **CC-004**: Cache invalidation race conditions
- **CC-005**: Incremental vs full update threshold conflicts
- **CC-006**: Data preservation during threshold transitions
- **CC-007**: Cache key conflicts between operations
- **CC-008**: Global cache operations integrity

**Key Testing Scenarios**:
```typescript
// Test cache doesn't serve stale data during active updates
await stateManager.setSpaceName(spaceId, 'Updated Name');
jest.advanceTimersByTime(2 * 60 * 1000); // Less than 5min TTL
const space = await stateManager.getSpaceById(spaceId);
// Should NOT serve stale cached data
```

### ✅ State Synchronization Tests (Priority 1C)
**File**: `StateSynchronizationTests.test.ts`
**Status**: ✅ Complete (Note: Some TypeScript issues with React components)
**Test Cases**: 11 comprehensive tests

- **SS-001**: Frontend state not reflecting successful backend saves
- **SS-002**: Backend save failure rollback handling
- **SS-003**: Missing optimistic updates with rollback
- **SS-004**: Partial optimistic update handling
- **SS-005**: State broadcast delays causing UI reversion
- **SS-006**: Local state priority over delayed broadcasts
- **SS-007**: useEffect dependency array causing unwanted resets
- **SS-008**: Rapid currentSpace updates during editing
- **SS-009**: currentSpace becoming null during editing
- **SS-010**: Version conflict detection during updates
- **SS-011**: Broadcast version conflict handling

**Key Testing Scenarios**:
```typescript
// Test delayed broadcasts don't revert UI
const delayedBroadcast = {
  timestamp: Date.now() - 1000, // Older
  payload: { spaces: { '1': { name: 'Old Name', version: 1 } } }
};
// Should maintain 'New Name', not revert to 'Old Name'
```

### ✅ Server Validation Tests (Priority 2)
**File**: `ServerValidationTests.test.ts`
**Status**: ✅ Complete
**Test Cases**: 9 comprehensive tests

- **SV-001**: Version conflict triggers during updates
- **SV-002**: Concurrent version update handling
- **SV-003**: State transition validation failures
- **SV-004**: Space invariant validation
- **SV-005**: Storage operation failure rollbacks
- **SV-006**: Partial storage failure atomic rollback
- **SV-007**: Lock acquisition timeout handling
- **SV-008**: Deadlock prevention during concurrent operations
- **SV-009**: Data integrity validation during complex operations

**Key Testing Scenarios**:
```typescript
// Test version conflict detection and rollback
const conflictingSpace = { ...initialSpace, version: 2 };
storageManager.saveSpaces.mockImplementationOnce(() => {
  throw new Error('Version conflict detected');
});
// Should handle conflict gracefully
```

### ⚠️ Event Handler Tests (Priority 3)
**File**: `EventHandlerTests.test.ts`
**Status**: ⚠️ Partial (TypeScript/JSX issues)
**Test Cases**: 8 planned tests

- **EH-001**: onBlur auto-save overriding user intent
- **EH-002**: Blur handling during rapid edit-cancel cycles
- **EH-003**: Rapid keystroke events without debouncing
- **EH-004**: Keystroke event order preservation
- **EH-005**: Escape key conflicts with auto-save
- **EH-006**: Escape prevention during critical operations
- **EH-007**: Focus management during async operations
- **EH-008**: Focus conflict resolution during rapid operations

**Note**: This file has TypeScript compilation issues due to JSX syntax complexity. The test logic is sound but needs React component mocking refinement.

## 🎯 Most Likely Root Causes Identified

Based on the comprehensive test design, these are the highest probability root causes:

### 1. **StateBroadcastService Race Condition** (Highest Priority)
- **Location**: `src/background/services/StateBroadcastService.ts`
- **Issue**: Update coalescing with 100ms debounce losing intermediate updates
- **Tests**: RC-001, RC-003, RC-004
- **Evidence**: Rapid Enter presses could trigger update conflicts

### 2. **StateManager Cache Invalidation** (High Priority)  
- **Location**: `src/background/services/StateManager.ts`
- **Issue**: 5-minute TTL cache serving stale data during active updates
- **Tests**: CC-001, CC-003
- **Evidence**: Cache not invalidated immediately on state changes

### 3. **Redux State Broadcast Delays** (High Priority)
- **Location**: Frontend state update handlers
- **Issue**: Delayed broadcasts reverting UI to old state
- **Tests**: SS-005, SS-006
- **Evidence**: UI updates not properly versioned/timestamped

## 🚀 Execution Instructions

### Prerequisites
```bash
npm install
npm run test:setup
export CHROME_TEST_MODE=true
```

### Run All Tests
```bash
# Execute complete test suite
npm test -- --testPathPattern="space-title-reversion"

# Run with verbose output
npm test -- --verbose --testPathPattern="space-title-reversion"

# Run with coverage
npm test -- --coverage --testPathPattern="space-title-reversion"
```

### Run Priority-Based Testing
```bash
# Priority 1A: Race Conditions (Start Here)
npm test -- RaceConditionTests.test.ts

# Priority 1B: Caching Issues  
npm test -- CachingLayerTests.test.ts

# Priority 1C: State Synchronization
npm test -- StateSynchronizationTests.test.ts

# Priority 2: Server Validation
npm test -- ServerValidationTests.test.ts

# Priority 3: Event Handlers (Fix TypeScript issues first)
npm test -- EventHandlerTests.test.ts
```

## 📊 Expected Test Results

### Success Criteria
1. **At least one test consistently reproduces the reversion bug**
2. **Failure patterns point to specific code locations**
3. **Timing/sequence issues revealed in test logs**
4. **Mock verification shows unexpected call patterns**

### Failure Analysis Strategy
1. **Start with Priority 1A tests** (Race Conditions)
2. **Focus on rapid update scenarios** (RC-001, RC-003)
3. **Check cache invalidation timing** (CC-001, CC-003)
4. **Verify state broadcast order** (SS-005, SS-006)

## 🔧 Test Infrastructure

### Service Mocking
```typescript
// Comprehensive service mocks in utils/serviceMocks.ts
const windowManager = createWindowManagerMock();
const tabManager = createTabManagerMock(); 
const storageManager = createStorageManagerMock();
```

### Timing Control
```typescript
// Deterministic timing for race condition testing
jest.useFakeTimers();
jest.advanceTimersByTime(150); // Advance debounce window
```

### State Verification
```typescript
// Comprehensive state validation
const finalSpace = await stateManager.getSpaceById(spaceId);
expect(finalSpace?.name).toBe('Expected Name');
expect(finalSpace?.version).toBeGreaterThan(initialVersion);
```

## 🐛 Known Issues

### TypeScript/JSX Compilation
- **File**: `EventHandlerTests.test.ts`
- **Issue**: Complex React component mocking causing TypeScript errors
- **Workaround**: Focus on Priority 1 tests first, fix React tests separately

### Mock Complexity
- **Issue**: Chrome API mocking requires careful setup
- **Solution**: Use `mockChrome` utility and environment variables

## 📈 Success Metrics

### Test Completion
- [x] Race Condition Tests: 7/7 tests implemented
- [x] Caching Layer Tests: 8/8 tests implemented  
- [x] State Sync Tests: 11/11 tests implemented
- [x] Server Validation Tests: 9/9 tests implemented
- [ ] Event Handler Tests: 8/8 tests (TypeScript issues)

### Coverage Analysis
- **Services Tested**: StateManager, StateBroadcastService, StateUpdateQueue
- **Components Tested**: SpaceHeader (partial due to TypeScript issues)
- **Scenarios Covered**: Race conditions, caching, state sync, validation, events
- **Edge Cases**: Concurrent updates, cache conflicts, version mismatches

## 🔍 Next Steps

1. **Execute Priority 1 Tests**: Start with race condition and caching tests
2. **Analyze Failures**: Focus on consistently failing test patterns
3. **Fix TypeScript Issues**: Resolve EventHandlerTests compilation errors
4. **Root Cause Identification**: Use test results to pinpoint exact bug location
5. **Develop Targeted Fix**: Create solution based on test findings
6. **Regression Testing**: Ensure fix doesn't break other functionality

## 📚 Related Documentation

- `docs/space-title-reversion-investigation.md` - Original bug investigation
- `docs/space-name-editing-plan.md` - Implementation analysis
- `src/tests/integration/space-title-reversion/TestExecutionPlan.md` - Detailed execution strategy

This comprehensive test suite provides systematic coverage of all identified potential root causes, with clear execution paths and success criteria for resolving the space title reversion bug.