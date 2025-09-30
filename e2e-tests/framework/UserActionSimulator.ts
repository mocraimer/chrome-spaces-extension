/**
 * User Action Simulator
 *
 * Simulates realistic human user behavior for testing.
 * Instead of instant actions, this adds natural delays, curves, and think time
 * to make tests more closely match how real users interact with the extension.
 */

import { Page, Keyboard, Mouse } from '@playwright/test';

export interface TypingOptions {
  /** Delay between keystrokes in milliseconds (default: 50-150ms randomized) */
  delayBetweenKeys?: number;
  /** Whether to add random variations to delays (default: true) */
  randomizeDelay?: boolean;
  /** Minimum delay in ms (default: 30) */
  minDelay?: number;
  /** Maximum delay in ms (default: 200) */
  maxDelay?: number;
  /** Simulate occasional typos that get corrected (default: false) */
  simulateTypos?: boolean;
}

export interface ClickOptions {
  /** Delay before click in ms (default: 100-300ms randomized) */
  thinkTime?: number;
  /** Whether to move mouse naturally to target (default: true) */
  naturalMovement?: boolean;
  /** Whether this is a double-click (default: false) */
  doubleClick?: boolean;
  /** Which mouse button to use (default: 'left') */
  button?: 'left' | 'right' | 'middle';
}

export interface NavigationOptions {
  /** Delay between key presses in ms (default: 200-400ms) */
  delayBetweenSteps?: number;
  /** Whether to add visual focus indicators (default: true) */
  verifyFocus?: boolean;
}

/**
 * Simulates realistic user typing behavior
 */
export class UserActionSimulator {
  constructor(
    private page: Page,
    private keyboard: Keyboard = page.keyboard,
    private mouse: Mouse = page.mouse
  ) {}

