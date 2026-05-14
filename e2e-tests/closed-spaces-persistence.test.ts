import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createMockSpace, setupExtensionState } from './helpers';

/**
 * Test that closed spaces are loaded from persisted storage after a browser restart.
 */
test.describe('Closed Spaces Persistence Test', () => {
  const pathToExtension = path.join(__dirname, '..', 'build');
  const userDataDir = path.join(__dirname, '..', '.test-user-data-closed-spaces');
  const closedSpaceId = 'closed-persistence-space';
  const closedSpaceName = 'Persistence Test Space';
  const closedSpaceUrls = [
    'https://closed-persistence-primary.invalid/',
    'https://closed-persistence-secondary.invalid/'
  ];

  const openPopup = async (context: BrowserContext, extensionId: string): Promise<Page> => {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForTimeout(500);
    return popup;
  };

  const readClosedSpaces = async (popup: Page) => {
    return popup.evaluate(async () => {
      const response = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });
      return {
        closedSpacesCount: Object.keys(response.closedSpaces || {}).length,
        closedSpaceIds: Object.keys(response.closedSpaces || {}),
        closedSpaceNames: Object.values(response.closedSpaces || {}).map((space: any) => space.name),
        storage: JSON.stringify(response, null, 2).slice(0, 2000)
      };
    });
  };

  const launchContext = async (): Promise<{ context: BrowserContext; extensionId: string }> => {
    const context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox'
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }

    const extensionId = background.url().split('/')[2];
    console.log(`[Test] Extension loaded: ${extensionId}`);
    return { context, extensionId };
  };

  test('closed spaces should be saved and persist', async () => {
    await fs.rm(userDataDir, { recursive: true, force: true });

    // ========== STEP 1: Seed a closed space ==========
    console.log('[Test] Step 1: Seeding closed space');
    let { context, extensionId } = await launchContext();
    let popup = await openPopup(context, extensionId);

    const testSpace = createMockSpace(closedSpaceId, closedSpaceName, closedSpaceUrls);
    await setupExtensionState(popup, { closedSpaces: { [closedSpaceId]: testSpace } });
    await popup.reload();
    await popup.waitForLoadState('domcontentloaded');

    // ========== STEP 2: Verify closed space is in storage ==========
    console.log('[Test] Step 2: Verifying closed space in storage');
    const storageBeforeRestart = await readClosedSpaces(popup);

    console.log('[Test] Storage before restart:', storageBeforeRestart);
    expect(storageBeforeRestart.closedSpaceIds).toContain(closedSpaceId);
    expect(storageBeforeRestart.closedSpaceNames).toContain(closedSpaceName);

    await popup.close();

    // ========== STEP 3: Restart browser ==========
    console.log('[Test] Step 3: Restarting browser');
    await context.close();

    ({ context, extensionId } = await launchContext());
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ========== STEP 4: Verify closed space persisted ==========
    console.log('[Test] Step 4: Verifying closed space persisted');
    popup = await openPopup(context, extensionId);
    const storageAfterRestart = await readClosedSpaces(popup);

    console.log('[Test] Storage after restart:', storageAfterRestart);
    expect(storageAfterRestart.closedSpacesCount).toBe(storageBeforeRestart.closedSpacesCount);
    expect(storageAfterRestart.closedSpaceIds).toContain(closedSpaceId);
    expect(storageAfterRestart.closedSpaceNames).toContain(closedSpaceName);

    console.log(`[Test] ✅ Closed space "${closedSpaceName}" persisted across restart`);

    await popup.close();
    await context.close();
    await fs.rm(userDataDir, { recursive: true, force: true });
  });
});
