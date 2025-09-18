import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

test.describe('Debug Popup', () => {
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

  test('debug popup content and test title editing bug fix', async () => {
    // Create a window to have a space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    // Open extension popup
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(2000); // Give time to load

    // Debug: What's actually in the popup?
    const bodyHTML = await popup.locator('body').innerHTML();
    console.log('=== POPUP HTML ===');
    console.log(bodyHTML);

    // Check for space items with different selectors
    const spaceItemsClassname = await popup.locator('.space-item').count();
    const spaceItemsTestId = await popup.locator('[data-testid="space-item"]').count();
    console.log(`Spaces found with .space-item: ${spaceItemsClassname}`);
    console.log(`Spaces found with [data-testid="space-item"]: ${spaceItemsTestId}`);

    // Check for any errors in console
    const logs: string[] = [];
    popup.on('console', (msg) => {
      if (msg.type() === 'error') {
        logs.push(`ERROR: ${msg.text()}`);
      }
    });

    await popup.waitForTimeout(1000);
    
    if (logs.length > 0) {
      console.log('=== CONSOLE ERRORS ===');
      logs.forEach(log => console.log(log));
    }

    // Try to find edit functionality
    const editButtons = await popup.locator('button').allTextContents();
    console.log('Available buttons:', editButtons);

    // Look for any space-related elements
    const spaceElements = await popup.locator('*').evaluateAll(elements => {
      return elements
        .filter(el => el.className && el.className.includes('space'))
        .map(el => ({
          tag: el.tagName,
          class: el.className,
          text: el.textContent?.substring(0, 50)
        }));
    });
    console.log('Space-related elements:', spaceElements);

    // Test basic title editing if any spaces found
    if (spaceItemsClassname > 0) {
      console.log('Testing with .space-item selector');
      
      // Look for any edit-related elements
      const editRelated = await popup.locator('*[class*="edit"], *[class*="name"]').allTextContents();
      console.log('Edit-related elements:', editRelated);

      // Try to double-click on space name to trigger edit mode
      const spaceName = popup.locator('.space-item h3').first();
      if (await spaceName.isVisible()) {
        console.log('Double-clicking space name...');
        await spaceName.dblclick();
        
        // Wait a moment to see if edit mode activates
        await popup.waitForTimeout(1000);
        
        // Check for edit input
        const editInput = popup.locator('input[class*="edit"], input[data-testid*="name"]');
        const editInputCount = await editInput.count();
        console.log(`Edit inputs found: ${editInputCount}`);
        
        if (editInputCount > 0) {
          console.log('✅ Edit mode activated successfully!');
          await editInput.fill('Debug Test Name');
          await editInput.press('Enter');
          
          // Check for the "Invalid message action" error we're trying to fix
          await popup.waitForTimeout(2000);
          console.log('Final console logs after save:', logs);
        } else {
          console.log('❌ Edit mode not activated');
        }
      }
    }
  });
}); 