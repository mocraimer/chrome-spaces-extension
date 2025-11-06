import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';

test.describe('Blank Slate Chrome Restart - Space Name Preservation', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  const launchBrowser = async () => {
    const newContext = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
        '--enable-logging=stderr',
        '--vmodule=*/browser/extensions/*=1',
        '--enable-service-worker-script-debugging',
      ],
    });

    let [background] = newContext.serviceWorkers();
    if (!background) {
      background = await newContext.waitForEvent('serviceworker', { timeout: 60000 });
    }
    
    const newExtensionId = background.url().split('/')[2];
    console.log(`[Test] Extension loaded with ID: ${newExtensionId}`);
    
    // Simple console logging for debugging
    newContext.on('page', page => {
      page.on('console', msg => console.log(`[PAGE] ${msg.text()}`));
    });

    return { context: newContext, extensionId: newExtensionId };
  };

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should preserve custom space name after blank slate restart', async () => {
    // Phase 1: Create window and name space
    ({ context, extensionId } = await launchBrowser());
    
    // Create a window with specific tabs
    const page1 = await context.newPage();
    await page1.goto('https://www.example.com');
    await page1.waitForLoadState('networkidle');
    
    const page2 = await context.newPage();
    await page2.goto('https://www.github.com');
    await page2.waitForLoadState('networkidle');

    // Give time for extension to register
    await page1.waitForTimeout(1000);

    // Open popup and name the space
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(2000);

    // Get the first space and name it
    const spaceItem = popup.locator('.space-item').first();
    await spaceItem.waitFor({ state: 'visible', timeout: 10000 });
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = spaceItem.locator('input.edit-input');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Work Project');
    await nameInput.press('Enter');

    // Verify the name was set
    await expect(popup.locator('h3:has-text("Work Project")')).toBeVisible();
    console.log('[Test] Space named successfully');

    // Force save state
    await popup.evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'FORCE_SAVE_STATE' });
        console.log('[Test] Forced state save');
      } catch (e) {
        console.log('[Test] Force save failed:', e);
      }
    });

    await popup.waitForTimeout(1000);
    await popup.close();
    await page1.close();
    await page2.close();

    // Phase 2: Simulate blank slate restart
    console.log('[Test] Closing browser context (blank slate restart)');
    await context.close();
    
    console.log('[Test] Reopening browser context');
    ({ context, extensionId } = await launchBrowser());

    // Give extension time to restore named spaces
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Phase 3: Verification
    console.log('[Test] Checking for restored space with preserved name');
    const newPopup = await context.newPage();
    await newPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopup.waitForTimeout(3000);

    // Verify "Work Project" name is preserved
    const hasNamedSpace = await newPopup.locator('h3:has-text("Work Project")').isVisible();
    console.log('[Test] Named space preserved:', hasNamedSpace);
    
    if (!hasNamedSpace) {
      // Debug: what spaces do we have?
      const spaceNames = await newPopup.locator('.space-item h3').allTextContents();
      console.log('[Test] Current space names:', spaceNames);
    }

    expect(hasNamedSpace).toBe(true);
    
    await newPopup.close();
  });

  test('should preserve multiple named spaces after restart', async () => {
    // Phase 1: Create 3 windows with custom names
    ({ context, extensionId } = await launchBrowser());

    const spaceNames = ['Development', 'Research', 'Personal'];
    const spaceUrls = [
      ['https://github.com', 'https://stackoverflow.com'],
      ['https://en.wikipedia.org', 'https://scholar.google.com'],
      ['https://news.ycombinator.com', 'https://reddit.com']
    ];

    for (let i = 0; i < spaceNames.length; i++) {
      // Create pages for this space
      for (const url of spaceUrls[i]) {
        const page = await context.newPage();
        await page.goto(url);
        await page.waitForLoadState('networkidle');
      }

      // Name the space
      const popup = await context.newPage();
      await popup.goto(`chrome-extension://${extensionId}/popup.html`);
      await popup.waitForTimeout(2000);

      const spaceItem = popup.locator('.space-item').last();
      await spaceItem.waitFor({ state: 'visible', timeout: 10000 });
      await spaceItem.focus();
      await popup.keyboard.press('F2');

      const nameInput = spaceItem.locator('input.edit-input');
      await nameInput.waitFor({ state: 'visible' });
      await nameInput.fill(spaceNames[i]);
      await nameInput.press('Enter');

      await popup.close();
      console.log(`[Test] Created and named space: ${spaceNames[i]}`);
    }

    // Force save
    const savePopup = await context.newPage();
    await savePopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await savePopup.evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'FORCE_SAVE_STATE' });
      } catch (e) {
        console.log('[Test] Force save failed:', e);
      }
    });
    await savePopup.close();

    // Close all pages
    const pages = context.pages();
    for (const page of pages) {
      await page.close().catch(() => {});
    }

    // Phase 2: Blank slate restart
    console.log('[Test] Restarting browser (blank slate)');
    await context.close();
    ({ context, extensionId } = await launchBrowser());

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Phase 3: Verify all 3 names preserved
    const newPopup = await context.newPage();
    await newPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopup.waitForTimeout(3000);

    let preservedCount = 0;
    for (const name of spaceNames) {
      const isVisible = await newPopup.locator(`h3:has-text("${name}")`).isVisible();
      if (isVisible) {
        preservedCount++;
        console.log(`[Test] ✅ Space "${name}" preserved`);
      } else {
        console.log(`[Test] ❌ Space "${name}" lost`);
      }
    }

    expect(preservedCount).toBe(spaceNames.length);
    
    await newPopup.close();
  });

  test('should preserve closed spaces through restart', async () => {
    // Phase 1: Create and name a space, then close it
    ({ context, extensionId } = await launchBrowser());

    const page1 = await context.newPage();
    await page1.goto('https://www.example.com');
    await page1.waitForLoadState('networkidle');

    await page1.waitForTimeout(1000);

    // Name the space
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(2000);

    const spaceItem = popup.locator('.space-item').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = spaceItem.locator('input.edit-input');
    await nameInput.fill('Archive Project');
    await nameInput.press('Enter');

    await popup.waitForTimeout(1000);

    // Close the space
    const closeButton = spaceItem.locator('button[title*="Close"]');
    await closeButton.click();

    await popup.waitForTimeout(1000);

    // Verify it's in closed spaces
    const closedSpaceVisible = await popup.locator('.closed-spaces h3:has-text("Archive Project")').isVisible();
    console.log('[Test] Space moved to closed spaces:', closedSpaceVisible);

    // Force save
    await popup.evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'FORCE_SAVE_STATE' });
      } catch (e) {
        console.log('[Test] Force save failed:', e);
      }
    });

    await popup.close();

    // Phase 2: Restart
    console.log('[Test] Restarting browser (blank slate)');
    await context.close();
    ({ context, extensionId } = await launchBrowser());

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Phase 3: Verify closed space still exists with name
    const newPopup = await context.newPage();
    await newPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopup.waitForTimeout(3000);

    const closedSpaceStillVisible = await newPopup.locator('.closed-spaces h3:has-text("Archive Project")').isVisible();
    console.log('[Test] Closed space preserved after restart:', closedSpaceStillVisible);

    expect(closedSpaceStillVisible).toBe(true);

    await newPopup.close();
  });

  test('should handle special characters in space names', async () => {
    // Phase 1: Create space with special characters
    ({ context, extensionId } = await launchBrowser());

    const page = await context.newPage();
    await page.goto('https://www.example.com');
    await page.waitForLoadState('networkidle');

    await page.waitForTimeout(1000);

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(2000);

    const spaceItem = popup.locator('.space-item').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = spaceItem.locator('input.edit-input');
    const specialName = 'Dev 🚀 [Test] & <Work>';
    await nameInput.fill(specialName);
    await nameInput.press('Enter');

    await popup.waitForTimeout(1000);

    // Verify special characters set correctly
    const nameSet = await popup.locator(`h3:has-text("${specialName}")`).isVisible();
    console.log('[Test] Special character name set:', nameSet);

    // Force save
    await popup.evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'FORCE_SAVE_STATE' });
      } catch (e) {
        console.log('[Test] Force save failed:', e);
      }
    });

    await popup.close();
    await page.close();

    // Phase 2: Restart
    console.log('[Test] Restarting browser (blank slate)');
    await context.close();
    ({ context, extensionId } = await launchBrowser());

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Phase 3: Verify special characters preserved
    const newPopup = await context.newPage();
    await newPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await newPopup.waitForTimeout(3000);

    const specialCharsPreserved = await newPopup.locator(`h3:has-text("${specialName}")`).isVisible();
    console.log('[Test] Special characters preserved:', specialCharsPreserved);

    if (!specialCharsPreserved) {
      const spaceNames = await newPopup.locator('.space-item h3').allTextContents();
      console.log('[Test] Current space names:', spaceNames);
    }

    expect(specialCharsPreserved).toBe(true);

    await newPopup.close();
  });
});

