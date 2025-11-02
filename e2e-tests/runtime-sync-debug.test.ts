import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';

/**
 * RUNTIME SYNCHRONIZATION DIAGNOSTIC TEST
 *
 * Tests that state changes are properly synchronized across:
 * 1. Multiple popup instances
 * 2. Background service worker
 * 3. Storage layer
 *
 * This helps identify if the issue is with runtime sync or just persistence.
 */
test.describe('Runtime Synchronization Diagnostic Suite', () => {
  const pathToExtension = path.join(__dirname, '..', 'build');
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
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

    console.log(`[Setup] Extension loaded: ${extensionId}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('DIAGNOSTIC: Multi-popup state synchronization', async () => {
    console.log('\n\n🔄 TEST: Multi-popup state synchronization');

    // Create a space
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    const windowInfo = await popup1.evaluate(async () => {
      const win = await chrome.windows.create({
        url: 'https://example.com',
        type: 'normal',
        focused: false
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { windowId: win.id };
    });

    console.log('[Test] Created window:', windowInfo);
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Open second popup
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');
    await new Promise(resolve => setTimeout(resolve, 500));

    // Get initial state from both popups
    const initialState1 = await popup1.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      return {
        activeCount: Object.keys(spaces.active || {}).length,
        spaceIds: Object.keys(spaces.active || {})
      };
    });

    const initialState2 = await popup2.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      return {
        activeCount: Object.keys(spaces.active || {}).length,
        spaceIds: Object.keys(spaces.active || {})
      };
    });

    console.log('[Test] Popup1 initial state:', initialState1);
    console.log('[Test] Popup2 initial state:', initialState2);

    // Both popups should see the same state
    expect(initialState1.activeCount).toBe(initialState2.activeCount);
    console.log('✅ Both popups see same initial state');

    // ========== TEST 1: Rename from Popup1, verify in Popup2 ==========
    console.log('\n📝 TEST 1: Rename in Popup1, verify sync to Popup2');

    const spaceId = initialState1.spaceIds[0];
    const testName = 'Sync Test Space';

    await popup1.evaluate(async ({ sid, name }) => {
      console.log('[Popup1] Renaming space:', sid, 'to', name);
      await chrome.runtime.sendMessage({
        type: 'RENAME_SPACE',
        spaceId: sid,
        name: name
      });
      console.log('[Popup1] Rename message sent');
    }, { sid: spaceId, name: testName });

    // Wait for broadcast
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if Popup1 sees the change
    const popup1AfterRename = await popup1.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      return Object.values(spaces.active || {}).map((s: any) => s.customName);
    });

    console.log('[Popup1] After rename:', popup1AfterRename);

    // Check if Popup2 sees the change (this tests broadcast mechanism)
    const popup2AfterRename = await popup2.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      return Object.values(spaces.active || {}).map((s: any) => s.customName);
    });

    console.log('[Popup2] After rename:', popup2AfterRename);

    if (popup2AfterRename.includes(testName)) {
      console.log('✅ Rename synchronized to Popup2');
    } else {
      console.error('❌ ISSUE: Rename NOT synchronized to Popup2');
      console.error('   Popup1 names:', popup1AfterRename);
      console.error('   Popup2 names:', popup2AfterRename);
    }

    expect(popup2AfterRename).toContain(testName);

    // ========== TEST 2: Verify storage was updated ==========
    console.log('\n💾 TEST 2: Verify storage was updated');

    const storageAfterRename = await popup1.evaluate(async () => {
      const storage = await chrome.storage.local.get('chrome_spaces');
      return {
        activeSpaces: Object.entries(storage.chrome_spaces?.spaces || {}).map(([id, space]: [string, any]) => ({
          id,
          customName: space.customName,
          lastModified: storage.chrome_spaces?.lastModified
        }))
      };
    });

    console.log('[Storage] After rename:', storageAfterRename);

    const nameInStorage = storageAfterRename.activeSpaces.some(s => s.customName === testName);
    if (nameInStorage) {
      console.log('✅ Rename persisted to storage');
    } else {
      console.error('❌ ISSUE: Rename NOT persisted to storage');
      console.error('   Storage state:', storageAfterRename);
    }

    expect(nameInStorage).toBe(true);

    // ========== TEST 3: Close space from Popup2, verify in Popup1 ==========
    console.log('\n🔒 TEST 3: Close space in Popup2, verify sync to Popup1');

    await popup2.evaluate(async ({ wid }) => {
      console.log('[Popup2] Closing window:', wid);
      await chrome.windows.remove(wid);
    }, { wid: windowInfo.windowId });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check Popup1 sees the space as closed
    const popup1AfterClose = await popup1.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      return {
        activeCount: Object.keys(spaces.active || {}).length,
        closedCount: Object.keys(spaces.closed || {}).length,
        closedSpaceNames: Object.values(spaces.closed || {}).map((s: any) => s.customName)
      };
    });

    console.log('[Popup1] After close:', popup1AfterClose);

    if (popup1AfterClose.closedCount > 0) {
      console.log('✅ Space closure synchronized to Popup1');
    } else {
      console.error('❌ ISSUE: Space closure NOT synchronized to Popup1');
    }

    expect(popup1AfterClose.closedCount).toBeGreaterThan(0);

    // Verify closed space has the custom name
    if (popup1AfterClose.closedSpaceNames.includes(testName)) {
      console.log('✅ Closed space retained custom name');
    } else {
      console.error('❌ ISSUE: Closed space lost custom name');
      console.error('   Closed space names:', popup1AfterClose.closedSpaceNames);
    }

    expect(popup1AfterClose.closedSpaceNames).toContain(testName);

    await popup1.close();
    await popup2.close();
  });

  test('DIAGNOSTIC: Rapid state changes synchronization', async () => {
    console.log('\n\n⚡ TEST: Rapid state changes synchronization');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Create multiple spaces
    const windows = await popup.evaluate(async () => {
      const wins = [];
      for (let i = 1; i <= 5; i++) {
        const win = await chrome.windows.create({
          url: `https://example.com/page${i}`,
          type: 'normal',
          focused: false
        });
        wins.push(win.id);
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      return wins;
    });

    console.log('[Test] Created windows:', windows);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Rapidly rename all spaces
    console.log('[Test] Performing rapid renames...');
    const renameResults = await popup.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      const spaceIds = Object.keys(spaces.active || {});
      const results = [];

      for (let i = 0; i < spaceIds.length; i++) {
        const spaceId = spaceIds[i];
        const name = `Rapid Test ${i + 1}`;

        await chrome.runtime.sendMessage({
          type: 'RENAME_SPACE',
          spaceId: spaceId,
          name: name
        });

        results.push({ spaceId, name });

        // Very short delay between renames (stress test)
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return results;
    });

    console.log('[Test] Rename results:', renameResults);

    // Wait for all broadcasts and storage writes
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify all renames persisted
    const finalState = await popup.evaluate(async () => {
      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      const storage = await chrome.storage.local.get('chrome_spaces');

      return {
        backgroundState: Object.values(spaces.active || {}).map((s: any) => s.customName),
        storageState: Object.values(storage.chrome_spaces?.spaces || {}).map((s: any) => s.customName)
      };
    });

    console.log('[Test] Final state:', finalState);

    // Check all expected names are present
    const allNamesInBackground = renameResults.every(r =>
      finalState.backgroundState.includes(r.name)
    );

    const allNamesInStorage = renameResults.every(r =>
      finalState.storageState.includes(r.name)
    );

    if (allNamesInBackground) {
      console.log('✅ All rapid renames in background state');
    } else {
      console.error('❌ ISSUE: Some rapid renames missing from background state');
      console.error('   Expected:', renameResults.map(r => r.name));
      console.error('   Got:', finalState.backgroundState);
    }

    if (allNamesInStorage) {
      console.log('✅ All rapid renames persisted to storage');
    } else {
      console.error('❌ ISSUE: Some rapid renames missing from storage');
      console.error('   Expected:', renameResults.map(r => r.name));
      console.error('   Got:', finalState.storageState);
    }

    expect(allNamesInBackground).toBe(true);
    expect(allNamesInStorage).toBe(true);

    // Cleanup
    for (const winId of windows) {
      try {
        await popup.evaluate(async (wid) => {
          await chrome.windows.remove(wid);
        }, winId);
      } catch (e) {
        // Window might already be closed
      }
    }

    await popup.close();
  });

  test('DIAGNOSTIC: Storage consistency during operations', async () => {
    console.log('\n\n🔍 TEST: Storage consistency during operations');

    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Create a space
    const windowId = await popup.evaluate(async () => {
      const win = await chrome.windows.create({
        url: 'https://example.com',
        type: 'normal',
        focused: false
      });
      await new Promise(resolve => setTimeout(resolve, 1000));
      return win.id;
    });

    await new Promise(resolve => setTimeout(resolve, 1500));

    // Perform a series of operations and check storage after each
    const operations = [
      {
        name: 'Initial State',
        action: async () => { /* no-op */ }
      },
      {
        name: 'Rename Space',
        action: async () => {
          const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
          const spaceId = Object.keys(spaces.active)[0];
          await chrome.runtime.sendMessage({
            type: 'RENAME_SPACE',
            spaceId: spaceId,
            name: 'Consistency Test'
          });
        }
      },
      {
        name: 'Get Spaces',
        action: async () => {
          await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
        }
      },
      {
        name: 'Close Window',
        action: async (wid: number) => {
          await chrome.windows.remove(wid);
        }
      }
    ];

    const consistencyLog = [];

    for (const op of operations) {
      if (op.action.length > 0) {
        await popup.evaluate(op.action, windowId);
      } else {
        await popup.evaluate(op.action);
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      const snapshot = await popup.evaluate(async () => {
        const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
        const storage = await chrome.storage.local.get('chrome_spaces');

        return {
          bgActiveCount: Object.keys(spaces.active || {}).length,
          bgClosedCount: Object.keys(spaces.closed || {}).length,
          storageActiveCount: Object.keys(storage.chrome_spaces?.spaces || {}).length,
          storageClosedCount: Object.keys(storage.chrome_spaces?.closedSpaces || {}).length,
          lastModified: storage.chrome_spaces?.lastModified
        };
      });

      consistencyLog.push({
        operation: op.name,
        ...snapshot,
        consistent: snapshot.bgActiveCount === snapshot.storageActiveCount &&
                    snapshot.bgClosedCount === snapshot.storageClosedCount
      });

      console.log(`[${op.name}]`, snapshot);
    }

    console.log('\n📊 Consistency Report:');
    console.table(consistencyLog);

    const allConsistent = consistencyLog.every(log => log.consistent);
    if (allConsistent) {
      console.log('✅ Storage remained consistent through all operations');
    } else {
      console.error('❌ ISSUE: Storage inconsistency detected');
      const inconsistentOps = consistencyLog.filter(log => !log.consistent);
      console.error('   Inconsistent operations:', inconsistentOps.map(op => op.operation));
    }

    expect(allConsistent).toBe(true);

    await popup.close();
  });

  test('DIAGNOSTIC: Broadcast listener verification', async () => {
    console.log('\n\n📡 TEST: Broadcast listener verification');

    // Open popup and listen for broadcasts
    const popup1 = await context.newPage();
    await popup1.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup1.waitForLoadState('domcontentloaded');

    // Set up message listener in popup
    const listenerSetup = await popup1.evaluate(() => {
      return new Promise((resolve) => {
        const messages: any[] = [];
        let messageCount = 0;

        chrome.runtime.onMessage.addListener((message, sender) => {
          console.log('[Popup] Received message:', message);
          messages.push({
            type: message.type,
            timestamp: Date.now(),
            sender: sender.id
          });
          messageCount++;
        });

        // Store messages in window object for retrieval
        (window as any).broadcastMessages = messages;
        (window as any).broadcastMessageCount = () => messageCount;

        resolve({ listenerActive: true });
      });
    });

    console.log('[Test] Listener setup:', listenerSetup);
    await new Promise(resolve => setTimeout(resolve, 500));

    // Trigger an action that should broadcast
    const popup2 = await context.newPage();
    await popup2.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup2.waitForLoadState('domcontentloaded');

    await popup2.evaluate(async () => {
      const win = await chrome.windows.create({
        url: 'https://example.com',
        type: 'normal',
        focused: false
      });
      await new Promise(resolve => setTimeout(resolve, 1000));

      const spaces = await chrome.runtime.sendMessage({ type: 'GET_SPACES' });
      const spaceId = Object.keys(spaces.active)[0];

      await chrome.runtime.sendMessage({
        type: 'RENAME_SPACE',
        spaceId: spaceId,
        name: 'Broadcast Test'
      });
    });

    // Wait for broadcasts
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Check if popup1 received broadcasts
    const receivedMessages = await popup1.evaluate(() => {
      return {
        messages: (window as any).broadcastMessages || [],
        count: (window as any).broadcastMessageCount?.() || 0
      };
    });

    console.log('[Test] Popup1 received messages:', receivedMessages);

    if (receivedMessages.count > 0) {
      console.log(`✅ Popup received ${receivedMessages.count} broadcast messages`);
      console.log('   Message types:', receivedMessages.messages.map((m: any) => m.type));
    } else {
      console.error('❌ ISSUE: Popup did not receive any broadcast messages');
      console.error('   This indicates the broadcast mechanism may not be working');
    }

    // We expect at least one STATE_UPDATE broadcast
    const hasStateUpdate = receivedMessages.messages.some((m: any) =>
      m.type === 'STATE_UPDATE' || m.type === 'SPACES_UPDATED'
    );

    if (hasStateUpdate) {
      console.log('✅ Received state update broadcast');
    } else {
      console.warn('⚠️ WARNING: No STATE_UPDATE broadcast received');
      console.warn('   Message types received:', receivedMessages.messages.map((m: any) => m.type));
    }

    await popup1.close();
    await popup2.close();
  });
});
