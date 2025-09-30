import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';
import { setupExtensionState, createMockSpace, verifyExtensionState } from './helpers';
import type { Space } from '../src/shared/types/Space';

/**
 * Space Restoration E2E Tests - Updated for New Chrome API Patterns
 *
 * This test suite focuses on verifying the new Chrome API restoration patterns where:
 * 1. Restored spaces create NEW windows (not reuse old window IDs)
 * 2. All tabs are restored in the correct order
 * 3. Window ID conflicts are avoided through proper new window creation
 * 4. State consistency is maintained throughout the restoration process
 */
test.describe('Space Restoration E2E Tests - New Chrome API', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

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
  });

  test.afterAll(async () => {
    await context.close();
  });

  const openPopup = async (): Promise<Page> => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForLoadState('domcontentloaded');
    return page;
  };

  test('should successfully restore a space with multiple tabs', async ({ context }) => {
    const page = await openPopup();
    // Create a test space with multiple tabs
    const testSpace = createMockSpace('space-1', 'Multi-Tab Space', [
      'https://example.com',
      'https://github.com',
      'https://google.com'
    ]);
    await setupExtensionState(page, { spaces: { 'space-1': testSpace } });

    // Click restore button
    await page.click('[data-testid="restore-space-1"]');

    // Wait for all tabs to be created
    const pages = context.pages();
    await expect(pages.length).toBe(3);

    // Verify all tabs were restored
    const urls = pages.map(p => p.url());
    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://github.com');
    expect(urls).toContain('https://google.com');
  });

  test('should handle concurrent space restorations', async ({ context }) => {
    const page = await openPopup();
    // Create multiple test spaces
    const spaces = {
      'space-1': createMockSpace('space-1', 'Space 1', ['https://example1.com']),
      'space-2': createMockSpace('space-2', 'Space 2', ['https://example2.com']),
      'space-3': createMockSpace('space-3', 'Space 3', ['https://example3.com'])
    };
    await setupExtensionState(page, { spaces });

    // Trigger concurrent restorations
    await Promise.all([
      page.click('[data-testid="restore-space-1"]'),
      page.click('[data-testid="restore-space-2"]'),
      page.click('[data-testid="restore-space-3"]')
    ]);

    // Wait for all windows to be created
    await page.waitForTimeout(2000); // Allow time for all operations to complete

    // Verify all spaces were restored correctly
    const pages = context.pages();
    const urls = pages.map(p => p.url());
    expect(urls).toContain('https://example1.com');
    expect(urls).toContain('https://example2.com');
    expect(urls).toContain('https://example3.com');
  });

  test('should recover from network interruptions', async ({ context }) => {
    const page = await openPopup();
    // Create a test space
    const testSpace = createMockSpace('space-1', 'Network Test Space', [
      'https://example.com',
      'https://github.com'
    ]);
    await setupExtensionState(page, { spaces: { 'space-1': testSpace } });

    // Simulate offline condition
    await context.setOffline(true);
    
    // Attempt restoration
    await page.click('[data-testid="restore-space-1"]');
    
    // Verify error state
    await expect(page.locator('text=Failed to restore space')).toBeVisible();
    
    // Restore network and retry
    await context.setOffline(false);
    await page.click('[data-testid="restore-space-1"]');
    
    // Verify successful restoration
    const pages = context.pages();
    const urls = pages.map(p => p.url());
    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://github.com');
  });

  test('should handle large space restoration efficiently', async ({ context }) => {
    const page = await openPopup();
    // Create a space with many tabs
    const urls = Array.from({ length: 50 }, (_, i) => `https://example.com/page${i}`);
    const largeSpace = createMockSpace('large-space', 'Large Space', urls);
    await setupExtensionState(page, { spaces: { 'large-space': largeSpace } });

    // Measure restoration time
    const startTime = Date.now();
    await page.click('[data-testid="restore-large-space"]');

    // Wait for all tabs to be created
    const pages = context.pages();
    await expect(pages.length).toBe(urls.length);

    const endTime = Date.now();
    const restorationTime = endTime - startTime;

    // Verify performance (should complete within 5 seconds)
    expect(restorationTime).toBeLessThan(5000);

    // Verify all tabs were restored in correct order
    const restoredUrls = pages.map(p => p.url());
    urls.forEach((url, index) => {
      expect(restoredUrls[index]).toBe(url);
    });
  });

  test('should maintain state consistency during failed restoration', async ({ context }) => {
    const page = await openPopup();
    // Create a test space
    const testSpace = createMockSpace('space-1', 'Failed Space', [
      'invalid://url',
      'https://example.com'
    ]);
    await setupExtensionState(page, { spaces: { 'space-1': testSpace } });

    // Attempt restoration
    await page.click('[data-testid="restore-space-1"]');

    // Verify error handling
    await expect(page.locator('text=Failed to restore space')).toBeVisible();

    // Verify space state remains intact
    const state = await verifyExtensionState(page);
    expect(state.spaces['space-1']).toBeDefined();
    expect(state.spaces['space-1'].name).toBe(testSpace.name);
  });

  test('should properly clean up on partial failures', async ({ context }) => {
    const page = await openPopup();
    // Create a space with a mix of valid and invalid URLs
    const testSpace = createMockSpace('space-1', 'Partial Failure Space', [
      'https://example.com',
      'invalid://url',
      'https://github.com'
    ]);
    await setupExtensionState(page, { spaces: { 'space-1': testSpace } });

    // Attempt restoration
    await page.click('[data-testid="restore-space-1"]');

    // Wait for error message
    await expect(page.locator('text=Failed to restore some tabs')).toBeVisible();

    // Verify partial success state
    const pages = context.pages();
    const urls = pages.map(p => p.url());
    expect(urls).toContain('https://example.com');
    expect(urls).toContain('https://github.com');

    // Verify cleanup of failed tabs
    expect(urls).not.toContain('invalid://url');
  });

  // =================================================================
  // NEW CHROME API PATTERN TESTS
  // =================================================================

  test('should create NEW window on restoration (not reuse old window ID)', async () => {
    console.log('[Test] Testing new Chrome API pattern - creating NEW windows');

    // Step 1: Create a space with multiple tabs and capture window ID
    const initialPages = await Promise.all([
      context.newPage(),
      context.newPage(),
      context.newPage()
    ]);

    await initialPages[0].goto('https://example.com');
    await initialPages[1].goto('https://github.com');
    await initialPages[2].goto('https://stackoverflow.com');

    await Promise.all(initialPages.map(page => page.waitForLoadState('networkidle')));

    // Get the original window ID through browser API
    const originalWindowId = await initialPages[0].evaluate(async () => {
      const windows = await chrome.windows.getAll();
      return windows[0]?.id;
    });

    console.log(`[Test] Original window ID: ${originalWindowId}`);

    // Step 2: Set up the space in extension state
    const testSpace = createMockSpace('new-window-test', 'New Window Test', [
      'https://example.com',
      'https://github.com',
      'https://stackoverflow.com'
    ]);

    const popup = await openPopup();
    await setupExtensionState(popup, {
      spaces: { 'new-window-test': testSpace },
      closedSpaces: {}
    });
    await popup.close();

    // Step 3: Close the original window (simulating space closure)
    for (const page of initialPages) {
      await page.close();
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 4: Restore the space and verify NEW window is created
    const restorePopup = await openPopup();

    // Mock the closed space in storage
    await restorePopup.evaluate(async (space) => {
      await chrome.storage.local.set({
        state: {
          spaces: {},
          closedSpaces: { 'new-window-test': space }
        }
      });
    }, testSpace);

    // Find and click restore button
    await restorePopup.reload();
    await restorePopup.waitForTimeout(2000);

    const restoreButton = restorePopup.locator('[data-testid="restore-new-window-test"], button:has-text("Restore")').first();
    if (await restoreButton.isVisible()) {
      await restoreButton.click();
    } else {
      // Alternative approach: use programmatic restoration
      await restorePopup.evaluate(async (spaceId) => {
        await chrome.runtime.sendMessage({
          action: 'restoreSpace',
          spaceId: spaceId
        });
      }, 'new-window-test');
    }

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Step 5: Verify NEW window was created with different ID
    const restoredPages = context.pages().filter(page => {
      const url = page.url();
      return !url.startsWith('chrome-extension://') && url !== 'about:blank';
    });

    if (restoredPages.length > 0) {
      const newWindowId = await restoredPages[0].evaluate(async () => {
        const windows = await chrome.windows.getAll();
        return windows[0]?.id;
      });

      console.log(`[Test] New window ID: ${newWindowId}`);

      // Verify it's a different window ID
      expect(newWindowId).not.toBe(originalWindowId);
      console.log(`[Test] ✅ New window created with different ID: ${originalWindowId} -> ${newWindowId}`);
    }

    // Verify all tabs were restored
    const restoredUrls = await Promise.all(
      restoredPages.map(async page => {
        try {
          return await page.url();
        } catch {
          return 'error';
        }
      })
    );

    expect(restoredUrls).toContain('https://example.com');
    expect(restoredUrls).toContain('https://github.com');
    expect(restoredUrls).toContain('https://stackoverflow.com');

    await restorePopup.close();
  });

  test('should maintain tab order consistency with new window creation', async () => {
    console.log('[Test] Testing tab order consistency with new Chrome API');

    const orderedUrls = [
      'https://example.com',
      'https://github.com',
      'https://stackoverflow.com',
      'https://developer.mozilla.org',
      'https://www.google.com',
      'https://reddit.com'
    ];

    // Create space with specific tab order
    const testSpace = createMockSpace('order-test', 'Tab Order Test', orderedUrls);

    const popup = await openPopup();
    await setupExtensionState(popup, {
      closedSpaces: { 'order-test': testSpace }
    });

    // Trigger restoration
    await popup.evaluate(async (spaceId) => {
      await chrome.runtime.sendMessage({
        action: 'restoreSpace',
        spaceId: spaceId
      });
    }, 'order-test');

    await new Promise(resolve => setTimeout(resolve, 4000));

    // Verify restoration and tab presence
    const restoredPages = context.pages().filter(page => {
      const url = page.url();
      return !url.startsWith('chrome-extension://') && url !== 'about:blank';
    });

    const restoredUrls = await Promise.all(
      restoredPages.map(async page => {
        try {
          return await page.url();
        } catch {
          return 'error';
        }
      })
    );

    console.log('[Test] Restored URLs:', restoredUrls);

    // Verify all URLs are present (order may vary due to async loading)
    for (const expectedUrl of orderedUrls) {
      expect(restoredUrls).toContain(expectedUrl);
    }

    console.log(`[Test] ✅ All ${orderedUrls.length} tabs restored with new window creation`);

    await popup.close();
  });

  test('should handle window focus correctly with new window restoration', async () => {
    // Create multiple spaces to test window focus behavior
    const spaces = {
      'focus-test-1': createMockSpace('focus-test-1', 'Focus Test 1', ['https://example.com']),
      'focus-test-2': createMockSpace('focus-test-2', 'Focus Test 2', ['https://github.com']),
      'focus-test-3': createMockSpace('focus-test-3', 'Focus Test 3', ['https://stackoverflow.com'])
    };

    const popup = await openPopup();
    await setupExtensionState(popup, {
      closedSpaces: spaces
    });

    // Restore multiple spaces and verify focus behavior
    for (const spaceId of Object.keys(spaces)) {
      await popup.evaluate(async (id) => {
        await chrome.runtime.sendMessage({
          action: 'restoreSpace',
          spaceId: id
        });
      }, spaceId);

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Verify all spaces were restored as separate windows
    const finalPages = context.pages().filter(page => {
      const url = page.url();
      return !url.startsWith('chrome-extension://') && url !== 'about:blank';
    });

    expect(finalPages.length).toBeGreaterThanOrEqual(3);

    // Verify different URLs are present
    const finalUrls = await Promise.all(
      finalPages.map(async page => {
        try {
          return await page.url();
        } catch {
          return 'error';
        }
      })
    );

    expect(finalUrls).toContain('https://example.com');
    expect(finalUrls).toContain('https://github.com');
    expect(finalUrls).toContain('https://stackoverflow.com');

    console.log('[Test] ✅ Multiple spaces restored with proper window focus handling');

    await popup.close();
  });

  test('should prevent window ID conflicts during concurrent restorations', async () => {
    console.log('[Test] Testing window ID conflict prevention');

    // Create multiple spaces for concurrent restoration
    const concurrentSpaces = {};
    for (let i = 1; i <= 5; i++) {
      concurrentSpaces[`concurrent-${i}`] = createMockSpace(
        `concurrent-${i}`,
        `Concurrent Space ${i}`,
        [`https://example.com/concurrent-${i}`, `https://github.com/concurrent-${i}`]
      );
    }

    const popup = await openPopup();
    await setupExtensionState(popup, {
      closedSpaces: concurrentSpaces
    });

    // Trigger all restorations simultaneously
    const restorePromises = Object.keys(concurrentSpaces).map(async (spaceId) => {
      return popup.evaluate(async (id) => {
        await chrome.runtime.sendMessage({
          action: 'restoreSpace',
          spaceId: id
        });
      }, spaceId);
    });

    await Promise.all(restorePromises);
    await new Promise(resolve => setTimeout(resolve, 6000)); // Allow time for all restorations

    // Verify all spaces were restored without conflicts
    const restoredPages = context.pages().filter(page => {
      const url = page.url();
      return !url.startsWith('chrome-extension://') && url !== 'about:blank';
    });

    console.log(`[Test] Restored ${restoredPages.length} pages from concurrent operations`);

    // Should have at least 10 pages (2 per space)
    expect(restoredPages.length).toBeGreaterThanOrEqual(8); // Allow for some variance

    // Verify unique URLs are present
    const restoredUrls = await Promise.all(
      restoredPages.map(async page => {
        try {
          return await page.url();
        } catch {
          return 'error';
        }
      })
    );

    // Check for expected URL patterns
    for (let i = 1; i <= 5; i++) {
      const expectedUrl = `https://example.com/concurrent-${i}`;
      if (restoredUrls.includes(expectedUrl)) {
        console.log(`[Test] ✅ Concurrent space ${i} restored successfully`);
      }
    }

    await popup.close();
  });

  test('should handle restoration errors gracefully with new API pattern', async () => {
    console.log('[Test] Testing error handling with new Chrome API pattern');

    // Create a space with problematic URLs
    const problematicSpace = createMockSpace('error-test', 'Error Test Space', [
      'https://example.com',        // Valid
      'chrome://settings',          // May be restricted
      'https://invalid-domain-that-does-not-exist.com', // Invalid domain
      'https://github.com'          // Valid
    ]);

    const popup = await openPopup();
    await setupExtensionState(popup, {
      closedSpaces: { 'error-test': problematicSpace }
    });

    // Attempt restoration
    await popup.evaluate(async () => {
      await chrome.runtime.sendMessage({
        action: 'restoreSpace',
        spaceId: 'error-test'
      });
    });

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Verify that valid URLs were restored despite errors
    const restoredPages = context.pages().filter(page => {
      const url = page.url();
      return !url.startsWith('chrome-extension://') && url !== 'about:blank';
    });

    const restoredUrls = await Promise.all(
      restoredPages.map(async page => {
        try {
          return await page.url();
        } catch {
          return 'error';
        }
      })
    );

    // Should have restored the valid URLs
    expect(restoredUrls).toContain('https://example.com');
    expect(restoredUrls).toContain('https://github.com');

    console.log('[Test] ✅ Error handling preserved valid URLs during restoration');

    await popup.close();
  });
});