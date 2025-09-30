# User-Perceived Performance Testing - Quick Start Guide

## TL;DR

This test suite measures **how fast your app FEELS**, not how fast it runs.

## What Makes an App Feel Fast?

### ✅ FEELS FAST (Even if slower)
- **100ms with immediate feedback** → User: "Wow, instant!"
- Show loading indicators for slow operations
- Optimistic UI updates (update immediately, save in background)
- Progressive rendering (show content as it loads)
- Smooth animations (60fps)

### ❌ FEELS SLOW (Even if faster)
- **50ms with no feedback** → User: "Is this working?"
- Loading indicators flash on/off
- UI waits for server responses
- Blank screens during load
- Janky animations (<30fps)

## The 3 Rules of Perceived Performance

### Rule 1: Immediate Feedback (< 100ms)
```typescript
// ❌ BAD: User waits
async function handleClick() {
  await saveToStorage(); // User sees nothing
  updateUI(); // Finally updates
}

// ✅ GOOD: Instant feedback
async function handleClick() {
  updateUI(); // Immediate!
  await saveToStorage(); // Background
}
```

### Rule 2: Never Block the UI
```typescript
// ❌ BAD: UI freezes
function filterSpaces(query: string) {
  const results = spaces.filter(/* expensive operation */);
  setResults(results); // Blocks UI
}

// ✅ GOOD: UI stays responsive
const debouncedFilter = useMemo(
  () => debounce(filterSpaces, 100),
  []
);

function handleSearch(query: string) {
  setQuery(query); // Immediate
  debouncedFilter(query); // Delayed
}
```

### Rule 3: Show, Don't Wait
```typescript
// ❌ BAD: Blank screen
<div>
  {loading ? <Spinner /> : <SpacesList spaces={spaces} />}
</div>

// ✅ GOOD: Always show something
<div>
  {spaces.length > 0 ? (
    <SpacesList spaces={spaces} />
  ) : (
    <SkeletonList /> // Skeleton, not blank
  )}
</div>
```

## Performance Targets (User-Perceived)

### Instant (< 100ms)
- Button click feedback
- Keystroke response
- Focus indicators
- Hover effects

### Fast (< 500ms)
- Time to Interactive (popup opens)
- Search results filter
- List renders

### Acceptable (< 1s)
- Window switching
- Large dataset loading

### Slow (but OK with feedback) (< 2s)
- Tab restoration
- Heavy operations (WITH loading indicator)

## Common Performance Issues & Quick Fixes

### Issue 1: "App feels slow to load"
**Symptom**: Popup takes > 500ms to become interactive
**Quick Fix**:
```typescript
// Show something immediately
useEffect(() => {
  // Don't wait for storage
  setSpaces(cachedSpaces); // Show cached immediately

  // Then load fresh data
  loadSpaces().then(setSpaces);
}, []);
```

### Issue 2: "Search input lags"
**Symptom**: Typing feels delayed
**Quick Fix**:
```typescript
// Debounce expensive operations
const debouncedFilter = useMemo(
  () => debounce(filterSpaces, 100),
  []
);

// But update input immediately
<input
  value={query}
  onChange={(e) => {
    setQuery(e.target.value); // No delay
    debouncedFilter(e.target.value); // Delayed
  }}
/>
```

### Issue 3: "Scrolling is janky"
**Symptom**: FPS drops during scroll
**Quick Fix**:
```typescript
// Use virtual scrolling for large lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={spaces.length}
  itemSize={60}
>
  {({ index, style }) => (
    <div style={style}>
      <SpaceItem space={spaces[index]} />
    </div>
  )}
</FixedSizeList>
```

### Issue 4: "Loading indicators flash"
**Symptom**: Spinner appears then immediately disappears
**Quick Fix**:
```typescript
// Delay loading indicator
async function handleOperation() {
  const timer = setTimeout(() => setLoading(true), 200);

  try {
    await operation();
  } finally {
    clearTimeout(timer);
    setLoading(false);
  }
}
```

