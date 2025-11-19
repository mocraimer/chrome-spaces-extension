/**
 * Visual Testing Helper Utilities
 *
 * This file contains helper functions specifically designed for visual regression testing
 * of the Chrome Spaces extension popup UI. These utilities assist with:
 *
 * - Baseline screenshot management
 * - UI state manipulation for testing
 * - Visual comparison utilities
 * - DOM element visibility validation
 * - Extension-specific test setup
 */

import { Page, BrowserContext, expect } from '@playwright/test';

/**
 * Screenshot comparison options for consistent visual testing
 */
export const VISUAL_TEST_OPTIONS = {
  // Standard screenshot options for UI components
  component: {
    animations: 'disabled' as const,
    clip: undefined
  },

  // Full page screenshot options
  fullPage: {
    animations: 'disabled' as const,
    fullPage: true
  },

  // High precision screenshot options for pixel-perfect comparisons
  precise: {
    animations: 'disabled' as const,
    threshold: 0.1,
    maxDiffPixels: 100
  }
};

/**
 * Extension-specific selectors for visual testing
 */
export const VISUAL_SELECTORS = {
  // Main popup structure
  popup: {
    container: '.popup-container',
    searchContainer: '.search-container',
    searchInput: '.search-input',
    spacesList: '.spaces-list',
    helpText: '.help-text'
  },

  // Space item states
  spaceItem: {
    base: '.space-item',
    normal: '.space-item:not(.selected):not(.current):not(.closed)',
    hover: '.space-item:hover',
    selected: '.space-item.selected',
    current: '.space-item.current',
    closed: '.space-item.closed',
    editing: '.space-item:has(.edit-input)'
  },

  // Interactive elements
  interactive: {
    editInput: '.edit-input',
    editButton: '.edit-btn',
    deleteButton: '.delete-btn',
    confirmDialog: '.confirm-dialog',
    confirmContent: '.confirm-content',
    confirmDelete: '.confirm-delete',
    confirmCancel: '.confirm-cancel'
  },

  // State indicators
  states: {
    loading: '.loading',
    error: '.error',
    noResults: '.no-results',
    sectionHeader: '.section-header'
  }
};

/**
 * Extension ID Management
 * Reliably extracts the extension ID from the browser context
 */
export class ExtensionManager {
  private extensionId: string | null = null;

  async getExtensionId(context: BrowserContext): Promise<string> {
    if (this.extensionId) {
      return this.extensionId;
    }

    // Method 1: From background page URL
    const pages = context.pages();
    const backgroundPage = pages.find(page => page.url().includes('chrome-extension://'));

    if (backgroundPage) {
      const match = backgroundPage.url().match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        this.extensionId = match[1];
        return this.extensionId;
      }
    }

    // Method 2: From service workers
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const match = serviceWorkers[0].url().match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        this.extensionId = match[1];
        return this.extensionId;
      }
    }

    // Method 3: Wait for service worker (MV3 support)
    try {
      const worker = await context.waitForEvent('serviceworker', {
        predicate: worker => worker.url().includes('chrome-extension://'),
        timeout: 5000
      });
      const match = worker.url().match(/chrome-extension:\/\/([a-z]+)/);
      if (match) {
        this.extensionId = match[1];
        return this.extensionId;
      }
    } catch (e) {
      // Ignore timeout and try Method 4
    }

    // Method 4: Wait for extension page to appear (Fallback)
    const newPage = await context.waitForEvent('page', {
      predicate: page => page.url().includes('chrome-extension://'),
      timeout: 10000
    });

    const match = newPage.url().match(/chrome-extension:\/\/([a-z]+)/);
    if (match) {
      this.extensionId = match[1];
      return this.extensionId;
    }

    throw new Error('Could not determine extension ID - extension may not be loaded properly');
  }

  getPopupUrl(extensionId: string): string {
    return `chrome-extension://${extensionId}/src/popup/index.html`;
  }
}

/**
 * Popup State Manager
 * Utilities for manipulating popup state for visual testing
 */
export class PopupStateManager {
  constructor(private page: Page) {}

