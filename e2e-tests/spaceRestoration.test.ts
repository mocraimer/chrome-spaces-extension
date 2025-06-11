import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import * as path from 'path';
import { setupExtensionState, createMockSpace, verifyExtensionState } from './helpers';
import type { Space } from '../src/shared/types/Space';

const extensionId = process.env.EXTENSION_ID || '';

test.describe('Space Restoration E2E Tests', () => {
  let context: BrowserContext;
  let extensionId: string;
  const pathToExtension = path.join(__dirname, '..', 'build');

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
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
});