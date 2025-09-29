# Chrome Spaces Extension - Comprehensive Stability Test Suite

## Overview

This comprehensive E2E stability test suite verifies the critical stability fixes implemented for the Chrome Spaces extension, with a focus on:

1. **Window Restoration with New Chrome API Pattern** - Ensuring restored spaces create NEW windows (not reuse old IDs)
2. **Space Renaming Persistence** - Verifying names persist across browser restarts and crashes
3. **Stability Under Load** - Testing performance with 20+ spaces and concurrent operations
4. **Error Recovery** - Handling edge cases and graceful degradation

## Test Files

### 🏗️ Core Stability Tests

#### `comprehensive-stability.test.ts`
**Primary focus areas for stability fixes:**
- **Window Restoration**: Tests new Chrome API pattern where restored spaces create NEW windows
- **Space Renaming**: Persistence across browser restarts and concurrent operations
- **Load Testing**: Performance with 20+ spaces, rapid create/delete cycles
- **Edge Cases**: Empty URLs, special characters, network issues

#### `space-name-persistence.test.ts` (Enhanced)
**Enhanced scenarios for name persistence:**
- Memory pressure scenarios
- Rapid rename operations
- Multiple restore cycles
- Extension update simulation
- Complex character handling
- Concurrent storage operations

#### `spaceRestoration.test.ts` (Updated for New API)
**New Chrome API pattern tests:**
- Verification that restored spaces create NEW windows (not reuse old window IDs)
- Tab order consistency with new window creation
- Window focus handling with multiple restorations
- Prevention of window ID conflicts during concurrent operations
- Error handling with new API patterns

#### `session-restore.test.ts` (Enhanced)
**Browser crash simulation and recovery:**
- Multiple crash scenario types (sudden termination, memory pressure, extension crash, storage corruption)
- Rapid restart cycles
- Extension lifecycle events
- Storage quota and cleanup scenarios

### ⚡ Performance & Benchmarking

#### `performance-benchmarks.test.ts`
**Performance baselines and regression detection:**
- Popup load time benchmarks (empty state, 20+ spaces)
- Scroll performance with large space lists
- Space creation/restoration performance metrics
- Storage operation benchmarks
- Memory usage monitoring
- Concurrent operation efficiency
- Regression baseline establishment

### 🛡️ Error Recovery & Robustness

#### `error-recovery-edge-cases.test.ts`
**Comprehensive error handling:**
- Network connectivity failures
- Invalid URL handling
- Chrome API failures
- Resource exhaustion scenarios
- Concurrent modification conflicts
- Browser permission changes
- Data corruption recovery
- Extension lifecycle edge cases

## Performance Baselines

The test suite establishes the following performance baselines:

```javascript
const PERFORMANCE_BASELINES = {
  POPUP_LOAD_TIME: 5000,        // 5 seconds max
  SPACE_CREATION_TIME: 2000,    // 2 seconds per space max
  RESTORATION_TIME_PER_TAB: 500, // 500ms per tab max
  LARGE_LIST_SCROLL_TIME: 1000,  // 1 second for scroll operations
  STORAGE_OPERATION_TIME: 1000,  // 1 second for storage ops
  MEMORY_USAGE_LIMIT: 100 * 1024 * 1024, // 100MB rough limit
};
```

## Test Execution

### Quick Start

```bash
# Run all stability tests
node e2e-tests/run-stability-tests.js

# Run individual test suites
npm run test:e2e comprehensive-stability.test.ts
npm run test:e2e performance-benchmarks.test.ts
npm run test:e2e error-recovery-edge-cases.test.ts
```

### Comprehensive Test Runner

The `run-stability-tests.js` script executes all test suites in priority order:

1. **Comprehensive Stability Tests** (Priority 1 - Critical)
2. **Space Name Persistence** (Priority 2 - Critical)
3. **Space Restoration** (Priority 3 - Critical)
4. **Session Restore & Crash Recovery** (Priority 4)
5. **Performance Benchmarks** (Priority 5)
6. **Error Recovery & Edge Cases** (Priority 6)

### Test Configuration

```javascript
const CONFIG = {
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 2 : 1,
  timeout: 60000,
  reporter: 'list',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure'
};
```

## Critical Test Scenarios

### 🎯 Window Restoration (New Chrome API)

**Key Tests:**
- `should create NEW window on restoration (not reuse old window ID)`
- `should maintain tab order consistency with new window creation`
- `should prevent window ID conflicts during concurrent restorations`

