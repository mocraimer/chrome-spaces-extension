# Chrome Spaces Extension - BDD Tests

This directory contains Behavior-Driven Development (BDD) tests using Cucumber.js and Gherkin syntax.

## 🎯 Purpose

BDD tests serve as:
- **Living Documentation** - Feature files describe the system behavior in plain English
- **Acceptance Criteria** - Each scenario represents a user story or requirement
- **Regression Tests** - Automated tests ensure features continue working as expected
- **Stakeholder Communication** - Non-technical team members can read and contribute to scenarios

## 📁 Structure

```
features/
├── *.feature                           # Gherkin feature files (4 files)
│   ├── space-management.feature       # 11 scenarios - Core space CRUD
│   ├── keyboard-navigation.feature    # 12 scenarios - Keyboard & a11y
│   ├── data-persistence.feature       # 10 scenarios - Data reliability
│   └── import-export.feature          # 12 scenarios - Import/export workflows
├── step-definitions/                   # Step implementation in TypeScript
│   ├── space-management.steps.ts      # 376 lines - Space operations
│   ├── keyboard-navigation.steps.ts   # 483 lines - Keyboard interactions
│   ├── data-persistence.steps.ts      # 464 lines - Persistence logic
│   ├── import-export.steps.ts         # 553 lines - Import/export steps
│   └── common-steps.ts                # 288 lines - Shared utilities
├── support/                            # Test setup and utilities
│   ├── world.ts                       # 192 lines - ExtensionWorld context
│   ├── hooks.ts                       # 101 lines - Lifecycle hooks
│   └── helpers.ts                     # 380 lines - Helper utilities
└── README.md                          # This file - Full documentation
```

## 🚀 Running BDD Tests

### Prerequisites
1. Build the extension first:
   ```bash
   npm run build
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Run Commands

```bash
# Run all BDD tests
npm run test:bdd

# Run only smoke tests
npm run test:bdd:smoke

# Run core functionality tests
npm run test:bdd:core

# Run specific tag
npm run test:bdd:tag @persistence

# Dry run (check steps without execution)
npm run test:bdd:dryrun

# Generate HTML report
npm run test:bdd:report
```

## 🏷️ Available Tags

- `@core` - Essential functionality that must always work
- `@smoke` - Quick tests for basic functionality
- `@persistence` - Data persistence and storage tests
- `@keyboard` - Keyboard navigation and shortcuts
- `@accessibility` - Accessibility features
- `@performance` - Performance-related scenarios
- `@edge-case` - Edge cases and error handling

## ✍️ Writing New Scenarios

### 1. Create/Update Feature File

```gherkin
Feature: New Feature Name
  As a [type of user]
  I want [goal]
  So that [benefit]

  @core @new-tag
  Scenario: Descriptive scenario name
    Given [initial context]
    When [action taken]
    Then [expected outcome]
```

### 2. Implement Step Definitions

```typescript
import { Given, When, Then } from '@cucumber/cucumber';
import { CustomWorld } from '../support/world';

Given('initial context', async function(this: CustomWorld) {
  // Implementation
});

When('action taken', async function(this: CustomWorld) {
  // Implementation
});

Then('expected outcome', async function(this: CustomWorld) {
  // Implementation
});
```

## 🌟 Features Covered

### 1. **Space Management** (`space-management.feature`)
- Creating spaces from browser windows
- Naming and renaming spaces
- Switching between spaces
- Closing and restoring spaces
- Searching spaces
- Keyboard navigation

### 2. **Data Persistence** (`data-persistence.feature`)
- Storage across browser restarts
- Extension updates
- Real-time synchronization
- Storage quota handling
- Data migration
- Automatic backups

### 3. **Keyboard Navigation** (`keyboard-navigation.feature`)
- Complete keyboard control
- Global hotkeys
- Search shortcuts
- Quick switching
- Accessibility features

### 4. **Import/Export** (`import-export.feature`)
- Export spaces to JSON
- Import from backup
- Selective import
- Template creation
- Cloud backup integration

## 🔧 Custom World Methods

The `ExtensionWorld` class provides helper methods:

```typescript
// Extension management
await this.openExtension();
await this.openPopup();
await this.openOptions();

// Space operations
await this.createMockSpace(name, urls);
await this.waitForSpaceItem(spaceName);
await this.searchForSpace(query);
await this.getVisibleSpaces();

