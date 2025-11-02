import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';

/**
 * COMPREHENSIVE DIAGNOSTIC TEST FOR STATE PERSISTENCE ISSUES
 *
 * This test suite is designed to identify exactly where state is being lost:
 * 1. Runtime synchronization issues
 * 2. Service worker suspension issues
 * 3. Browser restart persistence issues
 */
test.describe('State Persistence Diagnostic Suite', () => {
  const pathToExtension = path.join(__dirname, '..', 'build');
  const userDataDir = path.join(__dirname, '..', '.test-user-data-diagnostic');
  const logFile = path.join(__dirname, '..', 'diagnostic-test-log.json');

  // Helper to log test state snapshots
  const logSnapshot = (stage: string, data: any) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${ timestamp}] ========== ${stage} ==========`);
    console.log(JSON.stringify(data, null, 2));

    // Also append to file for analysis
    const logEntry = { timestamp, stage, data };
    const logs = fs.existsSync(logFile)
      ? JSON.parse(fs.readFileSync(logFile, 'utf-8'))
      : [];
    logs.push(logEntry);
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
  };

  test.beforeAll(() => {
    // Clear previous diagnostic log
    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }
  });

  test('DIAGNOSTIC: Full state persistence lifecycle', async () => {
    let context: BrowserContext;
    let extensionId: string;
    const testData = {
      spaces: [
        { url: 'https://example.com', customName: 'Development Space' },
        { url: 'https://github.com', customName: 'Code Review Space' },
        { url: 'https://stackoverflow.com', customName: 'Research Space' }
      ]
    };

    // ========== PHASE 1: Initial Setup ==========
    console.log('\n\n🔧 PHASE 1: Initial Setup and Space Creation');
    logSnapshot('PHASE_1_START', { message: 'Starting browser context' });

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Wait for service worker
    let [background] = context.serviceWorkers();
    if (!background) {
      console.log('[Test] Waiting for service worker...');
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];
    logSnapshot('EXTENSION_LOADED', { extensionId });

    // Allow extension to initialize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Create windows and spaces
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    const createdWindows = await popup.evaluate(async (spaces) => {
      const windows = [];
      for (const space of spaces) {
        const win = await chrome.windows.create({
          url: space.url,
          type: 'normal',
          focused: false
        });
        windows.push({ windowId: win.id, url: space.url });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      return windows;
    }, testData.spaces);

    logSnapshot('WINDOWS_CREATED', { createdWindows });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ========== PHASE 2: Name Spaces ==========
    console.log('\n\n✏️ PHASE 2: Naming Spaces');

    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Get current state and assign names
    const namedSpaces = await popup2.evaluate(async (testSpaces) => {
      // Send rename messages to background
      const results = [];
      const response = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });

      console.log('[Popup] Current spaces response:', response);
      const spaces = response.spaces || {};

      // Try to match windows to spaces and rename
      for (let i = 0; i < testSpaces.length && i < Object.keys(spaces).length; i++) {
        const spaceId = Object.keys(spaces)[i];
        const space = spaces[spaceId];
        const newName = testSpaces[i].customName;

        if (!space.windowId) {
          console.log(`[Popup] Skipping space ${spaceId} - no windowId`);
          continue;
        }

        console.log(`[Popup] Renaming space ${spaceId} (window ${space.windowId}) to "${newName}"`);

        await chrome.runtime.sendMessage({
          action: 'renameSpace',
          windowId: space.windowId,
          name: newName
        });

        results.push({ spaceId, newName, windowId: space.windowId });

        // Wait between renames to avoid race conditions
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      return results;
    }, testData.spaces);

    logSnapshot('SPACES_RENAMED', { namedSpaces });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ========== PHASE 3: Verify Runtime State ==========
    console.log('\n\n✅ PHASE 3: Verify Runtime State');

    const runtimeState = await popup2.evaluate(async () => {
      const storage = await chrome.storage.local.get('chrome_spaces');
      const spacesFromBg = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });

      return {
        storageData: storage.chrome_spaces,
        backgroundState: spacesFromBg,
        activeSpacesCount: Object.keys(spacesFromBg.spaces || {}).length,
        closedSpacesCount: Object.keys(spacesFromBg.closedSpaces || {}).length,
        spaceNames: Object.entries(spacesFromBg.spaces || {}).map(([id, space]: [string, any]) => ({
          id,
          name: space.name,
          customName: space.customName,
          windowId: space.windowId
        }))
      };
    });

    logSnapshot('RUNTIME_STATE_CHECK', runtimeState);

    // Verify names are set in runtime
    // Note: activeSpacesCount may be higher than testData.spaces.length due to Playwright browser window
    expect(runtimeState.activeSpacesCount).toBeGreaterThanOrEqual(testData.spaces.length);
    const hasAllNames = testData.spaces.every(ts =>
      runtimeState.spaceNames.some((sn: any) => sn.customName === ts.customName)
    );
    expect(hasAllNames).toBe(true);
    console.log('✅ All custom names verified in runtime state');

    await popup2.close();

    // ========== PHASE 4: Close One Space (Test Closed Spaces) ==========
    console.log('\n\n🔒 PHASE 4: Close One Space');

    const popup3 = await context.newPage();
    await popup3.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup3.waitForLoadState('domcontentloaded');

    const closedSpaceInfo = await popup3.evaluate(async (createdWindows) => {
      const response = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });

      // Find one of the test windows to close (use the first created window)
      const windowToClose = createdWindows[0].windowId;
      const spaceId = windowToClose.toString();
      const space = response.spaces[spaceId];

      console.log(`[Test] Closing space: ${spaceId}`, space);

      // Close the window
      await chrome.windows.remove(windowToClose);
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get updated state
      const updatedSpaces = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });
      const storage = await chrome.storage.local.get('chrome_spaces');

      return {
        closedSpaceId: spaceId,
        closedSpaceName: space?.customName || space?.name,
        activeCount: Object.keys(updatedSpaces.spaces).length,
        closedCount: Object.keys(updatedSpaces.closedSpaces).length,
        storageClosedCount: Object.keys(storage.chrome_spaces?.closedSpaces || {}).length
      };
    }, createdWindows);

    logSnapshot('SPACE_CLOSED', closedSpaceInfo);
    expect(closedSpaceInfo.closedCount).toBeGreaterThan(0);
    expect(closedSpaceInfo.storageClosedCount).toBeGreaterThan(0);
    console.log('✅ Closed space tracked correctly');

    await popup3.close();
    await popup.close();

    // ========== PHASE 5: Final Pre-Restart Storage Snapshot ==========
    console.log('\n\n📸 PHASE 5: Final Storage Snapshot Before Restart');

    const popup4 = await context.newPage();
    await popup4.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup4.waitForLoadState('domcontentloaded');

    const preRestartSnapshot = await popup4.evaluate(async () => {
      const storage = await chrome.storage.local.get(null);
      return {
        fullStorage: storage,
        chromeSpaces: storage.chrome_spaces,
        activeSpaces: Object.entries(storage.chrome_spaces?.spaces || {}).map(([id, space]: [string, any]) => ({
          id,
          name: space.name,
          customName: space.customName,
          windowId: space.windowId,
          active: space.active
        })),
        closedSpaces: Object.entries(storage.chrome_spaces?.closedSpaces || {}).map(([id, space]: [string, any]) => ({
          id,
          name: space.name,
          customName: space.customName
        })),
        lastModified: storage.chrome_spaces?.lastModified,
        version: storage.chrome_spaces?.version
      };
    });

    logSnapshot('PRE_RESTART_STORAGE', preRestartSnapshot);
    await popup4.close();

    // ========== PHASE 6: Browser Restart Simulation ==========
    console.log('\n\n🔄 PHASE 6: Simulating Browser Restart');
    logSnapshot('BROWSER_CLOSING', { message: 'Closing browser context to trigger onSuspend' });

    await context.close();

    // Wait to ensure service worker fully terminates
    console.log('[Test] Waiting 5 seconds for service worker to fully terminate...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    logSnapshot('BROWSER_CLOSED', { message: 'Browser closed, reopening now' });

    // Reopen browser
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
      console.log('[Test] Waiting for service worker after restart...');
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    console.log('[Test] Waiting 3 seconds for extension to initialize...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // ========== PHASE 7: Post-Restart Verification ==========
    console.log('\n\n🔍 PHASE 7: Post-Restart State Verification');

    const popup5 = await context.newPage();
    await popup5.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup5.waitForLoadState('domcontentloaded');

    const postRestartSnapshot = await popup5.evaluate(async () => {
      const storage = await chrome.storage.local.get(null);
      const spacesFromBg = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });

      return {
        storageData: {
          activeSpaces: Object.entries(storage.chrome_spaces?.spaces || {}).map(([id, space]: [string, any]) => ({
            id,
            name: space.name,
            customName: space.customName,
            windowId: space.windowId,
            active: space.active
          })),
          closedSpaces: Object.entries(storage.chrome_spaces?.closedSpaces || {}).map(([id, space]: [string, any]) => ({
            id,
            name: space.name,
            customName: space.customName
          })),
          lastModified: storage.chrome_spaces?.lastModified,
          version: storage.chrome_spaces?.version
        },
        backgroundState: {
          activeSpaces: Object.entries(spacesFromBg.spaces || {}).map(([id, space]: [string, any]) => ({
            id,
            name: space.name,
            customName: space.customName,
            windowId: space.windowId
          })),
          closedSpaces: Object.entries(spacesFromBg.closedSpaces || {}).map(([id, space]: [string, any]) => ({
            id,
            name: space.name,
            customName: space.customName
          }))
        }
      };
    });

    logSnapshot('POST_RESTART_STORAGE', postRestartSnapshot);

    // ========== PHASE 8: Compare Pre/Post Restart ==========
    console.log('\n\n📊 PHASE 8: Comparing Pre/Post Restart State');

    const comparison = {
      activeSpaces: {
        before: preRestartSnapshot.activeSpaces.length,
        after: postRestartSnapshot.storageData.activeSpaces.length,
        match: preRestartSnapshot.activeSpaces.length === postRestartSnapshot.storageData.activeSpaces.length
      },
      closedSpaces: {
        before: preRestartSnapshot.closedSpaces.length,
        after: postRestartSnapshot.storageData.closedSpaces.length,
        match: preRestartSnapshot.closedSpaces.length === postRestartSnapshot.storageData.closedSpaces.length
      },
      customNames: {
        before: preRestartSnapshot.activeSpaces.map((s: any) => s.customName).filter(Boolean),
        after: postRestartSnapshot.storageData.activeSpaces.map((s: any) => s.customName).filter(Boolean),
        missingNames: [] as string[]
      }
    };

    // Check which custom names are missing
    for (const beforeName of comparison.customNames.before) {
      if (!comparison.customNames.after.includes(beforeName)) {
        comparison.customNames.missingNames.push(beforeName);
      }
    }

    logSnapshot('STATE_COMPARISON', comparison);

    // ========== PHASE 9: Assertions and Diagnosis ==========
    console.log('\n\n🎯 PHASE 9: Final Assertions');

    // Check if closed spaces persisted
    if (!comparison.closedSpaces.match) {
      console.error('❌ ISSUE FOUND: Closed spaces count mismatch!');
      console.error(`   Before: ${comparison.closedSpaces.before}, After: ${comparison.closedSpaces.after}`);
    } else {
      console.log('✅ Closed spaces count matches');
    }

    // Check if custom names persisted
    if (comparison.customNames.missingNames.length > 0) {
      console.error('❌ ISSUE FOUND: Custom names were lost!');
      console.error('   Missing names:', comparison.customNames.missingNames);
    } else {
      console.log('✅ All custom names persisted');
    }

    // Check storage vs background state consistency
    const storageVsBg = {
      activeCountMatch: postRestartSnapshot.storageData.activeSpaces.length ===
                         postRestartSnapshot.backgroundState.activeSpaces.length,
      closedCountMatch: postRestartSnapshot.storageData.closedSpaces.length ===
                         postRestartSnapshot.backgroundState.closedSpaces.length
    };

    logSnapshot('STORAGE_VS_BACKGROUND_CONSISTENCY', storageVsBg);

    if (!storageVsBg.activeCountMatch || !storageVsBg.closedCountMatch) {
      console.error('❌ ISSUE FOUND: Storage and background state are inconsistent!');
    } else {
      console.log('✅ Storage and background state are consistent');
    }

    // Main assertions
    expect(comparison.closedSpaces.match).toBe(true);
    expect(comparison.customNames.missingNames.length).toBe(0);
    expect(storageVsBg.activeCountMatch).toBe(true);
    expect(storageVsBg.closedCountMatch).toBe(true);

    console.log('\n\n🎉 DIAGNOSTIC TEST COMPLETE!');
    console.log(`   See detailed logs at: ${logFile}`);

    await popup5.close();
    await context.close();
  });

  test.skip('DIAGNOSTIC: Service worker suspension behavior', async () => {
    let context: BrowserContext;
    let extensionId: string;

    console.log('\n\n🔬 DIAGNOSTIC: Testing Service Worker Suspension');

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

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Add console listener to service worker
    background.on('console', msg => {
      console.log(`[ServiceWorker] ${msg.type()}: ${msg.text()}`);
    });

    // Create a space and name it
    await popup.evaluate(async () => {
      const win = await chrome.windows.create({ url: 'https://example.com' });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });
      const spaces = response.spaces || {};
      const spaceId = Object.keys(spaces)[0];
      const space = spaces[spaceId];

      if (space && space.windowId) {
        await chrome.runtime.sendMessage({
          action: 'renameSpace',
          windowId: space.windowId,
          name: 'Suspension Test Space'
        });
      }
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if onSuspend is registered
    const suspendHandlerInfo = await popup.evaluate(async () => {
      // Try to get background page context
      const bgPage = await chrome.runtime.getBackgroundPage?.();
      return {
        onSuspendHasListeners: chrome.runtime?.onSuspend?.hasListeners?.() || 'unknown',
        backgroundPageAvailable: !!bgPage
      };
    });

    logSnapshot('SUSPEND_HANDLER_CHECK', suspendHandlerInfo);

    await popup.close();

    // Force close to trigger onSuspend
    console.log('[Test] Closing context to trigger onSuspend...');
    await context.close();

    console.log('[Test] Service worker suspension test complete');
  });
});
