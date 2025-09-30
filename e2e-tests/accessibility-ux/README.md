# Accessibility UX Flow Tests

Comprehensive accessibility testing suite that validates complete user journeys for users who rely on keyboard-only navigation, screen readers, and other assistive technologies.

## Overview

This test suite ensures the Chrome Spaces extension is fully accessible to users with disabilities by testing real-world workflows from an accessibility perspective. These tests go beyond basic accessibility checkers to validate that users can actually **complete their tasks** using assistive technologies.

## WCAG 2.1 AA Coverage

These tests validate compliance with the following WCAG 2.1 Success Criteria:

### Perceivable
- **1.1.1**: Non-text Content (Level A) - Alt text for images/icons
- **1.3.1**: Info and Relationships (Level A) - Semantic structure
- **1.4.1**: Use of Color (Level A) - Not relying solely on color
- **1.4.3**: Contrast (Minimum) (Level AA) - 4.5:1 text contrast
- **1.4.4**: Resize Text (Level AA) - Text resizable to 200%
- **1.4.10**: Reflow (Level AA) - Content reflows at 400% zoom
- **1.4.11**: Non-text Contrast (Level AA) - 3:1 UI component contrast
- **1.4.12**: Text Spacing (Level AA) - Supports increased spacing

### Operable
- **2.1.1**: Keyboard (Level A) - All functionality via keyboard
- **2.1.2**: No Keyboard Trap (Level A) - Focus can move away
- **2.1.4**: Character Key Shortcuts (Level A) - Can remap/disable
- **2.2.2**: Pause, Stop, Hide (Level A) - Control over motion
- **2.3.3**: Animation from Interactions (Level AAA) - Can disable motion
- **2.4.1**: Bypass Blocks (Level A) - Skip navigation
- **2.4.3**: Focus Order (Level A) - Logical focus sequence
- **2.4.7**: Focus Visible (Level AA) - Visible focus indicator

### Understandable
- **3.2.1**: On Focus (Level A) - No unexpected context changes
- **3.2.4**: Consistent Identification (Level AA) - Consistent behavior
- **3.3.2**: Labels or Instructions (Level A) - Form inputs labeled

### Robust
- **4.1.2**: Name, Role, Value (Level A) - Accessible names/roles
- **4.1.3**: Status Messages (Level AA) - Dynamic content announced

## Test Files

### 1. `keyboard-only-complete-journey.test.ts`
Complete user journey using ONLY keyboard navigation (no mouse).

**Tests:**
- Open popup with keyboard shortcut
- Navigate spaces list with Tab/Arrow keys
- Rename space using F2
- Switch to space using Enter
- Search using / key or Tab to search field
- Delete space with Delete/Backspace key
- Verify every action works without mouse
- Verify no mouse-only functionality
- Verify complete Tab order is logical
- Verify no keyboard traps

**WCAG Coverage:** 2.1.1, 2.1.2, 2.4.3

### 2. `screen-reader-journey.test.ts`
Verify screen reader users can understand and interact with the extension.

**Tests:**
- ARIA labels on all interactive elements
- Semantic HTML structure (landmarks)
- Role attributes (button, list, listitem, dialog, etc.)
- Alt text on images and icons
- Live region announcements (space switched, error occurred)
- Status messages announced properly
- Error messages accessible (role="alert")
- Form inputs have proper labels
- Current space indication announced
- Accessibility tree snapshot validation

**WCAG Coverage:** 1.1.1, 1.3.1, 4.1.2, 4.1.3

### 3. `focus-management-journey.test.ts`
Focus management through complete workflows.

**Tests:**
- Focus order through complete popup workflow
- Focus visible indicator on all elements
- Focus restoration after closing dialogs
- Focus trap in confirmation dialogs
- No focus loss during async operations
- Focus doesn't move unexpectedly on hover
- Focus order follows visual order (top-to-bottom, left-to-right)
- Shift+Tab reverses focus order correctly
- Focus not trapped in popup (can exit)
- Focus management in nested elements

**WCAG Coverage:** 2.4.3, 2.4.7, 2.1.2, 3.2.1

### 4. `keyboard-shortcuts-accessibility.test.ts`
All keyboard shortcuts are accessible, documented, and discoverable.

