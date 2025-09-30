/**
 * Interaction Flow Builder
 *
 * Main fluent API for building interaction flows.
 * Allows chaining user actions to create readable, maintainable test scenarios.
 */

import { Page, BrowserContext, expect } from '@playwright/test';
import { UserActionSimulator, TypingOptions, ClickOptions } from './UserActionSimulator';
import { InteractionFlowAssertions } from './InteractionFlowAssertions';

export interface FlowOptions {
  /** Whether to take screenshots at each step (default: false) */
  screenshotOnStep?: boolean;
  /** Whether to log each action (default: true) */
  logActions?: boolean;
  /** Default timeout for waits (default: 5000ms) */
  defaultTimeout?: number;
  /** Whether to capture failure screenshots automatically (default: true) */
  captureFailures?: boolean;
}

/**
 * Main interaction flow builder for Chrome Spaces extension
 */
export class InteractionFlowBuilder {
  private simulator: UserActionSimulator;
  private assertions: InteractionFlowAssertions;
  private extensionId: string = '';
  private options: FlowOptions;
  private stepCounter: number = 0;

  constructor(
    private page: Page,
    private context: BrowserContext,
    options: FlowOptions = {}
  ) {
    this.simulator = new UserActionSimulator(page);
    this.assertions = new InteractionFlowAssertions(page);
    this.options = {
      screenshotOnStep: false,
      logActions: true,
      defaultTimeout: 5000,
      captureFailures: true,
      ...options
    };
  }

  /**
   * Initialize the flow builder with extension ID
   */
  async initialize(): Promise<this> {
    this.extensionId = await this.getExtensionId();
    return this;
  }

  /**
   * Open the extension popup
   */
  async openPopup(): Promise<this> {
    await this.logStep('Opening popup');

    if (!this.extensionId) {
      await this.initialize();
    }

    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    await this.page.goto(popupUrl);
    await this.page.waitForLoadState('domcontentloaded');

    // Wait for popup to be ready
    await this.assertions.verifyPopupReady();
    await this.takeStepScreenshot('popup-opened');

    return this;
  }

  /**
   * Search for spaces with a query
   */
  async searchFor(query: string, options?: TypingOptions): Promise<this> {
    await this.logStep(`Searching for: "${query}"`);

    const searchInput = this.page.locator('.search-input, [data-testid="search-input"]');
    await searchInput.waitFor({ state: 'visible' });

    // Clear any existing search
    await searchInput.clear();

    // Type with realistic delay
    await searchInput.focus();
    await this.simulator.typeWithRealisticDelay(query, options);

    // Wait for search results to filter
    await this.page.waitForTimeout(300);
    await this.takeStepScreenshot(`search-${query}`);

    this.assertions.recordAction(`Searched for "${query}"`);
    return this;
  }

  /**
   * Clear the search input
   */
  async clearSearch(): Promise<this> {
    await this.logStep('Clearing search');

    const searchInput = this.page.locator('.search-input, [data-testid="search-input"]');
    await searchInput.clear();
    await this.page.waitForTimeout(200);

    await this.takeStepScreenshot('search-cleared');
    this.assertions.recordAction('Cleared search');
    return this;
  }

  /**
   * Select first result in the list
   */
  async selectFirstResult(): Promise<this> {
    await this.logStep('Selecting first result');

    const firstSpace = this.page.locator('.space-item:visible').first();
    await expect(firstSpace).toBeVisible({ timeout: this.options.defaultTimeout });

    // Navigate to first item with arrow down
    await this.simulator.navigateWithArrowKeys('down', 1);
    await this.takeStepScreenshot('first-result-selected');

    this.assertions.recordAction('Selected first result');
    return this;
  }

