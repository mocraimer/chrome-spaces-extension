# Interaction Flow Testing Framework

A comprehensive framework for testing complex multi-step user interactions in the Chrome Spaces extension.

## Overview

This framework provides a fluent, human-readable API for creating realistic user interaction tests. Instead of writing low-level click-and-assert tests, you can describe user flows that closely match how real users interact with the extension.

## Features

- **Fluent API**: Method chaining for readable test flows
- **Realistic User Simulation**: Natural typing delays, mouse movements, and think time
- **Smart Waits**: Automatic waiting for elements and state changes
- **Higher-Level Assertions**: Assertions that understand extension behavior
- **Flow Recording**: Record and replay user sessions for debugging
- **Common User Flows**: Prebuilt flows for typical use cases
- **Error Context**: Detailed error messages with action history

## Quick Start

```typescript
import { InteractionFlowBuilder } from '../framework';

test('user can search and rename space', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);
  await flow.initialize();

  await flow
    .openPopup()
    .searchFor('Work')
    .selectFirstResult()
    .pressF2()
    .editName('Work - Morning')
    .saveEdit()
    .verifyNameChanged('Work - Morning');
});
```

## Core Components

### 1. InteractionFlowBuilder

The main fluent API for building interaction flows.

**Initialization:**
```typescript
const flow = new InteractionFlowBuilder(page, context, {
  logActions: true,          // Log each action
  captureFailures: true,     // Screenshot on failure
  screenshotOnStep: false,   // Screenshot each step
  defaultTimeout: 5000       // Default wait timeout
});

await flow.initialize();
```

**Common Actions:**

```typescript
// Popup operations
await flow.openPopup();

// Search operations
await flow.searchFor('query');
await flow.clearSearch();

// Navigation
await flow.navigateDown(3);
await flow.navigateUp(1);
await flow.selectFirstResult();
await flow.selectSpaceByIndex(2);

// Editing
await flow.pressF2();
await flow.editName('New Name');
await flow.saveEdit();
await flow.cancelEdit();

// Keyboard shortcuts
await flow.pressEnter();
await flow.pressEscape();

// Mouse interactions
await flow.clickElement('.selector');
await flow.doubleClickToEdit('Space Name');
await flow.hoverElement('.selector');

// Think time (simulates user pausing)
await flow.think('short');   // 300-800ms
await flow.think('medium');  // 800-1500ms
await flow.think('long');    // 1500-3000ms
```

**Verification Methods:**

```typescript
// Basic verifications
await flow.verifySpaceVisible('Space Name');
await flow.verifyInEditMode();
await flow.verifySpaceSelected();
await flow.verifyAllSpacesVisible();

// Search verifications
await flow.verifySearchFiltered(3);  // Exactly 3 results

// Edit verifications
await flow.verifyNameChanged('New Name', 'Old Name');

// State verifications
await flow.verifyVisualFeedback('loading');
await flow.verifyErrorShown('Error message');
await flow.verifyWindowSwitched();
```

### 2. UserActionSimulator

Simulates realistic human user behavior.

**Typing with Natural Delays:**
```typescript
const simulator = flow.getSimulator();

await simulator.typeWithRealisticDelay('Hello World', {
  minDelay: 50,
  maxDelay: 200,
  randomizeDelay: true,
  simulateTypos: false
});
```

**Natural Mouse Movement:**
```typescript
await simulator.clickWithNaturalDelay('.button', {
  thinkTime: 200,           // Pause before clicking
  naturalMovement: true,    // Bezier curve movement
  doubleClick: false
});

await simulator.hoverWithNaturalMovement('.element');
```

**Keyboard Navigation:**
```typescript
await simulator.navigateWithArrowKeys('down', 3, {
  delayBetweenSteps: 300,
  verifyFocus: true
});

await simulator.pressShortcut('ctrl+a');
await simulator.pressKey('F2', ['Shift']);
```

**Think Time:**
```typescript
await simulator.simulateThinkTime('medium');
await simulator.simulateReadingTime(20);  // 20 words
await simulator.randomDelay(100, 500);
```

