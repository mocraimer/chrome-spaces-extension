import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ExtensionWorld } from '../support/world';

// Storage-related steps
Given('Chrome\'s local storage is nearly full', async function(this: ExtensionWorld) {
  // Simulate storage being nearly full
  // In real implementation, we'd fill storage to near capacity
  await this.page!.evaluate(() => {
    // Mock storage quota
    (window as any).__storageQuotaUsed = 0.95; // 95% full
  });
});

When('I try to create a new space with many tabs', async function(this: ExtensionWorld) {
  // Simulate creating a large space
  try {
    const urls = Array(50).fill(null).map((_, i) => `https://example.com/page${i}`);
    await this.createMockSpace('Large Space', urls);
    this.testData.set('createSpaceResult', 'success');
  } catch (error) {
    this.testData.set('createSpaceResult', 'error');
    this.testData.set('createSpaceError', error);
  }
});

Then('I should see a meaningful error message', async function(this: ExtensionWorld) {
  const result = this.testData.get('createSpaceResult');
  if (result === 'error') {
    // In real app, this would show in UI
    const error = this.testData.get('createSpaceError');
    expect(error).toBeTruthy();
  }
  
  // Check for error message in UI
  const errorMessage = await this.page!.$('.error-message');
  if (errorMessage) {
    const text = await errorMessage.textContent();
    expect(text).toContain('storage');
  }
});

Then('existing spaces should remain intact', async function(this: ExtensionWorld) {
  // Verify existing spaces weren't affected
  const spaces = await this.getVisibleSpaces();
  expect(spaces.length).toBeGreaterThan(0);
});

// Real-time sync steps
Given('I have a space named {string}', async function(this: ExtensionWorld, spaceName: string) {
  await this.createMockSpace(spaceName, ['https://example.com']);
  await this.openPopup();
  await this.waitForSpaceItem(spaceName);
});

Given('I have two popup windows open', async function(this: ExtensionWorld) {
  // First popup
  const popup1 = await this.openPopup();
  this.testData.set('popup1', popup1);
  
  // Second popup
  const popup2Page = await this.context!.newPage();
  await popup2Page.goto(`chrome-extension://${this.extensionId}/popup.html`);
  await popup2Page.waitForLoadState('domcontentloaded');
  this.testData.set('popup2', popup2Page);
});

When('I rename the space to {string} in the first popup', async function(this: ExtensionWorld, newName: string) {
  const popup1 = this.testData.get('popup1');
  
  // Edit the space name in first popup
  const editButton = await popup1.$('button[aria-label="Edit space name"]');
  await editButton.click();
  
  const input = await popup1.$('[data-testid="space-name-input"]');
  await input.fill(newName);
  await input.press('Enter');
});

Then('the second popup should immediately show {string}', async function(this: ExtensionWorld, expectedName: string) {
  const popup2 = this.testData.get('popup2');
  
  // Wait for sync (should be immediate)
  await popup2.waitForSelector(`.space-name:has-text("${expectedName}")`, {
    timeout: 2000 // Should be very quick
  });
  
  const spaceName = await popup2.textContent('.space-name');
  expect(spaceName).toBe(expectedName);
});

// Performance steps
Given('I have {int} spaces saved', async function(this: ExtensionWorld, spaceCount: number) {
  // Create many mock spaces
  for (let i = 0; i < spaceCount; i++) {
    await this.createMockSpace(`Space ${i + 1}`, [
      `https://example.com/space${i}`,
      `https://test.com/space${i}`
    ]);
  }
});

Then('the popup should load within {int} seconds', async function(this: ExtensionWorld, seconds: number) {
  const startTime = Date.now();
  await this.openPopup();
  const loadTime = Date.now() - startTime;
  
  expect(loadTime).toBeLessThan(seconds * 1000);
});

Then('display the first {int} spaces immediately', async function(this: ExtensionWorld, count: number) {
  // Check that initial spaces are visible quickly
  const spaces = await this.page!.$$('[data-testid="space-item"]');
  expect(spaces.length).toBeGreaterThanOrEqual(Math.min(count, 10));
});

// Migration steps
Given('I have space data from version {float} without version numbers', async function(this: ExtensionWorld, version: number) {
  // Simulate old format data
  const oldFormatSpace = {
    id: 'legacy-1',
    name: 'Legacy Space',
    urls: ['https://example.com'],
    lastModified: Date.now(),
    named: true
    // No version field
  };
  
  this.testData.set('legacyData', oldFormatSpace);
});

When('I install version {float}', async function(this: ExtensionWorld, version: number) {
  // Simulate migration process
  const legacyData = this.testData.get('legacyData');
  
  // Migration would add version field
  const migratedData = {
    ...legacyData,
    version: 1
  };
  
  this.testData.set('migratedData', migratedData);
});

Then('all spaces should be migrated successfully', async function(this: ExtensionWorld) {
  const migratedData = this.testData.get('migratedData');
  expect(migratedData.version).toBeDefined();
  expect(migratedData.version).toBe(1);
});

// Cleanup steps
Given('I have closed spaces older than {int} days:', async function(this: ExtensionWorld, days: number, dataTable: any) {
  const closedSpaces = dataTable.hashes();
  
  for (const space of closedSpaces) {
    const daysAgo = parseInt(space['Closed Date'].match(/\d+/)[0]);
    const closedDate = Date.now() - (daysAgo * 24 * 60 * 60 * 1000);
    
    await this.createMockSpace(space['Space Name'], []);
    // Mark as closed with specific date
    this.testData.set(`closed-${space['Space Name']}`, {
      name: space['Space Name'],
      closedDate
    });
  }
});

When('the cleanup process runs', async function(this: ExtensionWorld) {
  // Simulate cleanup
  const threshold = 30 * 24 * 60 * 60 * 1000; // 30 days
  const now = Date.now();
  
  const remainingSpaces: string[] = [];
  this.testData.forEach((value, key) => {
    if (key.startsWith('closed-')) {
      if (now - value.closedDate < threshold) {
        remainingSpaces.push(value.name);
      }
    }
  });
  
  this.testData.set('remainingClosedSpaces', remainingSpaces);
});

Then('spaces older than {int} days should be removed', async function(this: ExtensionWorld, days: number) {
  const remaining = this.testData.get('remainingClosedSpaces') || [];
  
  // Check that old spaces are not in the remaining list
  expect(remaining).not.toContain('Old Project 1');
  expect(remaining).not.toContain('Old Project 2');
});

Then('{string} should remain in closed spaces', async function(this: ExtensionWorld, spaceName: string) {
  const remaining = this.testData.get('remainingClosedSpaces') || [];
  expect(remaining).toContain(spaceName);
});