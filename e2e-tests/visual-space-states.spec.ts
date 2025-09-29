import { test, expect } from '@playwright/test';
import {
  ExtensionManager,
  PopupStateManager,
  VisualAssertions,
  BaselineManager,
  VISUAL_SELECTORS,
  VISUAL_TEST_OPTIONS
} from './visual-helpers';

/**
 * Visual Space Item States Test Suite
 *
 * This focused test suite validates the visual appearance and behavior of space items
 * in different states within the Chrome Spaces extension popup. It covers:
 *
 * 1. Normal/Default state visual validation
 * 2. Hover state transitions and styling
 * 3. Selected state (keyboard navigation) appearance
 * 4. Current window indicator styling
 * 5. Closed space visual distinctions
 * 6. Edit mode visual transformation
 * 7. Long name text overflow handling
 * 8. Multi-state combinations
 */

test.describe('Space Item Visual States', () => {
  let extensionManager: ExtensionManager;
  let popupStateManager: PopupStateManager;
  let visualAssertions: VisualAssertions;
  let baselineManager: BaselineManager;

  test.beforeEach(async ({ context, page }) => {
    // Initialize helper classes
    extensionManager = new ExtensionManager();
    popupStateManager = new PopupStateManager(page);
    visualAssertions = new VisualAssertions(page);
    baselineManager = new BaselineManager(page);

    // Navigate to popup
    const extensionId = await extensionManager.getExtensionId(context);
    const popupUrl = extensionManager.getPopupUrl(extensionId);
    await page.goto(popupUrl);
    await popupStateManager.waitForPopupReady();
  });

  test.describe('Individual Space Item States', () => {

    /**
     * Test: Normal Space Item Visual State
     * Verifies the default appearance of active space items
     */
    test('should display normal space items with correct styling', async ({ page }) => {
      // Find first active space item
      const normalSpaceItem = page.locator(VISUAL_SELECTORS.spaceItem.normal).first();
      await expect(normalSpaceItem).toBeVisible();

      // Capture normal state screenshot
      await expect(normalSpaceItem).toHaveScreenshot('space-item-normal-state.png', VISUAL_TEST_OPTIONS.component);

      // Validate visual structure
      await expect(normalSpaceItem.locator('.space-info')).toBeVisible();
      await expect(normalSpaceItem.locator('.space-name')).toBeVisible();
      await expect(normalSpaceItem.locator('.space-details')).toBeVisible();
      await expect(normalSpaceItem.locator('.space-actions')).toBeVisible();

      // Validate CSS properties for normal state
      await visualAssertions.assertCSSProperties(VISUAL_SELECTORS.spaceItem.normal, {
        'cursor': 'pointer',
        'transition': /.*fast.*/,
        'border': '1px solid transparent'
      });

      // Full popup with normal items
      await expect(page).toHaveScreenshot('popup-normal-space-items.png', VISUAL_TEST_OPTIONS.fullPage);
    });

    /**
     * Test: Hover State Visual Feedback
     * Verifies hover styling and smooth transitions
     */
    test('should display hover state correctly with smooth transitions', async ({ page }) => {
      const spaceItem = page.locator(VISUAL_SELECTORS.spaceItem.base).first();

      // Capture before hover
      await expect(spaceItem).toHaveScreenshot('space-item-before-hover.png', VISUAL_TEST_OPTIONS.component);

      // Trigger hover state
      await spaceItem.hover();

      // Wait for hover transition to complete
      await page.waitForTimeout(300);

      // Capture hover state
      await expect(spaceItem).toHaveScreenshot('space-item-hover-state.png', VISUAL_TEST_OPTIONS.component);

      // Verify hover styling is applied
      const hoverStyles = await spaceItem.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          transition: computed.transition
        };
      });

      // Hover should change background
      expect(hoverStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)'); // Not transparent

      // Move mouse away and capture return to normal
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      await expect(spaceItem).toHaveScreenshot('space-item-after-hover.png', VISUAL_TEST_OPTIONS.component);
    });

    /**
     * Test: Selected State (Keyboard Navigation)
     * Verifies keyboard navigation selection visual feedback
     */
    test('should display selected state correctly for keyboard navigation', async ({ page }) => {
      // Use keyboard to select first item
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      const selectedItem = page.locator(VISUAL_SELECTORS.spaceItem.selected);
      await expect(selectedItem).toBeVisible();

      // Capture selected state
      await expect(selectedItem).toHaveScreenshot('space-item-selected-state.png', VISUAL_TEST_OPTIONS.component);

      // Verify selected styling
      const selectedStyles = await selectedItem.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color
        };
      });

      // Selected items should have distinct background and color
      expect(selectedStyles.backgroundColor).toMatch(/rgb\(/); // Some background color
      expect(selectedStyles.color).toBe('rgb(255, 255, 255)'); // White text

      // Navigate to next item and verify selection moves
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      // First item should no longer be selected
      const firstItem = page.locator(VISUAL_SELECTORS.spaceItem.base).first();
      const isStillSelected = await firstItem.evaluate((el) => el.classList.contains('selected'));
      expect(isStillSelected).toBe(false);

      // Second item should be selected
      const newSelectedItem = page.locator(VISUAL_SELECTORS.spaceItem.selected);
      await expect(newSelectedItem).toHaveScreenshot('space-item-selected-second.png', VISUAL_TEST_OPTIONS.component);

      // Full popup showing selection state
      await expect(page).toHaveScreenshot('popup-keyboard-selection.png', VISUAL_TEST_OPTIONS.fullPage);
    });

    /**
     * Test: Current Window Indicator
     * Verifies visual indication of the current window's space
     */
    test('should display current window indicator correctly', async ({ page }) => {
      // Look for current window space (may not exist in test environment)
      const currentSpaceItem = page.locator(VISUAL_SELECTORS.spaceItem.current);

      if (await currentSpaceItem.count() > 0) {
        await expect(currentSpaceItem).toBeVisible();

        // Capture current window indicator
        await expect(currentSpaceItem.first()).toHaveScreenshot('space-item-current-window.png', VISUAL_TEST_OPTIONS.component);

        // Verify current window styling
        const currentStyles = await currentSpaceItem.first().evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            borderColor: computed.borderColor,
            backgroundColor: computed.backgroundColor
          };
        });

        // Current window should have border styling
        expect(currentStyles.borderColor).not.toBe('rgba(0, 0, 0, 0)');

        // Full popup showing current window indicator
        await expect(page).toHaveScreenshot('popup-current-window-indicator.png', VISUAL_TEST_OPTIONS.fullPage);
      } else {
        console.log('No current window space found - skipping current window indicator test');
      }
    });

    /**
     * Test: Closed Space Visual Distinction
     * Verifies closed spaces have distinct visual styling
     */
    test('should display closed spaces with visual distinction', async ({ page, context }) => {
      // Create and then close a window to generate closed space
      const testPage = await context.newPage();
      await testPage.goto('https://example.com');
      await testPage.evaluate(() => { document.title = 'Test Closed Space'; });
      await testPage.close();

      // Refresh popup to show closed space
      await page.reload();
      await popupStateManager.waitForPopupReady();

      // Look for closed spaces
      const closedSpaceItem = page.locator(VISUAL_SELECTORS.spaceItem.closed);

      if (await closedSpaceItem.count() > 0) {
        await expect(closedSpaceItem.first()).toBeVisible();

        // Capture closed space styling
        await expect(closedSpaceItem.first()).toHaveScreenshot('space-item-closed-state.png', VISUAL_TEST_OPTIONS.component);

        // Verify closed space has reduced opacity
        const closedStyles = await closedSpaceItem.first().evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            opacity: computed.opacity
          };
        });

        expect(parseFloat(closedStyles.opacity)).toBeLessThan(1);

        // Verify "Recently Closed" section header exists
        const sectionHeader = page.locator(VISUAL_SELECTORS.states.sectionHeader);
        if (await sectionHeader.count() > 0) {
          await expect(sectionHeader).toHaveScreenshot('recently-closed-header.png', VISUAL_TEST_OPTIONS.component);
        }

        // Full popup with closed spaces
        await expect(page).toHaveScreenshot('popup-with-closed-spaces.png', VISUAL_TEST_OPTIONS.fullPage);
      } else {
        console.log('No closed spaces found - skipping closed space visual test');
      }
    });
  });

  test.describe('Space Item Edit Mode States', () => {

    /**
     * Test: Edit Mode Visual Transformation
     * Verifies the visual change when entering edit mode
     */
    test('should transform space item correctly in edit mode', async ({ page }) => {
      const spaceItem = page.locator(VISUAL_SELECTORS.spaceItem.base).first();

      // Capture before edit
      await expect(spaceItem).toHaveScreenshot('space-item-before-edit-mode.png', VISUAL_TEST_OPTIONS.component);

      // Enter edit mode
      await popupStateManager.enterEditMode(0);

      // Capture edit mode transformation
      const editingItem = page.locator(VISUAL_SELECTORS.spaceItem.editing);
      await expect(editingItem).toBeVisible();
      await expect(editingItem).toHaveScreenshot('space-item-edit-mode.png', VISUAL_TEST_OPTIONS.component);

      // Verify edit input is properly styled and focused
      const editInput = page.locator(VISUAL_SELECTORS.interactive.editInput);
      await expect(editInput).toBeVisible();
      await expect(editInput).toBeFocused();

      // Capture just the edit input
      await expect(editInput).toHaveScreenshot('edit-input-styling.png', VISUAL_TEST_OPTIONS.component);

      // Verify edit input CSS properties
      await visualAssertions.assertCSSProperties(VISUAL_SELECTORS.interactive.editInput, {
        'border': /.*solid.*/,
        'border-radius': /.*px/,
        'padding': /.*px.*px/
      });

      // Type some text and capture
      await editInput.fill('Edited Space Name for Visual Testing');
      await expect(editInput).toHaveScreenshot('edit-input-with-content.png', VISUAL_TEST_OPTIONS.component);

      // Full popup in edit mode
      await expect(page).toHaveScreenshot('popup-space-edit-mode.png', VISUAL_TEST_OPTIONS.fullPage);

      // Exit edit mode by saving
      await popupStateManager.exitEditMode(true);

      // Capture after edit
      await expect(spaceItem).toHaveScreenshot('space-item-after-edit-save.png', VISUAL_TEST_OPTIONS.component);
    });

    /**
     * Test: Edit Mode Cancellation
     * Verifies visual feedback when canceling edit mode
     */
    test('should handle edit mode cancellation correctly', async ({ page }) => {
      const spaceItem = page.locator(VISUAL_SELECTORS.spaceItem.base).first();

      // Get original content
      const originalName = await spaceItem.locator('.space-name').textContent();

      // Enter edit mode
      await popupStateManager.enterEditMode(0);

      // Change the text
      const editInput = page.locator(VISUAL_SELECTORS.interactive.editInput);
      await editInput.fill('This Change Should Be Cancelled');

      // Capture before cancellation
      await expect(editInput).toHaveScreenshot('edit-input-before-cancel.png', VISUAL_TEST_OPTIONS.component);

      // Cancel edit mode
      await popupStateManager.exitEditMode(false);

      // Verify text is unchanged
      const finalName = await spaceItem.locator('.space-name').textContent();
      expect(finalName).toBe(originalName);

      // Capture after cancellation
      await expect(spaceItem).toHaveScreenshot('space-item-after-edit-cancel.png', VISUAL_TEST_OPTIONS.component);
    });
  });

  test.describe('Text Overflow and Layout Tests', () => {

    /**
     * Test: Long Space Names Text Overflow
     * Verifies proper ellipsis handling for long space names
     */
    test('should handle long space names with proper text overflow', async ({ page, context }) => {
      // Create a window with very long title
      const longTitlePage = await context.newPage();
      await longTitlePage.goto('https://example.com');

      const longTitle = 'This is an extremely long space name that should demonstrate the text overflow behavior and ellipsis handling in the Chrome Spaces extension popup interface';
      await longTitlePage.evaluate((title) => {
        document.title = title;
      }, longTitle);

      // Refresh popup to show long name
      await page.reload();
      await popupStateManager.waitForPopupReady();

      // Find the space with long name
      const longNameItem = page.locator('.space-item').first();
      await expect(longNameItem).toBeVisible();

      // Capture long name handling
      await expect(longNameItem).toHaveScreenshot('space-item-long-name.png', VISUAL_TEST_OPTIONS.component);

      // Verify text overflow properties
      await visualAssertions.assertTextOverflow('.space-name');

      // Verify space details also handle overflow
      await visualAssertions.assertTextOverflow('.space-details');

      // Test in different widths by resizing popup
      await page.setViewportSize({ width: 300, height: 600 }); // Narrower
      await page.waitForTimeout(300);

      await expect(longNameItem).toHaveScreenshot('space-item-long-name-narrow.png', VISUAL_TEST_OPTIONS.component);

      // Reset viewport
      await page.setViewportSize({ width: 1280, height: 720 });
    });

    /**
     * Test: Multiple Long Names Layout Stability
     * Verifies layout remains stable with multiple long names
     */
    test('should maintain layout stability with multiple long names', async ({ page, context }) => {
      // Create multiple windows with varying long titles
      const longTitles = [
        'First Very Long Space Name That Tests Layout Stability',
        'Second Extremely Verbose Space Title for Visual Testing',
        'Third Super Long Space Name with Even More Text',
        'Short Name',
        'Another Really Really Really Long Space Name That Goes On And On'
      ];

      for (let i = 0; i < longTitles.length; i++) {
        const testPage = await context.newPage();
        await testPage.goto('https://example.com');
        await testPage.evaluate((title) => {
          document.title = title;
        }, longTitles[i]);
      }

      // Refresh popup
      await page.reload();
      await popupStateManager.waitForPopupReady();

      // Capture full popup with mixed name lengths
      await expect(page).toHaveScreenshot('popup-mixed-name-lengths.png', VISUAL_TEST_OPTIONS.fullPage);

      // Verify all space items maintain consistent height
      const spaceItems = page.locator(VISUAL_SELECTORS.spaceItem.base);
      const itemCount = await spaceItems.count();

      const itemHeights = [];
      for (let i = 0; i < itemCount; i++) {
        const item = spaceItems.nth(i);
        const box = await item.boundingBox();
        itemHeights.push(box?.height || 0);
      }

      // All items should have similar heights (within reasonable tolerance)
      const avgHeight = itemHeights.reduce((a, b) => a + b, 0) / itemHeights.length;
      itemHeights.forEach(height => {
        expect(Math.abs(height - avgHeight)).toBeLessThan(10); // 10px tolerance
      });
    });
  });

  test.describe('State Combinations and Interactions', () => {

    /**
     * Test: Hover + Selected State Combination
     * Verifies visual feedback when hovering over selected item
     */
    test('should handle hover over selected item correctly', async ({ page }) => {
      // Select first item with keyboard
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      const selectedItem = page.locator(VISUAL_SELECTORS.spaceItem.selected);
      await expect(selectedItem).toBeVisible();

      // Capture selected state only
      await expect(selectedItem).toHaveScreenshot('selected-item-no-hover.png', VISUAL_TEST_OPTIONS.component);

      // Hover over the selected item
      await selectedItem.hover();
      await page.waitForTimeout(300);

      // Capture hover + selected combination
      await expect(selectedItem).toHaveScreenshot('selected-item-with-hover.png', VISUAL_TEST_OPTIONS.component);

      // Move away and verify selected state remains
      await page.mouse.move(0, 0);
      await page.waitForTimeout(300);

      await expect(selectedItem).toHaveScreenshot('selected-item-after-hover.png', VISUAL_TEST_OPTIONS.component);
    });

    /**
     * Test: Action Buttons Visibility and Styling
     * Verifies edit and delete buttons appear and style correctly
     */
    test('should display action buttons with correct styling', async ({ page }) => {
      const spaceItem = page.locator(VISUAL_SELECTORS.spaceItem.base).first();

      // Look for edit button
      const editButton = spaceItem.locator(VISUAL_SELECTORS.interactive.editButton);

      if (await editButton.count() > 0) {
        await expect(editButton).toBeVisible();

        // Capture edit button
        await expect(editButton).toHaveScreenshot('edit-button-styling.png', VISUAL_TEST_OPTIONS.component);

        // Test hover state on edit button
        await editButton.hover();
        await page.waitForTimeout(200);

        await expect(editButton).toHaveScreenshot('edit-button-hover.png', VISUAL_TEST_OPTIONS.component);
      }

      // Look for delete buttons on closed spaces
      const deleteButton = page.locator(VISUAL_SELECTORS.interactive.deleteButton);

      if (await deleteButton.count() > 0) {
        await expect(deleteButton.first()).toBeVisible();

        // Capture delete button
        await expect(deleteButton.first()).toHaveScreenshot('delete-button-styling.png', VISUAL_TEST_OPTIONS.component);

        // Test hover state on delete button
        await deleteButton.first().hover();
        await page.waitForTimeout(200);

        await expect(deleteButton.first()).toHaveScreenshot('delete-button-hover.png', VISUAL_TEST_OPTIONS.component);
      }
    });
  });

  test.describe('Accessibility Visual Indicators', () => {

    /**
     * Test: Focus Indicators for Keyboard Navigation
     * Verifies visible focus indicators for accessibility
     */
    test('should display proper focus indicators for accessibility', async ({ page }) => {
      // Focus on search input first
      const searchInput = page.locator(VISUAL_SELECTORS.popup.searchInput);
      await searchInput.focus();

      // Capture search input focus
      await expect(searchInput).toHaveScreenshot('search-input-focused.png', VISUAL_TEST_OPTIONS.component);

      // Use Tab to navigate (if focus management is implemented)
      await page.keyboard.press('Tab');
      await page.waitForTimeout(200);

      // Or use arrow keys to navigate to space items
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      const selectedItem = page.locator(VISUAL_SELECTORS.spaceItem.selected);
      if (await selectedItem.count() > 0) {
        // Capture keyboard focus state
        await expect(selectedItem).toHaveScreenshot('space-item-keyboard-focus.png', VISUAL_TEST_OPTIONS.component);
      }

      // Full popup showing focus states
      await expect(page).toHaveScreenshot('popup-focus-states.png', VISUAL_TEST_OPTIONS.fullPage);
    });

    /**
     * Test: High Contrast Mode Compatibility
     * Verifies visibility in high contrast scenarios
     */
    test('should maintain visibility in high contrast mode', async ({ page }) => {
      // Simulate high contrast mode by modifying CSS
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.textContent = `
          * {
            background-color: black !important;
            color: white !important;
            border-color: white !important;
          }
          .space-item:hover {
            background-color: #333 !important;
          }
          .space-item.selected {
            background-color: #666 !important;
          }
        `;
        document.head.appendChild(style);
      });

      await page.waitForTimeout(500);

      // Capture high contrast mode
      await expect(page).toHaveScreenshot('popup-high-contrast-mode.png', VISUAL_TEST_OPTIONS.fullPage);

      // Test interactive states in high contrast
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);

      await expect(page).toHaveScreenshot('popup-high-contrast-selected.png', VISUAL_TEST_OPTIONS.fullPage);
    });
  });
});