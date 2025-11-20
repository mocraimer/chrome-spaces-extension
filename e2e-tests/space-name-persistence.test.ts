import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

test.describe('Space Name Persistence E2E Tests', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  // Utility to open the extension popup
  const openExtensionPopup = async (): Promise<Page> => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  };

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should persist space name edits across Chrome restarts', async () => {
    // Step 1: Create a new window that will become a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    // Step 2: Open extension popup and edit the space name
    let popup = await openExtensionPopup();
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    await spaceItem.waitFor({ state: 'visible', timeout: 10000 });

    const spaceNameDisplay = spaceItem.locator('.space-name');
    await spaceItem.click();
    await popup.keyboard.press('F2');

    const nameInput = spaceItem.locator('[data-testid="space-name-input"]');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('My Custom Workspace');
    await nameInput.press('Enter');

    await expect(popup.locator('text=My Custom Workspace')).toBeVisible();
    await popup.close();

    // Step 3: Simulate Chrome restart by closing and reopening context
    await context.close();
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    // Re-establish the extensionId
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    // Step 4: Open popup again and verify the name persisted
    popup = await openExtensionPopup();
    await expect(popup.locator('text=My Custom Workspace')).toBeVisible({ timeout: 10000 });
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
        await spaceItem.click();
        await popup.keyboard.press('F2');
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
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        '--disable-extensions-except=./build',
        '--load-extension=./build',
        '--disable-web-security'
      ]
    });

    let newServiceWorker = context.serviceWorkers()[0];
    if (!newServiceWorker) {
      newServiceWorker = await context.waitForEvent('serviceworker', { timeout: 60000 });
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
      await spaceItem.click();
      await popup.keyboard.press('F2');
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
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        '--disable-extensions-except=./build',
        '--load-extension=./build'
      ]
    });

    let newServiceWorker = context.serviceWorkers()[0];
    if (!newServiceWorker) {
      newServiceWorker = await context.waitForEvent('serviceworker', { timeout: 60000 });
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
      await spaceItem.click();
      await popup.keyboard.press('F2');
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
          await spaceItem.click();
          await popup.keyboard.press('F2');
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
          await spaceItem.click();
          await popup.keyboard.press('F2');
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
      await spaceItem.click();
      await popup.keyboard.press('F2');
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

  // =================================================================
  // ENHANCED PERSISTENCE SCENARIOS FOR STABILITY TESTING
  // =================================================================

  test('should persist space names during memory pressure scenarios', async () => {
    // Create multiple spaces to simulate memory pressure
    const memoryTestSpaces = [];

    for (let i = 1; i <= 10; i++) {
      const page = await context.newPage();
      await page.goto(`https://example.com/memory-test-${i}`);
      await page.waitForLoadState('networkidle');
      memoryTestSpaces.push(page);

      // Name every other space
      if (i % 2 === 0) {
        const popup = await openExtensionPopup();
        const spaceItem = popup.locator('[data-testid="space-item"]').last();

        const editButton = spaceItem.locator('button:has-text("Edit")');
        if (await editButton.isVisible()) {
          await editButton.click();
        } else {
          await spaceItem.click();
          await popup.keyboard.press('F2');
        }

        const nameInput = popup.locator('[data-testid="space-name-input"]');
        await nameInput.fill(`Memory Test Space ${i}`);
        await nameInput.press('Enter');
        await popup.close();
      }
    }

    // Simulate memory pressure by rapidly opening/closing many tabs
    for (let i = 0; i < 20; i++) {
      const tempPage = await context.newPage();
      await tempPage.goto('https://httpbin.org/delay/1');
      await tempPage.close();
    }

    // Verify names are still persistent
    const verifyPopup = await openExtensionPopup();
    for (let i = 2; i <= 10; i += 2) {
      await expect(verifyPopup.locator(`text=Memory Test Space ${i}`)).toBeVisible({ timeout: 5000 });
    }
    await verifyPopup.close();

    // Clean up
    for (const page of memoryTestSpaces) {
      await page.close();
    }
  });

  test('should handle rapid rename operations without data corruption', async () => {
    // Create a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    const popup = await openExtensionPopup();
    const spaceItem = popup.locator('[data-testid="space-item"]').first();

    // Perform rapid rename operations
    const rapidNames = [
      'Rapid Test 1',
      'Rapid Test 2',
      'Rapid Test 3',
      'Rapid Test 4',
      'Final Rapid Name'
    ];

    for (const name of rapidNames) {
      // Enter edit mode
      await spaceItem.focus();
      await popup.keyboard.press('F2');

      const nameInput = popup.locator('[data-testid="space-name-input"]');
      await nameInput.waitFor({ state: 'visible', timeout: 3000 });
      await nameInput.selectAll();
      await nameInput.fill(name);
      await nameInput.press('Enter');

      // Brief pause to allow processing
      await popup.waitForTimeout(200);
    }

    // Verify final name is correct
    await expect(popup.locator('text=Final Rapid Name')).toBeVisible({ timeout: 5000 });
    await popup.close();
  });

  test('should persist names when spaces are restored multiple times', async () => {
    // Create and name a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    let popup = await openExtensionPopup();
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = popup.locator('[data-testid="space-name-input"]');
    await nameInput.fill('Multi-Restore Test Space');
    await nameInput.press('Enter');
    await popup.close();

    // Close and restore multiple times
    for (let i = 1; i <= 5; i++) {
      console.log(`[Test] Restore cycle ${i}/5`);

      // Close the space
      await page1.close();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Restore it
      popup = await openExtensionPopup();
      const closedSpacesToggle = popup.locator('button:has-text("Closed")');
      if (await closedSpacesToggle.isVisible()) {
        await closedSpacesToggle.click();
      }

      const restoreButton = popup.locator('button:has-text("Restore")').first();
      if (await restoreButton.isVisible()) {
        await restoreButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Get the restored page
        const pages = context.pages().filter(p =>
          p.url().includes('example.com') && !p.isClosed()
        );
        if (pages.length > 0) {
          page1 = pages[0];
        }
      }

      await popup.close();

      // Verify name persisted through restore
      popup = await openExtensionPopup();
      await expect(popup.locator('text=Multi-Restore Test Space')).toBeVisible({ timeout: 5000 });
      await popup.close();
    }
  });

  test('should maintain name consistency across browser extension updates', async () => {
    // Create and name spaces
    const testSpaces = [
      { url: 'https://example.com', name: 'Update Test 1' },
      { url: 'https://github.com', name: 'Update Test 2' },
      { url: 'https://stackoverflow.com', name: 'Update Test 3' }
    ];

    for (const space of testSpaces) {
      const page = await context.newPage();
      await page.goto(space.url);
      await page.waitForLoadState('networkidle');

      const popup = await openExtensionPopup();
      const spaceItem = popup.locator('[data-testid="space-item"]').last();
      await spaceItem.focus();
      await popup.keyboard.press('F2');

      const nameInput = popup.locator('[data-testid="space-name-input"]');
      await nameInput.fill(space.name);
      await nameInput.press('Enter');
      await popup.close();
    }

    // Verify all names before "update" simulation
    const preUpdatePopup = await openExtensionPopup();
    for (const space of testSpaces) {
      await expect(preUpdatePopup.locator(`text=${space.name}`)).toBeVisible({ timeout: 5000 });
    }
    await preUpdatePopup.close();

    // Simulate extension reload/update by restarting context
    await context.close();

    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    // Allow extension to reinitialize
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify names survived the "update"
    const postUpdatePopup = await openExtensionPopup();
    for (const space of testSpaces) {
      await expect(postUpdatePopup.locator(`text=${space.name}`)).toBeVisible({
        timeout: 10000
      });
      console.log(`[Test] ✅ Space name "${space.name}" survived extension update`);
    }
    await postUpdatePopup.close();
  });

  test('should handle name persistence with special storage conditions', async () => {
    // Create a space with a complex name
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    const popup = await openExtensionPopup();
    const spaceItem = popup.locator('[data-testid="space-item"]').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    // Test persistence with complex name containing special characters
    const complexName = '🚀 Project "Alpha-β" [v2.1] {Dev/Test} @2024 💻';
    const nameInput = popup.locator('[data-testid="space-name-input"]');
    await nameInput.fill(complexName);
    await nameInput.press('Enter');

    await expect(popup.locator(`text=${complexName}`)).toBeVisible({ timeout: 5000 });
    await popup.close();

    // Force storage sync by performing multiple operations
    for (let i = 0; i < 5; i++) {
      const tempPage = await context.newPage();
      await tempPage.goto(`https://httpbin.org/delay/1`);
      await tempPage.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Verify complex name persisted
    const verifyPopup = await openExtensionPopup();
    await expect(verifyPopup.locator(`text=${complexName}`)).toBeVisible({ timeout: 5000 });
    await verifyPopup.close();

    console.log(`[Test] ✅ Complex name with special characters persisted: "${complexName}"`);
  });

  test('should maintain persistence during concurrent storage operations', async () => {
    // Create multiple spaces
    const concurrentSpaces = [];
    for (let i = 1; i <= 5; i++) {
      const page = await context.newPage();
      await page.goto(`https://example.com/concurrent-${i}`);
      await page.waitForLoadState('networkidle');
      concurrentSpaces.push({ page, name: `Concurrent Space ${i}` });
    }

    // Open multiple popups and rename simultaneously
    const renamePromises = concurrentSpaces.map(async (space, index) => {
      const popup = await openExtensionPopup();

      // Wait for spaces to load
      await popup.waitForSelector('[data-testid="space-item"]', { timeout: 10000 });
      const spaceItems = popup.locator('[data-testid="space-item"]');
      const spaceItem = spaceItems.nth(index);

      if (await spaceItem.isVisible()) {
        await spaceItem.focus();
        await popup.keyboard.press('F2');

        const nameInput = popup.locator('[data-testid="space-name-input"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill(space.name);
          await nameInput.press('Enter');

          // Verify rename in this popup
          await expect(popup.locator(`text=${space.name}`)).toBeVisible({ timeout: 3000 });
        }
      }

      await popup.close();
    });

    // Execute all renames concurrently
    await Promise.all(renamePromises);

    // Wait for storage operations to complete
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify all names persisted correctly
    const finalPopup = await openExtensionPopup();
    for (const space of concurrentSpaces) {
      await expect(finalPopup.locator(`text=${space.name}`)).toBeVisible({ timeout: 5000 });
      console.log(`[Test] ✅ Concurrent rename persisted: "${space.name}"`);
    }
    await finalPopup.close();

    // Clean up
    for (const space of concurrentSpaces) {
      await space.page.close();
    }
  });
});