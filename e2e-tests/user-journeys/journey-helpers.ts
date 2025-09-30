/**
 * Shared Helper Utilities for User Journey Tests
 *
 * These utilities provide common functionality for journey tests,
 * enabling realistic user behavior simulation and consistent patterns.
 */

import { Page, BrowserContext } from '@playwright/test';

/**
 * User action timing constants - simulate realistic human behavior
 */
export const TIMING = {
  // Reading and thinking
  READ_SHORT: 500,      // Quick glance at UI element
  READ_MEDIUM: 1000,    // Reading a label or short text
  READ_LONG: 1500,      // Reading instructions or help text
  THINK: 1000,          // User considers options before acting

  // Typing speeds
  TYPE_SLOW: 150,       // Careful typing (beginner)
  TYPE_NORMAL: 80,      // Average typing speed
  TYPE_FAST: 50,        // Fast/power user typing

  // UI interactions
  CLICK_DELAY: 300,     // Time between click and next action
  KEYBOARD_DELAY: 200,  // Time between keyboard presses
  NAVIGATION: 300,      // Arrow key navigation delay
  SWITCH_DELAY: 1500,   // Wait after space switch operation

  // System operations
  POPUP_LOAD: 1000,     // Wait for popup to fully load
  EXTENSION_SYNC: 2000, // Wait for extension to process changes
  SEARCH_FILTER: 600,   // Wait for real-time search filtering
};

/**
 * User Journey Helper Class
 * Provides realistic user interaction methods
 */
export class JourneyHelper {
  constructor(private page: Page) {}

  /**
   * User opens the extension popup
   * Simulates realistic opening and waiting for load
   */
  async openPopup(extensionId: string): Promise<void> {
    await this.page.goto(`chrome-extension://${extensionId}/popup.html`);
    await this.page.waitForSelector('.popup-container', { state: 'visible' });
    await this.page.waitForTimeout(TIMING.POPUP_LOAD);

    // User takes a moment to orient themselves
    await this.page.waitForTimeout(TIMING.READ_SHORT);
  }

  /**
   * User types search query with realistic typing speed
   */
  async searchFor(query: string, speed: 'slow' | 'normal' | 'fast' = 'normal'): Promise<void> {
    const delay = speed === 'slow' ? TIMING.TYPE_SLOW :
                  speed === 'fast' ? TIMING.TYPE_FAST :
                  TIMING.TYPE_NORMAL;

    const searchInput = this.page.locator('.search-input, input[type="text"]');
    await searchInput.fill(''); // Clear any existing text
    await this.page.keyboard.type(query, { delay });

    // Wait for real-time filtering
    await this.page.waitForTimeout(TIMING.SEARCH_FILTER);
  }

  /**
   * User clears search by pressing Escape
   */
  async clearSearch(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(TIMING.CLICK_DELAY);
  }

