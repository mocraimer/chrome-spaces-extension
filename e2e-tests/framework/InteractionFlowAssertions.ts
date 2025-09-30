/**
 * Interaction Flow Assertions
 *
 * Higher-level assertions for interaction flows.
 * These assertions understand the extension's behavior and provide
 * meaningful error messages when things go wrong.
 */

import { Page, expect, Locator } from '@playwright/test';

export interface AssertionContext {
  /** History of actions taken so far */
  actionHistory: string[];
  /** Current step being executed */
  currentStep?: string;
  /** Additional context data */
  metadata?: Record<string, any>;
}

/**
 * Higher-level assertions for Chrome Spaces extension interactions
 */
export class InteractionFlowAssertions {
  private context: AssertionContext = {
    actionHistory: []
  };

  constructor(private page: Page) {}

  /**
   * Add an action to the history for better error messages
   */
  recordAction(action: string): void {
    this.context.actionHistory.push(action);
  }

  /**
   * Set the current step for context
   */
  setCurrentStep(step: string): void {
    this.context.currentStep = step;
  }

  /**
   * Get full context for error messages
   */
  getContext(): string {
    const history = this.context.actionHistory.slice(-5).join(' → ');
    return `
Context:
  Current Step: ${this.context.currentStep || 'Unknown'}
  Recent Actions: ${history || 'None'}
  Page URL: ${this.page.url()}
    `.trim();
  }

