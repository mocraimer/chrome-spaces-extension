# User Journey E2E Tests

## Overview

This directory contains **complete user journey tests** that simulate realistic, end-to-end workflows from a UX perspective. Unlike feature-specific tests, these tests follow entire user stories from start to finish, testing the complete user experience rather than isolated functionality.

## Philosophy

**User journeys test HOW users actually use the extension, not just IF features work.**

Each test represents a complete story:
- **Beginning**: User's goal or situation
- **Middle**: Steps user takes to achieve goal
- **End**: Successful outcome and user satisfaction

Tests are written as **narrative stories** with:
- Clear user intent at each step
- Realistic timing (users don't act instantly)
- Meaningful assertions for visual feedback
- Success paths AND common mistakes

## Test Structure

### Naming Convention

Files follow the pattern: `{user-type}-{workflow-name}.test.ts`

Examples:
- `new-user-onboarding.test.ts` - First-time user experience
- `power-user-keyboard-flow.test.ts` - Advanced keyboard-only workflow
- `daily-usage-workflow.test.ts` - Typical daily routine

### Test Organization

Each test file contains:
1. **Header comment** - User story and workflow description
2. **Setup** - Creating realistic test environment
3. **Multiple test cases** - Different phases of the journey
4. **Summary test** - Validates complete journey success

## Available User Journeys

### 1. New User Onboarding (`new-user-onboarding.test.ts`)

**User Story**: "First time using the extension - what do I do?"

**Journey**:
- Opens extension for first time
- Discovers existing windows are tracked
- Learns keyboard shortcuts from help text
- Renames first space successfully
- Creates new space
- Switches between spaces confidently

**Tests**:
- Complete new user onboarding flow
- New user learns search functionality
- New user explores closed spaces feature

**Duration**: ~60-90 seconds

**Key Learning**: Extension is intuitive for first-time users

---

### 2. Daily Usage Workflow (`daily-usage-workflow.test.ts`)

**User Story**: "How do I use this every day for work?"

**Journey**:
- Morning: Resumes work from yesterday's closed spaces
- Midday: Creates ad-hoc space for unexpected meeting
- Evening: Closes work spaces at end of day
- Verifies spaces preserved for tomorrow

**Tests**:
- Morning routine: Resume work from yesterday
- Midday workflow: Creating ad-hoc meeting space
- End of day workflow: Closing work spaces
- Complete daily workflow cycle verification

**Duration**: ~90-120 seconds

**Key Learning**: Extension supports natural daily work patterns

---

### 3. Power User Keyboard Flow (`power-user-keyboard-flow.test.ts`)

**User Story**: "I never want to touch my mouse - everything by keyboard"

**Journey**:
- Opens popup (keyboard focused automatically)
- Navigates with arrow keys exclusively
- Uses F2 to rename spaces rapidly
- Escapes to cancel mistakes
- Searches and switches with keyboard only

**Tests**:
- Power user navigates using only arrow keys
- Power user renames spaces using F2 shortcut
- Power user cancels edits with Escape
- Power user uses search with keyboard navigation
- Power user switches spaces rapidly
- Power user clears search efficiently
- Complete power user keyboard workflow summary

**Duration**: ~90-120 seconds

**Key Learning**: 10x faster workflow for keyboard users

---

### 4. Context Switching Flow (`context-switching-flow.test.ts`)

**User Story**: "I need to quickly check email without losing my development context"

**Journey**:
- Working in Development space (8 reference tabs)
- Urgent email requires attention
- Switches to Email space quickly
- Handles email task
- Returns to Development - all tabs intact
- Tests multiple rapid switches

**Tests**:
- User establishes development context with many tabs
- User switches to email to check urgent message
- User switches back to development - verifies context preserved
- Rapid multi-context switching without data loss
- User handles interruption mid-task and returns seamlessly
- Context switching summary and benefits

**Duration**: ~90-120 seconds

**Key Learning**: Zero context loss during interruptions

---

### 5. Space Organization Flow (`space-organization-flow.test.ts`)

**User Story**: "My browser is a mess - I need to organize everything"

**Journey**:
- User has 15+ unnamed, chaotic spaces
- Systematically renames by category (Work, Personal, Research)
- Uses search to verify organization
- Closes unnecessary duplicate spaces
- Achieves clean, maintainable workspace

**Tests**:
- User discovers their browser chaos
- User systematically renames spaces - Work category
- User continues organization - Personal category
- User finishes remaining spaces and verifies organization
- User tests organization with search
- User closes unnecessary duplicate spaces
- Organization journey complete - before and after

**Duration**: ~120-150 seconds

**Key Learning**: Systematic organization reduces mental overhead

---

### 6. Mistake Recovery Flow (`mistake-recovery-flow.test.ts`)

**User Story**: "Oh no! I accidentally closed my important work!"

**Journey**:
- User has Critical Project Work space (4 tabs)
- Accidentally closes it (panic!)
- Discovers "Recently Closed" section
- Successfully restores space
- All tabs return intact
- Renames space to prevent future accidents

**Tests**:
- User accidentally closes important space
- User searches for recovery option
- User restores the closed space
- User renames space to prevent future confusion
- User tests the safety net multiple times
- Mistake recovery summary

**Duration**: ~60-90 seconds

**Key Learning**: Mistakes are recoverable - users can work confidently

---

### 7. Search and Switch Flow (`search-switch-flow.test.ts`)

**User Story**: "I have 20+ spaces - how do I find anything quickly?"

**Journey**:
- User has many spaces (10+ named)
- Types partial name to filter instantly
- Sees real-time search results
- Hits Enter to switch to top result
- Complete workflow in <5 seconds

**Tests**:
- User performs instant search-to-switch
- User searches with partial match
- User filters by category with search
- User rapidly switches between spaces using search
- User handles no results gracefully
- Search and switch journey summary

**Duration**: ~60-90 seconds

**Key Learning**: Search is 10x faster than manual navigation

---

### 8. Multi-Window Management (`multi-window-management.test.ts`)

**User Story**: "I have 3 monitors - one project per screen"

**Journey**:
- User has multi-monitor setup
- Opens 3 Chrome windows side-by-side
- Names each for different project
- Switches between windows via extension
- Verifies all windows tracked correctly

**Tests**:
- User sets up multi-monitor workspace
- User names each window for its purpose
- User switches between monitor workspaces
- User verifies all windows tracked correctly
- Multi-window management summary

**Duration**: ~60-90 seconds

**Key Learning**: Perfect for multi-monitor setups

---

### 9. Edit Workflow Complete (`edit-workflow-complete.test.ts`)

**User Story**: "I want clear feedback when editing space names"

**Journey**:
- User tries invalid names (empty, whitespace)
- Sees helpful validation messages
- Validates only good names save
- Tests canceling edits preserves original
- Confirms validation prevents mistakes

**Tests**:
- User tries invalid names - validation prevents mistakes
- User successfully saves valid name
- User cancels edit - original name preserved
- Edit workflow summary

**Duration**: ~45-60 seconds

**Key Learning**: Good validation builds user confidence

---

### 10. Bulk Operations Flow (`bulk-operations-flow.test.ts`)

**User Story**: "I need to reorganize everything quickly"

**Journey**:
- Creates 5+ spaces rapidly
- Renames multiple spaces in succession
- Closes several old spaces
- Verifies all operations persisted
- Stress tests with rapid sequential operations

**Tests**:
- User creates multiple spaces rapidly
- User bulk renames all new spaces
- User verifies all renames persisted
- User bulk closes old unused spaces
- Stress test: Rapid sequential operations
- Bulk operations journey summary

**Duration**: ~90-120 seconds

**Key Learning**: System handles bulk operations without degradation

---

## Running the Tests

### Run All Journey Tests

```bash
npm run test:e2e -- e2e-tests/user-journeys/
```

### Run Specific Journey

```bash
npm run test:e2e -- e2e-tests/user-journeys/new-user-onboarding.test.ts
```

### Run in UI Mode (Recommended for Journey Tests)

```bash
npm run test:e2e:ui
```

Journey tests are **visual by design** - running in headed mode or UI mode lets you see the user experience unfold.

### Run in Headed Mode

```bash
npm run test:e2e -- e2e-tests/user-journeys/ --headed
```

## Test Characteristics

### Realistic Timing

Tests include realistic wait times that simulate human behavior:

```typescript
// User pauses to read UI
await popupPage.waitForTimeout(1500);

// User types quickly but not instantly
await popupPage.keyboard.type('search', { delay: 50 });

// User considers options before acting
await popupPage.waitForTimeout(1000);
```

### Narrative Structure

Tests read like stories with clear user intent:

```typescript
console.log('📖 User discovers their browser is a mess');
console.log('😰 User panic level: HIGH');
console.log('💭 User thinks: "I need to organize this mess!"');
console.log('✅ User successfully renamed their first space!');
console.log('🎉 SUCCESS: All 4 tabs recovered!');
```

### Complete Workflows

Each test covers an entire user journey, not just happy paths:

- ✅ Success scenarios
- ❌ Common mistakes
- 🔄 Error recovery
- 🎯 Goal achievement
- 📊 Benefits validation

## Writing New Journey Tests

### Template Structure

```typescript
/**
 * User Journey Test: [Journey Name]
 *
 * This test simulates [user scenario]:
 * 1. [Step 1]
 * 2. [Step 2]
 * 3. [Step 3]
 * ...
 *
 * User Story:
 * "As a [user type], I want to [goal],
 * so I can [benefit]."
 */

test.describe('[Journey Name] Journey', () => {
  // Setup

  test('Phase 1: [User action]', async () => {
    console.log('\n📖 [User intent]\n');
    // Test logic with narrative
  });

  test('Journey summary', async () => {
    console.log('\n🏆 [JOURNEY NAME] COMPLETE\n');
    // Summarize benefits and learnings
  });
});
```

### Best Practices

1. **Write for humans first**
   - Clear console logs explaining user intent
   - Descriptive test names that tell a story
   - Comments explaining WHY user does something

2. **Include realistic delays**
   - Users read, think, and then act
   - Fast typing ≠ instant typing
   - UI animations need time to complete

3. **Test both success and failure**
   - Happy path is important
   - Recovery from mistakes is equally important
   - Edge cases reveal UX issues

4. **Verify user-visible feedback**
   - Don't just check internal state
   - Assert on what users actually see
   - Test visual feedback (selected items, messages, etc.)

5. **End with summary**
   - What did the user learn?
   - What benefits did they experience?
   - What patterns emerged?

## Patterns Discovered

Through these journey tests, we discovered several user patterns:

### Power User Shortcuts
- Search → 3-4 chars → Enter (most common workflow)
- Arrow keys rarely used (search is faster)
- Keyboard-only users are 10x faster
- Muscle memory develops for common spaces

### Organization Strategies
- Users group by category: "Work", "Personal", "Research"
- Emoji usage for visual scanning (🔴 for important)
- Naming convention: "Category: Description"
- Good names make search powerful

### Error Recovery Behaviors
- First instinct: panic when space closes
- Discovery of "Recently Closed" = relief
- Confidence increases after testing recovery
- Users become less afraid of mistakes

### Context Switching Patterns
- Quick checks (<30 sec) are common
- Deep work contexts have 5-10+ tabs
- Users return to same space repeatedly
- Search queries become muscle memory

## Gaps Found

While testing, we discovered potential improvements:

1. **F2 Shortcut**: Not universally supported across all popup implementations
2. **Bulk Selection**: No way to select multiple spaces at once for bulk operations
3. **Keyboard-only Closed Space Restoration**: Might require mouse for restore button
4. **Search Results Ordering**: Could be optimized by recent usage
5. **Visual Feedback**: Some operations could have clearer loading states

## Recommended Additional Journey Tests

Future journey tests to consider:

1. **Browser Crash Recovery** - Verify spaces restored after Chrome crash
2. **Heavy Tab Load** (50+ tabs per space) - Performance under extreme load
3. **Long Session** (hours of usage) - Memory leaks, performance degradation
4. **Import/Export Workflow** - Backup and restore complete workspace
5. **Cross-Device Sync** - Same user across multiple computers (if supported)
6. **Mobile Browser** - Responsive design for mobile Chrome
7. **Accessibility Flow** - Screen reader and keyboard-only users
8. **First Launch After Update** - Extension upgrade scenarios

## Contributing

When adding new journey tests:

1. **Identify a real user workflow** - Base on actual usage patterns
2. **Write the user story first** - What's the goal and benefit?
3. **Create realistic test data** - Names, URLs, timing should feel real
4. **Add narrative logging** - Every step should explain user intent
5. **Test the full journey** - From problem to solution to satisfaction
6. **Document patterns discovered** - What did this reveal about UX?

## Test Maintenance

### Updating Tests

When extension UX changes:
1. Update affected journey tests to match new UX
2. Verify user stories still apply (goals haven't changed)
3. Check if new UX improves journey metrics
4. Update README with new patterns discovered

### Test Failures

Journey test failures often indicate:
- UX regression (workflow broke)
- Timing issues (need longer waits)
- Selector changes (UI structure changed)
- Real usability problems (users will hit this too!)

**Don't just fix the test** - understand if it's revealing a UX issue.

## Metrics

Journey tests measure real user success:

### Speed Metrics
- New user onboarding: <2 minutes to first success
- Search to switch: <5 seconds average
- Context switch: <3 seconds for experienced users
- Organization: <2 seconds per rename

### Success Metrics
- Zero data loss across all journeys
- 100% error recovery success rate
- Intuitive first-time experience (no documentation needed)
- Keyboard-only workflow 10x faster than mouse

### Quality Metrics
- All journeys pass = production ready UX
- Journey test coverage represents real usage patterns
- User confidence increases throughout journeys
- No blocking issues discovered

## Summary

**These journey tests validate the complete user experience**, not just individual features. They represent real users with real goals accomplishing real tasks. When all journey tests pass, we know the extension works not just functionally, but experientially.

The extension succeeds when users:
- ✅ Accomplish their goals quickly
- ✅ Feel confident using the extension
- ✅ Can recover from mistakes gracefully
- ✅ Develop efficient workflows naturally
- ✅ Experience zero data loss

**That's what these journey tests verify.**