**Tests:**
- F2 key activates rename mode
- Delete/Backspace triggers delete confirmation
- Enter key activates selected item
- Escape key cancels actions/closes dialogs
- Slash (/) key focuses search input
- Arrow keys navigate through list
- No single-character shortcuts conflicting with typing
- Keyboard shortcut help/documentation (? key)
- Ctrl/Cmd+N creates new space
- Shortcuts work with screen readers
- No conflicts with browser/OS shortcuts
- Shortcuts consistent across extension

**WCAG Coverage:** 2.1.1, 2.1.4, 2.4.1

**Expected Shortcuts:**
```
F2              - Rename selected space
Delete          - Delete selected space
Backspace       - Delete selected space (alternative)
Enter           - Switch to selected space / Confirm action
Escape          - Cancel action / Close dialog
/               - Focus search input
Tab             - Navigate forward
Shift+Tab       - Navigate backward
ArrowDown       - Navigate to next space (optional)
ArrowUp         - Navigate to previous space (optional)
Ctrl+N          - Create new space (optional)
?               - Show keyboard shortcuts help (optional)
```

### 5. `high-contrast-mode-journey.test.ts`
Extension works in Windows High Contrast Mode and forced colors.

**Tests:**
- Extension UI visible in high contrast mode
- Focus indicators visible in high contrast
- All text readable in high contrast
- Borders and separators visible
- Interactive elements distinguishable
- Current space indication visible
- Icons and images visible
- Complete user journey in high contrast
- Media query for prefers-contrast
- No information conveyed by color alone

**WCAG Coverage:** 1.4.1, 1.4.3, 1.4.11

**High Contrast Themes Tested:**
- High Contrast Black (white text on black)
- High Contrast White (black text on white)
- High Contrast #1 (lime text on black)
- High Contrast #2 (aqua text on black)

### 6. `reduced-motion-journey.test.ts`
Users with motion sensitivity can use without triggering discomfort.

**Tests:**
- Verify prefers-reduced-motion is detected
- Animations disabled or significantly reduced
- Transitions complete instantly or very quickly (< 100ms)
- No parallax or scrolling effects
- All functionality works without animation
- Loading states appear instantly (no spinners)
- Hover effects are instant (no fade-in/out)
- No auto-playing animations on page load
- CSS transitions respect reduced motion
- Complete workflow without motion-triggered discomfort

**WCAG Coverage:** 2.3.3, 2.2.2

### 7. `zoom-magnification-journey.test.ts`
Users with low vision can zoom and all content remains accessible.

**Tests:**
- Test at 200% zoom (WCAG AA requirement)
- Test at 400% zoom (maximum reflow test)
- All interactive elements accessible at high zoom
- Text doesn't overlap at high zoom
- Test with increased text spacing (WCAG 1.4.12)
- Browser zoom levels (100%, 150%, 200%)
- Font size increases proportionally with zoom
- Scrollbars appear when needed at high zoom
- Touch targets remain adequate size at zoom
- Complete user workflow at 200% zoom

**WCAG Coverage:** 1.4.4, 1.4.10, 1.4.12

**Zoom Levels Tested:**
- 100% (Default)
- 150%
- 200% (WCAG AA requirement)
- 300%
- 400% (WCAG AAA requirement)

## Running Tests

### Run all accessibility tests
```bash
npm run test:e2e -- e2e-tests/accessibility-ux/
```

### Run individual test suites
```bash
# Keyboard-only navigation
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

# Zoom/magnification
npm run test:e2e -- e2e-tests/accessibility-ux/zoom-magnification-journey.test.ts
```

### Run with headed browser for debugging
```bash
npm run test:e2e -- e2e-tests/accessibility-ux/ --headed
```

### Run specific test
```bash
npm run test:e2e -- e2e-tests/accessibility-ux/keyboard-only-complete-journey.test.ts -g "Journey 4: Rename space using F2 key"
```

## Test Structure

Each test file follows this pattern:

1. **Setup**: Load extension with appropriate accessibility settings
2. **Journey Tests**: Test complete user workflows (not just individual features)
3. **Validation**: Check WCAG success criteria compliance
4. **Violation Tracking**: Collect all violations throughout tests
5. **Summary**: Report violations with severity, WCAG reference, and recommendations