**Success Criteria:**
- Restored windows have different IDs from original windows
- All tabs restore in correct order
- No duplicate or orphaned windows
- Concurrent restorations work without conflicts

### 🎯 Space Naming Persistence

**Key Tests:**
- `should persist space names across browser restarts`
- `should handle concurrent space renaming operations`
- `should persist names when spaces are restored multiple times`

**Success Criteria:**
- Custom names survive browser restart
- Concurrent renames don't corrupt data
- Names persist through multiple restore cycles

### 🎯 Load & Performance Testing

**Key Tests:**
- `should handle 20+ spaces without performance degradation`
- `should maintain popup load performance with 20+ spaces`
- `should handle rapid space creation/deletion cycles`

**Success Criteria:**
- Popup loads within 5 seconds with 20+ spaces
- Space operations complete within baseline timeouts
- Memory usage stays within 100MB limit

## Test Reports

The test runner generates comprehensive reports:

### JSON Report (`stability-test-report.json`)
```json
{
  "timestamp": "2024-09-29T...",
  "summary": {
    "totalSuites": 6,
    "successful": 6,
    "failed": 0,
    "successRate": 100,
    "totalDuration": 1234567
  },
  "results": [...],
  "environment": {...}
}
```

### Console Report
```
📊 CHROME SPACES EXTENSION STABILITY TEST REPORT
================================================================
📈 Summary:
  • Total Test Suites: 6
  • Successful: 6
  • Failed: 0
  • Success Rate: 100.0%
  • Total Duration: 12m 34s

🎯 Stability Assessment:
  🌟 EXCELLENT: All stability tests passed!
  🚀 The extension demonstrates robust stability across all scenarios.
```

## Debugging Failed Tests

### Common Issues & Solutions

#### Window Restoration Failures
- Check Chrome API usage in background script
- Verify new window creation (not window reuse)
- Check for race conditions in restoration logic

#### Name Persistence Failures
- Verify chrome.storage.local persistence
- Check for storage quota issues
- Verify state serialization/deserialization

#### Performance Issues
- Check for memory leaks
- Verify efficient DOM updates
- Check storage operation optimization

### Debug Modes

```bash
# Run with UI (non-headless)
npm run test:e2e:ui comprehensive-stability.test.ts

# Run with video recording
npm run test:e2e comprehensive-stability.test.ts --video=on

# Run with detailed output
npm run test:e2e comprehensive-stability.test.ts --reporter=html
```

## CI/CD Integration

### GitHub Actions Configuration

```yaml
- name: Run Stability Tests
  run: |
    npm run build
    node e2e-tests/run-stability-tests.js
  env:
    CI: true

- name: Upload Test Results
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: stability-test-results
    path: e2e-tests/stability-test-results/
```

### Success Criteria for CI

- **All Critical Tests Pass** (Priority 1-3): Required for merge
- **Performance Baselines Met**: Required for release
- **80%+ Overall Success Rate**: Minimum for deployment

## Test Data & Cleanup

### Test Data Management
- Each test uses isolated browser contexts
- Temporary test data is automatically cleaned up
- No persistent state between test runs

### Storage Management
- Tests use chrome.storage.local for realistic scenarios
- Storage is cleared between major test sections
- Corruption scenarios test recovery mechanisms

## Future Enhancements

### Planned Additions
- [ ] Mobile browser testing (when supported)
- [ ] Cross-browser compatibility tests
- [ ] Accessibility testing integration
- [ ] Performance regression tracking over time
- [ ] Automated stress testing with varying loads

### Test Coverage Goals
- [x] Core functionality stability
- [x] Performance under load
- [x] Error recovery scenarios
- [x] Browser restart persistence
- [ ] Long-running stability (24h+ tests)
- [ ] User journey end-to-end tests

## Contributing

### Adding New Tests

1. Follow existing test patterns
2. Use the helper utilities in `helpers.ts`
3. Include performance benchmarks where relevant
4. Add comprehensive error handling
5. Update this README with new test descriptions

### Test Naming Convention

```javascript
test('should [expected behavior] [under specific conditions]', async () => {
  // Arrange
  // Act
  // Assert
});
```

### Best Practices

- Use descriptive test names
- Include performance timing where relevant
- Handle both success and failure scenarios
- Clean up resources in test teardown
- Use appropriate timeouts for stability testing

---

This stability test suite ensures the Chrome Spaces extension meets production-quality standards for reliability, performance, and user experience.