  /**
   * Wait for popup to be fully loaded and rendered
   */
  async waitForPopupReady(): Promise<void> {
    await this.page.waitForSelector(VISUAL_SELECTORS.popup.container, { state: 'visible' });
    await this.page.waitForLoadState('networkidle');

    // Additional wait for any CSS animations or transitions to complete
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  /**
   * Force popup into a specific state for visual testing
   */
  async setPopupState(state: 'loading' | 'error' | 'empty' | 'normal'): Promise<void> {
    switch (state) {
      case 'loading':
        await this.page.evaluate(() => {
          // Inject loading state
          const container = document.querySelector('.popup-container');
          if (container) {
            container.innerHTML = '<div class="loading">Loading spaces...</div>';
          }
        });
        break;

      case 'error':
        await this.page.evaluate(() => {
          // Inject error state
          const container = document.querySelector('.popup-container');
          if (container) {
            container.innerHTML = `
              <div class="error">
                Error: Test error for visual validation
                <button onclick="window.dispatchEvent(new Event('retry-clicked'))">Retry</button>
              </div>
            `;
          }
        });
        break;

      case 'empty':
        await this.page.evaluate(() => {
          // Remove all spaces to show empty state
          const spacesList = document.querySelector('.spaces-list');
          if (spacesList) {
            spacesList.innerHTML = '<div class="no-results">No spaces found</div>';
          }
        });
        break;

      case 'normal':
      default:
        // Refresh to return to normal state
        await this.page.reload();
        await this.waitForPopupReady();
        break;
    }
  }

  /**
   * Create test spaces with specific configurations for visual testing
   */
  async createTestSpaces(configurations: Array<{
    name: string;
    tabCount: number;
    isActive: boolean;
    isCurrent?: boolean;
  }>): Promise<void> {
    await this.page.evaluate((configs) => {
      // This would typically interface with the extension's background script
      // For visual testing, we can inject mock data directly into the popup
      const mockSpaces = configs.map((config, index) => ({
        id: `test-space-${index}`,
        name: config.name,
        urls: new Array(config.tabCount).fill(`https://example${index}.com`),
        isActive: config.isActive,
        windowId: config.isActive ? 1000 + index : undefined,
        lastModified: Date.now() - (index * 60000) // Stagger modification times
      }));

      // Dispatch event to update popup with test data
      window.dispatchEvent(new CustomEvent('test-spaces-updated', {
        detail: { spaces: mockSpaces }
      }));
    }, configurations);

    await this.waitForPopupReady();
  }

  /**
   * Trigger edit mode for a specific space
   */
  async enterEditMode(spaceIndex: number = 0): Promise<void> {
    const spaceItems = this.page.locator(VISUAL_SELECTORS.spaceItem.base);
    const targetItem = spaceItems.nth(spaceIndex);

    await expect(targetItem).toBeVisible();
    await targetItem.dblclick();

    // Wait for edit input to appear
    await this.page.waitForSelector(VISUAL_SELECTORS.interactive.editInput, { state: 'visible' });
  }

  /**
   * Exit edit mode
   */
  async exitEditMode(save: boolean = false): Promise<void> {
    const editInput = this.page.locator(VISUAL_SELECTORS.interactive.editInput);

    if (await editInput.isVisible()) {
      if (save) {
        await this.page.keyboard.press('Enter');
      } else {
        await this.page.keyboard.press('Escape');
      }

      await this.page.waitForSelector(VISUAL_SELECTORS.interactive.editInput, { state: 'hidden' });
    }
  }

  /**
   * Navigate using keyboard and verify selection state
   */
  async navigateWithKeyboard(direction: 'down' | 'up', steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press(direction === 'down' ? 'ArrowDown' : 'ArrowUp');
      await new Promise(resolve => setTimeout(resolve, 200)); // Wait for selection animation
    }

    // Verify a space item is selected
    await expect(this.page.locator(VISUAL_SELECTORS.spaceItem.selected)).toBeVisible();
  }
}

/**
 * Visual Assertion Utilities
 * Helper functions for making visual assertions
 */
export class VisualAssertions {
  constructor(private page: Page) {}

  /**
   * Assert that essential UI elements are properly positioned and visible
   */
  async assertPopupLayout(): Promise<void> {
    // Main container
    const container = this.page.locator(VISUAL_SELECTORS.popup.container);
    await expect(container).toBeVisible();

    // Verify container has expected dimensions
    const containerBox = await container.boundingBox();
    expect(containerBox?.width).toBeCloseTo(350, 10); // Allow 10px tolerance
    expect(containerBox?.height).toBeGreaterThan(0);

    // Search section
    await expect(this.page.locator(VISUAL_SELECTORS.popup.searchContainer)).toBeVisible();
    await expect(this.page.locator(VISUAL_SELECTORS.popup.searchInput)).toBeVisible();

    // Spaces list
    await expect(this.page.locator(VISUAL_SELECTORS.popup.spacesList)).toBeVisible();

    // Help text
    await expect(this.page.locator(VISUAL_SELECTORS.popup.helpText)).toBeVisible();
  }

