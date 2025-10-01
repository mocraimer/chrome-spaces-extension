import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import {
  createChromeWindow,
  openExtensionPopup,
  waitForSpaceItems,
  getSpaceItems,
  renameSpace,
  getDiagnosticInfo
} from './test-helpers';

test.describe('Space Persistence - Fixed Tests', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');
  const userDataDir = path.join(__dirname, '..', '.test-user-data-persistence');

  test.beforeEach(async () => {
    // Launch with persistent user data directory
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Wait for extension to load
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    // Give extension time to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log(`[Test] Extension loaded: ${extensionId}`);
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should persist space name after closing and reopening browser', async () => {
    // Step 1: Create a Chrome window for testing
    console.log('[Test] Creating Chrome window...');
    const { windowId: window1Id } = await createChromeWindow(context, extensionId, 'https://example.com');
    console.log(`[Test] Created window: ${window1Id}`);

    // Wait for extension to track the window
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 2: Open popup and verify window is tracked
    let popup = await openExtensionPopup(context, extensionId);

    const diagnosticBefore = await getDiagnosticInfo(popup);
    console.log('[Test] Diagnostic before:', diagnosticBefore);

    // Wait for space item to appear
    await waitForSpaceItems(popup, 1, 10000);

    const spaceItems = await getSpaceItems(popup);
    const spaceCount = await spaceItems.count();
    console.log(`[Test] Found ${spaceCount} space(s)`);

    expect(spaceCount).toBeGreaterThanOrEqual(1);

    // Step 3: Rename the space
    console.log('[Test] Renaming space...');
    await renameSpace(popup, 0, 'Test Workspace Persistent');

    // Verify the name was set
    await expect(popup.locator('text=Test Workspace Persistent')).toBeVisible({ timeout: 5000 });
    console.log('[Test] Space renamed successfully');

    await popup.close();

    // Wait a bit for save operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Step 4: Close the browser context (simulating Chrome restart)
    console.log('[Test] Closing browser context (simulating restart)...');
    await context.close();

    // Step 5: Reopen browser context
    console.log('[Test] Reopening browser context...');
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Wait for extension to reload
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    // Give extension time to initialize and restore state
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log(`[Test] Extension reloaded: ${extensionId}`);

    // Step 6: Open popup and verify space name persisted
    popup = await openExtensionPopup(context, extensionId);

    const diagnosticAfter = await getDiagnosticInfo(popup);
    console.log('[Test] Diagnostic after:', diagnosticAfter);

    // Check if space name persisted
    const persistedName = popup.locator('text=Test Workspace Persistent');
    await expect(persistedName).toBeVisible({ timeout: 10000 });

    console.log('[Test] ✅ Space name persisted across browser restart!');
  });

  test('should persist multiple space names', async () => {
    // Create multiple Chrome windows
    console.log('[Test] Creating multiple Chrome windows...');
    const windows = [];
    windows.push(await createChromeWindow(context, extensionId, 'https://example.com'));
    windows.push(await createChromeWindow(context, extensionId, 'https://github.com'));
    windows.push(await createChromeWindow(context, extensionId, 'https://stackoverflow.com'));

    console.log(`[Test] Created ${windows.length} windows`);

    // Wait for extension to track them
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Open popup and rename each space
    const popup = await openExtensionPopup(context, extensionId);

    await waitForSpaceItems(popup, 3, 10000);

    const names = ['Development', 'Research', 'Documentation'];

    for (let i = 0; i < names.length; i++) {
      console.log(`[Test] Renaming space ${i} to "${names[i]}"...`);
      await renameSpace(popup, i, names[i]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Verify all names are set
    for (const name of names) {
      await expect(popup.locator(`text=${name}`)).toBeVisible();
    }

    console.log('[Test] All spaces renamed');
    await popup.close();

    // Wait for saves
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Restart
    console.log('[Test] Restarting browser...');
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

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verify all names persisted
    const newPopup = await openExtensionPopup(context, extensionId);

    for (const name of names) {
      await expect(newPopup.locator(`text=${name}`)).toBeVisible({ timeout: 10000 });
      console.log(`[Test] ✅ Space "${name}" persisted`);
    }
  });

  test('should handle rapid close/reopen cycles', async () => {
    // Create a window and name it
    await createChromeWindow(context, extensionId, 'https://example.com');
    await new Promise(resolve => setTimeout(resolve, 1000));

    let popup = await openExtensionPopup(context, extensionId);
    await waitForSpaceItems(popup, 1);
    await renameSpace(popup, 0, 'Rapid Test Space');
    await popup.close();

    // Perform 3 rapid restart cycles
    for (let cycle = 1; cycle <= 3; cycle++) {
      console.log(`[Test] Restart cycle ${cycle}/3`);

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

      let [background] = context.serviceWorkers();
      if (!background) {
        background = await context.waitForEvent('serviceworker', { timeout: 60000 });
      }
      extensionId = background.url().split('/')[2];

      await new Promise(resolve => setTimeout(resolve, 2000));

      popup = await openExtensionPopup(context, extensionId);
      await expect(popup.locator('text=Rapid Test Space')).toBeVisible({ timeout: 10000 });
      await popup.close();

      console.log(`[Test] ✅ Cycle ${cycle}: Space name still persisted`);
    }
  });
});