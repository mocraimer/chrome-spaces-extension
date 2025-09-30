# Accessibility Testing - Quick Start Guide

## TL;DR

```bash
# Run all accessibility tests
npm run test:e2e -- e2e-tests/accessibility-ux/

# Run specific test
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-only-complete-journey.test.ts

# Debug with browser visible
npm run test:e2e -- e2e-tests/accessibility-ux/ --headed
```

## What These Tests Check

### ✅ Can users with disabilities actually use your extension?

1. **Keyboard-Only Users** - Can they do everything without a mouse?
2. **Screen Reader Users** - Will NVDA/JAWS announce things correctly?
3. **Low Vision Users** - Can they zoom to 200% and still use it?
4. **Motion-Sensitive Users** - Are animations disabled with prefers-reduced-motion?
5. **High Contrast Users** - Is everything visible in Windows High Contrast Mode?

## Common Violations & Quick Fixes

### ❌ "Interactive element has no accessible name" (WCAG 4.1.2)

**Problem:** Button with only an icon, no text or aria-label
```tsx
// ❌ BAD
<button onClick={handleDelete}>
  <TrashIcon />
</button>
```

**Fix:** Add aria-label
```tsx
// ✅ GOOD
<button aria-label="Delete space" onClick={handleDelete}>
  <TrashIcon aria-hidden="true" />
</button>
```

### ❌ "No visible focus indicator" (WCAG 2.4.7)

**Problem:** Can't see which element has keyboard focus
```css
/* ❌ BAD */
.space-item {
  outline: none; /* Never do this! */
}
```

**Fix:** Add visible focus styles
```css
/* ✅ GOOD */
.space-item:focus {
  outline: 2px solid #4A90E2;
  outline-offset: 2px;
}

/* or */
.space-item:focus {
  box-shadow: 0 0 0 2px #4A90E2;
}
```

### ❌ "F2 key does not activate rename mode" (WCAG 2.1.1)

**Problem:** Missing keyboard shortcuts
```tsx
// ❌ BAD - Only double-click to rename
<div onDoubleClick={handleRename}>
  {spaceName}
</div>
```

**Fix:** Add keyboard shortcut
```tsx
// ✅ GOOD
<div
  tabIndex={0}
  onDoubleClick={handleRename}
  onKeyDown={(e) => {
    if (e.key === 'F2') {
      handleRename();
    }
  }}
>
  {spaceName}
</div>
```

### ❌ "Status messages not announced to screen readers" (WCAG 4.1.3)

**Problem:** No aria-live region for status updates
```tsx
// ❌ BAD
{statusMessage && <div>{statusMessage}</div>}
```

**Fix:** Add aria-live region
```tsx
// ✅ GOOD
<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### ❌ "Animation not disabled with prefers-reduced-motion" (WCAG 2.3.3)

**Problem:** Animations cause motion sickness
```css
/* ❌ BAD */
.space-item {
  transition: all 0.3s ease;
}
```

**Fix:** Disable with media query
```css
/* ✅ GOOD */
.space-item {
  transition: all 0.3s ease;
}

@media (prefers-reduced-motion: reduce) {
  .space-item {
    transition: none;
  }
}
```

### ❌ "Horizontal scrolling at 200% zoom" (WCAG 1.4.10)

**Problem:** Content doesn't reflow at high zoom
```css
/* ❌ BAD */
.space-item {
  width: 400px; /* Fixed width */
  white-space: nowrap; /* Prevents wrapping */
}
```

**Fix:** Use flexible widths and allow wrapping
```css
/* ✅ GOOD */
.space-item {
  max-width: 100%; /* Flexible */
  white-space: normal; /* Allow wrapping */
  word-wrap: break-word;
}
```

## Accessibility Checklist for New Features

Before submitting a PR with new UI:

- [ ] All buttons have accessible names (aria-label or text)
- [ ] All interactive elements are keyboard accessible (Tab, Enter, Space)
- [ ] Focus indicators are visible (2px outline or box-shadow)
- [ ] Keyboard shortcuts implemented (F2, Delete, Escape)
- [ ] Status messages use aria-live regions
- [ ] Form inputs have labels (aria-label or <label>)
- [ ] Current state uses aria-current or aria-selected
- [ ] Animations disabled with prefers-reduced-motion
- [ ] Content reflows at 200% zoom (no horizontal scroll)
- [ ] High contrast mode supported (forced-colors media query)

## Test Output Examples

### ✅ Passing Test
```
✅ All keyboard accessibility tests passed! No violations found.
```

### ❌ Failing Test
```
================================================================================
KEYBOARD ACCESSIBILITY VIOLATIONS SUMMARY
================================================================================
❌ 3 Accessibility Violations Found

