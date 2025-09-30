/**
 * Network Failure UX Tests
 *
 * Tests how users experience and recover from network-related failures:
 * - Offline mode
 * - Network timeouts
 * - Connection refused
 * - Slow network conditions
 * - DNS resolution failures
 *
 * Focus: User-friendly error messages, retry functionality, state consistency
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import {
  simulateNetworkFailure,
  verifyErrorMessage,
  verifyVisualErrorIndicators,
  waitForError,
  waitForErrorDismissed
} from './error-simulation-helpers';

test.describe('Network Failure UX Tests', () => {
  let context: BrowserContext;
  let page: Page;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '../..', 'build');

  test.beforeEach(async () => {
    // Launch browser with extension
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Get extension ID
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 60000 });
    }
    extensionId = background.url().split('/')[2];

    // Create new page for testing
    page = await context.newPage();
  });

  test.afterEach(async () => {
    if (context) {
      await context.close();
    }
  });

  test('should show user-friendly error when restoring space offline', async () => {
    // Setup: Create a space first
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');
    await setupPage.waitForLoadState('networkidle');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Name the space
    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.waitFor({ state: 'visible' });
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Network Test Space');
    await input.press('Enter');
    await page.waitForTimeout(500);

    // Close the space
    await setupPage.close();
    await page.waitForTimeout(1000);

    // Simulate network failure
    const cleanup = await simulateNetworkFailure(context, {
      type: 'offline',
      urlPattern: '**/*'
    });

    // Try to restore space while offline
    await page.reload();
    await page.waitForTimeout(1000);

    const closedToggle = page.locator('button:has-text("Closed"), .toggle-closed');
    if (await closedToggle.isVisible({ timeout: 2000 })) {
      await closedToggle.click();
      await page.waitForTimeout(500);
    }

    const restoreButton = page.locator('button:has-text("Restore")').first();
    if (await restoreButton.isVisible({ timeout: 2000 })) {
      await restoreButton.click();
      await page.waitForTimeout(2000);

      // Verify user sees helpful error
      const errorShown = await waitForError(page);
      expect(errorShown).toBe(true);

      const errorVerification = await verifyErrorMessage(page);
      expect(errorVerification.isVisible).toBe(true);

      // Error should be user-friendly
      expect(errorVerification.isUserFriendly).toBe(true);

      // Should contain network-related keywords
      const message = errorVerification.message.toLowerCase();
      const hasNetworkKeyword =
        message.includes('network') ||
        message.includes('connection') ||
        message.includes('offline') ||
        message.includes('internet');

      expect(hasNetworkKeyword).toBe(true);

      // Should have retry option
      expect(errorVerification.hasRetryOption).toBe(true);

      // Verify visual indicators
      const visual = await verifyVisualErrorIndicators(page);
      expect(visual.isAccessible).toBe(true);
    }

    // Restore network
    await cleanup();
    await page.waitForTimeout(1000);

    // Retry should work now
    const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');
    if (await retryButton.isVisible({ timeout: 2000 })) {
      await retryButton.click();
      await page.waitForTimeout(2000);

      // Error should disappear
      const errorDismissed = await waitForErrorDismissed(page, 5000);
      expect(errorDismissed).toBe(true);

      // Space should be restored (new page opens)
      const pages = context.pages().filter(p =>
        p.url().includes('example.com') && !p.url().includes('chrome-extension')
      );
      expect(pages.length).toBeGreaterThan(0);
    }
  });

  test('should handle network timeout with clear messaging', async () => {
    // Create space
    const setupPage = await context.newPage();
    await setupPage.goto('https://httpbin.org/delay/1');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Close the space
    await setupPage.close();
    await page.waitForTimeout(1000);

    // Simulate timeout
    const cleanup = await simulateNetworkFailure(context, {
      type: 'timeout',
      urlPattern: '**/*'
    });

    // Try to restore with timeout
    await page.reload();
    const closedToggle = page.locator('button:has-text("Closed")');
    if (await closedToggle.isVisible({ timeout: 2000 })) {
      await closedToggle.click();
    }

    const restoreButton = page.locator('button:has-text("Restore")').first();
    if (await restoreButton.isVisible({ timeout: 2000 })) {
      await restoreButton.click();

      // Wait for timeout error
      await page.waitForTimeout(5000);

      const errorVerification = await verifyErrorMessage(page);
      if (errorVerification.isVisible) {
        // Should mention timeout or slowness
        const message = errorVerification.message.toLowerCase();
        const hasTimeoutMessage =
          message.includes('timeout') ||
          message.includes('slow') ||
          message.includes('taking too long') ||
          message.includes('not responding');

        expect(hasTimeoutMessage).toBe(true);
        expect(errorVerification.hasRetryOption).toBe(true);
      }
    }

    await cleanup();
  });

  test('should preserve user state during network failure', async () => {
    // Create multiple spaces
    const page1 = await context.newPage();
    await page1.goto('https://example.com');

    const page2 = await context.newPage();
    await page2.goto('https://github.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Name spaces
    const spaces = page.locator('[data-testid="space-item"], .space-item');
    const spaceCount = await spaces.count();

    // Simulate network failure
    const cleanup = await simulateNetworkFailure(context, {
      type: 'offline'
    });

    // Try to perform operations while offline
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify spaces are still shown (loaded from local storage)
    const spacesAfterOffline = page.locator('[data-testid="space-item"], .space-item');
    const countAfterOffline = await spacesAfterOffline.count();

    expect(countAfterOffline).toBe(spaceCount);

    // Try to rename space while offline
    const firstSpace = spacesAfterOffline.first();
    await firstSpace.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Offline Rename Test');
    await input.press('Enter');

    // Should either:
    // 1. Save locally and sync when online
    // 2. Show error but preserve input

    await page.waitForTimeout(1000);

    // Verify rename persisted or input preserved
    const hasRenamed = await page.locator('text=Offline Rename Test').isVisible({ timeout: 2000 }).catch(() => false);
    const inputStillVisible = await input.isVisible({ timeout: 1000 }).catch(() => false);

    // One of these should be true
    expect(hasRenamed || inputStillVisible).toBe(true);

    // Restore network
    await cleanup();
    await page.waitForTimeout(2000);

    // If there was an error, verify retry works
    const retryButton = page.locator('button:has-text("Retry")');
    if (await retryButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await retryButton.click();
      await page.waitForTimeout(1000);
    }

    // Verify state consistency after recovery
    await page.reload();
    await page.waitForTimeout(1000);

    const spacesAfterRecovery = page.locator('[data-testid="space-item"], .space-item');
    const countAfterRecovery = await spacesAfterRecovery.count();

    expect(countAfterRecovery).toBeGreaterThanOrEqual(spaceCount);
  });

  test('should show connection status indicator when offline', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Simulate offline
    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(1000);

    // Look for offline indicator
    const offlineIndicator = page.locator(
      'text=Offline, text=No connection, [data-testid="offline-indicator"], .offline-indicator'
    );

    const hasOfflineIndicator = await offlineIndicator.isVisible({ timeout: 2000 }).catch(() => false);

    // If extension shows offline indicator, verify it's helpful
    if (hasOfflineIndicator) {
      const text = await offlineIndicator.textContent();
      expect(text?.toLowerCase()).toContain('offline');
    }

    // Restore online
    await context.setOffline(false);
    await page.reload();
    await page.waitForTimeout(1000);

    // Offline indicator should disappear
    const stillOffline = await offlineIndicator.isVisible({ timeout: 1000 }).catch(() => false);
    expect(stillOffline).toBe(false);
  });

  test('should handle intermittent network with auto-retry', async () => {
    // Create space
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    await setupPage.close();
    await page.waitForTimeout(1000);

    // Simulate intermittent failure (fails once, then works)
    let requestCount = 0;
    await context.route('**/*', async (route) => {
      requestCount++;
      if (requestCount === 1) {
        // First request fails
        await route.abort('failed');
      } else {
        // Subsequent requests succeed
        await route.continue();
      }
    });

    // Try to restore
    await page.reload();
    const closedToggle = page.locator('button:has-text("Closed")');
    if (await closedToggle.isVisible({ timeout: 2000 })) {
      await closedToggle.click();
    }

    const restoreButton = page.locator('button:has-text("Restore")').first();
    if (await restoreButton.isVisible({ timeout: 2000 })) {
      await restoreButton.click();

      // May show error briefly
      await page.waitForTimeout(2000);

      // Click retry if error appears
      const retryButton = page.locator('button:has-text("Retry")');
      if (await retryButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await retryButton.click();
        await page.waitForTimeout(2000);
      }

      // Should eventually succeed
      const pages = context.pages().filter(p =>
        p.url().includes('example.com') && !p.url().includes('chrome-extension')
      );

      expect(pages.length).toBeGreaterThanOrEqual(1);
    }

    // Cleanup
    await context.unroute('**/*');
  });

  test('should not lose user input on network error', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Create space
    const page1 = await context.newPage();
    await page1.goto('https://example.com');
    await page.waitForTimeout(1000);

    // Start renaming
    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Important Name Change');

    // Simulate network failure before saving
    const cleanup = await simulateNetworkFailure(context, { type: 'offline' });

    // Try to save
    await input.press('Enter');
    await page.waitForTimeout(1000);

    // Input should either:
    // 1. Still be visible (edit mode) with value preserved
    // 2. Show error with way to retry

    const inputVisible = await input.isVisible({ timeout: 1000 }).catch(() => false);

    if (inputVisible) {
      const value = await input.inputValue();
      expect(value).toBe('Important Name Change');
    } else {
      // Should show error with preserved data
      const errorShown = await waitForError(page);
      expect(errorShown).toBe(true);

      // Should have retry option
      const retryButton = page.locator('button:has-text("Retry")');
      expect(await retryButton.isVisible()).toBe(true);
    }

    await cleanup();
  });

  test('should gracefully degrade functionality when offline', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Go offline
    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify extension still loads
    const body = page.locator('body');
    expect(await body.isVisible()).toBe(true);

    // Verify can still view spaces (from cache)
    const spacesVisible = await page.locator('[data-testid="space-item"], .space-item, text=No spaces').isVisible({ timeout: 2000 }).catch(() => false);
    expect(spacesVisible).toBe(true);

    // Operations that require network should show helpful message
    const createButton = page.locator('button:has-text("Create"), button:has-text("+")');
    if (await createButton.isVisible({ timeout: 1000 })) {
      await createButton.click();
      await page.waitForTimeout(1000);

      // Should either disable button or show offline message
      const errorMessage = await verifyErrorMessage(page);
      if (errorMessage.isVisible) {
        expect(errorMessage.isUserFriendly).toBe(true);
      }
    }

    // Restore online
    await context.setOffline(false);
  });
});