## Violation Severity Levels

- **Critical**: Prevents users from completing tasks (MUST fix)
- **Serious**: Major barriers to accessibility (SHOULD fix)
- **Moderate**: Impacts usability but workarounds exist (RECOMMENDED to fix)
- **Minor**: Best practice improvements (NICE to fix)

## Helper Functions

`accessibility-helpers.ts` provides:

- `verifyKeyboardAccessible()` - Check element is keyboard accessible
- `verifyARIALabels()` - Verify accessible names on all interactive elements
- `verifyFocusManagement()` - Validate focus through workflow
- `verifyFocusTrap()` - Verify focus trap in dialogs
- `verifyColorContrast()` - Calculate and verify contrast ratios
- `verifyLiveRegionAnnouncements()` - Check aria-live regions
- `verifyTabOrder()` - Validate tab navigation sequence
- `getAccessibilityViolations()` - Get violations from accessibility tree
- `formatViolationsReport()` - Format violations for output

## Understanding Test Results

### Successful Test Output
```
✅ All keyboard accessibility tests passed! No violations found.
```

### Violation Report
```
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
```

## Best Practices for Fixing Violations

### Keyboard Accessibility
```css
/* Ensure all interactive elements are keyboard accessible */
.space-item {
  /* Make focusable */
  tabindex: 0;

  /* Visible focus indicator */
  &:focus {
    outline: 2px solid #4A90E2;
    outline-offset: 2px;
  }
}
```

### Screen Reader Support
```tsx
// Add ARIA labels and semantic structure
<button
  aria-label="Delete space: Work Project"
  onClick={handleDelete}
>
  <DeleteIcon aria-hidden="true" />
</button>

<div role="status" aria-live="polite" aria-atomic="true">
  {statusMessage}
</div>
```

### Focus Management
```typescript
// Restore focus after closing dialog
const triggerRef = useRef<HTMLElement>(null);

const handleOpenDialog = () => {
  triggerRef.current = document.activeElement as HTMLElement;
  setDialogOpen(true);
};

const handleCloseDialog = () => {
  setDialogOpen(false);
  triggerRef.current?.focus();
};
```

### High Contrast Mode
```css
/* Support forced colors mode */
@media (forced-colors: active) {
  .space-item {
    border: 1px solid CanvasText;
  }

  .space-item.current {
    border-width: 2px;
    font-weight: bold;
  }
}
```

### Reduced Motion
```css
/* Disable animations for motion-sensitive users */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Zoom Support
```css
/* Use relative units for zoom support */
.space-item {
  /* Instead of: height: 40px; */
  min-height: 2.5rem; /* Scales with zoom */

  /* Allow text to wrap */
  white-space: normal;
  word-wrap: break-word;
}
```

## Integration with CI/CD

Add to your GitHub Actions workflow:

```yaml
- name: Run Accessibility Tests
  run: npm run test:e2e -- e2e-tests/accessibility-ux/

- name: Upload Accessibility Report
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: accessibility-violations
    path: test-results/
```

## Manual Testing Recommendations

While these automated tests cover most scenarios, also perform manual testing with:

1. **Real Screen Readers**:
   - NVDA (Windows, free)
   - JAWS (Windows, commercial)
   - VoiceOver (macOS/iOS, built-in)
   - TalkBack (Android, built-in)

2. **Browser DevTools**:
   - Chrome DevTools > Accessibility panel
   - Firefox Accessibility Inspector
   - axe DevTools browser extension

3. **Real Users**:
   - User testing with people who rely on assistive technologies
   - Accessibility consultants

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices Guide](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Keyboard Accessibility](https://webaim.org/articles/keyboard/)
- [WebAIM Screen Reader Testing](https://webaim.org/articles/screenreader_testing/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Contributing

When adding new features, ensure they pass all accessibility tests:

1. Run accessibility test suite
2. Fix any violations (prioritize Critical and Serious)
3. Test manually with keyboard-only navigation
4. Test with a screen reader if possible
5. Add new tests for new interactive patterns

## Support

For questions about accessibility testing or violations, please:

1. Review the WCAG guidelines linked in violation reports
2. Check the test file that reported the violation for examples
3. Consult the resources section above
4. Open an issue with the accessibility label

## License

Same as parent project (MIT)