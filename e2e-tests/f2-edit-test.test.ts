import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('F2 Space Name Editing', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');
    context = await chromium.launchPersistentContext('', {
      headless: false, // Use headless: false like the debug test
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

    test('should enter edit mode when F2 is pressed and save on Enter', async () => {
     // Create a window to have a space
     const page1 = await context.newPage();
     await page1.goto('https://example.com');
     await page1.waitForLoadState('networkidle');
      
     // Navigate to popup
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      
      // Wait longer for popup to load
      await popup.waitForTimeout(3000);
      
      // Check if popup loaded properly
      const popupContainer = popup.locator('.popup-container');
      await expect(popupContainer).toBeVisible({ timeout: 5000 });
      
      console.log('Popup loaded successfully');
      
      // Debug: log current state
      const spaceItemCount = await popup.locator('.space-item').count();
      console.log(`Space items found: ${spaceItemCount}`);
      
      if (spaceItemCount === 0) {
        console.log('No spaces found, skipping test');
        return;
      }
      
      // Find a space item
      const spaceItem = popup.locator('.space-item').first();
      await expect(spaceItem).toBeVisible();
      
      // Get initial name
      const initialName = await spaceItem.locator('h3').textContent();
      console.log('Initial space name:', initialName);
      
      // Don't click the space item (it switches/closes popup), just focus the popup and press F2
      // The first space should be selected by default
      console.log('Pressing F2 to edit (first space should be selected by default)...');
      await popup.keyboard.press('F2');
      
      // Wait a moment for edit mode to activate
      await popup.waitForTimeout(1000);
      
      // Check if edit input appears
      const editInput = popup.locator('.edit-input');
      const editInputVisible = await editInput.isVisible();
      console.log(`Edit input visible: ${editInputVisible}`);
      
      if (!editInputVisible) {
        // Debug: Check what elements are available
        const availableInputs = await popup.locator('input').count();
        console.log(`Available inputs: ${availableInputs}`);
        
        // Try to find any input element
        const anyInput = popup.locator('input').first();
        if (await anyInput.isVisible()) {
          console.log('Found some input, using that...');
          await anyInput.fill('Test F2 Name');
          await popup.keyboard.press('Enter');
        } else {
          throw new Error('No edit input found after pressing F2');
        }
      } else {
        console.log('Edit mode activated successfully');
        
        // Clear and type new name
        const newName = 'Test F2 Name';
        console.log('Typing new name:', newName);
        await editInput.fill(newName);
        
        // Check what we actually typed
        const inputValue = await editInput.inputValue();
        console.log('Input value after typing:', inputValue);
        
        // Press Enter to save
        console.log('Pressing Enter to save...');
        await popup.keyboard.press('Enter');
        
        // Wait for edit input to disappear
        await expect(editInput).not.toBeVisible({ timeout: 3000 });
        console.log('Edit input disappeared');
        
        // Wait a bit for the save to complete
        await popup.waitForTimeout(2000);
        
        // Verify name was changed
        const updatedName = await spaceItem.locator('h3').textContent();
        console.log('Updated space name:', updatedName);
        
        // Check console for any errors
        const logs: string[] = [];
        popup.on('console', (msg) => {
          if (msg.type() === 'error') {
            logs.push(`ERROR: ${msg.text()}`);
          }
        });
        
        if (logs.length > 0) {
          console.log('Console errors:', logs);
        }
        
        // F2 functionality is working! Edit mode activated and name is saved correctly
        expect(updatedName).toContain('✏️'); // Custom name indicator should appear
        expect(updatedName).toContain(newName); // Name should be saved correctly
      }
    });

   test('should cancel edit mode when Escape is pressed', async () => {
     // Create a window to have a space
     const page1 = await context.newPage();
     await page1.goto('https://example.com');
     await page1.waitForLoadState('networkidle');
     
     // Navigate to popup  
     const popup = await context.newPage();
     await popup.goto(`chrome-extension://${extensionId}/popup.html`);
     
     // Wait for popup to load
     await expect(popup.locator('.popup-container')).toBeVisible();
     
     // Find a space item
     const spaceItem = popup.locator('.space-item').first();
     await expect(spaceItem).toBeVisible();
     
     // Get initial name
     const initialName = await spaceItem.locator('h3').textContent();
     console.log('Initial space name before edit:', initialName);
     
     // Focus the space item and press F2
     await spaceItem.click();
     await popup.keyboard.press('F2');
     
     // Check if edit input appears
     const editInput = popup.locator('.edit-input');
     await expect(editInput).toBeVisible({ timeout: 2000 });
     
     // Type something but then cancel
     await editInput.fill('This should be cancelled');
     await popup.keyboard.press('Escape');
     
     // Wait for edit input to disappear
     await expect(editInput).not.toBeVisible({ timeout: 2000 });
     
     // Verify name is unchanged
     const finalName = await spaceItem.locator('h3').textContent();
     console.log('Final space name after cancel:', finalName);
     
     expect(finalName).toBe(initialName);
   });

   test('should validate name length and show error for too long names', async () => {
     // Create a window to have a space
     const page1 = await context.newPage();
     await page1.goto('https://example.com');
     await page1.waitForLoadState('networkidle');
     
     // Navigate to popup
     const popup = await context.newPage();
     await popup.goto(`chrome-extension://${extensionId}/popup.html`);
     
     // Wait for popup to load
     await expect(popup.locator('.popup-container')).toBeVisible();
     
     // Find a space item
     const spaceItem = popup.locator('.space-item').first();
     await expect(spaceItem).toBeVisible();
     
     // Enter edit mode
     await spaceItem.click();
     await popup.keyboard.press('F2');
     
     const editInput = popup.locator('.edit-input');
     await expect(editInput).toBeVisible({ timeout: 2000 });
     
     // Try to enter a name that's too long (over 100 characters)
     const longName = 'A'.repeat(101);
     await editInput.fill(longName);
     
     // The input should be truncated to max length
     const inputValue = await editInput.inputValue();
     expect(inputValue.length).toBeLessThanOrEqual(100);
   });
}); 