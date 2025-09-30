# User-Perceived Performance Testing Suite

## Philosophy: Test What Users Actually Experience

This testing suite measures **user-perceived performance**, not just technical benchmarks. Users don't care about millisecond metrics - they care whether the app **FEELS fast**.

### Key Principles

1. **Perceived Speed > Actual Speed**
   - 100ms with immediate feedback feels faster than 50ms with no feedback
   - Loading indicators matter as much as load time
   - Optimistic UI updates create illusion of instant response

2. **No Benchmarks, Only User Experience**
   - Don't measure backend timing
   - Measure time-to-interactive, not time-to-loaded
   - Measure input latency, not computation time

3. **Test Real User Scenarios**
   - Realistic data sizes (10-50 spaces, not 2)
   - Test under load (multiple operations, rapid clicks)
   - Test error states and edge cases

## Test Files

### 1. `first-interaction-time.test.ts`
**What It Tests**: Time from popup open to first user action
**User Impact**: How quickly can I start using the extension?
**Target**: < 500ms (feels instant)

**Key Metrics**:
- Time to Interactive (TTI)
- Search input ready time
- Progressive rendering
- No blank screens

### 2. `visual-feedback-latency.test.ts`
**What It Tests**: Time from action to visual response
**User Impact**: Does the app respond when I click/type?
**Target**: < 100ms (imperceptible)

**Key Metrics**:
- Input latency
- Button click feedback
- Hover transitions
- Focus indicators
- Search filter response

### 3. `animation-smoothness.test.ts`
**What It Tests**: Frame rate during animations
**User Impact**: Is the app smooth or janky?
**Target**: 55+ FPS (smooth)

**Key Metrics**:
- Hover animation FPS
- Scroll smoothness
- Dialog transitions
- No layout shifts
- Keyboard navigation smoothness

### 4. `loading-states-ux.test.ts`
**What It Tests**: Quality of loading experience
**User Impact**: Are loading states helpful or annoying?
**Target**: Smooth, no flashes

**Key Metrics**:
- No loading flash for fast operations (<200ms)
- Skeleton screens for slow loads
- Progressive rendering
- No blank screens
- Optimistic updates

### 5. `perceived-responsiveness.test.ts`
**What It Tests**: App responds during heavy operations
**User Impact**: Does the app freeze or stay responsive?
**Target**: Never blocks

**Key Metrics**:
- UI responsive during operations
- Optimistic UI updates
- Can cancel operations
- No UI freeze
- Smooth scrolling during updates

### 6. `large-dataset-performance.test.ts`
**What It Tests**: Performance with 50-100 spaces
**User Impact**: Is the app still fast with lots of data?
**Target**: Same speed as 10 spaces

**Key Metrics**:
- Load time with 50 spaces
- Search latency with 100 spaces
- Scroll smoothness
- Virtual scrolling effectiveness
- Memory usage

### 7. `switch-operation-speed.test.ts`
**What It Tests**: Window switch perceived delay
**User Impact**: How fast does switching feel?
**Target**: < 100ms perceived (< 1s actual)

**Key Metrics**:
- Immediate button feedback
- Loading indicators during switch
- Perceived vs actual delay
- Restore operation speed
- UI remains responsive

## Performance Targets

### Time to Interactive
- **Popup TTI**: < 500ms
- **Search Ready**: < 300ms

### Input Latency
- **Keystroke Feedback**: < 100ms
- **Click Feedback**: < 100ms

### Visual Feedback
- **Hover Transition**: < 150ms
- **Focus Indicator**: < 50ms

### Operation Speed
- **Search Filter**: < 100ms
- **Space Switch**: < 1000ms
- **Space Restore**: < 2000ms

### Smoothness
- **Minimum FPS**: 55fps
- **Max Dropped Frames**: < 10%

