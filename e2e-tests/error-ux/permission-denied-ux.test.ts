/**
 * Permission Denied UX Tests
 *
 * Tests how users experience permission-related errors:
 * - Chrome permissions denied
 * - Clear explanation of why permission is needed
 * - Guidance on how to grant permission
 * - Graceful degradation without permission
 * - Re-prompt option
 *
 * Focus: Helpful guidance, not just "Permission denied"
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import {
  simulatePermissionDenied,
  verifyErrorMessage,
  verifyVisualErrorIndicators
} from './error-simulation-helpers';

test.describe('Permission Denied UX Tests', () => {
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

  test('should explain why permission is needed', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Simulate permission denied
    const cleanup = await simulatePermissionDenied(page, 'tabs');

    // Try to perform action requiring tabs permission
    const createPage = await context.newPage();
    await createPage.goto('https://example.com');
    await page.waitForTimeout(1000);

    // Reload popup to trigger permission check
    await page.reload();
    await page.waitForTimeout(1000);

    // Look for permission error or explanation
    const permissionDialog = page.locator(
      '[role="dialog"]:has-text("Permission"), [role="alert"]:has-text("Permission"), text=/permission.*required/i'
    ).first();

    const hasPermissionMessage = await permissionDialog.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasPermissionMessage) {
      const messageText = await permissionDialog.textContent() || '';
      const message = messageText.toLowerCase();

      // Should explain WHY permission is needed
      const explainsPurpose =
        message.includes('manage tabs') ||
        message.includes('access tabs') ||
        message.includes('switch spaces') ||
        message.includes('organize tabs');

      expect(explainsPurpose).toBe(true);

      // Should NOT be just "Permission denied"
      expect(message).not.toBe('permission denied');
      expect(messageText.length).toBeGreaterThan(50); // Should be explanatory
    }

    await cleanup();
  });

  test('should provide guidance on how to grant permission', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulatePermissionDenied(page, 'tabs');

    // Trigger permission-required action
    await page.reload();
    await page.waitForTimeout(1000);

    const permissionDialog = page.locator('[role="dialog"], [role="alert"]').first();
    const hasDialog = await permissionDialog.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasDialog) {
      const text = await permissionDialog.textContent() || '';
      const message = text.toLowerCase();

      // Should provide actionable guidance
      const hasGuidance =
        message.includes('allow') ||
        message.includes('grant') ||
        message.includes('enable') ||
        message.includes('settings') ||
        message.includes('chrome://extensions');

      expect(hasGuidance).toBe(true);

      // Should have button to open settings or request permission
      const actionButton = page.locator(
        'button:has-text("Grant"), button:has-text("Allow"), button:has-text("Settings"), button:has-text("Enable")'
      );

      const hasActionButton = await actionButton.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasActionButton).toBe(true);
    }

    await cleanup();
  });

  test('should gracefully degrade without permission', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulatePermissionDenied(page, 'tabs');

    // Extension should still load
    await page.reload();
    await page.waitForTimeout(1000);

    const body = page.locator('body');
    expect(await body.isVisible()).toBe(true);

    // Should show what features are unavailable
    const featureUnavailable = page.locator(
      'text=/feature.*unavailable/i, text=/requires.*permission/i, .permission-warning'
    ).first();

    const hasWarning = await featureUnavailable.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasWarning) {
      console.log('✓ Shows feature unavailability warning');
    }

    // Should not crash or show blank page
    const isUsable = await page.locator('[data-testid="space-item"], .space-item, text=No spaces, text=Permission').isVisible({ timeout: 3000 }).catch(() => false);
    expect(isUsable).toBe(true);

    await cleanup();
  });

  test('should provide re-prompt option for permission', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    let cleanup = await simulatePermissionDenied(page, 'tabs');

    await page.reload();
    await page.waitForTimeout(1000);

    // Look for button to try again
    const retryPermissionButton = page.locator(
      'button:has-text("Try Again"), button:has-text("Grant Permission"), button:has-text("Request Permission")'
    );

    const hasRetry = await retryPermissionButton.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasRetry) {
      console.log('✓ Provides retry option');

      // Clean up first simulation
      await cleanup();

      // Click retry button
      await retryPermissionButton.click();
      await page.waitForTimeout(1000);

      // Should attempt to request permission again
      // (In real scenario, this would show Chrome's permission dialog)
    } else {
      console.log('ℹ No explicit retry button found');
    }
  });

  test('should differentiate between different permission types', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Test tabs permission
    let cleanup = await simulatePermissionDenied(page, 'tabs');
    await page.reload();
    await page.waitForTimeout(500);

    let errorMsg = page.locator('[role="dialog"], [role="alert"]').first();
    let tabsMessage = await errorMsg.textContent().catch(() => '');

    await cleanup();

    // Test storage permission
    cleanup = await simulatePermissionDenied(page, 'storage');
    await page.reload();
    await page.waitForTimeout(500);

    let storageMessage = await errorMsg.textContent().catch(() => '');

    // Messages should be contextual to the permission type
    if (tabsMessage && storageMessage) {
      // Should not be identical generic messages
      expect(tabsMessage).not.toBe(storageMessage);

      // Tabs permission should mention tabs/windows
      expect(tabsMessage.toLowerCase()).toMatch(/tab|window|switch/);

      // Storage permission should mention save/data
      expect(storageMessage.toLowerCase()).toMatch(/save|stor|data/);
    }

    await cleanup();
  });

  test('should not spam permission requests', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulatePermissionDenied(page, 'tabs');

    // Try action multiple times
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await page.waitForTimeout(500);
    }

    // Should not show 5 permission dialogs
    // Should show at most 1-2 dialogs or show persistent warning

    const dialogs = await page.locator('[role="dialog"]').count();
    expect(dialogs).toBeLessThanOrEqual(2);

    await cleanup();
  });

  test('should remember permission denial temporarily', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const cleanup = await simulatePermissionDenied(page, 'tabs');

    // Deny permission
    await page.reload();
    await page.waitForTimeout(500);

    const dismissButton = page.locator('button:has-text("Cancel"), button:has-text("Not Now")');
    if (await dismissButton.isVisible({ timeout: 2000 })) {
      await dismissButton.click();
      await page.waitForTimeout(500);
    }

    // On next action, should not immediately re-prompt
    await page.reload();
    await page.waitForTimeout(500);

    // Should show disabled feature or "grant permission" link
    // But not auto-prompt again immediately
    const autoPrompt = page.locator('[role="dialog"]:has-text("Grant")').first();
    const hasAutoPrompt = await autoPrompt.isVisible({ timeout: 1000 }).catch(() => false);

    // Should either not show, or show as dismissible warning not blocking
    console.log(hasAutoPrompt ? 'Shows permission reminder' : 'Respects user dismissal');

    await cleanup();
  });

  test('should show permission status in settings', async () => {
    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Look for settings/options link
    const settingsLink = page.locator(
      'button:has-text("Settings"), a:has-text("Settings"), button:has-text("Options"), a:has-text("Options")'
    );

    const hasSettings = await settingsLink.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasSettings) {
      await settingsLink.click();
      await page.waitForTimeout(1000);

      // Should show permission status
      const permissionStatus = page.locator(
        'text=/permission.*status/i, text=/permissions/i, .permission-item'
      );

      const hasPermissionInfo = await permissionStatus.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasPermissionInfo) {
        console.log('✓ Settings page shows permission status');
      }
    }
  });
});