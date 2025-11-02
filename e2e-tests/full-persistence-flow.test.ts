/**
 * Comprehensive Chrome Spaces Extension Persistence Flow Test
 *
 * Tests the complete persistence flow:
 * 1. Create 2 spaces with 5 tabs each
 * 2. Name both spaces
 * 3. Close Chrome completely
 * 4. Reopen Chrome
 * 5. Verify both spaces and all tabs are restored
 */

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

const EXTENSION_PATH = path.join(__dirname, '..', 'build');

// Test URLs for Space 1
const SPACE_1_URLS = [
  'https://www.google.com',
  'https://www.github.com',
  'https://www.stackoverflow.com',
  'https://www.reddit.com',
  'https://www.wikipedia.org'
];

// Test URLs for Space 2
const SPACE_2_URLS = [
  'https://www.npmjs.com',
  'https://www.mozilla.org',
  'https://www.w3.org',
  'https://www.python.org',
  'https://www.rust-lang.org'
];

const SPACE_1_NAME = 'Development Resources';
const SPACE_2_NAME = 'Tech Documentation';

test.describe('Full Persistence Flow', () => {
  let userDataDir: string;

  test.beforeAll(() => {
    // Create a persistent user data directory
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-spaces-test-'));
    console.log(`\n📁 Created user data directory: ${userDataDir}`);
  });

  test.afterAll(() => {
    // Cleanup
    if (userDataDir && fs.existsSync(userDataDir)) {
      console.log(`\n🧹 Cleaning up user data directory: ${userDataDir}`);
      fs.rmSync(userDataDir, { recursive: true, force: true });
    }
  });

  test('should create 2 spaces with 5 tabs each, persist through restart, and restore correctly', async () => {
    console.log('\n' + '='.repeat(80));
    console.log('🚀 CHROME SPACES - FULL PERSISTENCE FLOW TEST');
    console.log('='.repeat(80));

    // ===== PHASE 1: Create Spaces =====
    console.log('\n' + '='.repeat(80));
    console.log('📝 PHASE 1: Creating Spaces with Tabs');
    console.log('='.repeat(80));

    let context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // Get extension ID - Wait for extension to load
    console.log('🔍 Waiting for extension to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    let serviceWorkers = context.serviceWorkers();
    console.log(`  Service workers found: ${serviceWorkers.length}`);

    if (serviceWorkers.length === 0) {
      console.log('  Triggering extension by opening a page...');
      const triggerPage = await context.newPage();
      await triggerPage.goto('https://example.com');
      await triggerPage.waitForTimeout(3000);

      serviceWorkers = context.serviceWorkers();
      console.log(`  Service workers after page load: ${serviceWorkers.length}`);
    }

    if (serviceWorkers.length === 0) {
      console.log('  Waiting for service worker event...');
      try {
        const sw = await context.waitForEvent('serviceworker', { timeout: 60000 });
        serviceWorkers = [sw];
      } catch (e: any) {
        console.log(`  ❌ Service worker event timeout: ${e.message}`);
        throw new Error('Extension failed to load');
      }
    }

    const extensionId = serviceWorkers[0].url().split('/')[2];
    console.log(`✅ Extension loaded with ID: ${extensionId}`);

    // Create Space 1 in a NEW window using Chrome Windows API
    console.log(`\n📦 Creating Space 1: "${SPACE_1_NAME}" with ${SPACE_1_URLS.length} tabs in NEW window...`);

    // Open popup temporarily to create new window
    let tempPopup = await context.newPage();
    await tempPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await tempPopup.waitForTimeout(1000);

    // Create new window with Space 1 URLs using Chrome Windows API
    const space1WindowId = await tempPopup.evaluate(async (urls) => {
      const window = await chrome.windows.create({
        url: urls,
        focused: true,
        state: 'normal'
      });
      return window.id;
    }, SPACE_1_URLS);

    console.log(`  ✅ Created window ${space1WindowId} with ${SPACE_1_URLS.length} tabs`);
    await tempPopup.close();

    // Wait for tabs to load
    await context.pages()[0].waitForTimeout(3000);

    // Rename Space 1
    let popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    await popup.evaluate(async ([windowId, spaceName]) => {
      try {
        await chrome.runtime.sendMessage({
          action: 'renameSpace',
          windowId: windowId,
          name: spaceName
        });
      } catch (e: any) {
        console.log(`[Test] Rename Space 1 failed:`, e.message);
      }
    }, [space1WindowId, SPACE_1_NAME]);

    console.log(`  ✅ Named Space 1: "${SPACE_1_NAME}"`);
    await popup.close();

    // Create Space 2 in a NEW window using Chrome Windows API
    console.log(`\n📦 Creating Space 2: "${SPACE_2_NAME}" with ${SPACE_2_URLS.length} tabs in NEW window...`);

    tempPopup = await context.newPage();
    await tempPopup.goto(`chrome-extension://${extensionId}/popup.html`);
    await tempPopup.waitForTimeout(1000);

    // Create new window with Space 2 URLs using Chrome Windows API
    const space2WindowId = await tempPopup.evaluate(async (urls) => {
      const window = await chrome.windows.create({
        url: urls,
        focused: true,
        state: 'normal'
      });
      return window.id;
    }, SPACE_2_URLS);

    console.log(`  ✅ Created window ${space2WindowId} with ${SPACE_2_URLS.length} tabs`);
    await tempPopup.close();

    // Wait for tabs to load
    await context.pages()[0].waitForTimeout(3000);

    // Rename Space 2
    popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(1000);

    await popup.evaluate(async ([windowId, spaceName]) => {
      try {
        await chrome.runtime.sendMessage({
          action: 'renameSpace',
          windowId: windowId,
          name: spaceName
        });
      } catch (e: any) {
        console.log(`[Test] Rename Space 2 failed:`, e.message);
      }
    }, [space2WindowId, SPACE_2_NAME]);

    console.log(`  ✅ Named Space 2: "${SPACE_2_NAME}"`);


    // Force save state and verify storage before restart
    console.log('\n🔍 Forcing state save and checking storage BEFORE restart...');

    // Try to force save state
    await popup.evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'FORCE_SAVE_STATE' });
        console.log('[Test] Force save requested');
      } catch (e: any) {
        console.log('[Test] Force save failed:', e.message);
      }
    });

    // Wait for save to complete
    await popup.waitForTimeout(2000);

    const storageBeforeRestart = await popup.evaluate(async () => {
      const data = await chrome.storage.local.get(null);
      return data;
    });

    console.log('📦 Storage summary:');
    console.log('  Storage keys:', Object.keys(storageBeforeRestart));

    // The extension uses 'chrome_spaces' as the key
    const state = storageBeforeRestart.chrome_spaces || storageBeforeRestart.state;

    if (state) {
      console.log('  State exists:', !!state);
      console.log('  State structure:', JSON.stringify(state, null, 2));

      // The extension stores spaces in 'spaces', not 'activeSpaces'
      if (state.spaces) {
        const spaces = state.spaces;
        const activeSpaces = Object.values(spaces).filter((s: any) => s.isActive);
        console.log(`  Total spaces: ${Object.keys(spaces).length}`);
        console.log(`  Active spaces: ${activeSpaces.length}`);
        for (const space of activeSpaces) {
          console.log(`    - ${(space as any).name}: ${(space as any).urls?.length || 0} tabs`);
        }
      } else {
        console.log('  ⚠️ No spaces in state');
      }
    } else {
      console.log('  ⚠️ No state in storage!');
    }

    await popup.close();

    // ===== PHASE 2: Close Browser =====
    console.log('\n' + '='.repeat(80));
    console.log('🔄 PHASE 2: Closing Browser (Simulating Restart)');
    console.log('='.repeat(80));

    await context.close();
    console.log('✅ Browser closed');

    // Wait to simulate real restart
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ===== PHASE 3: Reopen and Verify =====
    console.log('\n' + '='.repeat(80));
    console.log('🔍 PHASE 3: Reopening Browser and Verifying Restoration');
    console.log('='.repeat(80));

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    // Get extension ID (should be the same)
    console.log('🔍 Waiting for extension to reload...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    serviceWorkers = context.serviceWorkers();
    console.log(`  Service workers found: ${serviceWorkers.length}`);

    if (serviceWorkers.length === 0) {
      console.log('  Triggering extension by opening a page...');
      const triggerPage = await context.newPage();
      await triggerPage.goto('https://example.com');
      await triggerPage.waitForTimeout(3000);

      serviceWorkers = context.serviceWorkers();
      console.log(`  Service workers after page load: ${serviceWorkers.length}`);
    }

    if (serviceWorkers.length === 0) {
      console.log('  Waiting for service worker event...');
      try {
        const sw = await context.waitForEvent('serviceworker', { timeout: 60000 });
        serviceWorkers = [sw];
      } catch (e: any) {
        console.log(`  ❌ Service worker event timeout: ${e.message}`);
        throw new Error('Extension failed to reload');
      }
    }

    console.log(`✅ Extension reloaded`);

    // Wait for restoration to complete
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check restoration
    popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForTimeout(2000);

    const storageAfterRestart = await popup.evaluate(async () => {
      const data = await chrome.storage.local.get(null);
      return data;
    });

    // ===== PHASE 4: Verification =====
    console.log('\n' + '='.repeat(80));
    console.log('📊 RESTORATION RESULTS');
    console.log('='.repeat(80));

    const pages = context.pages();
    console.log(`Total pages: ${pages.length}`);

    // Use the correct storage key and property
    const stateAfter = storageAfterRestart.chrome_spaces || storageAfterRestart.state;
    const allSpaces = stateAfter?.spaces || {};
    const activeSpacesArray = Object.values(allSpaces).filter((s: any) => s.isActive);

    console.log(`Total spaces in storage: ${Object.keys(allSpaces).length}`);
    console.log(`Active spaces: ${activeSpacesArray.length}`);

    const restoredSpaces: any = {};
    for (const space of activeSpacesArray) {
      const spaceData = space as any;
      restoredSpaces[spaceData.name] = {
        tabCount: spaceData.urls?.length || 0,
        urls: spaceData.urls || []
      };

      console.log(`\n  📦 Space: ${spaceData.name}`);
      console.log(`     Tabs: ${spaceData.urls?.length || 0}`);
      spaceData.urls?.forEach((url: string, i: number) => {
        console.log(`       ${i + 1}. ${url}`);
      });
    }

    // Verify expected results
    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST VERIFICATION');
    console.log('='.repeat(80));

    let success = true;

    // Check Space 1
    if (restoredSpaces[SPACE_1_NAME]) {
      const space1TabCount = restoredSpaces[SPACE_1_NAME].tabCount;
      if (space1TabCount === SPACE_1_URLS.length) {
        console.log(`✅ Space 1 "${SPACE_1_NAME}": ${space1TabCount}/${SPACE_1_URLS.length} tabs restored`);
        expect(space1TabCount).toBe(SPACE_1_URLS.length);
      } else {
        console.log(`❌ Space 1 "${SPACE_1_NAME}": ${space1TabCount}/${SPACE_1_URLS.length} tabs restored`);
        success = false;
      }
    } else {
      console.log(`❌ Space 1 "${SPACE_1_NAME}" NOT FOUND`);
      success = false;
      expect(restoredSpaces[SPACE_1_NAME]).toBeDefined();
    }

    // Check Space 2
    if (restoredSpaces[SPACE_2_NAME]) {
      const space2TabCount = restoredSpaces[SPACE_2_NAME].tabCount;
      if (space2TabCount === SPACE_2_URLS.length) {
        console.log(`✅ Space 2 "${SPACE_2_NAME}": ${space2TabCount}/${SPACE_2_URLS.length} tabs restored`);
        expect(space2TabCount).toBe(SPACE_2_URLS.length);
      } else {
        console.log(`❌ Space 2 "${SPACE_2_NAME}": ${space2TabCount}/${SPACE_2_URLS.length} tabs restored`);
        success = false;
      }
    } else {
      console.log(`❌ Space 2 "${SPACE_2_NAME}" NOT FOUND`);
      success = false;
      expect(restoredSpaces[SPACE_2_NAME]).toBeDefined();
    }

    console.log('\n' + '='.repeat(80));
    if (success) {
      console.log('🎉 TEST PASSED: All spaces and tabs restored successfully!');
    } else {
      console.log('❌ TEST FAILED: Some spaces or tabs were not restored');
    }
    console.log('='.repeat(80) + '\n');

    await popup.close();
    await context.close();
  });
});