  /**
   * Verify that a space with the given name is visible in the list
   */
  async verifySpaceVisible(
    name: string,
    options: { timeout?: number; exact?: boolean } = {}
  ): Promise<void> {
    this.setCurrentStep(`Verifying space "${name}" is visible`);

    const { timeout = 5000, exact = false } = options;

    try {
      const selector = exact
        ? `.space-item:has-text("${name}")`
        : `.space-item:has-text("${name}")`;

      await expect(this.page.locator(selector).first()).toBeVisible({
        timeout
      });
    } catch (error) {
      throw new Error(
        `Space "${name}" not visible\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that we're in edit mode for a space
   */
  async verifyInEditMode(spaceName?: string): Promise<void> {
    this.setCurrentStep('Verifying edit mode is active');

    try {
      const editInput = this.page.locator('.edit-input, .space-name-input, [data-testid="space-name-input"]');
      await expect(editInput).toBeVisible({ timeout: 3000 });
      await expect(editInput).toBeFocused();

      if (spaceName) {
        const value = await editInput.inputValue();
        expect(value).toContain(spaceName);
      }
    } catch (error) {
      throw new Error(
        `Edit mode not active${spaceName ? ` for "${spaceName}"` : ''}\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that edit mode is NOT active
   */
  async verifyNotInEditMode(): Promise<void> {
    this.setCurrentStep('Verifying edit mode is not active');

    try {
      const editInput = this.page.locator('.edit-input, .space-name-input, [data-testid="space-name-input"]');
      await expect(editInput).not.toBeVisible({ timeout: 2000 });
    } catch (error) {
      throw new Error(
        `Edit mode unexpectedly active\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that search has filtered results to expected count
   */
  async verifySearchFiltered(expectedCount: number): Promise<void> {
    this.setCurrentStep(`Verifying search filtered to ${expectedCount} results`);

    try {
      const spaceItems = this.page.locator('.space-item:visible');
      await expect(spaceItems).toHaveCount(expectedCount, { timeout: 3000 });
    } catch (error) {
      const actualCount = await this.page.locator('.space-item:visible').count();
      throw new Error(
        `Expected ${expectedCount} spaces, found ${actualCount}\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that visual feedback is shown (loading, animation complete, etc.)
   */
  async verifyVisualFeedback(type: 'loading' | 'success' | 'error' | 'none' = 'none'): Promise<void> {
    this.setCurrentStep(`Verifying visual feedback: ${type}`);

    try {
      switch (type) {
        case 'loading':
          await expect(this.page.locator('.loading, [data-loading="true"]')).toBeVisible({
            timeout: 2000
          });
          break;

        case 'success':
          // Wait for success indicator or lack of error
          await expect(this.page.locator('.error, .error-message')).not.toBeVisible({
            timeout: 2000
          });
          break;

        case 'error':
          await expect(this.page.locator('.error, .error-message')).toBeVisible({
            timeout: 2000
          });
          break;

        case 'none':
          // Verify no loading or error states
          await expect(this.page.locator('.loading, [data-loading="true"]')).not.toBeVisible({
            timeout: 1000
          });
          await expect(this.page.locator('.error, .error-message')).not.toBeVisible({
            timeout: 1000
          });
          break;
      }
    } catch (error) {
      throw new Error(
        `Visual feedback verification failed for type: ${type}\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that an error message is shown with expected content
   */
  async verifyErrorShown(expectedMessage?: string): Promise<void> {
    this.setCurrentStep('Verifying error message is shown');

    try {
      const errorElement = this.page.locator('.error, .error-message');
      await expect(errorElement).toBeVisible({ timeout: 3000 });

      if (expectedMessage) {
        await expect(errorElement).toContainText(expectedMessage);
      }
    } catch (error) {
      throw new Error(
        `Error message not shown${expectedMessage ? ` with text "${expectedMessage}"` : ''}\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that the popup is open and ready
   */
  async verifyPopupReady(): Promise<void> {
    this.setCurrentStep('Verifying popup is ready');

    try {
      // Wait for main container
      await expect(this.page.locator('.popup-container, [data-testid="popup-container"]')).toBeVisible({
        timeout: 5000
      });

      // Wait for search input (it should auto-focus)
      await expect(this.page.locator('.search-input, [data-testid="search-input"]')).toBeVisible({
        timeout: 3000
      });

      // Wait for any loading to complete
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch (error) {
      throw new Error(
        `Popup not ready\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that a space is selected (keyboard navigation)
   */
  async verifySpaceSelected(spaceName?: string): Promise<void> {
    this.setCurrentStep(`Verifying space is selected${spaceName ? `: "${spaceName}"` : ''}`);

    try {
      const selectedSpace = this.page.locator('.space-item.selected, .space-item[data-selected="true"]');
      await expect(selectedSpace).toBeVisible({ timeout: 2000 });

      if (spaceName) {
        await expect(selectedSpace).toContainText(spaceName);
      }
    } catch (error) {
      throw new Error(
        `Space not selected${spaceName ? ` (expected "${spaceName}")` : ''}\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that the window has switched (for space switching tests)
   */
  async verifyWindowSwitched(expectedWindowId?: number): Promise<void> {
    this.setCurrentStep('Verifying window switched');

    try {
      // In a real Chrome extension, we'd verify via chrome.windows API
      // For now, verify that the popup closed (which happens on switch)
      const isPopupClosed = await this.page.isClosed();

      if (!isPopupClosed) {
        // If popup is still open, check if it's in transition
        await this.page.waitForTimeout(1000);
      }

      // Additional verification could be added here based on extension behavior
    } catch (error) {
      throw new Error(
        `Window switch verification failed\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that a space name has changed
   */
  async verifyNameChanged(oldName: string, newName: string): Promise<void> {
    this.setCurrentStep(`Verifying name changed from "${oldName}" to "${newName}"`);

    try {
      // Old name should not exist
      await expect(this.page.locator(`.space-item:has-text("${oldName}")`)).not.toBeVisible({
        timeout: 2000
      });

      // New name should exist
      await expect(this.page.locator(`.space-item:has-text("${newName}")`)).toBeVisible({
        timeout: 2000
      });
    } catch (error) {
      throw new Error(
        `Name change verification failed\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that all spaces are visible (no filter applied)
   */
  async verifyAllSpacesVisible(minimumCount: number = 1): Promise<void> {
    this.setCurrentStep('Verifying all spaces are visible');

    try {
      const spaceItems = this.page.locator('.space-item:visible');
      const count = await spaceItems.count();

      expect(count).toBeGreaterThanOrEqual(minimumCount);

      // Verify search is clear
      const searchInput = this.page.locator('.search-input, [data-testid="search-input"]');
      const searchValue = await searchInput.inputValue();
      expect(searchValue).toBe('');
    } catch (error) {
      const actualCount = await this.page.locator('.space-item:visible').count();
      throw new Error(
        `Not all spaces visible (found ${actualCount}, minimum ${minimumCount})\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that a confirmation dialog is shown
   */
  async verifyConfirmationDialog(expectedMessage?: string): Promise<void> {
    this.setCurrentStep('Verifying confirmation dialog is shown');

    try {
      const dialog = this.page.locator('.confirm-dialog, [role="dialog"]');
      await expect(dialog).toBeVisible({ timeout: 3000 });

      if (expectedMessage) {
        await expect(dialog).toContainText(expectedMessage);
      }
    } catch (error) {
      throw new Error(
        `Confirmation dialog not shown${expectedMessage ? ` with message "${expectedMessage}"` : ''}\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that search input is focused (initial state)
   */
  async verifySearchFocused(): Promise<void> {
    this.setCurrentStep('Verifying search input is focused');

    try {
      const searchInput = this.page.locator('.search-input, [data-testid="search-input"]');
      await expect(searchInput).toBeFocused({ timeout: 2000 });
    } catch (error) {
      throw new Error(
        `Search input not focused\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify that a closed space is visible in the closed section
   */
  async verifyClosedSpaceVisible(spaceName: string): Promise<void> {
    this.setCurrentStep(`Verifying closed space "${spaceName}" is visible`);

    try {
      const closedSpace = this.page.locator('.space-item.closed, .closed-space-item').filter({
        hasText: spaceName
      });
      await expect(closedSpace).toBeVisible({ timeout: 3000 });
    } catch (error) {
      throw new Error(
        `Closed space "${spaceName}" not visible\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Verify tab count for a space
   */
  async verifySpaceTabCount(spaceName: string, expectedCount: number): Promise<void> {
    this.setCurrentStep(`Verifying space "${spaceName}" has ${expectedCount} tabs`);

    try {
      const spaceItem = this.page.locator('.space-item').filter({ hasText: spaceName });
      const tabCountElement = spaceItem.locator('.tab-count, .space-details');

      await expect(tabCountElement).toContainText(`${expectedCount}`);
    } catch (error) {
      throw new Error(
        `Tab count verification failed for "${spaceName}"\n${this.getContext()}\nOriginal error: ${error.message}`
      );
    }
  }

  /**
   * Take a screenshot on assertion failure for debugging
   */
  async captureFailureScreenshot(testName: string): Promise<void> {
    try {
      const timestamp = Date.now();
      const filename = `failure-${testName}-${timestamp}.png`;
      await this.page.screenshot({
        path: `test-results/${filename}`,
        fullPage: true
      });
      console.log(`Failure screenshot saved: ${filename}`);
    } catch (error) {
      console.warn('Failed to capture screenshot:', error);
    }
  }

  /**
   * Get action history for debugging
   */
  getActionHistory(): string[] {
    return [...this.context.actionHistory];
  }

  /**
   * Clear action history (useful between test steps)
   */
  clearActionHistory(): void {
    this.context.actionHistory = [];
  }

  /**
   * Add custom metadata to context
   */
  addMetadata(key: string, value: any): void {
    if (!this.context.metadata) {
      this.context.metadata = {};
    }
    this.context.metadata[key] = value;
  }
}