### Loading States
- **Loading Delay**: 200ms (don't show immediately)
- **Skeleton Timeout**: < 3s

### Large Datasets
- **Large List Render**: < 1s (100 items)
- **Large List Scroll**: < 100ms
- **Large List Search**: < 150ms

## Running the Tests

```bash
# Run all performance tests
npm run test:e2e e2e-tests/user-perceived-performance

# Run specific test file
npm run test:e2e e2e-tests/user-perceived-performance/first-interaction-time.test.ts

# Run with UI (watch mode)
npm run test:e2e:ui e2e-tests/user-perceived-performance
```

## Understanding Results

### ✅ Good Performance
- All metrics meet targets
- Users perceive app as "instant"
- No complaints about speed

### ⚠️ Warning Signs
- Metrics exceed targets by 50%+
- Users notice delays
- Loading indicators appear frequently

### ❌ Poor Performance
- Metrics exceed targets by 2x+
- App feels sluggish
- Users complain about freezing

## Performance Report

Each test suite generates a performance report:

```
=== User-Perceived Performance Report ===

Overall: 8/10 tests passed (80%)

✅ Popup Time to Interactive
   Value: 450ms (target: 500ms)
   Performance: 90% of target

❌ Search Input Latency
   Value: 150ms (target: 100ms)
   Performance: 150% of target
   ⚠️  Exceeded target by 50ms

✅ Hover Animation Smoothness
   Value: 58fps (target: 55fps)
   Performance: 105% of target
```

## Debugging Performance Issues

### Slow Time to Interactive
**Symptoms**: Popup takes > 500ms to become interactive
**Causes**:
- Heavy initialization in React components
- Blocking chrome.storage calls
- Large initial render
- Synchronous operations

**Fixes**:
- Lazy load components
- Use async storage calls
- Progressive rendering
- Code splitting

### Poor Input Latency
**Symptoms**: Typing/clicking takes > 100ms to respond
**Causes**:
- Heavy computation on main thread
- Expensive re-renders
- Unoptimized search filter
- Too many DOM nodes

**Fixes**:
- Debounce search input
- Use React.memo/useMemo
- Virtual scrolling
- Web Workers for heavy computation

### Janky Animations
**Symptoms**: FPS < 55, dropped frames > 10%
**Causes**:
- Layout thrashing
- Expensive CSS transitions
- JavaScript running during animation
- Too many animated elements

**Fixes**:
- Use CSS transforms (GPU accelerated)
- Avoid layout-triggering properties
- requestAnimationFrame for JS animations
- Reduce animated elements

### Loading Flashes
**Symptoms**: Loading indicators appear/disappear quickly
**Causes**:
- No loading delay (show immediately)
- Fast operations don't need loading states
- No minimum display time

**Fixes**:
- 200ms delay before showing loading
- 300ms minimum display time
- Only show for slow operations (> 500ms)

### UI Freezing
**Symptoms**: Can't interact during operations
**Causes**:
- Synchronous operations blocking main thread
- No optimistic updates
- Heavy computation
- Blocking API calls

**Fixes**:
- Use async/await
- Optimistic UI updates
- Show immediate feedback
- Web Workers for computation

## Performance Best Practices

### 1. Optimistic UI Updates
```typescript
// ❌ Bad: Wait for operation to complete
async function saveSpace(space: Space) {
  await chrome.storage.local.set({ space });
  updateUI(space); // User waits
}

// ✅ Good: Update UI immediately
async function saveSpace(space: Space) {
  updateUI(space); // Immediate feedback
  await chrome.storage.local.set({ space });
}
```

### 2. Progressive Rendering
```typescript
// ❌ Bad: Render all at once
{spaces.map(space => <SpaceItem key={space.id} space={space} />)}

// ✅ Good: Render progressively or use virtual scrolling
<VirtualList items={spaces} renderItem={space => <SpaceItem space={space} />} />
```

### 3. Loading States
```typescript
// ❌ Bad: Show loading immediately
setLoading(true);
await operation();
setLoading(false);

// ✅ Good: Delay loading indicator
const timer = setTimeout(() => setLoading(true), 200);
await operation();
clearTimeout(timer);
setLoading(false);
```

### 4. Input Responsiveness
```typescript
// ❌ Bad: Filter on every keystroke
onChange={(e) => {
  filterSpaces(e.target.value); // Expensive
}}

// ✅ Good: Debounce expensive operations
const debouncedFilter = useMemo(
  () => debounce(filterSpaces, 100),
  []
);

onChange={(e) => {
  setValue(e.target.value); // Immediate feedback
  debouncedFilter(e.target.value); // Delayed operation
}}
```

## Monitoring Performance

### Key User Complaints to Watch For
- "The app is slow"
- "It freezes when I click"
- "Loading takes forever"
- "It feels laggy"
- "The app stutters"

### Metrics to Track
1. **Time to Interactive** (TTI)
2. **First Input Delay** (FID)
3. **Cumulative Layout Shift** (CLS)
4. **Frame Rate** during interactions
5. **Operation completion time**

### Real User Monitoring (RUM)
Consider adding performance tracking:

```typescript
// Track TTI
const tti = performance.now();
// ... app initialization
console.log(`TTI: ${performance.now() - tti}ms`);

// Track input latency
inputElement.addEventListener('input', () => {
  const start = performance.now();
  requestAnimationFrame(() => {
    console.log(`Input latency: ${performance.now() - start}ms`);
  });
});
```

## Performance Testing Methodology

### 1. Test on Target Hardware
- Don't test on developer machines (too fast)
- Test on typical user hardware (mid-range laptops)
- Consider CPU throttling in Chrome DevTools

### 2. Test with Realistic Data
- Typical user: 10-20 spaces
- Power user: 50+ spaces
- Stress test: 100+ spaces

### 3. Test Under Load
- Multiple rapid clicks
- Fast typing
- Scrolling during operations
- Concurrent operations

### 4. Test Edge Cases
- Empty state
- Error states
- Slow network (if applicable)
- Large datasets

### 5. Measure What Users Experience
- Time to first interaction (not time to loaded)
- Input responsiveness (not computation time)
- Visual feedback latency (not operation completion)

## Contributing

When adding new performance tests:

1. **Focus on user experience**, not technical metrics
2. **Use descriptive test names** that explain user impact
3. **Set realistic targets** based on user perception
4. **Add clear console output** for debugging
5. **Update this README** with new test descriptions

## Performance Philosophy: The 3 Rules

### Rule 1: Perceived Performance > Actual Performance
Users judge speed by how responsive the app feels, not by actual timing. Show immediate feedback, use optimistic updates, and hide latency behind loading states.

### Rule 2: Never Block the UI
The #1 user complaint is "the app froze". Keep the UI responsive even during heavy operations. Use async operations, web workers, and progressive rendering.

### Rule 3: Test Real User Scenarios
Don't test with 2 spaces and claim the app is fast. Test with 50 spaces, rapid clicks, and concurrent operations - that's what real users experience.

---

**Remember**: Users don't care about your benchmarks. They care about whether the app FEELS fast. Make it feel fast, and it IS fast.