  /**
   * User navigates with arrow keys (realistic speed)
   */
  async navigateSpaces(direction: 'down' | 'up', steps: number = 1): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await this.page.keyboard.press(direction === 'down' ? 'ArrowDown' : 'ArrowUp');
      await this.page.waitForTimeout(TIMING.NAVIGATION);
    }
  }

  /**
   * User renames space with realistic workflow
   * Returns true if successful, false if validation failed
   */
  async renameSpace(
    spaceIndex: number,
    newName: string,
    method: 'dblclick' | 'f2' = 'dblclick'
  ): Promise<boolean> {
    const spaceItems = this.page.locator('.active-spaces .space-item');
    const targetSpace = spaceItems.nth(spaceIndex);

    // User initiates edit
    if (method === 'dblclick') {
      await targetSpace.dblclick();
    } else {
      await targetSpace.click();
      await this.page.keyboard.press('F2');
    }

    await this.page.waitForTimeout(TIMING.CLICK_DELAY);

    // Wait for edit input to appear
    const editInput = this.page.locator('input[type="text"]:not(.search-input)').first();

    if (!(await editInput.isVisible())) {
      return false;
    }

    // User types new name (realistic speed)
    await editInput.fill('');
    await this.page.keyboard.type(newName, { delay: TIMING.TYPE_NORMAL });
    await this.page.waitForTimeout(TIMING.READ_SHORT);

    // User presses Enter to save
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(TIMING.EXTENSION_SYNC);

    // Check if still in edit mode (validation failed)
    return !(await editInput.isVisible());
  }

  /**
   * User cancels editing by pressing Escape
   */
  async cancelEdit(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(TIMING.CLICK_DELAY);
  }

  /**
   * User switches to space via Enter key
   */
  async switchToSpace(): Promise<void> {
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(TIMING.SWITCH_DELAY);
  }

  /**
   * User closes a space
   * Returns true if successful, false if space couldn't be closed
   */
  async closeSpace(spaceIndex: number): Promise<boolean> {
    const spaceItems = this.page.locator('.active-spaces .space-item');
    const targetSpace = spaceItems.nth(spaceIndex);

    // Look for close button
    const closeButton = targetSpace.locator(
      'button:has-text("Close"), button[title*="close"], .delete-btn'
    );

    if (!(await closeButton.count() > 0 && await closeButton.first().isVisible())) {
      return false;
    }

    await closeButton.first().click();
    await this.page.waitForTimeout(TIMING.CLICK_DELAY);

    // Handle confirmation dialog if present
    const confirmDialog = this.page.locator('.confirm-dialog, [role="dialog"]');
    if (await confirmDialog.isVisible()) {
      const confirmBtn = confirmDialog.locator(
        'button:has-text("Confirm"), button:has-text("Close")'
      );
      await confirmBtn.click();
      await this.page.waitForTimeout(TIMING.EXTENSION_SYNC);
    }

    return true;
  }

  /**
   * User restores a closed space
   * Returns true if successful
   */
  async restoreClosedSpace(spaceIndex: number = 0): Promise<boolean> {
    const closedSection = this.page.locator('.closed-spaces');

    if (!(await closedSection.isVisible())) {
      return false;
    }

    const closedSpaces = this.page.locator('.closed-spaces .space-item');
    const targetSpace = closedSpaces.nth(spaceIndex);

    // Try restore button first
    const restoreButton = targetSpace.locator(
      'button:has-text("Restore"), button[title*="restore"]'
    );

    if (await restoreButton.count() > 0 && await restoreButton.first().isVisible()) {
      await restoreButton.first().click();
    } else {
      // Fallback: click the space itself
      await targetSpace.click();
    }

    await this.page.waitForTimeout(TIMING.EXTENSION_SYNC);
    return true;
  }

  /**
   * Get count of visible spaces
   */
  async getActiveSpaceCount(): Promise<number> {
    const spaceItems = this.page.locator('.active-spaces .space-item');
    return await spaceItems.count();
  }

  /**
   * Get count of closed spaces
   */
  async getClosedSpaceCount(): Promise<number> {
    const closedSection = this.page.locator('.closed-spaces');

    if (!(await closedSection.isVisible())) {
      return 0;
    }

    const closedSpaces = this.page.locator('.closed-spaces .space-item');
    return await closedSpaces.count();
  }

  /**
   * Get space name by index
   */
  async getSpaceName(spaceIndex: number, type: 'active' | 'closed' = 'active'): Promise<string> {
    const selector = type === 'active' ? '.active-spaces .space-item' : '.closed-spaces .space-item';
    const spaceItems = this.page.locator(selector);
    const space = spaceItems.nth(spaceIndex);

    const name = await space.locator('.space-name, .space-info h3').textContent();
    return name || '';
  }

  /**
   * Check if search input is focused (good UX indicator)
   */
  async isSearchFocused(): Promise<boolean> {
    const searchInput = this.page.locator('.search-input, input[type="text"]');
    return await searchInput.evaluate((el) => el === document.activeElement);
  }

  /**
   * User pauses to read something (realistic behavior)
   */
  async userReads(duration: 'short' | 'medium' | 'long' = 'medium'): Promise<void> {
    const delay = duration === 'short' ? TIMING.READ_SHORT :
                  duration === 'long' ? TIMING.READ_LONG :
                  TIMING.READ_MEDIUM;

    await this.page.waitForTimeout(delay);
  }

  /**
   * User thinks before taking action (realistic behavior)
   */
  async userThinks(): Promise<void> {
    await this.page.waitForTimeout(TIMING.THINK);
  }
}

/**
 * Environment Setup Helper
 * Creates realistic test environments for journeys
 */
export class JourneyEnvironment {
  constructor(private context: BrowserContext) {}

  /**
   * Create multiple spaces with URLs for realistic testing
   */
  async createSpaces(count: number, urlPattern?: (index: number) => string): Promise<void> {
    const getUrl = urlPattern || ((i: number) => `https://example${i}.com`);

    for (let i = 0; i < count; i++) {
      const page = await this.context.newPage();
      await page.goto(getUrl(i));
      await page.waitForLoadState('domcontentloaded');
    }

    // Wait for extension to register all spaces
    await this.context.pages()[0].waitForTimeout(TIMING.EXTENSION_SYNC);
  }

  /**
   * Create a space with multiple tabs (heavy tab load)
   */
  async createSpaceWithTabs(tabUrls: string[]): Promise<void> {
    for (const url of tabUrls) {
      const page = await this.context.newPage();
      await page.goto(url);
      await page.waitForLoadState('domcontentloaded');
    }

    await this.context.pages()[0].waitForTimeout(TIMING.EXTENSION_SYNC);
  }