  /**
   * Select space by index (0-based)
   */
  async selectSpaceByIndex(index: number): Promise<this> {
    await this.logStep(`Selecting space at index ${index}`);

    // Navigate down by index + 1 times (assuming we start at search)
    await this.simulator.navigateWithArrowKeys('down', index + 1);
    await this.takeStepScreenshot(`space-${index}-selected`);

    this.assertions.recordAction(`Selected space at index ${index}`);
    return this;
  }

  /**
   * Select space by name (clicks on it)
   */
  async selectSpaceByName(name: string): Promise<this> {
    await this.logStep(`Selecting space: "${name}"`);

    const spaceItem = this.page.locator('.space-item').filter({ hasText: name });
    await this.simulator.clickWithNaturalDelay('.space-item:has-text("' + name + '")');
    await this.takeStepScreenshot(`space-${name}-selected`);

    this.assertions.recordAction(`Selected space "${name}"`);
    return this;
  }

  /**
   * Edit the name of the currently selected space
   */
  async editName(newName: string, options?: TypingOptions): Promise<this> {
    await this.logStep(`Editing name to: "${newName}"`);

    // Enter edit mode (should already be in it, or trigger it)
    const editInput = this.page.locator('.edit-input, .space-name-input, [data-testid="space-name-input"]');

    if (!(await editInput.isVisible())) {
      // Not in edit mode, press F2 to enter
      await this.pressF2();
    }

    // Clear and type new name
    await editInput.clear();
    await this.simulator.typeWithRealisticDelay(newName, options);

    await this.takeStepScreenshot(`name-edited-${newName}`);
    this.assertions.recordAction(`Edited name to "${newName}"`);
    return this;
  }

  /**
   * Save the current edit (press Enter)
   */
  async saveEdit(): Promise<this> {
    await this.logStep('Saving edit');

    await this.simulator.pressKey('Enter');
    await this.page.waitForTimeout(300); // Wait for save to complete

    // Verify we exited edit mode
    await this.assertions.verifyNotInEditMode();
    await this.takeStepScreenshot('edit-saved');

    this.assertions.recordAction('Saved edit');
    return this;
  }

  /**
   * Cancel the current edit (press Escape)
   */
  async cancelEdit(): Promise<this> {
    await this.logStep('Cancelling edit');

    await this.simulator.pressKey('Escape');
    await this.page.waitForTimeout(200);

    await this.assertions.verifyNotInEditMode();
    await this.takeStepScreenshot('edit-cancelled');

    this.assertions.recordAction('Cancelled edit');
    return this;
  }

  /**
   * Press F2 to enter edit mode
   */
  async pressF2(): Promise<this> {
    await this.logStep('Pressing F2 to edit');

    await this.simulator.pressKey('F2');
    await this.page.waitForTimeout(200);

    await this.assertions.verifyInEditMode();
    await this.takeStepScreenshot('f2-edit-mode');

    this.assertions.recordAction('Pressed F2');
    return this;
  }

  /**
   * Press Escape key
   */
  async pressEscape(): Promise<this> {
    await this.logStep('Pressing Escape');

    await this.simulator.pressKey('Escape');
    await this.page.waitForTimeout(200);
    await this.takeStepScreenshot('escape-pressed');

    this.assertions.recordAction('Pressed Escape');
    return this;
  }

  /**
   * Press Enter key
   */
  async pressEnter(): Promise<this> {
    await this.logStep('Pressing Enter');

    await this.simulator.pressKey('Enter');
    await this.page.waitForTimeout(200);
    await this.takeStepScreenshot('enter-pressed');

    this.assertions.recordAction('Pressed Enter');
    return this;
  }

  /**
   * Double-click on a space to edit
   */
  async doubleClickToEdit(spaceName: string): Promise<this> {
    await this.logStep(`Double-clicking to edit: "${spaceName}"`);

    await this.simulator.clickWithNaturalDelay(`.space-item:has-text("${spaceName}")`, {
      doubleClick: true
    });

    await this.assertions.verifyInEditMode(spaceName);
    await this.takeStepScreenshot(`double-click-edit-${spaceName}`);

    this.assertions.recordAction(`Double-clicked to edit "${spaceName}"`);
    return this;
  }

