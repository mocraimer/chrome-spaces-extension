import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';
import { ExtensionWorld } from '../support/world';

// Shared steps used across multiple feature files

// Common navigation steps
When('When I navigate to the {string} page', async function(this: ExtensionWorld, pageName: string) {
  if (pageName.toLowerCase() === 'options') {
    await this.openOptions();
  } else if (pageName.toLowerCase() === 'popup') {
    await this.openPopup();
  }
});

// Common assertion steps
Then('I should see a {string} message', async function(this: ExtensionWorld, messageType: string) {
  const selector = `.${messageType}-message, .message.${messageType}`;
  await this.page!.waitForSelector(selector, { timeout: 5000 });
  const message = await this.page!.$(selector);
  expect(message).toBeTruthy();
});

Then('the {string} should be visible', async function(this: ExtensionWorld, elementDescription: string) {
  const selector = `[data-testid="${elementDescription}"], .${elementDescription}`;
  const element = await this.page!.$(selector);
  const isVisible = await element?.isVisible();
  expect(isVisible).toBe(true);
});

Then('the {string} should not be visible', async function(this: ExtensionWorld, elementDescription: string) {
  const selector = `[data-testid="${elementDescription}"], .${elementDescription}`;
  const element = await this.page!.$(selector);
  const isVisible = await element?.isVisible().catch(() => false);
  expect(isVisible).toBe(false);
});

// Common waiting steps
When('I wait for {int} second(s)', async function(this: ExtensionWorld, seconds: number) {
  await this.page!.waitForTimeout(seconds * 1000);
});

// Common interaction steps
When('I click the button labeled {string}', async function(this: ExtensionWorld, buttonLabel: string) {
  const button = await this.page!.$(`button:has-text("${buttonLabel}"), button[aria-label="${buttonLabel}"]`);
  expect(button).toBeTruthy();
  await button!.click();
});

When('I type {string} into {string}', async function(this: ExtensionWorld, text: string, fieldName: string) {
  const input = await this.page!.$(`input[name="${fieldName}"], input[placeholder="${fieldName}"], #${fieldName}`);
  expect(input).toBeTruthy();
  await input!.fill(text);
});

// Common verification steps
Then('I should see {string} in the page', async function(this: ExtensionWorld, text: string) {
  const content = await this.page!.textContent('body');
  expect(content).toContain(text);
});

Then('I should not see {string} in the page', async function(this: ExtensionWorld, text: string) {
  const content = await this.page!.textContent('body');
  expect(content).not.toContain(text);
});

// Common state verification
Then('the extension should be functioning normally', async function(this: ExtensionWorld) {
  // Verify popup can open
  await this.openPopup();
  const isLoaded = await this.page!.evaluate(() => document.readyState === 'complete');
  expect(isLoaded).toBe(true);
});

// Common error handling
Then('I should see an error', async function(this: ExtensionWorld) {
  const errorElement = await this.page!.$('.error, .error-message, [role="alert"]');
  expect(errorElement).toBeTruthy();
});

Then('I should not see any errors', async function(this: ExtensionWorld) {
  const errorElements = await this.page!.$$('.error, .error-message, [role="alert"]');
  expect(errorElements.length).toBe(0);
});

// Common keyboard interactions
When('I press the {string} key', async function(this: ExtensionWorld, keyName: string) {
  await this.page!.keyboard.press(keyName);
});

When('I press {string} and {string} together', async function(this: ExtensionWorld, modifier: string, key: string) {
  await this.page!.keyboard.down(modifier);
  await this.page!.keyboard.press(key);
  await this.page!.keyboard.up(modifier);
});

// Common space operations
Given('I have no spaces created', async function(this: ExtensionWorld) {
  // Clear any test data
  this.testData.clear();
  await this.openPopup();
});

Given('I have {int} space(s) created', async function(this: ExtensionWorld, count: number) {
  for (let i = 0; i < count; i++) {
    await this.createMockSpace(`Test Space ${i + 1}`, [`https://example.com/space${i}`]);
  }
});

// Common list operations
Then('I should see {int} item(s) in the list', async function(this: ExtensionWorld, expectedCount: number) {
  const items = await this.page!.$$('[data-testid="space-item"]');
  expect(items.length).toBe(expectedCount);
});

Then('the list should be empty', async function(this: ExtensionWorld) {
  const items = await this.page!.$$('[data-testid="space-item"]');
  expect(items.length).toBe(0);
});