// Test data
this.testData.set(key, value);
this.testData.get(key);
```

## 📊 Reports

After running tests, view reports:
- **Console Output** - Progress and results in terminal
- **HTML Report** - `cucumber-report.html` in project root
- **Screenshots** - Captured on failure and attached to report

## 🐛 Debugging

1. **Run specific scenario by name:**
   ```bash
   npm run test:bdd -- --name "Creating a new space"
   ```

2. **Add console logs in steps:**
   ```typescript
   console.log('Current URL:', await this.page!.url());
   ```

3. **Take screenshots:**
   ```typescript
   await this.page!.screenshot({ path: 'debug.png' });
   ```

4. **Pause execution:**
   ```typescript
   await this.page!.pause(); // Opens Playwright inspector
   ```

## 🤝 Contributing

1. Write scenarios in collaboration with stakeholders
2. Use clear, business-focused language
3. Follow existing patterns and conventions
4. Tag scenarios appropriately
5. Ensure all steps are implemented
6. Run tests locally before committing

## 🔗 Integration with CI/CD

The BDD tests can be integrated into your CI/CD pipeline:

```yaml
# Example GitHub Actions
- name: Run BDD Tests
  run: |
    npm run build
    npm run test:bdd:smoke
    npm run test:bdd:report

- name: Upload BDD Report
  uses: actions/upload-artifact@v2
  with:
    name: cucumber-report
    path: cucumber-report.html
```

## 🧪 Test Coverage Summary

### Total: 45 Scenarios Across 4 Feature Files

#### Space Management (11 scenarios)
- ✅ Creating spaces from windows (@core @smoke)
- ✅ Naming and renaming spaces
- ✅ Switching between multiple spaces
- ✅ Space persistence across restarts
- ✅ Closing and restoring spaces
- ✅ Search functionality
- ✅ Keyboard navigation
- ✅ Edge cases (50+ tabs)
- ✅ Name validation

#### Keyboard Navigation (12 scenarios)
- ✅ Complete keyboard flow (@keyboard @accessibility)
- ✅ Global hotkeys (Ctrl+Shift+S)
- ✅ Keyboard-driven search (/ key)
- ✅ F2 for editing
- ✅ Screen reader support
- ✅ Quick actions (R, S, Delete)
- ✅ Navigation wrap-around
- ✅ Vim-style navigation (optional)
- ✅ Multi-select with keyboard
- ✅ Focus trap in modals
- ✅ Shortcuts help overlay (?)
- ✅ Number key quick switch (1-9, 0)

#### Data Persistence (10 scenarios)
- ✅ Survives extension updates (@critical @persistence)
- ✅ Real-time sync between popups (@sync)
- ✅ Storage quota handling
- ✅ Migration from old versions
- ✅ Automatic backups (every 24 hours)
- ✅ Concurrent modification handling
- ✅ Corruption recovery
- ✅ Efficient loading (100 spaces)
- ✅ Local-only storage (@privacy)
- ✅ Automatic cleanup (30+ days)

#### Import/Export (12 scenarios)
- ✅ Export all spaces to JSON (@export @core)
- ✅ Import from JSON file (@import @core)
- ✅ File validation (JSON syntax, size, fields)
- ✅ Merge strategies (Merge/Replace/Rename)
- ✅ Selective import/export
- ✅ Export formats (JSON/Encrypted/Chrome)
- ✅ Template creation
- ✅ Auto-backup (every 7 days)
- ✅ Import history and rollback
- ✅ Drag and drop import
- ✅ Cloud sync (Google Drive)
- ✅ Partial export

## 🎯 Step Definition Patterns

### Common Patterns Used

```typescript
// Pattern 1: Data Tables
Given('I have multiple spaces:', async function(dataTable) {
  const spaces = dataTable.hashes(); // Array of objects
  // Process each row
});

// Pattern 2: String Parameters
When('I type {string} in the search field', async function(query: string) {
  await this.searchForSpace(query);
});

// Pattern 3: Integer Parameters
Then('I should see {int} items', async function(count: number) {
  const items = await this.page!.$$('[data-testid="space-item"]');
  expect(items.length).toBe(count);
});