### Issue 5: "App freezes during operations"
**Symptom**: Can't interact while something is processing
**Quick Fix**:
```typescript
// Use optimistic updates
function handleSave(space: Space) {
  // Update UI immediately
  updateSpaceInUI(space);

  // Save in background
  saveSpace(space).catch((error) => {
    // Rollback on error
    revertSpaceInUI(space);
    showError(error);
  });
}
```

## Testing Your Changes

### Before Your Change
```bash
# Run performance tests
npm run test:e2e e2e-tests/user-perceived-performance
```

### After Your Change
```bash
# Run tests again
npm run test:e2e e2e-tests/user-perceived-performance

# Compare metrics
# Look for regressions (slower times)
```

## Key Metrics to Watch

### ⚠️ Red Flags
- TTI > 1s (popup feels slow)
- Input latency > 200ms (typing feels laggy)
- FPS < 50 (animations janky)
- Dropped frames > 20% (very janky)

### ✅ Good Performance
- TTI < 500ms (instant)
- Input latency < 100ms (imperceptible)
- FPS > 55 (smooth)
- Dropped frames < 10% (acceptable)

## Debugging Performance Issues

### 1. Find the Bottleneck
```typescript
// Add timing logs
console.time('operation');
await expensiveOperation();
console.timeEnd('operation');
```

### 2. Check React Renders
```typescript
// Use React DevTools Profiler
// Look for:
// - Expensive re-renders
// - Too many renders
// - Large component trees
```

### 3. Check Main Thread
```typescript
// Use Chrome DevTools Performance tab
// Look for:
// - Long tasks (> 50ms)
// - Layout thrashing
// - Forced reflows
```

### 4. Check Memory
```typescript
// Use Chrome DevTools Memory tab
// Look for:
// - Memory leaks
// - Large object allocations
// - Detached DOM nodes
```

## Performance Optimization Checklist

### Immediate Wins (< 1 hour)
- [ ] Add optimistic UI updates for save operations
- [ ] Debounce search input (100ms)
- [ ] Add loading delay (200ms) to prevent flashes
- [ ] Show cached data immediately, load fresh data in background

### Medium Effort (< 1 day)
- [ ] Implement virtual scrolling for space list
- [ ] Add skeleton screens for loading states
- [ ] Memoize expensive computations
- [ ] Use React.memo for expensive components

### Long Term (> 1 day)
- [ ] Implement progressive rendering
- [ ] Move heavy computation to Web Workers
- [ ] Add caching layer for frequent operations
- [ ] Optimize bundle size (code splitting)

## Examples from the Test Suite

### Test: Time to Interactive
```typescript
test('TTI: Popup becomes interactive within 500ms', async () => {
  const startTime = Date.now();

  await page.goto(`chrome-extension://${extensionId}/popup.html`);

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.waitFor({ state: 'visible' });
  await searchInput.focus();

  const tti = Date.now() - startTime;

  expect(tti).toBeLessThan(500); // User perceives as instant
});
```

### Test: Input Latency
```typescript
test('Search input responds within 100ms', async () => {
  const searchInput = page.locator('input[type="text"]');

  const startTime = Date.now();
  await searchInput.type('test', { delay: 0 });
  const latency = Date.now() - startTime;

  expect(latency).toBeLessThan(100); // Imperceptible to user
});
```

### Test: Animation Smoothness
```typescript
test('Hover transitions maintain 60fps', async () => {
  const fpsMetrics = await measureFPS(page, 1000);

  expect(fpsMetrics.averageFPS).toBeGreaterThan(55); // Smooth
  expect(fpsMetrics.dropRate).toBeLessThan(10); // < 10% dropped
});
```

## Remember

**Users don't care about your technical metrics.**

They care about:
- "Does it feel fast?"
- "Does it respond when I click?"
- "Does it freeze?"
- "Is it smooth?"

Test for those. Optimize for those. Measure those.

## Resources

- **Full Documentation**: `README.md`
- **Performance Summary**: `PERFORMANCE_SUMMARY.md`
- **Helper Functions**: `performance-helpers.ts`
- **Test Examples**: All `*.test.ts` files in this directory

---

**Quick Mental Model**: If you click a button and nothing happens for 100ms, it feels broken. Even if the operation completes in 50ms, show SOMETHING in the first 100ms.