### 3. InteractionFlowAssertions

Higher-level assertions with context awareness.

**Context Tracking:**
```typescript
const assertions = flow.getAssertions();

assertions.recordAction('Searched for example');
assertions.setCurrentStep('Verifying search results');

// On failure, includes full context:
// - Current step
// - Recent actions
// - Page URL
```

**Space Assertions:**
```typescript
await assertions.verifySpaceVisible('Work Space', {
  timeout: 5000,
  exact: true
});

await assertions.verifyClosedSpaceVisible('Old Space');
await assertions.verifySpaceTabCount('Work', 5);
```

**Edit Mode Assertions:**
```typescript
await assertions.verifyInEditMode('Space Name');
await assertions.verifyNotInEditMode();
```

**Search Assertions:**
```typescript
await assertions.verifySearchFiltered(3);
await assertions.verifyAllSpacesVisible(1);  // At least 1 space
```

**Error Handling:**
```typescript
try {
  await assertions.verifySpaceVisible('Nonexistent');
} catch (error) {
  // Error includes:
  // - What was expected
  // - What was found
  // - Recent action history
  // - Current page state
}
```

### 4. CommonUserFlows

Prebuilt flows for common scenarios.

**Creating Common Flows:**
```typescript
const flow = new InteractionFlowBuilder(page, context);
const common = new CommonUserFlows(flow);
```

**Prebuilt Flows:**

```typescript
// Create and name a space
await common.createAndNameSpace('My Project');

// Rename an existing space
await common.renameSpace('Old Name', 'New Name');

// Search and switch
await common.searchAndSwitch('Work');

// Double-click rename
await common.doubleClickRename('Space', 'New Name');

// Bulk rename multiple spaces
await common.bulkRename([
  { oldName: 'Work', newName: 'Work - Morning' },
  { oldName: 'Personal', newName: 'Personal - Evening' }
]);

// Keyboard-only navigation
await common.keyboardOnlyNavigation(3);

// Edit and cancel
await common.editAndCancel('Space Name');

// Search with no results
await common.searchWithNoResults();

// Rapid interaction (fast user)
await common.rapidInteraction('Space', 'New Name');

// Slow interaction (careful user)
await common.slowDeliberateInteraction('Space', 'New Name');

// Multiple edit attempts
await common.multipleEditAttempts('Space Name');

// Context switching between edits
await common.contextSwitching([
  { spaceName: 'Space 1', newName: 'Updated 1' },
  { spaceName: 'Space 2', newName: 'Updated 2' }
]);

// Full CRUD sequence
await common.fullOperationSequence(
  'Original',
  'Temporary',
  'Final'
);
```

### 5. FlowRecorder

Records and replays user sessions.

**Recording a Session:**
```typescript
const recorder = new FlowRecorder(page, {
  captureScreenshots: true,
  autoSave: true,
  outputDir: 'test-results/recordings'
});

await recorder.startRecording('My Test Flow', {
  environment: 'test',
  browser: 'Chrome'
});

// Perform actions and record them
await recorder.recordClick('.button');
await recorder.recordType('input', 'Hello');
await recorder.recordKeyPress('Enter');
await recorder.recordAssertion('visible', 'Element');

const session = await recorder.stopRecording('passed');
```

**Analyzing Recordings:**
```typescript
// Generate human-readable description
const description = recorder.generateFlowDescription(session);
console.log(description);

// Generate replay script
const script = recorder.generateReplayScript(session, 'typescript');

// Get statistics
const stats = recorder.getSessionStatistics(session);
console.log(stats.totalActions);
console.log(stats.actionsByType);
console.log(stats.averageActionDuration);

// Export as test code
await recorder.exportAsTestCode(session, 'output.test.ts');
```

**Loading and Replaying:**
```typescript
const session = await recorder.loadSession('path/to/recording.json');
const description = recorder.generateFlowDescription(session);
```

## Usage Examples

### Example 1: Basic Search and Edit

