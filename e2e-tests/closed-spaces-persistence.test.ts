import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';

/**
 * Test that closed spaces are properly saved and persist across restarts
 */
test.describe('Closed Spaces Persistence Test', () => {
  const pathToExtension = path.join(__dirname, '..', 'build');
  const userDataDir = path.join(__dirname, '..', '.test-user-data-closed-spaces');

  test('closed spaces should be saved and persist', async () => {
    let context: BrowserContext;
    let extensionId: string;

    // ========== STEP 1: Create windows ==========
    console.log('[Test] Step 1: Creating windows');
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];
    console.log(`[Test] Extension loaded: ${extensionId}`);

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create windows using extension popup
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    const windowIds = await popup1.evaluate(async () => {
      const win1 = await chrome.windows.create({ url: 'https://example.com', type: 'normal', focused: false });
      await new Promise(resolve => setTimeout(resolve, 500));
      const win2 = await chrome.windows.create({ url: 'https://github.com', type: 'normal', focused: false });
      await new Promise(resolve => setTimeout(resolve, 500));

      return [win1.id, win2.id];
    });

    console.log(`[Test] Created windows: ${windowIds.join(', ')}`);
    await popup1.close();

    // Wait for extension to register
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ========== STEP 2: Close windows explicitly (not context) ==========
    console.log('[Test] Step 2: Closing windows explicitly');
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');

    await popup2.evaluate(async ([wid1, wid2]) => {
      console.log(`[Test] Closing window ${wid1}`);
      await chrome.windows.remove(wid1);
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`[Test] Closing window ${wid2}`);
      await chrome.windows.remove(wid2);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }, windowIds);

    console.log('[Test] Windows closed, waiting for saves to complete');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ========== STEP 3: Verify closed spaces are in storage ==========
    console.log('[Test] Step 3: Verifying closed spaces in storage');
    const storageBeforeRestart = await popup2.evaluate(async () => {
      const storage = await chrome.storage.local.get(null);
      return {
        closedSpacesCount: Object.keys(storage.chrome_spaces?.closedSpaces || {}).length,
        closedSpaceIds: Object.keys(storage.chrome_spaces?.closedSpaces || {}),
        storage: JSON.stringify(storage, null, 2).slice(0, 2000)
      };
    });

    console.log('[Test] Storage before restart:', storageBeforeRestart);

    // Assert that closed spaces were saved
    expect(storageBeforeRestart.closedSpacesCount).toBeGreaterThan(0);
    console.log(`[Test] ✅ Found ${storageBeforeRestart.closedSpacesCount} closed spaces in storage`);

    await popup2.close();

    // ========== STEP 4: Restart browser ==========
    console.log('[Test] Step 4: Restarting browser');
    await context.close();

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    await new Promise(resolve => setTimeout(resolve, 3000));

    // ========== STEP 5: Verify closed spaces still in storage ==========
    console.log('[Test] Step 5: Verifying closed spaces persisted');
    const popup3 = await context.newPage();
    await popup3.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup3.waitForLoadState('domcontentloaded');

    const storageAfterRestart = await popup3.evaluate(async () => {
      const storage = await chrome.storage.local.get(null);
      return {
        closedSpacesCount: Object.keys(storage.chrome_spaces?.closedSpaces || {}).length,
        closedSpaceIds: Object.keys(storage.chrome_spaces?.closedSpaces || {}),
        storage: JSON.stringify(storage, null, 2).slice(0, 2000)
      };
    });

    console.log('[Test] Storage after restart:', storageAfterRestart);

    // Assert closed spaces persisted
    expect(storageAfterRestart.closedSpacesCount).toBeGreaterThan(0);
    expect(storageAfterRestart.closedSpacesCount).toBe(storageBeforeRestart.closedSpacesCount);

    console.log(`[Test] ✅ ${storageAfterRestart.closedSpacesCount} closed spaces persisted across restart!`);

    await popup3.close();
    await context.close();
  });
});