  /**
   * Switch to the currently selected space
   */
  async switchToSpace(): Promise<this> {
    await this.logStep('Switching to space');

    await this.simulator.pressKey('Enter');
    await this.page.waitForTimeout(500);

    await this.takeStepScreenshot('space-switched');
    this.assertions.recordAction('Switched to space');
    return this;
  }

  /**
   * Navigate using arrow keys
   */
  async navigateDown(steps: number = 1): Promise<this> {
    await this.logStep(`Navigating down ${steps} step(s)`);

    await this.simulator.navigateWithArrowKeys('down', steps);
    await this.takeStepScreenshot(`navigate-down-${steps}`);

    this.assertions.recordAction(`Navigated down ${steps} step(s)`);
    return this;
  }

  /**
   * Navigate up using arrow keys
   */
  async navigateUp(steps: number = 1): Promise<this> {
    await this.logStep(`Navigating up ${steps} step(s)`);

    await this.simulator.navigateWithArrowKeys('up', steps);
    await this.takeStepScreenshot(`navigate-up-${steps}`);

    this.assertions.recordAction(`Navigated up ${steps} step(s)`);
    return this;
  }

  /**
   * Type with realistic delay (for any input)
   */
  async typeWithRealisticDelay(text: string, options?: TypingOptions): Promise<this> {
    await this.logStep(`Typing: "${text}"`);

    await this.simulator.typeWithRealisticDelay(text, options);
    await this.takeStepScreenshot(`typed-${text.substring(0, 20)}`);

    this.assertions.recordAction(`Typed "${text}"`);
    return this;
  }

  /**
   * Click on an element with natural movement
   */
  async clickElement(selector: string, options?: ClickOptions): Promise<this> {
    await this.logStep(`Clicking: ${selector}`);

    await this.simulator.clickWithNaturalDelay(selector, options);
    await this.takeStepScreenshot(`clicked-${selector}`);

    this.assertions.recordAction(`Clicked ${selector}`);
    return this;
  }

  /**
   * Hover over an element
   */
  async hoverElement(selector: string): Promise<this> {
    await this.logStep(`Hovering: ${selector}`);

    await this.simulator.hoverWithNaturalMovement(selector);
    await this.takeStepScreenshot(`hovered-${selector}`);

    this.assertions.recordAction(`Hovered ${selector}`);
    return this;
  }

  /**
   * Wait for a duration (simulate think time)
   */
  async wait(duration: number): Promise<this> {
    await this.logStep(`Waiting ${duration}ms`);

    await this.page.waitForTimeout(duration);
    this.assertions.recordAction(`Waited ${duration}ms`);
    return this;
  }

  /**
   * Simulate user thinking (random wait)
   */
  async think(duration: 'short' | 'medium' | 'long' = 'medium'): Promise<this> {
    await this.logStep(`Thinking (${duration})...`);

    await this.simulator.simulateThinkTime(duration);
    this.assertions.recordAction(`Think time: ${duration}`);
    return this;
  }

  // ============ VERIFICATION METHODS ============

  /**
   * Verify space is visible
   */
  async verifySpaceVisible(name: string): Promise<this> {
    await this.logStep(`Verifying space visible: "${name}"`);

    await this.assertions.verifySpaceVisible(name);
    await this.takeStepScreenshot(`verified-space-${name}`);
    return this;
  }

  /**
   * Verify in edit mode
   */
  async verifyInEditMode(): Promise<this> {
    await this.logStep('Verifying in edit mode');

    await this.assertions.verifyInEditMode();
    return this;
  }

  /**
   * Verify search filtered results
   */
  async verifySearchFiltered(count: number): Promise<this> {
    await this.logStep(`Verifying ${count} filtered results`);

    await this.assertions.verifySearchFiltered(count);
    await this.takeStepScreenshot(`verified-filter-${count}`);
    return this;
  }