```typescript
test('user searches and edits space', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);
  await flow.initialize();

  await flow
    .openPopup()
    .searchFor('example')
    .selectFirstResult()
    .pressF2()
    .editName('My Example')
    .saveEdit()
    .verifyNameChanged('My Example');
});
```

### Example 2: Keyboard-Only Workflow

```typescript
test('keyboard power user workflow', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);
  await flow.initialize();

  await flow
    .openPopup()
    .navigateDown(3)
    .pressF2()
    .typeWithRealisticDelay('Quick Edit')
    .pressEnter()
    .verifyNameChanged('Quick Edit');
});
```

### Example 3: Error Recovery

```typescript
test('user corrects mistake', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);
  await flow.initialize();

  await flow
    .openPopup()
    .searchFor('wrong')
    .verifySearchFiltered(0)
    .clearSearch()
    .searchFor('correct')
    .selectFirstResult()
    .pressF2()
    .editName('Fixed Name')
    .saveEdit()
    .verifyNameChanged('Fixed Name');
});
```

### Example 4: Using Common Flows

```typescript
test('bulk rename operation', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);
  const common = new CommonUserFlows(flow);

  await common.bulkRename([
    { oldName: 'Work', newName: 'Work - Q1' },
    { oldName: 'Personal', newName: 'Personal - Home' },
    { oldName: 'Research', newName: 'Research - AI' }
  ]);
});
```

### Example 5: With Recording

```typescript
test('recorded flow with debugging', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);
  const recorder = new FlowRecorder(page);

  await recorder.startRecording('Complex Flow');

  try {
    await flow.initialize();
    await recorder.recordCustomAction('Initializing');

    await flow.openPopup();
    await recorder.recordCustomAction('Opened popup');

    await flow.searchFor('example').selectFirstResult();
    await recorder.recordAction('type', 'search', 'example');

    await flow.pressF2().editName('Test').saveEdit();
    await recorder.recordAction('type', 'edit', 'Test');

    await recorder.stopRecording('passed');
  } catch (error) {
    const session = await recorder.stopRecording('failed', error.message);
    console.log(recorder.generateFlowDescription(session));
    throw error;
  }
});
```

## Best Practices

### 1. Use Fluent Chaining

**Good:**
```typescript
await flow
  .openPopup()
  .searchFor('query')
  .selectFirstResult()
  .pressF2()
  .editName('New Name')
  .saveEdit();
```

**Avoid:**
```typescript
await flow.openPopup();
await flow.searchFor('query');
await flow.selectFirstResult();
// ... separate statements
```

### 2. Add Think Time for Realistic Tests

```typescript
await flow
  .openPopup()
  .think('short')        // User pauses to read
  .searchFor('query')
  .think('medium')       // User considers options
  .selectFirstResult()
  .pressF2()
  .editName('Name')
  .saveEdit();
```

### 3. Use Verification Methods

Always verify expected outcomes:

```typescript
await flow
  .searchFor('example')
  .verifySearchFiltered(1)    // Verify filter worked
  .selectFirstResult()
  .pressF2()
  .verifyInEditMode()          // Verify edit mode active
  .editName('New')
  .saveEdit()
  .verifyNameChanged('New');   // Verify save worked
```

### 4. Handle Errors Gracefully

```typescript
test('resilient test with error handling', async ({ page, context }) => {
  const flow = new InteractionFlowBuilder(page, context);

  try {
    await flow
      .openPopup()
      .searchFor('query')
      .selectFirstResult()
      .editName('Name')
      .saveEdit();
  } catch (error) {
    console.log('Action history:', flow.getActionHistory());
    throw error;
  }
});
```

### 5. Use Common Flows for Repeated Patterns

Instead of repeating the same flow:

```typescript
// Reusable
const common = new CommonUserFlows(flow);
await common.renameSpace('Old', 'New');
```

### 6. Log Actions in Debug Mode

```typescript
const flow = new InteractionFlowBuilder(page, context, {
  logActions: true,
  captureFailures: true
});
```

### 7. Simulate Different User Types

```typescript
// Fast power user
await flow.searchFor('query', { minDelay: 10, maxDelay: 30 });

// Slow, careful user
await flow.searchFor('query', { minDelay: 100, maxDelay: 300 });

// User with typos
await flow.typeWithRealisticDelay('text', { simulateTypos: true });
```

