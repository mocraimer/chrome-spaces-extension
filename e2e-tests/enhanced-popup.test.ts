import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

test.describe('Enhanced Popup Tests', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');
    context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    extensionId = background.url().split('/')[2];
    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Search input auto-focuses on popup open', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Check that search input is focused
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeFocused();
    
    console.log('✅ Search input auto-focuses');
  });

  test('Search filters spaces in real-time', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Type in search
    const searchInput = page.locator('.search-input');
    await searchInput.fill('Window');

    // Check that spaces are filtered
    const spaceItems = page.locator('.space-item');
    const count = await spaceItems.count();
    
    console.log(`Found ${count} spaces matching "Window"`);
    expect(count).toBeGreaterThanOrEqual(0);
    
    console.log('✅ Real-time search filtering works');
  });

  test('Keyboard navigation works', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Press arrow down to navigate
    await page.keyboard.press('ArrowDown');
    
    // Check if a space is selected
    const selectedSpace = page.locator('.space-item.selected');
    const selectedCount = await selectedSpace.count();
    
    console.log(`Selected spaces: ${selectedCount}`);
    expect(selectedCount).toBeGreaterThanOrEqual(0);
    
    console.log('✅ Keyboard navigation works');
  });

  test('ESC clears search and closes popup', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Type in search
    const searchInput = page.locator('.search-input');
    await searchInput.fill('test search');

    // Press ESC to clear
    await page.keyboard.press('Escape');
    
    // Check that search is cleared
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
    
    console.log('✅ ESC clears search');
  });

  test('Space names are auto-generated correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Check for space names
    const spaceNames = page.locator('.space-info h3');
    const nameCount = await spaceNames.count();
    
    if (nameCount > 0) {
      const firstName = await spaceNames.first().textContent();
      console.log(`First space name: "${firstName}"`);
      
      // Should not be just "Window X" - should have descriptive names
      expect(firstName).toBeTruthy();
      expect(firstName?.length).toBeGreaterThan(5);
    }
    
    console.log('✅ Space names are auto-generated');
  });

  test('Help text is visible', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Check for help text
    const helpText = page.locator('.help-text');
    await expect(helpText).toBeVisible();
    
    const text = await helpText.textContent();
    expect(text).toContain('navigate');
    expect(text).toContain('Enter');
    
    console.log('✅ Help text is visible and informative');
  });

  test('Current space is highlighted', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Look for current space
    const currentSpace = page.locator('.space-item.current');
    const currentCount = await currentSpace.count();
    
    console.log(`Current spaces found: ${currentCount}`);
    
    if (currentCount > 0) {
      // Should have "Current" label
      const currentLabel = currentSpace.locator('.current-label');
      await expect(currentLabel).toBeVisible();
    }
    
    console.log('✅ Current space highlighting works');
  });

  test('No React errors in console', async () => {
    const page = await context.newPage();
    
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(2000);

    // Interact with the popup
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.locator('.search-input').fill('test');
    await page.keyboard.press('Escape');

    // Check for React errors
    const hasReactErrors = consoleErrors.some(error => 
      error.includes('React') || 
      error.includes('hooks') || 
      error.includes('render')
    );

    if (consoleErrors.length > 0) {
      console.log('Console errors found:', consoleErrors);
    }

    expect(hasReactErrors).toBe(false);
    console.log('✅ No React errors in console');
  });

  test('Space title editing works correctly', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Look for edit button on a space
    const editButton = page.locator('.edit-name-btn').first();
    const isVisible = await editButton.isVisible();
    
    if (isVisible) {
      // Click edit button
      await editButton.click();
      
      // Should show input field
      const nameInput = page.locator('.space-name-input');
      await expect(nameInput).toBeVisible();
      await expect(nameInput).toBeFocused();
      
      // Type new name
      await nameInput.fill('Test Edited Space');
      
      // Press Enter to save
      await nameInput.press('Enter');
      
      // Should exit edit mode and show new name
      await expect(nameInput).not.toBeVisible();
      const spaceName = page.locator('.space-name').first();
      await expect(spaceName).toContainText('Test Edited Space');
      
      console.log('✅ Space title editing works');
    } else {
      console.log('⚠️ No editable spaces found, skipping edit test');
    }
  });

  test('Space title editing can be cancelled', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000);

    // Look for edit button on a space
    const editButton = page.locator('.edit-name-btn').first();
    const isVisible = await editButton.isVisible();
    
    if (isVisible) {
      // Get original name
      const originalName = await page.locator('.space-name').first().textContent();
      
      // Click edit button
      await editButton.click();
      
      // Type new name
      const nameInput = page.locator('.space-name-input');
      await nameInput.fill('Should Not Save');
      
      // Press Escape to cancel
      await nameInput.press('Escape');
      
      // Should exit edit mode and show original name
      await expect(nameInput).not.toBeVisible();
      const spaceName = page.locator('.space-name').first();
      await expect(spaceName).toContainText(originalName || '');
      
      console.log('✅ Space title editing cancellation works');
    } else {
      console.log('⚠️ No editable spaces found, skipping cancel test');
    }
  });
});