  /**
   * Type text with realistic human-like delays and variations
   */
  async typeWithRealisticDelay(
    text: string,
    options: TypingOptions = {}
  ): Promise<void> {
    const {
      randomizeDelay = true,
      minDelay = 30,
      maxDelay = 200,
      simulateTypos = false
    } = options;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Simulate occasional typos (1% chance)
      if (simulateTypos && Math.random() < 0.01) {
        // Type wrong character
        const wrongChar = String.fromCharCode(char.charCodeAt(0) + 1);
        await this.keyboard.type(wrongChar);
        await this.randomDelay(100, 300);

        // Backspace to correct
        await this.keyboard.press('Backspace');
        await this.randomDelay(50, 150);
      }

      // Type the correct character
      await this.keyboard.type(char);

      // Add realistic delay before next character
      if (randomizeDelay) {
        await this.randomDelay(minDelay, maxDelay);
      } else {
        await this.page.waitForTimeout(options.delayBetweenKeys || 100);
      }
    }
  }

  /**
   * Click with natural mouse movement and think time
   */
  async clickWithNaturalDelay(
    selector: string,
    options: ClickOptions = {}
  ): Promise<void> {
    const {
      thinkTime = this.getRandomInt(100, 300),
      naturalMovement = true,
      doubleClick = false,
      button = 'left'
    } = options;

    // Think time before action
    await this.page.waitForTimeout(thinkTime);

    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });

    if (naturalMovement) {
      // Get element position
      const box = await element.boundingBox();
      if (box) {
        // Move to a random point within the element
        const targetX = box.x + box.width * (0.3 + Math.random() * 0.4);
        const targetY = box.y + box.height * (0.3 + Math.random() * 0.4);

        // Move mouse naturally (not instant)
        await this.moveMouseNaturally(targetX, targetY);
        await this.randomDelay(50, 150);
      }
    }

    // Perform the click
    if (doubleClick) {
      await element.dblclick({ button });
    } else {
      await element.click({ button });
    }

    // Small delay after click (hand movement away)
    await this.randomDelay(50, 150);
  }

  /**
   * Navigate using arrow keys with realistic delays
   */
  async navigateWithArrowKeys(
    direction: 'up' | 'down' | 'left' | 'right',
    steps: number = 1,
    options: NavigationOptions = {}
  ): Promise<void> {
    const {
      delayBetweenSteps = this.getRandomInt(200, 400),
      verifyFocus = true
    } = options;

    const keyMap = {
      up: 'ArrowUp',
      down: 'ArrowDown',
      left: 'ArrowLeft',
      right: 'ArrowRight'
    };

    for (let i = 0; i < steps; i++) {
      await this.keyboard.press(keyMap[direction]);

      if (verifyFocus) {
        // Wait for visual feedback to complete
        await this.page.waitForTimeout(150);
      }

      if (i < steps - 1) {
        await this.page.waitForTimeout(delayBetweenSteps);
      }
    }
  }

  /**
   * Press a key with optional modifiers and natural delay
   */
  async pressKey(
    key: string,
    modifiers?: string[],
    thinkTime?: number
  ): Promise<void> {
    // Think time before pressing
    await this.randomDelay(thinkTime || 100, thinkTime ? thinkTime + 100 : 300);

    if (modifiers && modifiers.length > 0) {
      // Press modifiers first
      for (const mod of modifiers) {
        await this.keyboard.down(mod);
        await this.randomDelay(20, 50);
      }

      // Press main key
      await this.keyboard.press(key);
      await this.randomDelay(20, 50);

      // Release modifiers
      for (const mod of modifiers.reverse()) {
        await this.keyboard.up(mod);
        await this.randomDelay(20, 50);
      }
    } else {
      await this.keyboard.press(key);
    }

    // Small delay after key press
    await this.randomDelay(50, 150);
  }

  /**
   * Simulate keyboard shortcuts (like Ctrl+A, F2, etc.)
   */
  async pressShortcut(shortcut: string): Promise<void> {
    const parts = shortcut.toLowerCase().split('+');

    if (parts.length === 1) {
      // Simple key press
      await this.pressKey(shortcut);
    } else {
      // Key combination
      const modifiers = parts.slice(0, -1);
      const key = parts[parts.length - 1];

      await this.pressKey(key, modifiers);
    }
  }

  /**
   * Hover over an element with natural mouse movement
   */
  async hoverWithNaturalMovement(selector: string): Promise<void> {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible' });

    const box = await element.boundingBox();
    if (box) {
      const targetX = box.x + box.width / 2;
      const targetY = box.y + box.height / 2;

      await this.moveMouseNaturally(targetX, targetY);
      await this.randomDelay(100, 300); // Hover duration
    }
  }

  /**
   * Simulate natural mouse movement with curves
   * Uses Bezier curve approximation for realistic motion
   */
  private async moveMouseNaturally(
    targetX: number,
    targetY: number,
    steps: number = 10
  ): Promise<void> {
    // Get current mouse position (approximate)
    const currentPos = await this.page.evaluate(() => {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    });

    // Create control points for Bezier curve
    const controlX = (currentPos.x + targetX) / 2 + (Math.random() - 0.5) * 50;
    const controlY = (currentPos.y + targetY) / 2 + (Math.random() - 0.5) * 50;

    // Move in steps along the curve
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      // Quadratic Bezier curve formula
      const x =
        Math.pow(1 - t, 2) * currentPos.x +
        2 * (1 - t) * t * controlX +
        Math.pow(t, 2) * targetX;

      const y =
        Math.pow(1 - t, 2) * currentPos.y +
        2 * (1 - t) * t * controlY +
        Math.pow(t, 2) * targetY;

      await this.mouse.move(x, y);
      await this.randomDelay(5, 20); // Natural movement speed
    }
  }

  /**
   * Wait for a random duration within a range (simulates think time)
   */
  async randomDelay(min: number, max: number): Promise<void> {
    const delay = this.getRandomInt(min, max);
    await this.page.waitForTimeout(delay);
  }

  /**
   * Simulate user reading content (longer think time)
   */
  async simulateReadingTime(estimatedWords: number = 10): Promise<void> {
    // Average reading speed: 200-250 words per minute
    // That's ~250ms per word, but we'll use shorter for testing
    const readingTime = estimatedWords * this.getRandomInt(100, 200);
    await this.page.waitForTimeout(readingTime);
  }

  /**
   * Simulate user pausing to think
   */
  async simulateThinkTime(duration: 'short' | 'medium' | 'long' = 'medium'): Promise<void> {
    const durations = {
      short: [300, 800],
      medium: [800, 1500],
      long: [1500, 3000]
    };

    const [min, max] = durations[duration];
    await this.randomDelay(min, max);
  }

  /**
   * Simulate filling a form with natural pauses between fields
   */
  async fillFormWithNaturalBehavior(
    fields: Array<{ selector: string; value: string }>,
    options: TypingOptions = {}
  ): Promise<void> {
    for (let i = 0; i < fields.length; i++) {
      const field = fields[i];

      // Click into field
      await this.clickWithNaturalDelay(field.selector);

      // Small pause before typing (reading the field label)
      await this.randomDelay(200, 500);

      // Type the value
      await this.typeWithRealisticDelay(field.value, options);

      // Pause between fields (moving focus)
      if (i < fields.length - 1) {
        await this.randomDelay(300, 700);
      }
    }
  }

  /**
   * Simulate drag and drop with natural movement
   */
  async dragAndDropNaturally(
    sourceSelector: string,
    targetSelector: string
  ): Promise<void> {
    const source = this.page.locator(sourceSelector);
    const target = this.page.locator(targetSelector);

    await source.waitFor({ state: 'visible' });
    await target.waitFor({ state: 'visible' });

    // Get positions
    const sourceBox = await source.boundingBox();
    const targetBox = await target.boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error('Could not get element positions for drag and drop');
    }

    // Move to source
    await this.moveMouseNaturally(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2
    );

    await this.randomDelay(100, 200);

    // Mouse down
    await this.mouse.down();
    await this.randomDelay(50, 100);

    // Drag to target
    await this.moveMouseNaturally(
      targetBox.x + targetBox.width / 2,
      targetBox.y + targetBox.height / 2,
      15 // More steps for drag
    );

    await this.randomDelay(100, 200);

    // Mouse up
    await this.mouse.up();
  }

  /**
   * Get random integer between min and max (inclusive)
   */
  private getRandomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Simulate user scrolling
   */
  async scrollWithMouseWheel(
    direction: 'up' | 'down',
    amount: number = 100
  ): Promise<void> {
    const delta = direction === 'down' ? amount : -amount;

    await this.page.mouse.wheel(0, delta);
    await this.randomDelay(100, 300);
  }

  /**
   * Simulate clicking and holding (for context menus, etc.)
   */
  async clickAndHold(
    selector: string,
    holdDuration: number = 500
  ): Promise<void> {
    await this.clickWithNaturalDelay(selector, { naturalMovement: true });
    await this.mouse.down();
    await this.page.waitForTimeout(holdDuration);
    await this.mouse.up();
  }
}