## Architecture

### Flow Builder Pattern

The framework uses the Builder pattern for fluent API construction:

```
InteractionFlowBuilder
├── UserActionSimulator (realistic actions)
├── InteractionFlowAssertions (smart assertions)
└── FlowRecorder (optional recording)
```

### Automatic Waits

The framework handles waits automatically:
- Elements wait for visibility
- State changes are detected
- Animations complete before next action
- Network idle states are tracked

### Error Context

When assertions fail, you get:
```
Space "Test" not visible

Context:
  Current Step: Verifying space "Test" is visible
  Recent Actions: Opened popup → Searched for "test" → Selected first result → Pressed F2 → Edited name
  Page URL: chrome-extension://abc123/popup.html

Original error: Timeout waiting for element
```

## Extension Guide

### Adding Custom Actions

```typescript
// Extend InteractionFlowBuilder
class CustomFlowBuilder extends InteractionFlowBuilder {
  async customAction(): Promise<this> {
    await this.logStep('Performing custom action');

    // Your custom logic
    await this.page.evaluate(() => {
      // Custom page interaction
    });

    this.getAssertions().recordAction('Custom action');
    return this;
  }
}
```

### Adding Custom Assertions

```typescript
// Extend InteractionFlowAssertions
class CustomAssertions extends InteractionFlowAssertions {
  async verifyCustomCondition(expected: string): Promise<void> {
    this.setCurrentStep(`Verifying custom: ${expected}`);

    // Your assertion logic
    const actual = await this.page.locator('.custom').textContent();
    expect(actual).toBe(expected);
  }
}
```

### Adding Custom Flows

```typescript
// Extend CommonUserFlows
class CustomUserFlows extends CommonUserFlows {
  async myCustomFlow(param: string): Promise<InteractionFlowBuilder> {
    await this.flow
      .openPopup()
      .searchFor(param)
      .selectFirstResult();

    return this.flow;
  }
}
```

## Troubleshooting

### Tests are too slow

```typescript
// Reduce delays
const flow = new InteractionFlowBuilder(page, context, {
  defaultTimeout: 2000  // Lower timeout
});

// Use rapid interaction
await flow.searchFor('query', { minDelay: 10, maxDelay: 30 });
```

### Assertions failing intermittently

```typescript
// Increase timeout
await flow.verifySpaceVisible('Name', { timeout: 10000 });

// Add explicit waits
await flow.wait(500).verifySpaceVisible('Name');
```

### Need more debug info

```typescript
// Enable logging and screenshots
const flow = new InteractionFlowBuilder(page, context, {
  logActions: true,
  screenshotOnStep: true,
  captureFailures: true
});

// Check action history
console.log(flow.getActionHistory());
```

### Recording not saving

```typescript
// Ensure output directory exists
const recorder = new FlowRecorder(page, {
  outputDir: 'test-results/recordings',
  autoSave: true
});

// Manually save
const session = await recorder.stopRecording('passed');
await recorder.saveSession(session);
```

## API Reference

See inline TypeScript documentation for complete API reference. Each method includes:
- Parameter descriptions
- Return types
- Usage examples
- Related methods

## Contributing

To add new features:

1. **New actions**: Add to `InteractionFlowBuilder.ts`
2. **New assertions**: Add to `InteractionFlowAssertions.ts`
3. **New simulations**: Add to `UserActionSimulator.ts`
4. **New common flows**: Add to `CommonUserFlows.ts`
5. **Update this README** with examples

## Examples Location

See `/e2e-tests/interaction-flows/` for complete test examples:
- `search-edit-save-flow.test.ts` - Basic search and edit
- `keyboard-only-navigation-flow.test.ts` - Keyboard interactions
- `error-recovery-interaction-flow.test.ts` - Error handling
- `bulk-rename-flow.test.ts` - Multiple operations
- `mixed-interaction-patterns-flow.test.ts` - Combined patterns
- And more...

## License

MIT