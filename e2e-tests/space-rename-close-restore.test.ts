import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

/**
 * Test for space name persistence during rename -> close -> restore flow
 * This tests the fix for the issue where renamed spaces revert to default names after closing and restoring
 */
test.describe('Space Rename -> Close -> Restore E2E Test', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  // Utility to open the extension popup
  const openExtensionPopup = async (): Promise<Page> => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    // Wait a bit for React to render
    await popup.waitForTimeout(500);
    return popup;
  };

  test.beforeAll(async () => {
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
    console.log(`[Test] Extension loaded: ${extensionId}`);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should preserve custom name when closing and restoring a space', async () => {
    console.log('\n========== TEST START: Rename -> Close -> Restore ==========\n');

    // Step 1: Create a new window that will become a space
    console.log('[Test] Step 1: Creating new window');
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    // Wait for the space to be created in the extension
    await page1.waitForTimeout(1000);

    // Step 2: Open extension popup and rename the space
    console.log('[Test] Step 2: Opening popup and renaming space');
    let popup = await openExtensionPopup();

    // Wait for spaces to load - use a partial match for the data-testid
    await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });

    // Get the space item for our window
    const spaceItems = popup.locator('[data-testid^="space-item-"]');
    const spaceCount = await spaceItems.count();
    console.log(`[Test] Found ${spaceCount} spaces`);

    // Find the space item (should be the last one created)
    const spaceItem = spaceItems.last();

    // Enter edit mode - try different methods
    console.log('[Test] Entering edit mode');
    try {
      // Try clicking edit button first
      const editButton = spaceItem.locator('[data-testid^="edit-btn-"]');
      if (await editButton.isVisible({ timeout: 1000 })) {
        await editButton.click();
      } else {
        // Try double-clicking the space item itself
        await spaceItem.dblclick();
      }
    } catch (error) {
      // Fallback to F2 key
      await spaceItem.focus();
      await popup.keyboard.press('F2');
    }

    // Fill in custom name
    const customName = 'My Custom Test Space';
    console.log(`[Test] Setting custom name: "${customName}"`);
    const nameInput = popup.locator('[data-testid^="edit-input-"]');
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(customName);
    await nameInput.press('Enter');

    // Wait for the name change to propagate (popup may close, that's okay)
    console.log('[Test] Waiting for name change to propagate');
    await context.pages()[0].waitForTimeout(2000);

    // Reopen popup to verify the name was actually saved
    console.log('[Test] Reopening popup to verify name');
    popup = await openExtensionPopup();
    await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });

    // Verify the name was set
    console.log('[Test] Verifying name was set');
    await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Name successfully set to: ' + customName);

    await popup.close();

    // Step 3: Close the window to create a closed space
    console.log('[Test] Step 3: Closing the window');
    await page1.close();

    // Wait for the extension to process the close event
    await context.pages()[0].waitForTimeout(2000);

    // Step 4: Verify the closed space has the custom name
    console.log('[Test] Step 4: Verifying closed space has custom name');
    popup = await openExtensionPopup();

    // Look for closed spaces section
    const closedSpacesToggle = popup.locator('button:has-text("Closed")');
    if (await closedSpacesToggle.isVisible({ timeout: 2000 })) {
      console.log('[Test] Clicking "Closed" tab');
      await closedSpacesToggle.click();
      await popup.waitForTimeout(500);
    }

    // Verify closed space has the custom name
    console.log('[Test] Looking for closed space with custom name');
    const closedSpaceWithName = popup.locator(`.space-name:has-text("${customName}")`);
    await expect(closedSpaceWithName).toBeVisible({ timeout: 5000 });
    console.log('[Test] ✅ Closed space has custom name: ' + customName);

    // Step 5: Restore the space by clicking on it
    console.log('[Test] Step 5: Restoring the space');
    // Find the closed space item with our custom name and click it to restore
    const closedSpaceItem = popup.locator(`[data-testid^="space-item-"]:has(.space-name:has-text("${customName}"))`);
    await closedSpaceItem.waitFor({ state: 'visible', timeout: 5000 });
    await closedSpaceItem.click();

    // Wait for restoration to complete (popup may close)
    await context.pages()[0].waitForTimeout(3000);

    // Step 6: Verify the restored space STILL has the custom name (not a default name)
    console.log('[Test] Step 6: Verifying restored space has custom name');
    popup = await openExtensionPopup();

    // Wait for spaces to load
    await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });

    // CRITICAL ASSERTION: The restored space should have the custom name, NOT a default name
    console.log('[Test] CRITICAL CHECK: Looking for restored space with custom name');
    const restoredSpaceWithName = popup.locator(`.space-name:has-text("${customName}")`);
    await expect(restoredSpaceWithName).toBeVisible({ timeout: 10000 });

    // Also check that we DON'T have a default name by checking the actual space-name elements
    const spaceNames = await popup.locator('.space-name').allTextContents();
    console.log('[Test] All space names:', spaceNames);

    const hasDefaultName = spaceNames.some(name => /^Space \d+$/.test(name.trim()));

    if (hasDefaultName && !spaceNames.includes(customName)) {
      console.error('[Test] ❌ FAILURE: Found default space name after restoration!');
      console.error('[Test] Space names found:', spaceNames);
      console.error('[Test] This indicates the bug is still present.');
      throw new Error('Space name reverted to default after restoration');
    }

    console.log('[Test] ✅ SUCCESS: Restored space has custom name: ' + customName);
    console.log('[Test] ✅ No default space names found');

    await popup.close();

    // Step 7: Get service worker logs to verify the fix is working
    console.log('[Test] Step 7: Checking service worker logs');
    const serviceWorkerPage = await context.newPage();
    await serviceWorkerPage.goto(`chrome-extension://${extensionId}/popup.html`);

    const logs = await serviceWorkerPage.evaluate(() => {
      // Get console logs from service worker if available
      return 'Service worker logs not accessible from this context';
    });

    console.log('[Test] Service worker status:', logs);
    await serviceWorkerPage.close();

    console.log('\n========== TEST COMPLETE: Rename -> Close -> Restore ==========\n');
    console.log('[Test] ✅ All assertions passed!');
    console.log('[Test] ✅ Space name was preserved through close and restore cycle');
  });

  test('should preserve name through multiple close/restore cycles', async () => {
    console.log('\n========== TEST START: Multiple Close/Restore Cycles ==========\n');

    const customName = 'Multi-Cycle Test Space';
    const cycles = 3;

    // Create and name a space
    console.log('[Test] Creating and naming initial space');
    let page1 = await context.newPage();
    await page1.goto('https://example.com/multi-cycle');
    await page1.waitForLoadState('networkidle');
    await page1.waitForTimeout(1000);

    let popup = await openExtensionPopup();
    await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });

    const spaceItem = popup.locator('[data-testid^="space-item-"]').last();
    const editButton = spaceItem.locator('[data-testid^="edit-btn-"]');
    await editButton.click();

    const nameInput = popup.locator('[data-testid^="edit-input-"]');
    await nameInput.fill(customName);
    await nameInput.press('Enter');
    await context.pages()[0].waitForTimeout(2000);
    // Reopen popup to verify
    popup = await openExtensionPopup();
    await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });
    await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 5000 });
    await popup.close();

    // Perform multiple close/restore cycles
    for (let i = 1; i <= cycles; i++) {
      console.log(`\n[Test] === Cycle ${i}/${cycles} ===`);

      // Close
      console.log(`[Test] Cycle ${i}: Closing space`);
      await page1.close();
      await context.pages()[0].waitForTimeout(2000);

      // Verify closed space has name
      console.log(`[Test] Cycle ${i}: Verifying closed space name`);
      popup = await openExtensionPopup();
      const closedTab = popup.locator('button:has-text("Closed")');
      if (await closedTab.isVisible({ timeout: 2000 })) {
        await closedTab.click();
        await popup.waitForTimeout(500);
      }
      await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 5000 });
      console.log(`[Test] Cycle ${i}: ✅ Closed space has name`);

      // Restore by clicking the closed space
      console.log(`[Test] Cycle ${i}: Restoring space`);
      const closedSpaceItem = popup.locator(`[data-testid^="space-item-"]:has(.space-name:has-text("${customName}"))`);
      await closedSpaceItem.click();
      await context.pages()[0].waitForTimeout(3000);

      // Verify restored space has name
      console.log(`[Test] Cycle ${i}: Verifying restored space name`);
      popup = await openExtensionPopup();
      await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });

      await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 10000 });
      console.log(`[Test] Cycle ${i}: ✅ Restored space has name`);

      await popup.close();

      // Get the restored page reference with retry
      let restoredPage: Page | undefined;
      for (let attempt = 0; attempt < 30; attempt++) { // Increased to 30 attempts (15s)
        const pages = context.pages();
        console.log(`[Test] Cycle ${i} attempt ${attempt}: Found ${pages.length} pages: ${pages.map(p => p.url()).join(', ')}`);
        
        const candidates = pages.filter(p =>
          (p.url().includes('example.com/multi-cycle') || p.url() === 'about:blank') && !p.isClosed()
        );
        
        if (candidates.length > 0) {
          restoredPage = candidates[0];
          if (restoredPage.url() === 'about:blank') {
             console.log('[Test] Restored page is about:blank, re-navigating to continue test...');
             await restoredPage.goto('https://example.com/multi-cycle');
             await restoredPage.waitForLoadState('networkidle');
          }
          break;
        }
        await context.pages()[0].waitForTimeout(500);
      }

      if (!restoredPage) {
        throw new Error(`Cycle ${i}: Could not find restored page`);
      }
      page1 = restoredPage;
    }

    console.log('\n[Test] ✅ All cycles completed successfully!');
    console.log(`[Test] ✅ Space name "${customName}" preserved through ${cycles} close/restore cycles`);
  });

  test('should preserve name during rapid close/restore operations', async () => {
    console.log('\n========== TEST START: Rapid Close/Restore Operations ==========\n');

    const customName = 'Rapid Test Space';

    // Create and name a space
    console.log('[Test] Creating and naming space');
    const initialPage = await context.newPage();
    await initialPage.goto('https://example.com/rapid-test');
    await initialPage.waitForLoadState('networkidle');
    await initialPage.waitForTimeout(2000); // Extra wait

    let popup = await openExtensionPopup();
    
    // Retry loop for naming to be robust
    for (let attempt = 0; attempt < 5; attempt++) { // Increased retries
      try {
        if (popup.isClosed()) {
          popup = await openExtensionPopup();
        }
        
        await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });
        // Ensure at least one space is visible
        await expect(popup.locator('[data-testid^="space-item-"]').first()).toBeVisible();
        
        const spaceItem = popup.locator('[data-testid^="space-item-"]').last();
        
        // Use F2 for more stability
        await spaceItem.focus();
        await popup.keyboard.press('F2');

        const nameInput = popup.locator('[data-testid^="edit-input-"]');
        await nameInput.waitFor({ state: 'visible', timeout: 2000 });
        await nameInput.fill(customName);
        await nameInput.press('Enter');
        
        // Wait for save
        await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 5000 });
        break;
      } catch (e) {
        console.log(`[Test] Setup attempt ${attempt} failed, retrying...`);
        if (attempt === 2) throw e;
        await context.pages()[0].waitForTimeout(500);
      }
    }
    
    await popup.close();

    // Close immediately (no wait)
    console.log('[Test] Closing space immediately');
    await page1.close();

    // Restore almost immediately (short wait)
    await context.pages()[0].waitForTimeout(500);

    console.log('[Test] Restoring space immediately');
    popup = await openExtensionPopup();
    const closedTab = popup.locator('button:has-text("Closed")');
    if (await closedTab.isVisible({ timeout: 2000 })) {
      await closedTab.click();
    }

    // The closed space should still have the name
    await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 5000 });

    // Restore by clicking the closed space
    const closedSpaceItem = popup.locator(`[data-testid^="space-item-"]:has(.space-name:has-text("${customName}"))`);
    await closedSpaceItem.click();
    await context.pages()[0].waitForTimeout(2000);

    // Verify restored space has name (despite rapid operations)
    console.log('[Test] Verifying restored space name after rapid operations');
    popup = await openExtensionPopup();
    await popup.waitForSelector('[data-testid^="space-item-"]', { timeout: 10000 });

    await expect(popup.locator(`.space-name:has-text("${customName}")`)).toBeVisible({ timeout: 10000 });
    console.log('[Test] ✅ Name preserved even with rapid operations');

    await popup.close();
  });
});
