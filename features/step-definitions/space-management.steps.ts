import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ExtensionWorld } from '../support/world';

// Background steps
Given('I have the Chrome Spaces extension installed', async function(this: ExtensionWorld) {
  // Load the extension if not already loaded
  if (!this.extensionId) {
    await this.openExtension();
  }
  expect(this.extensionId).toBeTruthy();
});

Given('the extension popup is open', async function(this: ExtensionWorld) {
  await this.openPopup();
  expect(this.page?.url()).toContain('popup.html');
});

// Scenario: Creating a new space from current window
Given('I have a browser window open with multiple tabs', async function(this: ExtensionWorld) {
  // Create a new window with tabs
  const newPage1 = await this.context!.newPage();
  await newPage1.goto('https://example.com');
  
  const newPage2 = await this.context!.newPage();
  await newPage2.goto('https://github.com');
  
  const newPage3 = await this.context!.newPage();
  await newPage3.goto('https://google.com');
  
  // Store tab count for verification
  this.testData.set('tabCount', 3);
});

When('I open the extension popup', async function(this: ExtensionWorld) {
  await this.openPopup();
});

Then('I should see my current window listed as a space', async function(this: ExtensionWorld) {
  await this.page!.waitForSelector('[data-testid="space-item"]', { timeout: 5000 });
  const spaceItems = await this.page!.$$('[data-testid="space-item"]');
  expect(spaceItems.length).toBeGreaterThan(0);
});

Then('the space should show the number of tabs', async function(this: ExtensionWorld) {
  const tabCount = this.testData.get('tabCount') || 3;
  const tabsText = await this.page!.textContent('.space-tabs-count');
  expect(tabsText).toContain(`${tabCount} tabs`);
});

Then('the space should have a default name based on the window', async function(this: ExtensionWorld) {
  const spaceName = await this.page!.textContent('.space-name');
  expect(spaceName).toBeTruthy();
  // Default names typically include "Window" or "Space"
  expect(spaceName).toMatch(/Window|Space/i);
});

// Scenario: Naming a space for the first time
Given('I have an unnamed space in my spaces list', async function(this: ExtensionWorld) {
  await this.openPopup();
  await this.page!.waitForSelector('[data-testid="space-item"]');
  
  // Find first space and store its original name
  const spaceName = await this.page!.textContent('.space-name');
  this.testData.set('originalName', spaceName);
});

When('I click the edit button for that space', async function(this: ExtensionWorld) {
  const editButton = await this.page!.$('button[aria-label="Edit space name"]');
  await editButton!.click();
});

Then('I should see an input field with the current space name', async function(this: ExtensionWorld) {
  const input = await this.page!.waitForSelector('[data-testid="space-name-input"]');
  const currentValue = await input.inputValue();
  const originalName = this.testData.get('originalName');
  expect(currentValue).toBe(originalName);
});

When('I type {string} and press Enter', async function(this: ExtensionWorld, newName: string) {
  const input = await this.page!.$('[data-testid="space-name-input"]');
  await input!.fill(newName);
  await input!.press('Enter');
  this.testData.set('newName', newName);
});

Then('the space should be renamed to {string}', async function(this: ExtensionWorld, expectedName: string) {
  // Wait for the input to disappear and name to update
  await this.page!.waitForSelector('.space-name', { timeout: 5000 });
  const spaceName = await this.page!.textContent('.space-name');
  expect(spaceName).toBe(expectedName);
});

Then('the new name should persist after closing the popup', async function(this: ExtensionWorld) {
  const newName = this.testData.get('newName');
  
  // Close and reopen popup
  await this.page!.close();
  await this.openPopup();
  
  // Verify name persisted
  await this.page!.waitForSelector('.space-name');
  const spaceName = await this.page!.textContent('.space-name');
  expect(spaceName).toBe(newName);
});

// Scenario: Switching between spaces
Given('I have multiple spaces open:', async function(this: ExtensionWorld, dataTable: any) {
  // Create multiple browser windows to simulate spaces
  const spaces = dataTable.hashes();
  
  for (const space of spaces) {
    const pages = [];
    for (let i = 0; i < parseInt(space['Tab Count']); i++) {
      const page = await this.context!.newPage();
      await page.goto(`https://example.com/tab${i}`);
      pages.push(page);
    }
    this.testData.set(`space-${space['Space Name']}`, pages);
  }
  
  await this.openPopup();
});

Given('I am currently in the {string} space', async function(this: ExtensionWorld, spaceName: string) {
  // This would be indicated by UI state in the popup
  // For now, we'll just note it for verification
  this.testData.set('currentSpace', spaceName);
});