Then('the list should not be empty', async function(this: ExtensionWorld) {
  const items = await this.page!.$$('[data-testid="space-item"]');
  expect(items.length).toBeGreaterThan(0);
});

// Common performance checks
Then('the operation should complete within {int} millisecond(s)', async function(this: ExtensionWorld, maxDuration: number) {
  const operationTime = this.testData.get('operationStartTime');
  if (operationTime) {
    const duration = Date.now() - operationTime;
    expect(duration).toBeLessThan(maxDuration);
  }
});

// Common browser checks
Then('no console errors should be present', async function(this: ExtensionWorld) {
  const errors = await this.page!.evaluate(() => {
    return (window as any).__consoleErrors || [];
  });
  expect(errors.length).toBe(0);
});

// Common storage checks
Then('data should be persisted', async function(this: ExtensionWorld) {
  // Close and reopen to verify persistence
  await this.page!.close();
  await this.openPopup();

  const items = await this.page!.$$('[data-testid="space-item"]');
  expect(items.length).toBeGreaterThan(0);
});

// Common UI state checks
Then('the UI should be in a {string} state', async function(this: ExtensionWorld, stateName: string) {
  const hasState = await this.page!.evaluate((state) => {
    return document.body.classList.contains(state) ||
           document.body.dataset.state === state;
  }, stateName);

  expect(hasState).toBeTruthy();
});

// Common loading checks
Then('a loading indicator should appear', async function(this: ExtensionWorld) {
  const loader = await this.page!.$('.loading, .spinner, [role="progressbar"]');
  expect(loader).toBeTruthy();
});

Then('the loading indicator should disappear', async function(this: ExtensionWorld) {
  await this.page!.waitForSelector('.loading, .spinner, [role="progressbar"]', {
    state: 'hidden',
    timeout: 5000
  });
});

// Common dialog interactions
When('I confirm the dialog', async function(this: ExtensionWorld) {
  const confirmButton = await this.page!.$('button:has-text("Confirm"), button:has-text("OK"), button:has-text("Yes")');
  await confirmButton!.click();
});

When('I cancel the dialog', async function(this: ExtensionWorld) {
  const cancelButton = await this.page!.$('button:has-text("Cancel"), button:has-text("No")');
  await cancelButton!.click();
});

// Common focus checks
Then('the {string} should have focus', async function(this: ExtensionWorld, elementId: string) {
  const focused = await this.page!.evaluate((id) => {
    return document.activeElement?.id === id ||
           document.activeElement?.getAttribute('data-testid') === id;
  }, elementId);

  expect(focused).toBe(true);
});

// Common text content checks
Then('the {string} should contain {string}', async function(this: ExtensionWorld, selector: string, expectedText: string) {
  const element = await this.page!.$(`.${selector}, #${selector}, [data-testid="${selector}"]`);
  const text = await element?.textContent();
  expect(text).toContain(expectedText);
});

// Common attribute checks
Then('the {string} should have attribute {string} with value {string}', async function(this: ExtensionWorld, selector: string, attribute: string, value: string) {
  const element = await this.page!.$(`.${selector}, #${selector}, [data-testid="${selector}"]`);
  const attrValue = await element?.getAttribute(attribute);
  expect(attrValue).toBe(value);
});

// Common class checks
Then('the {string} should have class {string}', async function(this: ExtensionWorld, selector: string, className: string) {
  const element = await this.page!.$(`.${selector}, #${selector}, [data-testid="${selector}"]`);
  const hasClass = await element?.evaluate((el, cls) => el.classList.contains(cls), className);
  expect(hasClass).toBe(true);
});

// Common count checks
Then('there should be exactly {int} {string}', async function(this: ExtensionWorld, count: number, elementType: string) {
  const elements = await this.page!.$$(`.${elementType}, [data-testid="${elementType}"]`);
  expect(elements.length).toBe(count);
});

Then('there should be at least {int} {string}', async function(this: ExtensionWorld, minCount: number, elementType: string) {
  const elements = await this.page!.$$(`.${elementType}, [data-testid="${elementType}"]`);
  expect(elements.length).toBeGreaterThanOrEqual(minCount);
});

Then('there should be at most {int} {string}', async function(this: ExtensionWorld, maxCount: number, elementType: string) {
  const elements = await this.page!.$$(`.${elementType}, [data-testid="${elementType}"]`);
  expect(elements.length).toBeLessThanOrEqual(maxCount);
});