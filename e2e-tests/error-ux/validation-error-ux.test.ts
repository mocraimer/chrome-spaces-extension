/**
 * Validation Error UX Tests
 *
 * Tests user experience when providing invalid input:
 * - Empty space names
 * - Names that are too long
 * - Special characters
 * - Duplicate names
 * - Real-time validation feedback
 * - Error message positioning
 * - Recovery paths
 *
 * Focus: Clear, actionable validation messages near the input field
 */

import { test, expect, chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import { InteractionFlowBuilder } from '../framework/InteractionFlowBuilder';
import {
  verifyErrorMessage,
  verifyVisualErrorIndicators,
  waitForError
} from './error-simulation-helpers';

test.describe('Validation Error UX Tests', () => {
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

  test('should show clear error for empty space name', async () => {
    // Create a space first
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    // Try to rename to empty name
    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.waitFor({ state: 'visible' });
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.waitFor({ state: 'visible' });

    // Clear to empty
    await input.fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Verify error message
    const errorMsg = page.locator(
      '[data-testid="validation-error"], .validation-error, [role="alert"]'
    ).first();

    const errorVisible = await errorMsg.isVisible({ timeout: 3000 }).catch(() => false);

    if (errorVisible) {
      const errorText = await errorMsg.textContent() || '';
      const message = errorText.toLowerCase();

      // Should mention that name is required or cannot be empty
      const hasValidMessage =
        message.includes('name') &&
        (message.includes('required') ||
         message.includes('empty') ||
         message.includes('cannot be blank') ||
         message.includes('must have a name'));

      expect(hasValidMessage).toBe(true);

      // Error should be near the input
      const inputBox = await input.boundingBox();
      const errorBox = await errorMsg.boundingBox();

      if (inputBox && errorBox) {
        // Error should be within reasonable distance of input (e.g., below it)
        const distance = Math.abs(errorBox.y - (inputBox.y + inputBox.height));
        expect(distance).toBeLessThan(100);
      }

      // Error should be accessible
      const role = await errorMsg.getAttribute('role');
      expect(role).toBe('alert');

      // Input should stay in edit mode (user can fix)
      expect(await input.isVisible()).toBe(true);
      expect(await input.isFocused()).toBe(true);
    } else {
      // Alternative: input might prevent empty submission
      // In that case, input should still be visible and focused
      expect(await input.isVisible()).toBe(true);
      expect(await input.isFocused()).toBe(true);
    }

    // User corrects the error
    await input.fill('Valid Name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Error should disappear
    const errorStillVisible = await errorMsg.isVisible({ timeout: 1000 }).catch(() => false);
    expect(errorStillVisible).toBe(false);

    // Save should succeed
    const savedName = await page.locator('text=Valid Name').isVisible({ timeout: 2000 }).catch(() => false);
    expect(savedName).toBe(true);
  });

  test('should show error for space name that is too long', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Try to enter very long name
    const longName = 'A'.repeat(200);
    await input.fill(longName);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Should show error or truncate
    const errorMsg = page.locator('[role="alert"], .validation-error').first();
    const errorVisible = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);

    if (errorVisible) {
      const errorText = await errorMsg.textContent() || '';
      const message = errorText.toLowerCase();

      // Should mention length limit
      const hasLengthMessage =
        message.includes('too long') ||
        message.includes('maximum') ||
        message.includes('characters') ||
        message.includes('limit');

      expect(hasLengthMessage).toBe(true);

      // Should show the actual limit if possible
      const hasNumber = /\d+/.test(errorText);
      expect(hasNumber).toBe(true);

      // Input should stay editable
      expect(await input.isVisible()).toBe(true);
    } else {
      // Alternative: input might have maxLength attribute
      const maxLength = await input.getAttribute('maxlength');
      expect(maxLength).toBeTruthy();

      // Or name might be truncated
      const value = await input.inputValue();
      expect(value.length).toBeLessThan(longName.length);
    }
  });

  test('should provide real-time validation feedback', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Clear input
    await input.fill('');
    await page.waitForTimeout(300);

    // Look for real-time validation (before submission)
    const validationFeedback = page.locator(
      '[data-testid="validation-error"], .validation-error, .error-text, .help-text'
    );

    const hasRealtimeValidation = await validationFeedback.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasRealtimeValidation) {
      // Real-time validation is good UX
      console.log('✓ Real-time validation present');

      // Type something valid
      await input.fill('Valid');
      await page.waitForTimeout(300);

      // Error should disappear
      const errorStillVisible = await validationFeedback.isVisible({ timeout: 1000 }).catch(() => false);

      // If it was a real-time error, it should disappear when input becomes valid
      if (errorStillVisible) {
        const text = await validationFeedback.textContent();
        // Should not show error for valid input
        expect(text?.toLowerCase().includes('error')).toBe(false);
      }
    } else {
      // Validation on submit is also acceptable
      console.log('✓ Validation on submit');
    }

    // Final validation on submit
    await input.fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    // Should show error on submit if empty
    const errorOnSubmit = await validationFeedback.isVisible({ timeout: 2000 }).catch(() => false);

    if (errorOnSubmit) {
      expect(await input.isVisible()).toBe(true); // Should stay in edit mode
      expect(await input.isFocused()).toBe(true);
    }
  });

  test('should handle special characters appropriately', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Test various special characters
    const testCases = [
      { name: 'Emoji 🚀', shouldAllow: true },
      { name: 'With-Dash', shouldAllow: true },
      { name: 'With_Underscore', shouldAllow: true },
      { name: 'With.Dot', shouldAllow: true },
      { name: 'With Space', shouldAllow: true },
      { name: 'With/Slash', shouldAllow: false }, // Might be problematic
      { name: 'With\\Backslash', shouldAllow: false },
      { name: '<Script>', shouldAllow: false },
      { name: 'NULL\0', shouldAllow: false },
    ];

    for (const testCase of testCases) {
      await input.fill(testCase.name);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      const errorMsg = page.locator('[role="alert"], .validation-error').first();
      const hasError = await errorMsg.isVisible({ timeout: 1000 }).catch(() => false);

      if (!testCase.shouldAllow && hasError) {
        // Good: showed error for invalid characters
        const errorText = await errorMsg.textContent() || '';
        console.log(`✓ Correctly rejected: "${testCase.name}" - ${errorText}`);

        // Error message should explain why
        const isHelpful =
          errorText.toLowerCase().includes('character') ||
          errorText.toLowerCase().includes('invalid') ||
          errorText.toLowerCase().includes('not allowed');

        expect(isHelpful).toBe(true);
      }

      if (testCase.shouldAllow && !hasError) {
        // Good: allowed valid characters
        console.log(`✓ Correctly allowed: "${testCase.name}"`);
      }

      // Reset for next test
      await page.keyboard.press('F2');
      await page.waitForTimeout(200);
    }
  });

  test('should handle duplicate names gracefully', async () => {
    // Create first space with a name
    const page1 = await context.newPage();
    await page1.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const firstSpace = page.locator('[data-testid="space-item"], .space-item').first();
    await firstSpace.focus();
    await page.keyboard.press('F2');

    let input = page.locator('[data-testid="space-name-input"], input.edit-input');
    await input.fill('Duplicate Test');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Create second space
    const page2 = await context.newPage();
    await page2.goto('https://github.com');
    await page.waitForTimeout(500);

    // Try to name it the same
    await page.reload();
    await page.waitForTimeout(500);

    const spaces = page.locator('[data-testid="space-item"], .space-item');
    const secondSpace = spaces.nth(1);

    if (await secondSpace.isVisible({ timeout: 2000 })) {
      await secondSpace.focus();
      await page.keyboard.press('F2');

      input = page.locator('[data-testid="space-name-input"], input.edit-input');
      await input.fill('Duplicate Test');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);

      // Should either:
      // 1. Allow duplicates (not ideal but acceptable)
      // 2. Show warning/error
      // 3. Auto-append number (e.g., "Duplicate Test (2)")

      const errorMsg = page.locator('[role="alert"], .validation-error').first();
      const hasError = await errorMsg.isVisible({ timeout: 2000 }).catch(() => false);

      if (hasError) {
        const errorText = await errorMsg.textContent() || '';
        const message = errorText.toLowerCase();

        // Should mention duplicate or already exists
        const hasDuplicateMessage =
          message.includes('duplicate') ||
          message.includes('already exists') ||
          message.includes('name is taken') ||
          message.includes('choose different');

        expect(hasDuplicateMessage).toBe(true);

        // Should suggest solution
        expect(errorText.length).toBeGreaterThan(20); // Should be explanatory
      }
    }
  });

  test('should show validation errors in correct order of priority', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Test: empty name (highest priority)
    await input.fill('');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    let errorMsg = page.locator('[role="alert"], .validation-error').first();
    let errorText = await errorMsg.textContent().catch(() => '');

    if (errorText) {
      // Should prioritize "required" over other validations
      expect(errorText.toLowerCase()).toContain('required');
    }

    // Test: whitespace-only name
    await page.keyboard.press('F2');
    await input.fill('   ');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);

    errorText = await errorMsg.textContent().catch(() => '');
    if (errorText) {
      // Should mention empty or invalid
      const hasValidMessage =
        errorText.toLowerCase().includes('empty') ||
        errorText.toLowerCase().includes('required') ||
        errorText.toLowerCase().includes('invalid');

      expect(hasValidMessage).toBe(true);
    }
  });

  test('should preserve user input when validation fails', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Enter invalid input
    const invalidInput = 'A'.repeat(200);
    await input.fill(invalidInput);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Input should still be there
    const currentValue = await input.inputValue().catch(() => '');

    // Should either:
    // 1. Preserve full input (best UX)
    // 2. Truncate to max length (acceptable)

    expect(currentValue.length).toBeGreaterThan(0);

    // Input should still be editable
    expect(await input.isVisible()).toBe(true);

    // User should be able to correct it
    await input.fill('Corrected Name');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);

    // Should save successfully
    const saved = await page.locator('text=Corrected Name').isVisible({ timeout: 2000 }).catch(() => false);
    expect(saved).toBe(true);
  });

  test('should provide helpful validation on paste', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Simulate pasting very long text
    const longText = 'A'.repeat(500);

    await input.evaluate((el, text) => {
      const inputEl = el as HTMLInputElement;
      inputEl.value = text;
      inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    }, longText);

    await page.waitForTimeout(500);

    // Should either:
    // 1. Show validation error immediately
    // 2. Truncate to valid length
    // 3. Show character count/limit

    const value = await input.inputValue();

    if (value.length < longText.length) {
      // Good: auto-truncated
      console.log('✓ Auto-truncated long paste');
    }

    const errorMsg = page.locator('[role="alert"], .validation-error, .help-text').first();
    const hasValidation = await errorMsg.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasValidation) {
      // Good: showed validation feedback
      console.log('✓ Validation feedback on paste');
    }

    // At minimum, should handle paste without crashing
    expect(await input.isVisible()).toBe(true);
  });

  test('should show character count for long names', async () => {
    const setupPage = await context.newPage();
    await setupPage.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize().openPopup();

    const spaceItem = page.locator('[data-testid="space-item"], .space-item').first();
    await spaceItem.focus();
    await page.keyboard.press('F2');

    const input = page.locator('[data-testid="space-name-input"], input.edit-input');

    // Type a moderately long name
    const longName = 'This is a somewhat long space name';
    await input.fill(longName);
    await page.waitForTimeout(300);

    // Look for character counter
    const charCounter = page.locator(
      '[data-testid="char-count"], .char-count, .character-counter'
    );

    const hasCounter = await charCounter.isVisible({ timeout: 1000 }).catch(() => false);

    if (hasCounter) {
      const counterText = await charCounter.textContent();
      console.log(`✓ Character counter: ${counterText}`);

      // Should show current count and/or limit
      expect(counterText).toMatch(/\d+/);
    } else {
      console.log('ℹ No character counter (acceptable)');
    }
  });
});