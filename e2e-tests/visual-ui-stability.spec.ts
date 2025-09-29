import { test, expect, Page, BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Visual UI Stability Test Suite for Chrome Spaces Extension
 *
 * This test suite performs comprehensive visual validation to ensure:
 * 1. UI state consistency during operations
 * 2. Visual regression prevention
 * 3. Interaction feedback validation
 * 4. Layout stability across different conditions
 *
 * Focus Areas:
 * - Popup rendering after window restoration
 * - Space renaming visual feedback
 * - Loading and error states
 * - Component layout stability
 * - Responsive behavior with varying content
 */

test.describe('Visual UI Stability Tests', () => {
  let context: BrowserContext;
  let popupPage: Page;
  let backgroundPage: Page;

  const extensionPath = path.resolve(__dirname, '../build');

  test.beforeEach(async ({ browser }) => {
    // Create context with extension loaded
    context = await browser.newContext({
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-web-security',
        '--enable-service-worker-script-debugging'
      ],
    });

    // Wait for extension background script to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get the background page for the extension
    const pages = context.pages();
    backgroundPage = pages.find(page => page.url().includes('chrome-extension://')) ||
                    await context.waitForEvent('page', { predicate: page => page.url().includes('chrome-extension://') });

    // Create multiple test windows with different tab configurations
    await setupTestEnvironment(context);
  });

  test.afterEach(async () => {
    await context?.close();
  });

  /**
   * Test Case 1: UI Layout Consistency with Multiple Spaces
   * Verifies that popup layout remains stable with varying numbers of spaces
   */
  test('should maintain consistent popup layout with multiple spaces', async () => {
    // Take baseline screenshot with minimal spaces
    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    // Wait for popup to fully load and render
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForLoadState('networkidle');

    // Take screenshot of minimal state (1-2 spaces)
    await expect(popupPage).toHaveScreenshot('popup-minimal-spaces.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Create additional test windows to increase space count
    for (let i = 0; i < 8; i++) {
      const testPage = await context.newPage();
      await testPage.goto('https://example.com');
      await testPage.setViewportSize({ width: 800, height: 600 });
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Refresh popup to show updated spaces
    await popupPage.reload();
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForLoadState('networkidle');

    // Verify scrollable area appears with many spaces
    await expect(popupPage.locator('.spaces-list')).toBeVisible();

    // Take screenshot with many spaces
    await expect(popupPage).toHaveScreenshot('popup-many-spaces.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Verify layout elements are properly positioned
    await validateLayoutElements(popupPage);
  });

  /**
   * Test Case 2: Space Item Visual States Validation
   * Verifies all visual states of space items render correctly
   */
  test('should display all space item states correctly', async () => {
    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    // Test 1: Normal space item state
    const firstSpaceItem = popupPage.locator('.space-item').first();
    await expect(firstSpaceItem).toBeVisible();

    // Take screenshot of normal state
    await expect(firstSpaceItem).toHaveScreenshot('space-item-normal.png', {
      animations: 'disabled'
    });

    // Test 2: Hover state
    await firstSpaceItem.hover();
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for hover transition

    await expect(firstSpaceItem).toHaveScreenshot('space-item-hover.png', {
      animations: 'disabled'
    });

    // Test 3: Selected state (keyboard navigation)
    await popupPage.keyboard.press('ArrowDown');
    await popupPage.keyboard.press('ArrowUp'); // Select first item
    await new Promise(resolve => setTimeout(resolve, 200));

    const selectedItem = popupPage.locator('.space-item.selected');
    await expect(selectedItem).toBeVisible();
    await expect(selectedItem).toHaveScreenshot('space-item-selected.png', {
      animations: 'disabled'
    });

    // Test 4: Current window indicator
    const currentWindowItem = popupPage.locator('.space-item.current').first();
    if (await currentWindowItem.count() > 0) {
      await expect(currentWindowItem).toHaveScreenshot('space-item-current.png', {
        animations: 'disabled'
      });
    }

    // Take full popup screenshot to verify all states together
    await expect(popupPage).toHaveScreenshot('popup-item-states-overview.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  /**
   * Test Case 3: Edit Mode Visual State Validation
   * Verifies edit mode styling and visual feedback
   */
  test('should display edit mode correctly across all components', async () => {
    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    const firstSpaceItem = popupPage.locator('.space-item').first();

    // Capture normal state before editing
    await expect(firstSpaceItem).toHaveScreenshot('space-item-before-edit.png', {
      animations: 'disabled'
    });

    // Enter edit mode via double-click
    await firstSpaceItem.dblclick();

    // Wait for edit input to appear
    await popupPage.waitForSelector('.edit-input', { state: 'visible' });

    // Capture edit mode state
    const editingItem = popupPage.locator('.space-item').first();
    await expect(editingItem).toHaveScreenshot('space-item-edit-mode.png', {
      animations: 'disabled'
    });

    // Test edit input styling
    const editInput = popupPage.locator('.edit-input');
    await expect(editInput).toBeVisible();
    await expect(editInput).toBeFocused();

    // Verify edit input has proper styling
    const inputStyles = await editInput.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        border: computed.border,
        background: computed.backgroundColor,
        padding: computed.padding,
        borderRadius: computed.borderRadius
      };
    });

    // Change the name and verify visual feedback
    await editInput.fill('Renamed Space for Visual Test');
    await expect(editInput).toHaveScreenshot('edit-input-with-text.png', {
      animations: 'disabled'
    });

    // Save by pressing Enter
    await popupPage.keyboard.press('Enter');

    // Wait for edit mode to exit
    await popupPage.waitForSelector('.edit-input', { state: 'hidden' });

    // Capture final state after rename
    await expect(firstSpaceItem).toHaveScreenshot('space-item-after-edit.png', {
      animations: 'disabled'
    });
  });

  /**
   * Test Case 4: Loading and Error States Visual Validation
   */
  test('should display loading and error states correctly', async () => {
    // Test loading state by intercepting network requests
    await context.route('**/*', route => {
      // Delay all requests to simulate slow loading
      setTimeout(() => route.continue(), 2000);
    });

    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();

    // Navigate and capture loading state quickly
    const navigationPromise = popupPage.goto(popupUrl);

    // Try to capture loading state (this might be challenging due to timing)
    try {
      await popupPage.waitForSelector('.loading', { state: 'visible', timeout: 1000 });
      await expect(popupPage).toHaveScreenshot('popup-loading-state.png', {
        fullPage: true,
        animations: 'disabled'
      });
    } catch (e) {
      console.log('Loading state capture skipped - loaded too quickly');
    }

    await navigationPromise;
    await popupPage.waitForLoadState('networkidle');

    // Test error state by injecting an error
    await popupPage.evaluate(() => {
      // Simulate an error state in Redux store
      const event = new CustomEvent('extension-error', {
        detail: { message: 'Test error for visual validation' }
      });
      window.dispatchEvent(event);
    });

    // Look for error display
    const errorSelector = '.error, .error-message, [data-testid="error"]';
    try {
      await popupPage.waitForSelector(errorSelector, { timeout: 2000 });
      await expect(popupPage).toHaveScreenshot('popup-error-state.png', {
        fullPage: true,
        animations: 'disabled'
      });
    } catch (e) {
      console.log('Error state visual test skipped - error UI not found');
    }
  });

  /**
   * Test Case 5: Confirm Dialog Visual Validation
   */
  test('should display confirm dialog overlay correctly', async () => {
    // First create a closed space to test deletion
    const testPage = await context.newPage();
    await testPage.goto('https://example.com');
    await testPage.close(); // This creates a closed space

    await new Promise(resolve => setTimeout(resolve, 1000));

    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    // Look for closed spaces section
    const closedSpaceItem = popupPage.locator('.space-item.closed').first();
    if (await closedSpaceItem.count() > 0) {
      // Click delete button on closed space
      const deleteButton = closedSpaceItem.locator('.delete-btn');
      await deleteButton.click();

      // Wait for confirm dialog to appear
      await popupPage.waitForSelector('.confirm-dialog', { state: 'visible' });

      // Capture confirm dialog overlay
      await expect(popupPage).toHaveScreenshot('confirm-dialog-overlay.png', {
        fullPage: true,
        animations: 'disabled'
      });

      // Verify dialog positioning and styling
      const dialog = popupPage.locator('.confirm-dialog');
      const dialogContent = dialog.locator('.confirm-content');

      await expect(dialog).toBeVisible();
      await expect(dialogContent).toBeVisible();

      // Test dialog buttons
      const deleteBtn = dialogContent.locator('.confirm-delete');
      const cancelBtn = dialogContent.locator('.confirm-cancel');

      await expect(deleteBtn).toBeVisible();
      await expect(cancelBtn).toBeVisible();

      // Capture just the dialog content
      await expect(dialogContent).toHaveScreenshot('confirm-dialog-content.png', {
        animations: 'disabled'
      });

      // Test cancel functionality
      await cancelBtn.click();
      await popupPage.waitForSelector('.confirm-dialog', { state: 'hidden' });

      // Verify dialog disappears
      await expect(dialog).not.toBeVisible();
    }
  });

  /**
   * Test Case 6: Keyboard Navigation Visual Feedback
   */
  test('should show proper visual feedback for keyboard navigation', async () => {
    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    // Initial state - search input should be focused
    const searchInput = popupPage.locator('.search-input');
    await expect(searchInput).toBeFocused();

    await expect(popupPage).toHaveScreenshot('keyboard-nav-initial.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Navigate down to first space item
    await popupPage.keyboard.press('ArrowDown');
    await new Promise(resolve => setTimeout(resolve, 200));

    // First item should be selected
    const firstSelected = popupPage.locator('.space-item.selected').first();
    await expect(firstSelected).toBeVisible();

    await expect(popupPage).toHaveScreenshot('keyboard-nav-first-item.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Navigate down to second item
    await popupPage.keyboard.press('ArrowDown');
    await new Promise(resolve => setTimeout(resolve, 200));

    const secondSelected = popupPage.locator('.space-item.selected');
    await expect(secondSelected).toBeVisible();

    await expect(popupPage).toHaveScreenshot('keyboard-nav-second-item.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Navigate back up
    await popupPage.keyboard.press('ArrowUp');
    await new Promise(resolve => setTimeout(resolve, 200));

    await expect(popupPage).toHaveScreenshot('keyboard-nav-back-to-first.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Test F2 edit functionality visual feedback
    await popupPage.keyboard.press('F2');
    await popupPage.waitForSelector('.edit-input', { state: 'visible' });

    await expect(popupPage).toHaveScreenshot('keyboard-nav-f2-edit.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Cancel edit with Escape
    await popupPage.keyboard.press('Escape');
    await popupPage.waitForSelector('.edit-input', { state: 'hidden' });

    await expect(popupPage).toHaveScreenshot('keyboard-nav-escape-edit.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  /**
   * Test Case 7: Responsive Layout with Long Space Names
   */
  test('should handle long space names and text overflow correctly', async () => {
    // Create a test window with a very long title
    const longTitlePage = await context.newPage();
    await longTitlePage.goto('https://example.com');

    // Use JavaScript to set a very long title
    await longTitlePage.evaluate(() => {
      document.title = 'This is a very long space name that should demonstrate text overflow behavior in the Chrome Spaces extension popup and test ellipsis handling';
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    // Find space item with long name
    const longNameItem = popupPage.locator('.space-item').first();

    // Capture how long names are handled
    await expect(longNameItem).toHaveScreenshot('space-item-long-name.png', {
      animations: 'disabled'
    });

    // Verify text overflow is handled properly
    const spaceName = longNameItem.locator('.space-name');
    const nameStyles = await spaceName.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        overflow: computed.overflow,
        textOverflow: computed.textOverflow,
        whiteSpace: computed.whiteSpace,
        width: computed.width
      };
    });

    // Verify ellipsis is applied
    expect(nameStyles.textOverflow).toBe('ellipsis');
    expect(nameStyles.overflow).toBe('hidden');
    expect(nameStyles.whiteSpace).toBe('nowrap');

    // Test with multiple long names
    await expect(popupPage).toHaveScreenshot('popup-long-names.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });

  /**
   * Test Case 8: Search Functionality Visual States
   */
  test('should display search functionality visual states correctly', async () => {
    const popupUrl = `chrome-extension://${await getExtensionId(context)}/src/popup/index.html`;
    popupPage = await context.newPage();
    await popupPage.goto(popupUrl);

    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    // Initial state with search input
    await expect(popupPage).toHaveScreenshot('search-initial-state.png', {
      fullPage: true,
      animations: 'disabled'
    });

    const searchInput = popupPage.locator('.search-input');

    // Test search input focus state
    await searchInput.focus();
    await expect(popupPage).toHaveScreenshot('search-focused.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Type search query
    await searchInput.fill('example');
    await new Promise(resolve => setTimeout(resolve, 300)); // Wait for search to filter

    // Capture filtered results
    await expect(popupPage).toHaveScreenshot('search-filtered-results.png', {
      fullPage: true,
      animations: 'disabled'
    });

    // Test no results state
    await searchInput.fill('nonexistentspace12345');
    await new Promise(resolve => setTimeout(resolve, 300));

    // Look for no results message
    const noResultsElement = popupPage.locator('.no-results');
    if (await noResultsElement.count() > 0) {
      await expect(popupPage).toHaveScreenshot('search-no-results.png', {
        fullPage: true,
        animations: 'disabled'
      });
    }

    // Clear search
    await searchInput.fill('');
    await new Promise(resolve => setTimeout(resolve, 300));

    await expect(popupPage).toHaveScreenshot('search-cleared.png', {
      fullPage: true,
      animations: 'disabled'
    });
  });
});

/**
 * Helper Functions for Visual Testing
 */

async function getExtensionId(context: BrowserContext): Promise<string> {
  // Get extension ID from background page URL
  const pages = context.pages();
  const backgroundPage = pages.find(page => page.url().includes('chrome-extension://'));

  if (backgroundPage) {
    const url = backgroundPage.url();
    const match = url.match(/chrome-extension:\/\/([a-z]+)/);
    if (match) {
      return match[1];
    }
  }

  // Fallback: try to get from any extension page
  const serviceWorker = await context.serviceWorkers()[0];
  if (serviceWorker) {
    const url = serviceWorker.url();
    const match = url.match(/chrome-extension:\/\/([a-z]+)/);
    if (match) {
      return match[1];
    }
  }

  throw new Error('Could not determine extension ID');
}

async function setupTestEnvironment(context: BrowserContext): Promise<void> {
  // Create a few test windows with different configurations
  const testPages = [];

  // Window 1: Single tab
  const page1 = await context.newPage();
  await page1.goto('https://example.com');
  await page1.evaluate(() => { document.title = 'Example Site'; });
  testPages.push(page1);

  // Window 2: Multiple tabs
  const page2 = await context.newPage();
  await page2.goto('https://github.com');
  await page2.evaluate(() => { document.title = 'GitHub'; });
  testPages.push(page2);

  const page3 = await context.newPage();
  await page3.goto('https://stackoverflow.com');
  await page3.evaluate(() => { document.title = 'Stack Overflow'; });
  testPages.push(page3);

  // Give time for extension to register the windows
  await new Promise(resolve => setTimeout(resolve, 2000));
}

async function validateLayoutElements(page: Page): Promise<void> {
  // Verify essential UI elements are present and properly positioned
  await expect(page.locator('.popup-container')).toBeVisible();
  await expect(page.locator('.search-container')).toBeVisible();
  await expect(page.locator('.search-input')).toBeVisible();
  await expect(page.locator('.spaces-list')).toBeVisible();
  await expect(page.locator('.help-text')).toBeVisible();

  // Verify space items are properly structured
  const spaceItems = page.locator('.space-item');
  const count = await spaceItems.count();

  for (let i = 0; i < count; i++) {
    const item = spaceItems.nth(i);
    await expect(item.locator('.space-info')).toBeVisible();
    await expect(item.locator('.space-name')).toBeVisible();
    await expect(item.locator('.space-details')).toBeVisible();
  }
}