Critical: 1 | Serious: 1 | Moderate: 1 | Minor: 0

🔴 CRITICAL VIOLATIONS:
  • Element: Button: "Delete"
    WCAG: 4.1.2
    Issue: Interactive element has no accessible name
    Fix: Add aria-label or text content

🟠 SERIOUS VIOLATIONS:
  • Element: Space item
    WCAG: 2.4.7
    Issue: No visible focus indicator on space item
    Fix: Add :focus styles with visible outline or box-shadow

🟡 MODERATE VIOLATIONS:
  • Element: Space item
    WCAG: 2.1.1
    Issue: F2 key does not activate rename mode
    Fix: Implement F2 keyboard shortcut to enter edit mode
================================================================================
```

## Running Individual Test Categories

```bash
# Keyboard navigation only
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-only-complete-journey.test.ts

# Screen reader support
npm run test:e2e -- e2e-tests/accessibility-ux/screen-reader-journey.test.ts

# Focus management
npm run test:e2e -- e2e-tests/accessibility-ux/focus-management-journey.test.ts

# Keyboard shortcuts
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-shortcuts-accessibility.test.ts

# High contrast mode
npm run test:e2e -- e2e-tests/accessibility-ux/high-contrast-mode-journey.test.ts

# Reduced motion
npm run test:e2e -- e2e-tests/accessibility-ux/reduced-motion-journey.test.ts

# Zoom and magnification
npm run test:e2e -- e2e-tests/accessibility-ux/zoom-magnification-journey.test.ts
```

## Debugging Failed Tests

### 1. Run with headed browser
```bash
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-only-complete-journey.test.ts --headed
```

### 2. Run specific test case
```bash
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-only-complete-journey.test.ts -g "F2 key"
```

### 3. Add debug output
```bash
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-only-complete-journey.test.ts --debug
```

### 4. Check Playwright trace
```bash
npx playwright show-trace test-results/*/trace.zip
```

## Manual Testing

While automated tests catch most issues, also test manually:

### Keyboard Only
1. Unplug your mouse
2. Navigate extension using only Tab, Enter, Escape, Arrow keys
3. Can you complete all tasks?

### Screen Reader
1. Download NVDA (free): https://www.nvaccess.org/
2. Turn on NVDA
3. Close your eyes
4. Try to use the extension
5. Does it announce everything clearly?

### High Contrast
1. Windows: Settings > Ease of Access > High Contrast
2. Turn on High Contrast Black or White theme
3. Can you see all UI elements?

### Zoom
1. Browser: Ctrl + (zoom in) or Ctrl - (zoom out)
2. Zoom to 200%
3. Does content reflow? Any horizontal scrolling?

## Resources

- **WCAG 2.1 Quick Reference**: https://www.w3.org/WAI/WCAG21/quickref/
- **ARIA Practices Guide**: https://www.w3.org/WAI/ARIA/apg/
- **WebAIM Keyboard Accessibility**: https://webaim.org/articles/keyboard/
- **Chrome DevTools Accessibility**: Chrome DevTools > Lighthouse > Accessibility

## Getting Help

1. Check the README.md for detailed documentation
2. Review the helper functions in accessibility-helpers.ts
3. Look at passing tests for examples
4. Open an issue with the `accessibility` label

## Common Questions

### Q: Why do these tests take so long?
**A:** They test complete user journeys, not just attributes. Each test simulates a real user with assistive technology.

### Q: Can I skip these tests?
**A:** No. Accessibility is not optional. These tests ensure users with disabilities can use the extension.

### Q: What if a test fails?
**A:** Read the violation report. It tells you exactly what's wrong and how to fix it. Fix Critical violations first.

### Q: Do I need to be an accessibility expert?
**A:** No. The tests provide specific fixes for each violation. Just follow the recommendations.

### Q: What's the minimum I need to pass?
**A:** Zero Critical violations. Fix Serious violations if possible. Moderate and Minor are improvements.

## Success Criteria

Your feature is accessible when:
- ✅ All tests pass (or only Minor violations remain)
- ✅ You can complete all tasks with keyboard only
- ✅ All interactive elements have visible focus
- ✅ All buttons have accessible names
- ✅ Status messages are announced

---

**Remember:** Accessibility is not a feature. It's a fundamental requirement.

For detailed information, see README.md or ACCESSIBILITY_TEST_SUMMARY.md