  /**
   * Verify name changed
   */
  async verifyNameChanged(newName: string, oldName?: string): Promise<this> {
    await this.logStep(`Verifying name changed to: "${newName}"`);

    if (oldName) {
      await this.assertions.verifyNameChanged(oldName, newName);
    } else {
      await this.assertions.verifySpaceVisible(newName);
    }
    await this.takeStepScreenshot(`verified-name-${newName}`);
    return this;
  }

  /**
   * Verify all spaces visible
   */
  async verifyAllSpacesVisible(): Promise<this> {
    await this.logStep('Verifying all spaces visible');

    await this.assertions.verifyAllSpacesVisible();
    await this.takeStepScreenshot('verified-all-spaces');
    return this;
  }

  /**
   * Verify window switched
   */
  async verifyWindowSwitched(): Promise<this> {
    await this.logStep('Verifying window switched');

    await this.assertions.verifyWindowSwitched();
    return this;
  }

  /**
   * Verify space selected
   */
  async verifySpaceSelected(name?: string): Promise<this> {
    await this.logStep(`Verifying space selected${name ? `: "${name}"` : ''}`);

    await this.assertions.verifySpaceSelected(name);
    await this.takeStepScreenshot(`verified-selected${name ? `-${name}` : ''}`);
    return this;
  }

  /**
   * Verify error shown
   */
  async verifyErrorShown(message?: string): Promise<this> {
    await this.logStep(`Verifying error shown${message ? `: "${message}"` : ''}`);

    await this.assertions.verifyErrorShown(message);
    await this.takeStepScreenshot('verified-error');
    return this;
  }

  /**
   * Verify visual feedback
   */
  async verifyVisualFeedback(type: 'loading' | 'success' | 'error' | 'none' = 'none'): Promise<this> {
    await this.logStep(`Verifying visual feedback: ${type}`);

    await this.assertions.verifyVisualFeedback(type);
    return this;
  }

  // ============ HELPER METHODS ============

  /**
   * Get the extension ID from the context
   */
  private async getExtensionId(): Promise<string> {
    // Try service workers first
    const serviceWorkers = this.context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      const url = serviceWorkers[0].url();
      const match = url.match(/chrome-extension:\/\/([a-z]+)/);
      if (match) return match[1];
    }

    // Try from existing pages
    const pages = this.context.pages();
    for (const p of pages) {
      const url = p.url();
      if (url.startsWith('chrome-extension://')) {
        const match = url.match(/chrome-extension:\/\/([a-z]+)/);
        if (match) return match[1];
      }
    }

    throw new Error('Could not determine extension ID');
  }

  /**
   * Log a step (if logging enabled)
   */
  private async logStep(message: string): Promise<void> {
    this.stepCounter++;

    if (this.options.logActions) {
      console.log(`[Step ${this.stepCounter}] ${message}`);
    }

    this.assertions.setCurrentStep(message);
  }

  /**
   * Take a screenshot of the current step (if enabled)
   */
  private async takeStepScreenshot(name: string): Promise<void> {
    if (this.options.screenshotOnStep) {
      try {
        await this.page.screenshot({
          path: `test-results/steps/step-${this.stepCounter}-${name}.png`
        });
      } catch (error) {
        // Ignore screenshot errors
      }
    }
  }

  /**
   * Get the underlying page object (for advanced usage)
   */
  getPage(): Page {
    return this.page;
  }

  /**
   * Get the assertions helper (for custom assertions)
   */
  getAssertions(): InteractionFlowAssertions {
    return this.assertions;
  }

  /**
   * Get the action simulator (for custom actions)
   */
  getSimulator(): UserActionSimulator {
    return this.simulator;
  }

  /**
   * Get action history for debugging
   */
  getActionHistory(): string[] {
    return this.assertions.getActionHistory();
  }
}