  /**
   * Assert that space items have proper visual structure
   */
  async assertSpaceItemStructure(): Promise<void> {
    const spaceItems = this.page.locator(VISUAL_SELECTORS.spaceItem.base);
    const count = await spaceItems.count();

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      const item = spaceItems.nth(i);

      // Each space item should have info and name
      await expect(item.locator('.space-info')).toBeVisible();
      await expect(item.locator('.space-name')).toBeVisible();
      await expect(item.locator('.space-details')).toBeVisible();

      // Text should not be empty
      const nameText = await item.locator('.space-name').textContent();
      expect(nameText?.trim()).toBeTruthy();
    }
  }

  /**
   * Assert CSS properties for visual consistency
   */
  async assertCSSProperties(selector: string, expectedProperties: Record<string, string>): Promise<void> {
    const element = this.page.locator(selector).first();
    await expect(element).toBeVisible();

    const actualProperties = await element.evaluate((el, props) => {
      const computed = window.getComputedStyle(el);
      const result: Record<string, string> = {};

      Object.keys(props).forEach(prop => {
        result[prop] = computed.getPropertyValue(prop);
      });

      return result;
    }, expectedProperties);

    Object.entries(expectedProperties).forEach(([property, expectedValue]) => {
      expect(actualProperties[property]).toBe(expectedValue);
    });
  }

  /**
   * Assert text overflow handling for long content
   */
  async assertTextOverflow(selector: string): Promise<void> {
    const element = this.page.locator(selector).first();
    await expect(element).toBeVisible();

    const overflowProps = await element.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        overflow: computed.overflow,
        textOverflow: computed.textOverflow,
        whiteSpace: computed.whiteSpace
      };
    });

    expect(overflowProps.overflow).toBe('hidden');
    expect(overflowProps.textOverflow).toBe('ellipsis');
    expect(overflowProps.whiteSpace).toBe('nowrap');
  }
}

/**
 * Screenshot Baseline Manager
 * Utilities for managing baseline screenshots and comparisons
 */
export class BaselineManager {
  constructor(private page: Page) {}

  /**
   * Capture baseline screenshot with proper naming convention
   */
  async captureBaseline(
    name: string,
    element?: string,
    options: any = VISUAL_TEST_OPTIONS.component
  ): Promise<void> {
    const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const baselineName = `${name}-baseline-${timestamp}.png`;

    if (element) {
      const locator = this.page.locator(element);
      await expect(locator).toHaveScreenshot(baselineName, options);
    } else {
      await expect(this.page).toHaveScreenshot(baselineName, options);
    }
  }

  /**
   * Compare current state with baseline
   */
  async compareWithBaseline(
    name: string,
    element?: string,
    options: any = VISUAL_TEST_OPTIONS.component
  ): Promise<void> {
    const screenshotName = `${name}.png`;

    if (element) {
      const locator = this.page.locator(element);
      await expect(locator).toHaveScreenshot(screenshotName, options);
    } else {
      await expect(this.page).toHaveScreenshot(screenshotName, options);
    }
  }
}

/**
 * Test Environment Setup
 * Utilities for creating consistent test environments
 */
export class TestEnvironmentSetup {
  constructor(private context: BrowserContext) {}

  /**
   * Create test windows with different configurations
   */
  async createTestWindows(configurations: Array<{
    url: string;
    title: string;
    tabs?: Array<{url: string, title: string}>;
  }>): Promise<void> {
    for (const config of configurations) {
      const page = await this.context.newPage();
      await page.goto(config.url);

      // Set custom title
      await page.evaluate((title) => {
        document.title = title;
      }, config.title);

      // Create additional tabs if specified
      if (config.tabs) {
        for (const tab of config.tabs) {
          const tabPage = await this.context.newPage();
          await tabPage.goto(tab.url);
          await tabPage.evaluate((title) => {
            document.title = title;
          }, tab.title);
        }
      }
    }

    // Allow time for extension to register all windows
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Close all test pages except popup
   */
  async cleanupTestPages(exceptPopup: boolean = true): Promise<void> {
    const pages = this.context.pages();

    for (const page of pages) {
      const url = page.url();

      // Skip popup pages if requested
      if (exceptPopup && url.includes('chrome-extension://')) {
        continue;
      }

      // Skip about:blank and empty pages
      if (url === 'about:blank' || url === '') {
        continue;
      }

      try {
        await page.close();
      } catch (e) {
        // Ignore errors closing pages
      }
    }
  }
}