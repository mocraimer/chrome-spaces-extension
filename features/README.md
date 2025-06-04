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
├── *.feature                    # Gherkin feature files
├── step-definitions/            # Step implementation in TypeScript
│   ├── space-management.steps.ts
│   ├── data-persistence.steps.ts
│   ├── keyboard-navigation.steps.ts
│   └── import-export.steps.ts
├── support/                     # Test setup and utilities
│   ├── world.ts                # Custom world with extension helpers
│   └── hooks.ts                # Before/After hooks
└── README.md                   # This file
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

## 📚 Resources

- [Cucumber.js Documentation](https://cucumber.io/docs/cucumber/)
- [Gherkin Syntax](https://cucumber.io/docs/gherkin/)
- [Playwright Documentation](https://playwright.dev/)
- [BDD Best Practices](https://cucumber.io/docs/bdd/)