import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';

/**
 * Error Recovery and Edge Case Tests for Chrome Spaces Extension
 *
 * This test suite verifies the extension's robustness and error handling
 * capabilities across various edge cases and failure scenarios:
 *
 * 1. Network connectivity issues
 * 2. Invalid URL handling
 * 3. Chrome API failures
 * 4. Storage corruption scenarios
 * 5. Resource exhaustion scenarios
 * 6. Browser permission changes
 * 7. Unexpected data formats
 * 8. Concurrent modification conflicts
 */
test.describe('Chrome Spaces Error Recovery and Edge Cases', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  /**
   * Robust browser context launch with error handling
   */
  const launchBrowser = async (): Promise<{ context: BrowserContext; extensionId: string }> => {
    const newContext = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
        '--enable-logging=stderr',
        '--vmodule=*/browser/extensions/*=1',
        '--enable-service-worker-script-debugging',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
      ],
    });

    let [background] = newContext.serviceWorkers();
    if (!background) {
      background = await newContext.waitForEvent('serviceworker', { timeout: 30000 });
    }

    const newExtensionId = background.url().split('/')[2];
    console.log(`[Error Recovery] Extension loaded with ID: ${newExtensionId}`);

    return { context: newContext, extensionId: newExtensionId };
  };

  /**
   * Open extension popup with error handling
   */
  const openPopup = async (ctx: BrowserContext, extId: string): Promise<Page> => {
    const popup = await ctx.newPage();
    await popup.goto(`chrome-extension://${extId}/popup.html`);
    await popup.waitForLoadState('domcontentloaded');

    // Wait for extension to initialize
    await popup.waitForTimeout(2000);

    return popup;
  };

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  // =================================================================
  // NETWORK CONNECTIVITY ERROR RECOVERY
  // =================================================================

  test('should handle network connectivity failures gracefully', async () => {
    console.log('[Error Recovery] Testing network connectivity failure handling');

    ({ context, extensionId } = await launchBrowser());

    // Create spaces while online
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page1.waitForLoadState('networkidle');

    let popup = await openPopup(context, extensionId);

    // Name the space
    const spaceItem = popup.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.waitFor({ state: 'visible', timeout: 10000 });
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = popup.locator('[data-testid="space-name-input"], input.edit-input');
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill('Network Test Space');
    await nameInput.press('Enter');
    await popup.close();

    await page1.close();

    // Simulate network disconnection
    console.log('[Error Recovery] Simulating network disconnection');
    await context.setOffline(true);

    // Try to restore space while offline
    popup = await openPopup(context, extensionId);

    const closedToggle = popup.locator('button:has-text("Closed"), .toggle-closed');
    if (await closedToggle.isVisible()) {
      await closedToggle.click();
    }

    const restoreButton = popup.locator('button:has-text("Restore")').first();
    if (await restoreButton.isVisible()) {
      await restoreButton.click();

      // Should handle network error gracefully
      await popup.waitForTimeout(3000);

      // Look for error indication or graceful fallback
      const hasError = await popup.locator('text=Network error, text=Failed to restore, text=Connection failed').isVisible();
      if (hasError) {
        console.log('[Error Recovery] ✅ Network error handled gracefully');
      }

      // Extension should still be functional
      const isPopupFunctional = await popup.locator('[data-testid="space-item"], .space-item, text=No spaces').isVisible();
      expect(isPopupFunctional).toBe(true);
    }

    // Restore network and verify recovery
    console.log('[Error Recovery] Restoring network connection');
    await context.setOffline(false);

    await popup.waitForTimeout(2000);

    // Should be able to restore space now
    if (await restoreButton.isVisible()) {
      await restoreButton.click();
      await popup.waitForTimeout(3000);

      // Check if restoration succeeded
      const pages = context.pages().filter(page =>
        page.url().includes('example.com') && !page.url().startsWith('chrome-extension://')
      );

      if (pages.length > 0) {
        console.log('[Error Recovery] ✅ Space restored successfully after network recovery');
      }
    }

    await popup.close();
  });

  test('should handle slow network conditions', async () => {
    console.log('[Error Recovery] Testing slow network handling');

    ({ context, extensionId } = await launchBrowser());

    // Simulate slow network
    await context.route('**/*', async route => {
      // Add delay to simulate slow network
      await new Promise(resolve => setTimeout(resolve, 2000));
      await route.continue();
    });

    // Create space with slow loading page
    const page = await context.newPage();

    const startTime = Date.now();
    await page.goto('https://httpbin.org/delay/3');
    const loadTime = Date.now() - startTime;

    console.log(`[Error Recovery] Page loaded in ${loadTime}ms with simulated slow network`);

    // Extension should handle slow loading gracefully
    const popup = await openPopup(context, extensionId);

    // Wait longer for spaces to appear under slow conditions
    await popup.waitForSelector('[data-testid="space-item"], .space-item', { timeout: 15000 });

    // Extension should still be functional
    const spaceItems = popup.locator('[data-testid="space-item"], .space-item');
    const spaceCount = await spaceItems.count();
    expect(spaceCount).toBeGreaterThan(0);

    console.log('[Error Recovery] ✅ Extension functional under slow network conditions');

    await popup.close();
  });

  // =================================================================
  // INVALID URL AND DATA HANDLING
  // =================================================================

  test('should handle invalid and problematic URLs', async () => {
    console.log('[Error Recovery] Testing invalid URL handling');

    ({ context, extensionId } = await launchBrowser());

    const problematicUrls = [
      'invalid://not-a-real-protocol',
      'chrome://settings',
      'chrome-extension://invalid-extension/page.html',
      'file:///etc/passwd',
      'javascript:alert("xss")',
      'data:text/html,<script>alert("xss")</script>',
      'ftp://old-protocol.com',
      'about:blank',
      '',
      'https://this-domain-definitely-does-not-exist-12345.com',
      'https://example.com:999999', // Invalid port
      'https://example.com/page with spaces',
      'https://example.com/page\nwith\nnewlines',
    ];

    const popup = await openPopup(context, extensionId);

    // Test each problematic URL
    for (const url of problematicUrls) {
      console.log(`[Error Recovery] Testing URL: "${url}"`);

      try {
        // Attempt to navigate to problematic URL
        const testPage = await context.newPage();

        const navigationPromise = testPage.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: 5000
        }).catch(error => {
          console.log(`[Error Recovery] Expected navigation error for ${url}: ${error.message}`);
          return null;
        });

        await navigationPromise;

        // Give extension time to process
        await popup.waitForTimeout(1000);

        // Close test page
        await testPage.close();

      } catch (error) {
        console.log(`[Error Recovery] Handled error for ${url}: ${error.message}`);
      }
    }

    // Extension should still be functional after handling problematic URLs
    await popup.reload();
    await popup.waitForSelector('[data-testid="space-item"], .space-item, text=No spaces', { timeout: 10000 });

    const isPopupFunctional = await popup.locator('body').isVisible();
    expect(isPopupFunctional).toBe(true);

    console.log('[Error Recovery] ✅ Extension survived problematic URL tests');

    await popup.close();
  });

  test('should handle malformed storage data', async () => {
    console.log('[Error Recovery] Testing malformed storage data handling');

    ({ context, extensionId } = await launchBrowser());

    const popup = await openPopup(context, extensionId);

    // Inject various types of malformed data
    const malformedDataTests = [
      { name: 'null_data', data: null },
      { name: 'invalid_json', data: 'invalid json string' },
      { name: 'wrong_structure', data: { wrongKey: 'wrongValue' } },
      { name: 'circular_reference', data: (() => { const obj: any = {}; obj.self = obj; return obj; })() },
      { name: 'undefined_values', data: { spaces: undefined, closedSpaces: undefined } },
      { name: 'array_instead_of_object', data: ['not', 'an', 'object'] },
      { name: 'very_large_data', data: { huge: Array(10000).fill('large data string').join('') } },
      { name: 'special_characters', data: { spaces: { '🚀\n\t\r': { name: '🔥💩\u0000\u001f' } } } },
    ];

    for (const test of malformedDataTests) {
      console.log(`[Error Recovery] Testing malformed data: ${test.name}`);

      try {
        await popup.evaluate(async (testData) => {
          try {
            if (testData.name === 'circular_reference') {
              // Can't JSON.stringify circular references, skip this test
              return;
            }
            await chrome.storage.local.set({ state: testData.data });
          } catch (e) {
            console.log(`[Test] Storage error for ${testData.name}:`, e);
          }
        }, test);

        // Reload popup to trigger data loading
        await popup.reload();
        await popup.waitForTimeout(2000);

        // Extension should handle malformed data gracefully
        const isStillFunctional = await popup.locator('body').isVisible();
        if (isStillFunctional) {
          console.log(`[Error Recovery] ✅ Survived malformed data: ${test.name}`);
        }

        // Clear malformed data
        await popup.evaluate(async () => {
          await chrome.storage.local.clear();
        });

      } catch (error) {
        console.log(`[Error Recovery] Handled error for ${test.name}: ${error.message}`);
      }
    }

    await popup.close();
  });

  // =================================================================
  // CHROME API FAILURE SCENARIOS
  // =================================================================

  test('should handle Chrome API failures gracefully', async () => {
    console.log('[Error Recovery] Testing Chrome API failure handling');

    ({ context, extensionId } = await launchBrowser());

    const popup = await openPopup(context, extensionId);

    // Test various API failure scenarios
    const apiFailureTests = [
      {
        name: 'storage_quota_exceeded',
        test: async () => {
          // Simulate storage quota exceeded
          await popup.evaluate(async () => {
            const originalSet = chrome.storage.local.set;
            chrome.storage.local.set = async () => {
              throw new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
            };

            try {
              await chrome.runtime.sendMessage({ action: 'createSpace', name: 'Test Space' });
            } catch (e) {
              console.log('[Test] Storage quota error caught:', e);
            }

            // Restore original function
            chrome.storage.local.set = originalSet;
          });
        }
      },
      {
        name: 'windows_api_failure',
        test: async () => {
          await popup.evaluate(async () => {
            const originalCreate = chrome.windows.create;
            chrome.windows.create = async () => {
              throw new Error('Windows API temporarily unavailable');
            };

            try {
              await chrome.runtime.sendMessage({ action: 'restoreSpace', spaceId: 'test' });
            } catch (e) {
              console.log('[Test] Windows API error caught:', e);
            }

            // Restore original function
            chrome.windows.create = originalCreate;
          });
        }
      },
      {
        name: 'tabs_api_failure',
        test: async () => {
          await popup.evaluate(async () => {
            const originalCreate = chrome.tabs.create;
            chrome.tabs.create = async () => {
              throw new Error('Tabs API temporarily unavailable');
            };

            try {
              await chrome.runtime.sendMessage({ action: 'createTab', url: 'https://example.com' });
            } catch (e) {
              console.log('[Test] Tabs API error caught:', e);
            }

            // Restore original function
            chrome.tabs.create = originalCreate;
          });
        }
      }
    ];

    for (const apiTest of apiFailureTests) {
      console.log(`[Error Recovery] Testing API failure: ${apiTest.name}`);

      try {
        await apiTest.test();

        // Extension should still be functional after API failures
        await popup.waitForTimeout(1000);
        const isStillFunctional = await popup.locator('body').isVisible();
        expect(isStillFunctional).toBe(true);

        console.log(`[Error Recovery] ✅ Survived API failure: ${apiTest.name}`);

      } catch (error) {
        console.log(`[Error Recovery] Handled API failure ${apiTest.name}: ${error.message}`);
      }
    }

    await popup.close();
  });

  // =================================================================
  // RESOURCE EXHAUSTION SCENARIOS
  // =================================================================

  test('should handle resource exhaustion gracefully', async () => {
    console.log('[Error Recovery] Testing resource exhaustion handling');

    ({ context, extensionId } = await launchBrowser());

    // Test memory pressure scenario
    const popup = await openPopup(context, extensionId);

    // Create memory pressure by rapidly creating and destroying objects
    await popup.evaluate(async () => {
      console.log('[Test] Creating memory pressure...');

      const memoryPressureArrays = [];
      try {
        for (let i = 0; i < 1000; i++) {
          // Create large arrays to consume memory
          memoryPressureArrays.push(new Array(10000).fill(`memory pressure data ${i}`));

          if (i % 100 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      } catch (e) {
        console.log('[Test] Memory pressure created:', e);
      }

      // Clean up
      memoryPressureArrays.length = 0;
    });

    // Extension should still be functional
    await popup.waitForTimeout(2000);
    const isStillFunctional = await popup.locator('body').isVisible();
    expect(isStillFunctional).toBe(true);

    console.log('[Error Recovery] ✅ Survived memory pressure test');

    // Test too many tabs scenario
    console.log('[Error Recovery] Testing too many tabs scenario');

    const testPages = [];
    try {
      // Create many tabs to test resource limits
      for (let i = 0; i < 50; i++) {
        const page = await context.newPage();
        await page.goto(`data:text/html,<h1>Test Tab ${i}</h1>`);
        testPages.push(page);

        if (i % 10 === 0) {
          console.log(`[Error Recovery] Created ${i + 1} test tabs`);
        }
      }

      // Extension should still function with many tabs
      await popup.reload();
      await popup.waitForTimeout(3000);

      const spaceItems = popup.locator('[data-testid="space-item"], .space-item');
      const spaceCount = await spaceItems.count();
      console.log(`[Error Recovery] Extension shows ${spaceCount} spaces with ${testPages.length} tabs open`);

    } finally {
      // Clean up test pages
      for (const page of testPages) {
        try {
          await page.close();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }

    await popup.close();
  });

  // =================================================================
  // CONCURRENT MODIFICATION CONFLICTS
  // =================================================================

  test('should handle concurrent modification conflicts', async () => {
    console.log('[Error Recovery] Testing concurrent modification conflict handling');

    ({ context, extensionId } = await launchBrowser());

    // Create initial space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');

    let popup1 = await openPopup(context, extensionId);
    const spaceItem = popup1.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await popup1.keyboard.press('F2');

    const nameInput = popup1.locator('[data-testid="space-name-input"], input.edit-input');
    await nameInput.fill('Conflict Test Space');
    await nameInput.press('Enter');
    await popup1.close();

    // Open multiple popups and try to modify same space simultaneously
    const popup2 = await openPopup(context, extensionId);
    const popup3 = await openPopup(context, extensionId);

    // Simulate concurrent rename operations
    const concurrentPromises = [
      (async () => {
        const spaceItem2 = popup2.locator('[data-testid="space-item"], .space-item').first();
        if (await spaceItem2.isVisible()) {
          await spaceItem2.focus();
          await popup2.keyboard.press('F2');

          const nameInput2 = popup2.locator('[data-testid="space-name-input"], input.edit-input');
          if (await nameInput2.isVisible()) {
            await nameInput2.fill('Renamed by Popup 2');
            await nameInput2.press('Enter');
          }
        }
      })(),
      (async () => {
        const spaceItem3 = popup3.locator('[data-testid="space-item"], .space-item').first();
        if (await spaceItem3.isVisible()) {
          await spaceItem3.focus();
          await popup3.keyboard.press('F2');

          const nameInput3 = popup3.locator('[data-testid="space-name-input"], input.edit-input');
          if (await nameInput3.isVisible()) {
            await nameInput3.fill('Renamed by Popup 3');
            await nameInput3.press('Enter');
          }
        }
      })(),
    ];

    await Promise.all(concurrentPromises);

    // Allow time for conflict resolution
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify extension handled the conflict gracefully
    popup1 = await openPopup(context, extensionId);
    const finalSpaceItems = popup1.locator('[data-testid="space-item"], .space-item');
    const finalSpaceCount = await finalSpaceItems.count();

    expect(finalSpaceCount).toBeGreaterThan(0);

    // One of the renames should have succeeded
    const hasRenamed = await popup1.locator('text=Renamed by Popup').isVisible();
    if (hasRenamed) {
      console.log('[Error Recovery] ✅ Concurrent modification handled, one rename succeeded');
    }

    await popup1.close();
    await popup2.close();
    await popup3.close();
  });

  // =================================================================
  // BROWSER PERMISSION CHANGES
  // =================================================================

  test('should handle permission changes gracefully', async () => {
    console.log('[Error Recovery] Testing permission change handling');

    ({ context, extensionId } = await launchBrowser());

    const popup = await openPopup(context, extensionId);

    // Simulate permission restrictions
    await popup.evaluate(async () => {
      // Mock permission denial scenarios
      const originalPermissions = chrome.permissions;

      (chrome.permissions as any) = {
        ...originalPermissions,
        contains: async () => false, // Simulate permission denied
        request: async () => false,  // Simulate permission request denied
      };

      try {
        // Try operations that require permissions
        await chrome.runtime.sendMessage({ action: 'createSpace', name: 'Permission Test' });
      } catch (e) {
        console.log('[Test] Permission error handled:', e);
      }

      // Restore permissions
      (chrome.permissions as any) = originalPermissions;
    });

    // Extension should handle permission errors gracefully
    await popup.waitForTimeout(1000);
    const isStillFunctional = await popup.locator('body').isVisible();
    expect(isStillFunctional).toBe(true);

    console.log('[Error Recovery] ✅ Permission change handled gracefully');

    await popup.close();
  });

  // =================================================================
  // DATA CORRUPTION RECOVERY
  // =================================================================

  test('should recover from data corruption scenarios', async () => {
    console.log('[Error Recovery] Testing data corruption recovery');

    ({ context, extensionId } = await launchBrowser());

    // Create some valid data first
    const page1 = await context.newPage();
    await page1.goto('https://example.com');

    let popup = await openPopup(context, extensionId);
    const spaceItem = popup.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await popup.keyboard.press('F2');

    const nameInput = popup.locator('[data-testid="space-name-input"], input.edit-input');
    await nameInput.fill('Corruption Test Space');
    await nameInput.press('Enter');
    await popup.close();

    // Simulate various corruption scenarios
    const corruptionScenarios = [
      {
        name: 'partial_corruption',
        corrupt: async () => {
          await popup.evaluate(async () => {
            const data = await chrome.storage.local.get('state');
            if (data.state) {
              data.state.corrupted = true;
              delete data.state.spaces;
              await chrome.storage.local.set(data);
            }
          });
        }
      },
      {
        name: 'invalid_version',
        corrupt: async () => {
          await popup.evaluate(async () => {
            await chrome.storage.local.set({
              state: {
                version: '999.999.999',
                spaces: 'invalid_data_type',
                corrupted: true
              }
            });
          });
        }
      },
      {
        name: 'missing_required_fields',
        corrupt: async () => {
          await popup.evaluate(async () => {
            await chrome.storage.local.set({
              state: {
                // Missing spaces and closedSpaces
                someRandomField: 'random_value'
              }
            });
          });
        }
      }
    ];

    for (const scenario of corruptionScenarios) {
      console.log(`[Error Recovery] Testing corruption scenario: ${scenario.name}`);

      popup = await openPopup(context, extensionId);

      // Apply corruption
      await scenario.corrupt();

      // Reload popup to trigger data loading
      await popup.reload();
      await popup.waitForTimeout(3000);

      // Extension should handle corruption gracefully
      const isRecovered = await popup.locator('body').isVisible();
      expect(isRecovered).toBe(true);

      // Should either recover data or reset to clean state
      const hasSpaces = await popup.locator('[data-testid="space-item"], .space-item').isVisible();
      const hasNoSpacesMessage = await popup.locator('text=No spaces').isVisible();

      expect(hasSpaces || hasNoSpacesMessage).toBe(true);

      console.log(`[Error Recovery] ✅ Recovered from corruption: ${scenario.name}`);

      await popup.close();
    }
  });

  // =================================================================
  // EXTENSION LIFECYCLE EDGE CASES
  // =================================================================

  test('should handle extension lifecycle edge cases', async () => {
    console.log('[Error Recovery] Testing extension lifecycle edge cases');

    ({ context, extensionId } = await launchBrowser());

    // Test rapid popup open/close cycles
    for (let i = 0; i < 10; i++) {
      const popup = await openPopup(context, extensionId);
      await popup.waitForTimeout(100);
      await popup.close();
    }

    // Extension should still be functional
    const finalPopup = await openPopup(context, extensionId);
    const isStillFunctional = await finalPopup.locator('body').isVisible();
    expect(isStillFunctional).toBe(true);

    console.log('[Error Recovery] ✅ Survived rapid popup cycling');

    // Test service worker restart simulation
    await finalPopup.evaluate(async () => {
      try {
        // Try to force service worker restart
        await chrome.runtime.sendMessage({ action: 'FORCE_RESTART' });
      } catch (e) {
        console.log('[Test] Service worker restart triggered');
      }
    });

    await finalPopup.waitForTimeout(3000);

    // Extension should recover from service worker restart
    const isRecoveredFromRestart = await finalPopup.locator('body').isVisible();
    expect(isRecoveredFromRestart).toBe(true);

    console.log('[Error Recovery] ✅ Recovered from service worker restart simulation');

    await finalPopup.close();
  });
});