// Pattern 4: Scenario Outlines
When('I try to rename it to {string}', async function(name: string) {
  // Parameterized test - runs multiple times with Examples
});
```

## 🛠️ Helper Functions Available

### ExtensionWorld Methods
```typescript
// Browser & Extension Setup
await this.openExtension()           // Launch Chrome with extension
await this.openPopup()                // Open extension popup
await this.openOptions()              // Open options page
await this.cleanup()                  // Clean up browser context

// Space Operations
await this.createMockSpace(name, urls)  // Create test space
await this.waitForSpaceItem(name)       // Wait for space to appear
await this.searchForSpace(query)        // Search for spaces
await this.getVisibleSpaces()           // Get list of visible spaces

// Data Storage
this.testData.set(key, value)        // Store test data
this.testData.get(key)               // Retrieve test data
this.testData.clear()                // Clear all test data
```

### Helper Utilities (support/helpers.ts)
```typescript
// Setup
setupExtensionContext(path): Promise<BrowserContext>
getExtensionId(context): Promise<string>
openPopup(context, extensionId): Promise<Page>
openOptions(context, extensionId): Promise<Page>

// Interactions
searchForSpace(page, query): Promise<void>
clickSpaceButton(page, spaceName, buttonText): Promise<void>
editSpaceName(page, currentName, newName): Promise<void>

// Queries
getVisibleSpaces(page): Promise<string[]>
getSpaceTabCount(page, spaceName): Promise<number>
isSpaceActive(page, spaceName): Promise<boolean>
isSpaceClosed(page, spaceName): Promise<boolean>

// Utilities
waitForStorageSync(page): Promise<void>
takeDebugScreenshot(page, name): Promise<Buffer>
clearExtensionData(page): Promise<void>
measurePerformance(page): Promise<number>
isInViewport(page, selector): Promise<boolean>
```

## 🐛 Common Issues & Solutions

### Issue: Extension not loading
```bash
Solution:
npm run build         # Rebuild extension
rm -rf build/         # Clean old build
npm run build         # Fresh build
```

### Issue: Tests timing out
```typescript
Solution: Increase timeouts
await this.page!.waitForSelector('.element', { timeout: 10000 });
```

### Issue: Flaky tests
```typescript
Solution: Replace waitForTimeout with specific waits
❌ await this.page!.waitForTimeout(1000);
✅ await this.page!.waitForSelector('.loaded');
```

### Issue: Element not found
```typescript
Solution: Add multiple selector options
const button = await this.page!.$(
  'button:has-text("Switch"), button[aria-label="Switch"]'
);
```

### Issue: Tests pass locally but fail in CI
```bash
Solution: Use headless mode matching
headless: process.env.CI ? true : false
```

## 📊 Performance Benchmarks

Target performance for scenarios:

- **@smoke tests**: < 30 seconds each
- **Popup load**: < 2 seconds (even with 100 spaces)
- **Search filter**: < 300ms response time
- **Real-time sync**: < 500ms between popups
- **Space switch**: < 100ms to trigger
- **Import/Export**: < 5 seconds for 100 spaces

## 🔍 Debugging Techniques

### 1. Run specific scenario
```bash
npx cucumber-js features/space-management.feature:11
```

### 2. Run with Playwright Inspector
```bash
PWDEBUG=1 npm run test:bdd
```

### 3. Take debug screenshots
```typescript
await this.page!.screenshot({ path: 'debug.png', fullPage: true });
```

### 4. Check console errors
```typescript
const errors = await getConsoleErrors(this.page!);
console.log('Console errors:', errors);
```

### 5. Inspect page state
```typescript
console.log('URL:', await this.page!.url());
console.log('Spaces:', await this.getVisibleSpaces());
console.log('Test data:', Array.from(this.testData.entries()));
```

## 📚 Resources

- [Cucumber.js Documentation](https://cucumber.io/docs/cucumber/)
- [Gherkin Syntax](https://cucumber.io/docs/gherkin/)
- [Playwright Documentation](https://playwright.dev/)
- [BDD Best Practices](https://cucumber.io/docs/bdd/)

## 🎉 Implementation Complete

All 45 scenarios across 4 feature files are now fully implemented with:
- ✅ Complete step definitions
- ✅ Comprehensive helpers
- ✅ Proper test isolation
- ✅ Screenshot on failure
- ✅ Performance monitoring
- ✅ Accessibility testing
- ✅ Real-world user workflows

Ready to run with: `npm run test:bdd`