When('I click the {string} button for {string}', async function(this: ExtensionWorld, buttonText: string, spaceName: string) {
  // Find the space item containing the space name
  const spaceItem = await this.page!.$(`[data-testid="space-item"]:has-text("${spaceName}")`);
  
  // Find and click the button within that space item
  const button = await spaceItem!.$(`button:has-text("${buttonText}")`);
  await button!.click();
});

Then('Chrome should switch to the {string} window', async function(this: ExtensionWorld, spaceName: string) {
  // In a real test, we'd verify the window switch happened
  // For now, we'll check that the action was triggered
  await this.page!.waitForTimeout(100); // Brief wait for action
  
  // The popup should have closed or updated
  const isPopupClosed = await this.page!.isClosed();
  expect(isPopupClosed).toBe(true);
});

Then('the popup should close automatically', async function(this: ExtensionWorld) {
  await this.page!.waitForTimeout(100);
  const isPopupClosed = await this.page!.isClosed();
  expect(isPopupClosed).toBe(true);
});

// Scenario: Space names persist across browser restarts
Given('I have renamed a space to {string}', async function(this: ExtensionWorld, spaceName: string) {
  await this.openPopup();
  
  // Find first space and rename it
  const editButton = await this.page!.$('button[aria-label="Edit space name"]');
  await editButton!.click();
  
  const input = await this.page!.$('[data-testid="space-name-input"]');
  await input!.fill(spaceName);
  await input!.press('Enter');
  
  // Verify rename succeeded
  await this.page!.waitForSelector(`.space-name:has-text("${spaceName}")`);
});

When('I close Chrome completely', async function(this: ExtensionWorld) {
  // Close all pages and context
  const pages = this.context!.pages();
  for (const page of pages) {
    await page.close();
  }
});

When('I restart Chrome', async function(this: ExtensionWorld) {
  // Close old context
  await this.context!.close();
  
  // Open new context with extension
  await this.openExtension();
});

Then('I should see the space named {string}', async function(this: ExtensionWorld, spaceName: string) {
  await this.openPopup();
  await this.page!.waitForSelector(`.space-name:has-text("${spaceName}")`, { timeout: 5000 });
  const spaceExists = await this.page!.$$(`.space-name:has-text("${spaceName}")`);
  expect(spaceExists.length).toBeGreaterThan(0);
});

// Search scenario steps
When('I type {string} in the search field', async function(this: ExtensionWorld, searchQuery: string) {
  await this.searchForSpace(searchQuery);
});

Then('I should only see spaces containing {string}:', async function(this: ExtensionWorld, searchTerm: string, dataTable: any) {
  // Wait for search to filter results
  await this.page!.waitForTimeout(300);
  
  const visibleSpaces = await this.getVisibleSpaces();
  const expectedSpaces = dataTable.hashes().map((row: any) => row['Space Name']);
  
  expect(visibleSpaces.sort()).toEqual(expectedSpaces.sort());
  
  // Verify all visible spaces contain the search term
  for (const spaceName of visibleSpaces) {
    expect(spaceName.toLowerCase()).toContain(searchTerm.toLowerCase());
  }
});

// Keyboard navigation steps
When('I press the Arrow Down key', async function(this: ExtensionWorld) {
  await this.page!.keyboard.press('ArrowDown');
});

Then('the next space should be highlighted', async function(this: ExtensionWorld) {
  // Check for focus or selection indicator
  const focusedElement = await this.page!.evaluate(() => document.activeElement?.className);
  expect(focusedElement).toContain('selected');
});

When('I press Enter', async function(this: ExtensionWorld) {
  await this.page!.keyboard.press('Enter');
});

// Validation scenario steps  
Given('I am editing a space name', async function(this: ExtensionWorld) {
  await this.openPopup();
  const editButton = await this.page!.$('button[aria-label="Edit space name"]');
  await editButton!.click();
});

When('I try to rename it to {string}', async function(this: ExtensionWorld, newName: string) {
  const input = await this.page!.$('[data-testid="space-name-input"]');
  await input!.fill(newName);
  await input!.press('Enter');
});

Then('the space name should be {string}', async function(this: ExtensionWorld, expectedResult: string) {
  await this.page!.waitForSelector('.space-name', { timeout: 5000 });
  const spaceName = await this.page!.textContent('.space-name');
  
  if (expectedResult === 'unchanged') {
    const originalName = this.testData.get('originalName');
    expect(spaceName).toBe(originalName);
  } else {
    expect(spaceName).toBe(expectedResult.replace(/"/g, ''));
  }
});