import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';

test.describe('Space Name Persistence E2E Tests', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeEach(async () => {
    // Launch browser with extension
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=./build',
        '--load-extension=./build',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    // Get extension ID from service worker (Manifest V3)
    let serviceWorker = context.serviceWorkers()[0];
    if (!serviceWorker) {
      serviceWorker = await context.waitForEvent('serviceworker');
    }
    
    extensionId = serviceWorker.url().split('/')[2];
    console.log('Extension ID:', extensionId);
  });

  test.afterEach(async () => {
    await context.close();
  });

  // Helper function to open extension popup
  async function openExtensionPopup(): Promise<Page> {
    // Create a new page and navigate directly to the extension popup
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(1000); // Wait for extension to initialize
    return page;
  }

  test('should persist space name edits across Chrome restarts', async () => {
    // Step 1: Create a new window that will become a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    // Step 2: Open extension popup
    let popup = await openExtensionPopup();
    
    // Step 3: Wait for space to appear and edit its name
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    
    // Find the space and enter edit mode
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    await expect(spaceItem).toBeVisible();
    
    // Double-click to enter edit mode (or click edit button if available)
    const editButton = spaceItem.locator('button:has-text("Edit")');
    if (await editButton.isVisible()) {
      await editButton.click();
    } else {
      // Try double-click on space name
      const spaceName = spaceItem.locator('.space-name');
      await spaceName.dblclick();
    }

    // Enter new name
    const nameInput = popup.locator('[data-testid="space-name-input"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill('My Custom Workspace');
    
    // Save the changes
    await nameInput.press('Enter');
    
    // Wait for save to complete
    await popup.waitForSelector('text=My Custom Workspace', { timeout: 5000 });
    
    // Verify the name was updated
    await expect(popup.locator('text=My Custom Workspace')).toBeVisible();

    // Step 4: Close popup
    await popup.close();

    // Step 5: Simulate Chrome restart by closing and reopening context
    const extensionPath = './build';
    await context.close();

    // Create new context (simulating Chrome restart)
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=' + extensionPath,
        '--load-extension=' + extensionPath,
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    // Get new extension ID from service worker
    let newServiceWorker = context.serviceWorkers()[0];
    if (!newServiceWorker) {
      newServiceWorker = await context.waitForEvent('serviceworker');
    }
    
    extensionId = newServiceWorker.url().split('/')[2]; // Update global extensionId

    // Step 6: Open popup again and verify space name persisted
    popup = await openExtensionPopup();
    
    // Wait for spaces to load
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    
    // Verify the custom name persisted across restart
    await expect(popup.locator('text=My Custom Workspace')).toBeVisible({ timeout: 5000 });
  });

  test('should persist multiple space name edits', async () => {
    // Create multiple windows/spaces
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    const page2 = await context.newPage();
    await page2.goto('https://github.com');
    await page2.waitForLoadState('networkidle');

    const page3 = await context.newPage();
    await page3.goto('https://stackoverflow.com');
    await page3.waitForLoadState('networkidle');

    // Open popup and edit names
    const popup = await openExtensionPopup();
    
    // Wait for all spaces to load
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    
    const spaceItems = popup.locator('[data-testid="space-item"]');
    const spaceCount = await spaceItems.count();
    expect(spaceCount).toBeGreaterThanOrEqual(3);

    // Edit each space name
    const customNames = ['Development', 'Research', 'Documentation'];
    
    for (let i = 0; i < Math.min(3, spaceCount); i++) {
      const spaceItem = spaceItems.nth(i);
      
      // Enter edit mode
      const editButton = spaceItem.locator('button:has-text("Edit")');
      if (await editButton.isVisible()) {
        await editButton.click();
      } else {
        const spaceName = spaceItem.locator('.space-name');
        await spaceName.dblclick();
      }

      // Edit name
      const nameInput = popup.locator('[data-testid="space-name-input"]');
      await nameInput.fill(customNames[i]);
      await nameInput.press('Enter');
      
      // Wait for update
      await popup.waitForSelector(`text=${customNames[i]}`, { timeout: 3000 });
    }

    await popup.close();

    // Simulate restart
    await context.close();
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=./build',
        '--load-extension=./build',
        '--disable-web-security'
      ]
    });

    let newServiceWorker = context.serviceWorkers()[0];
    if (!newServiceWorker) {
      newServiceWorker = await context.waitForEvent('serviceworker');
    }
    extensionId = newServiceWorker.url().split('/')[2];

    // Verify all names persisted
    const newPopup = await openExtensionPopup();
    await newPopup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });

    for (const name of customNames) {
      await expect(newPopup.locator(`text=${name}`)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should handle space name edits for closed spaces', async () => {
    // Create a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    let popup = await openExtensionPopup();
    
    // Edit the space name first
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    
    // Enter edit mode and set custom name
    const editButton = spaceItem.locator('button:has-text("Edit")');
    if (await editButton.isVisible()) {
      await editButton.click();
    } else {
      await spaceItem.locator('.space-name').dblclick();
    }

    const nameInput = popup.locator('[data-testid="space-name-input"]');
    await nameInput.fill('Closed Space Test');
    await nameInput.press('Enter');
    
    // Wait for name update
    await popup.waitForSelector('text=Closed Space Test', { timeout: 5000 });

    // Close the space
    const closeButton = spaceItem.locator('button:has-text("Close")');
    if (await closeButton.isVisible()) {
      await closeButton.click();
    }

    await popup.close();

    // Close the actual window to create a closed space
    await page1.close();

    // Verify closed space appears with correct name
    popup = await openExtensionPopup();
    
    // Look for closed spaces section or toggle
    const closedSpacesToggle = popup.locator('button:has-text("Closed")');
    if (await closedSpacesToggle.isVisible()) {
      await closedSpacesToggle.click();
    }

    // Verify closed space has the custom name
    await expect(popup.locator('text=Closed Space Test')).toBeVisible({ timeout: 5000 });

    await popup.close();

    // Simulate restart
    await context.close();
    
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        '--disable-extensions-except=./build',
        '--load-extension=./build'
      ]
    });

    let newServiceWorker = context.serviceWorkers()[0];
    if (!newServiceWorker) {
      newServiceWorker = await context.waitForEvent('serviceworker');
    }
    extensionId = newServiceWorker.url().split('/')[2];

    // Verify closed space name persisted
    const newPopup = await openExtensionPopup();
    
    const newClosedSpacesToggle = newPopup.locator('button:has-text("Closed")');
    if (await newClosedSpacesToggle.isVisible()) {
      await newClosedSpacesToggle.click();
    }

    await expect(newPopup.locator('text=Closed Space Test')).toBeVisible({ timeout: 5000 });
  });

  test('should validate space name inputs', async () => {
    // Create a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    const popup = await openExtensionPopup();
    
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    
    // Enter edit mode
    const editButton = spaceItem.locator('button:has-text("Edit")');
    if (await editButton.isVisible()) {
      await editButton.click();
    } else {
      await spaceItem.locator('.space-name').dblclick();
    }

    const nameInput = popup.locator('[data-testid="space-name-input"]');
    
    // Test empty name (should revert or show error)
    await nameInput.fill('');
    await nameInput.press('Enter');
    
    // Should either show error or revert to original name
    // The exact behavior depends on validation implementation
    
    // Test very long name
    const longName = 'A'.repeat(100);
    await nameInput.fill(longName);
    await nameInput.press('Enter');
    
    // Should either truncate or show error
    
    // Test special characters
    await nameInput.fill('Test 🚀 Space!');
    await nameInput.press('Enter');
    
    // Should accept special characters
    await expect(popup.locator('text=Test 🚀 Space!')).toBeVisible({ timeout: 3000 });
  });

  test('should handle concurrent space name edits', async () => {
    // Create multiple spaces
    const pages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);

    await Promise.all([
      pages[0].goto('https://example.com'),
      pages[1].goto('https://github.com'),
      pages[2].goto('https://stackoverflow.com')
    ]);

    await Promise.all(pages.map(page => page.waitForLoadState('networkidle')));

    // Open multiple popups and edit concurrently
    const popup1 = await openExtensionPopup();
    const popup2 = await openExtensionPopup();

    // Edit different spaces in each popup simultaneously
    const editPromises = [
      // Popup 1 - edit first space
      (async () => {
        await popup1.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
        const spaceItem = popup1.locator('[data-testid="space-item"]').first();
        
        const editButton = spaceItem.locator('button:has-text("Edit")');
        if (await editButton.isVisible()) {
          await editButton.click();
        } else {
          await spaceItem.locator('.space-name').dblclick();
        }

        const nameInput = popup1.locator('[data-testid="space-name-input"]');
        await nameInput.fill('Concurrent Edit 1');
        await nameInput.press('Enter');
      })(),
      
      // Popup 2 - edit second space
      (async () => {
        await popup2.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
        const spaceItems = popup2.locator('[data-testid="space-item"]');
        const spaceItem = spaceItems.nth(1);
        
        const editButton = spaceItem.locator('button:has-text("Edit")');
        if (await editButton.isVisible()) {
          await editButton.click();
        } else {
          await spaceItem.locator('.space-name').dblclick();
        }

        const nameInput = popup2.locator('[data-testid="space-name-input"]');
        await nameInput.fill('Concurrent Edit 2');
        await nameInput.press('Enter');
      })()
    ];

    await Promise.all(editPromises);

    // Verify both edits succeeded
    await expect(popup1.locator('text=Concurrent Edit 1')).toBeVisible({ timeout: 5000 });
    await expect(popup2.locator('text=Concurrent Edit 2')).toBeVisible({ timeout: 5000 });
  });

  test('should maintain edit state across popup reopens', async () => {
    // Create a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    let popup = await openExtensionPopup();
    
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    
    // Enter edit mode
    const editButton = spaceItem.locator('button:has-text("Edit")');
    if (await editButton.isVisible()) {
      await editButton.click();
    } else {
      await spaceItem.locator('.space-name').dblclick();
    }

    // Verify edit mode is active
    const nameInput = popup.locator('[data-testid="space-name-input"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });

    // Close popup without saving
    await popup.close();

    // Reopen popup
    popup = await openExtensionPopup();
    
    // Edit mode should not persist (should be in display mode)
    await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
    await expect(popup.locator('[data-testid="space-name-input"]')).not.toBeVisible();
  });
});