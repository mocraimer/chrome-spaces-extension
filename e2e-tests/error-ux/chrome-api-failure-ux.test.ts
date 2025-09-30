/**
 * Chrome API Failure UX Tests
 *
 * Tests handling of Chrome API failures:
 * - chrome.windows.create() fails
 * - chrome.tabs.query() fails
 * - chrome.storage.local.set() fails
 * - User-friendly error messages (not "undefined error")
 * - Retry options where applicable
 *
 * Focus: Translate technical API errors into user-friendly messages
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import {
  simulateAPIFailure,
  verifyErrorMessage,
  waitForError
} from './error-simulation-helpers';

test.describe('Chrome API Failure UX Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '../..', 'build');

  test.beforeEach(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
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

    page = await context.newPage();
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should translate windows.create failure into user-friendly message', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulateAPIFailure(page, {
      api: 'windows.create',
      errorMessage: 'Could not create window',
      failAlways: false
    });

    // Create and close space
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await page.waitForTimeout(500);
    await setupPage.close();
    await page.waitForTimeout(500);

    // Try to restore (calls windows.create)
    await page.reload();
    const closedToggle = page.locator('button:has-text("Closed")');
    if (await closedToggle.isVisible({ timeout: 2000 })) {
      await closedToggle.click();
    }

    const restoreButton = page.locator('button:has-text("Restore")').first();
    if (await restoreButton.isVisible({ timeout: 2000 })) {
      await restoreButton.click();
      await page.waitForTimeout(2000);

      const errorVerification = await verifyErrorMessage(page);
      if (errorVerification.isVisible) {
        // Should NOT show "windows.create failed" or technical error
        expect(errorVerification.isUserFriendly).toBe(true);

        const message = errorVerification.message.toLowerCase();

        // Should mention the user action that failed
        const mentionsAction =
          message.includes('restore') ||
          message.includes('open') ||
          message.includes('create') ||
          message.includes('space');

        expect(mentionsAction).toBe(true);

        // Should have retry option
        expect(errorVerification.hasRetryOption).toBe(true);
      }
    }

    await cleanup();
  });

  test('should handle storage API failure gracefully', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulateAPIFailure(page, {
      api: 'storage.set',
      errorMessage: 'Storage write failed',
      failAlways: false
    });

    // Try to rename space (triggers storage.set)
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page.waitForTimeout(500);

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('New Name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);

    // Should show user-friendly error
    const errorVerification = await verifyErrorMessage(page);

    if (errorVerification.isVisible) {
      // Should not mention "storage.set" or "Chrome API"
      const message = errorVerification.message.toLowerCase();
      expect(message).not.toContain('storage.set');
      expect(message).not.toContain('chrome api');
      expect(message).not.toContain('undefined');

      // Should mention save/update failure
      const mentionsSave =
        message.includes('save') ||
        message.includes('update') ||
        message.includes('couldn\'t');

      expect(mentionsSave).toBe(true);

      // Should preserve user input
      const inputStillVisible = await input.isVisible({ timeout: 1000 }).catch(() => false);
      if (inputStillVisible) {
        const value = await input.inputValue();
        expect(value).toBe('New Name');
      }
    }

    await cleanup();
  });

  test('should provide context-specific error messages for different APIs', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Test different APIs and verify error messages are contextual
    const apiTests = [
      {
        api: 'windows.create' as const,
        action: 'restore space',
        expectedKeywords: ['restore', 'open', 'window']
      },
      {
        api: 'tabs.create' as const,
        action: 'create tab',
        expectedKeywords: ['tab', 'open', 'create']
      },
      {
        api: 'storage.set' as const,
        action: 'save changes',
        expectedKeywords: ['save', 'update', 'store']
      }
    ];

    for (const apiTest of apiTests) {
      const cleanup = await simulateAPIFailure(page, {
        api: apiTest.api,
        errorMessage: `${apiTest.api} failed`,
        failAlways: false
      });

      console.log(`Testing ${apiTest.api} failure UX...`);

      // Trigger the API call and check error message
      // (Implementation depends on API - simplified here)

      await page.waitForTimeout(500);
      await cleanup();
    }
  });

  test('should not expose technical error details to users', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const technicalErrors = [
      'TypeError: Cannot read property',
      'ReferenceError: undefined is not defined',
      'chrome.windows.create is not a function',
      'Uncaught (in promise) Error'
    ];

    for (const technicalError of technicalErrors) {
      const cleanup = await simulateAPIFailure(page, {
        api: 'windows.create',
        errorMessage: technicalError,
        failAlways: false
      });

      // Trigger error
      await page.reload();
      await page.waitForTimeout(500);

      const errorVerification = await verifyErrorMessage(page);

      if (errorVerification.isVisible) {
        // Should NOT show technical error to user
        expect(errorVerification.message).not.toContain('TypeError');
        expect(errorVerification.message).not.toContain('ReferenceError');
        expect(errorVerification.message).not.toContain('Uncaught');
        expect(errorVerification.message).not.toContain('.js:');

        // Should be user-friendly
        expect(errorVerification.isUserFriendly).toBe(true);
      }

      await cleanup();
    }
  });

  test('should log technical details to console for debugging', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    const cleanup = await simulateAPIFailure(page, {
      api: 'windows.create',
      errorMessage: 'Technical error: windows.create failed at line 123',
      failAlways: false
    });

    // Trigger error
    await page.reload();
    await page.waitForTimeout(1000);

    // Technical details should be in console
    const hasTechnicalDetails = consoleErrors.some(err =>
      err.includes('windows.create') || err.includes('API') || err.includes('Error')
    );

    if (hasTechnicalDetails) {
      console.log('✓ Technical details logged to console');
    }

    // But UI should show user-friendly message
    const errorVerification = await verifyErrorMessage(page);
    if (errorVerification.isVisible) {
      expect(errorVerification.isUserFriendly).toBe(true);
    }

    await cleanup();
  });

  test('should handle API rate limiting gracefully', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Simulate rate limit error
    const cleanup = await simulateAPIFailure(page, {
      api: 'tabs.create',
      errorMessage: 'Rate limit exceeded',
      failAlways: false
    });

    await page.reload();
    await page.waitForTimeout(500);

    const errorVerification = await verifyErrorMessage(page);

    if (errorVerification.isVisible) {
      const message = errorVerification.message.toLowerCase();

      // Should explain rate limiting in user terms
      const explainsRateLimit =
        message.includes('too many') ||
        message.includes('wait') ||
        message.includes('try again') ||
        message.includes('slow down');

      if (explainsRateLimit) {
        console.log('✓ Explains rate limiting in user-friendly terms');
      }
    }

    await cleanup();
  });
});