  /**
   * Close all pages except extension pages
   */
  async cleanupPages(): Promise<void> {
    const pages = this.context.pages();

    for (const page of pages) {
      const url = page.url();

      // Skip extension pages and about:blank
      if (url.includes('chrome-extension://') || url === 'about:blank' || url === '') {
        continue;
      }

      try {
        await page.close();
      } catch (e) {
        // Ignore errors
      }
    }
  }
}

/**
 * Narrative logging helpers
 * Make console output read like a story
 */
export const narrative = {
  /**
   * Log the start of a journey phase
   */
  startPhase(phaseName: string): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎬 ${phaseName.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);
  },

  /**
   * Log user action
   */
  userAction(action: string): void {
    console.log(`📖 ${action}`);
  },

  /**
   * Log user thought/intention
   */
  userThought(thought: string): void {
    console.log(`💭 User: "${thought}"`);
  },

  /**
   * Log successful outcome
   */
  success(message: string): void {
    console.log(`✅ ${message}`);
  },

  /**
   * Log failure or problem
   */
  problem(message: string): void {
    console.log(`❌ ${message}`);
  },

  /**
   * Log metric or data point
   */
  metric(label: string, value: string | number): void {
    console.log(`📊 ${label}: ${value}`);
  },

  /**
   * Log important insight or learning
   */
  insight(message: string): void {
    console.log(`💡 ${message}`);
  },

  /**
   * Log keyboard action
   */
  keyboard(key: string): void {
    console.log(`⌨️  Pressing: ${key}`);
  },

  /**
   * Log timer/performance metric
   */
  timing(label: string, seconds: number): void {
    console.log(`⏱️  ${label}: ${seconds.toFixed(1)}s`);
  },

  /**
   * Log journey summary header
   */
  summary(journeyName: string): void {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🏆 ${journeyName.toUpperCase()} COMPLETE`);
    console.log(`${'='.repeat(60)}\n`);
  },
};

/**
 * Assertion helpers for user-visible feedback
 */
export const assertions = {
  /**
   * Assert user sees expected space count
   */
  async spaceCount(
    page: Page,
    expectedCount: number,
    type: 'active' | 'closed' = 'active'
  ): Promise<void> {
    const helper = new JourneyHelper(page);
    const count = type === 'active'
      ? await helper.getActiveSpaceCount()
      : await helper.getClosedSpaceCount();

    if (count !== expectedCount) {
      throw new Error(
        `Expected ${expectedCount} ${type} space(s), but found ${count}`
      );
    }
  },

  /**
   * Assert search input is auto-focused (good UX)
   */
  async searchAutoFocused(page: Page): Promise<void> {
    const helper = new JourneyHelper(page);
    const isFocused = await helper.isSearchFocused();

    if (!isFocused) {
      throw new Error('Search input should be auto-focused for good UX');
    }
  },

  /**
   * Assert space has expected name
   */
  async spaceName(
    page: Page,
    spaceIndex: number,
    expectedName: string,
    type: 'active' | 'closed' = 'active'
  ): Promise<void> {
    const helper = new JourneyHelper(page);
    const actualName = await helper.getSpaceName(spaceIndex, type);

    if (!actualName.includes(expectedName)) {
      throw new Error(
        `Expected space name to contain "${expectedName}", but got "${actualName}"`
      );
    }
  },
};

/**
 * Common test patterns for journey tests
 */
export const patterns = {
  /**
   * Standard popup opening pattern
   */
  async openPopup(page: Page, extensionId: string): Promise<JourneyHelper> {
    const helper = new JourneyHelper(page);
    await helper.openPopup(extensionId);
    narrative.success('Popup opened - user sees interface');
    return helper;
  },

  /**
   * Search and switch pattern (most common workflow)
   */
  async searchAndSwitch(
    page: Page,
    query: string,
    speed: 'slow' | 'normal' | 'fast' = 'normal'
  ): Promise<number> {
    const startTime = Date.now();
    const helper = new JourneyHelper(page);

    narrative.userAction(`Searching for "${query}"`);
    await helper.searchFor(query, speed);

    narrative.keyboard('Enter');
    await helper.switchToSpace();

    const elapsed = (Date.now() - startTime) / 1000;
    narrative.timing('Search and switch completed', elapsed);

    return elapsed;
  },

  /**
   * Quick rename pattern
   */
  async quickRename(page: Page, spaceIndex: number, newName: string): Promise<boolean> {
    const helper = new JourneyHelper(page);

    narrative.userAction(`Renaming space ${spaceIndex + 1} to "${newName}"`);
    const success = await helper.renameSpace(spaceIndex, newName);

    if (success) {
      narrative.success(`Renamed to "${newName}"`);
    } else {
      narrative.problem('Rename validation failed');
    }

    return success;
  },
};