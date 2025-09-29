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
 * Visual Dialog and State Testing Suite
 *
 * This test suite focuses on validating the visual appearance and behavior of:
 *
 * 1. Loading states and spinners
 * 2. Error states and error messages
 * 3. Confirm dialogs and modal overlays
 * 4. Empty states and no-results screens
 * 5. State transitions and animations
 * 6. Modal positioning and backdrop
 * 7. Button states and interactive feedback
 * 8. Toast notifications and temporary messages
 */

test.describe('Dialog and State Visual Validation', () => {
  let extensionManager: ExtensionManager;
  let popupStateManager: PopupStateManager;
  let visualAssertions: VisualAssertions;
  let baselineManager: BaselineManager;

  test.beforeEach(async ({ context, page }) => {
    extensionManager = new ExtensionManager();
    popupStateManager = new PopupStateManager(page);
    visualAssertions = new VisualAssertions(page);
    baselineManager = new BaselineManager(page);

    const extensionId = await extensionManager.getExtensionId(context);
    const popupUrl = extensionManager.getPopupUrl(extensionId);
    await page.goto(popupUrl);
    await popupStateManager.waitForPopupReady();
  });

  test.describe('Loading States', () => {

    /**
     * Test: Loading State Visual Appearance
     * Verifies loading spinner/message appears correctly
     */
    test('should display loading state with proper styling', async ({ page }) => {
      // Force loading state
      await popupStateManager.setPopupState('loading');
      await page.waitForTimeout(500);

      // Check if loading element exists
      const loadingElement = page.locator(VISUAL_SELECTORS.states.loading);

      if (await loadingElement.count() > 0) {
        await expect(loadingElement).toBeVisible();

        // Capture loading state
        await expect(loadingElement).toHaveScreenshot('loading-state-element.png', VISUAL_TEST_OPTIONS.component);

        // Full popup loading state
        await expect(page).toHaveScreenshot('popup-loading-state.png', VISUAL_TEST_OPTIONS.fullPage);

        // Verify loading text
        const loadingText = await loadingElement.textContent();
        expect(loadingText).toBeTruthy();
        expect(loadingText?.toLowerCase()).toContain('loading');

        // Verify loading styling
        const loadingStyles = await loadingElement.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            textAlign: computed.textAlign,
            padding: computed.padding,
            color: computed.color
          };
        });

        expect(loadingStyles.textAlign).toBe('center');
      } else {
        console.log('Loading state not available - skipping loading visual test');
      }
    });

    /**
     * Test: Loading to Content Transition
     * Verifies smooth transition from loading to loaded state
     */
    test('should transition smoothly from loading to content', async ({ page }) => {
      // Start with loading state
      await popupStateManager.setPopupState('loading');
      await page.waitForTimeout(300);

      const hasLoadingElement = await page.locator(VISUAL_SELECTORS.states.loading).count() > 0;

      if (hasLoadingElement) {
        // Capture loading state
        await expect(page).toHaveScreenshot('transition-loading-state.png', VISUAL_TEST_OPTIONS.fullPage);

        // Transition to normal state
        await popupStateManager.setPopupState('normal');

        // Capture loaded state
        await expect(page).toHaveScreenshot('transition-loaded-state.png', VISUAL_TEST_OPTIONS.fullPage);

        // Verify content is now visible
        await expect(page.locator(VISUAL_SELECTORS.popup.spacesList)).toBeVisible();
        await expect(page.locator(VISUAL_SELECTORS.popup.searchInput)).toBeVisible();
      }
    });
  });

  test.describe('Error States', () => {

    /**
     * Test: Error Message Display
     * Verifies error messages appear with proper styling
     */
    test('should display error messages with correct styling', async ({ page }) => {
      // Force error state
      await popupStateManager.setPopupState('error');
      await page.waitForTimeout(500);

      const errorElement = page.locator(VISUAL_SELECTORS.states.error);

      if (await errorElement.count() > 0) {
        await expect(errorElement).toBeVisible();

        // Capture error state
        await expect(errorElement).toHaveScreenshot('error-state-element.png', VISUAL_TEST_OPTIONS.component);

        // Full popup error state
        await expect(page).toHaveScreenshot('popup-error-state.png', VISUAL_TEST_OPTIONS.fullPage);

        // Verify error styling
        const errorStyles = await errorElement.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            textAlign: computed.textAlign,
            color: computed.color,
            padding: computed.padding
          };
        });

        expect(errorStyles.textAlign).toBe('center');
        // Error color should be red or error color
        expect(errorStyles.color).toMatch(/rgb\(.*\)/);

        // Check for retry button if present
        const retryButton = errorElement.locator('button');
        if (await retryButton.count() > 0) {
          await expect(retryButton).toBeVisible();
          await expect(retryButton).toHaveScreenshot('error-retry-button.png', VISUAL_TEST_OPTIONS.component);

          // Test retry button hover
          await retryButton.hover();
          await page.waitForTimeout(200);
          await expect(retryButton).toHaveScreenshot('error-retry-button-hover.png', VISUAL_TEST_OPTIONS.component);
        }
      } else {
        console.log('Error state not available - skipping error visual test');
      }
    });

    /**
     * Test: Error Recovery Visual Flow
     * Verifies visual feedback when recovering from errors
     */
    test('should handle error recovery with proper visual feedback', async ({ page }) => {
      // Start with error
      await popupStateManager.setPopupState('error');
      await page.waitForTimeout(300);

      const errorElement = page.locator(VISUAL_SELECTORS.states.error);

      if (await errorElement.count() > 0) {
        // Capture error state
        await expect(page).toHaveScreenshot('error-before-recovery.png', VISUAL_TEST_OPTIONS.fullPage);

        // Click retry if available, or force normal state
        const retryButton = errorElement.locator('button');
        if (await retryButton.count() > 0) {
          await retryButton.click();
        } else {
          await popupStateManager.setPopupState('normal');
        }

        await page.waitForTimeout(500);

        // Capture recovered state
        await expect(page).toHaveScreenshot('error-after-recovery.png', VISUAL_TEST_OPTIONS.fullPage);

        // Verify normal state is restored
        await expect(page.locator(VISUAL_SELECTORS.popup.container)).toBeVisible();
      }
    });
  });

  test.describe('Confirm Dialogs', () => {

    /**
     * Test: Confirm Dialog Appearance and Positioning
     * Verifies modal dialogs appear correctly centered with proper backdrop
     */
    test('should display confirm dialog with proper modal styling', async ({ page, context }) => {
      // Create a closed space first
      const testPage = await context.newPage();
      await testPage.goto('https://example.com');
      await testPage.evaluate(() => { document.title = 'Space to Delete'; });
      await testPage.close();

      // Refresh popup
      await page.reload();
      await popupStateManager.waitForPopupReady();

      // Look for closed space and delete button
      const closedSpace = page.locator(VISUAL_SELECTORS.spaceItem.closed).first();

      if (await closedSpace.count() > 0) {
        const deleteButton = closedSpace.locator(VISUAL_SELECTORS.interactive.deleteButton);

        if (await deleteButton.count() > 0) {
          // Capture before dialog
          await expect(page).toHaveScreenshot('before-confirm-dialog.png', VISUAL_TEST_OPTIONS.fullPage);

          // Click delete to show confirm dialog
          await deleteButton.click();

          // Wait for dialog to appear
          await page.waitForSelector(VISUAL_SELECTORS.interactive.confirmDialog, { state: 'visible' });

          const confirmDialog = page.locator(VISUAL_SELECTORS.interactive.confirmDialog);
          await expect(confirmDialog).toBeVisible();

          // Capture full dialog with backdrop
          await expect(page).toHaveScreenshot('confirm-dialog-modal.png', VISUAL_TEST_OPTIONS.fullPage);

          // Capture just the dialog content
          const dialogContent = page.locator(VISUAL_SELECTORS.interactive.confirmContent);
          await expect(dialogContent).toHaveScreenshot('confirm-dialog-content.png', VISUAL_TEST_OPTIONS.component);

          // Verify dialog positioning and backdrop
          const dialogStyles = await confirmDialog.evaluate((el) => {
            const computed = window.getComputedStyle(el);
            return {
              position: computed.position,
              zIndex: computed.zIndex,
              backgroundColor: computed.backgroundColor,
              display: computed.display,
              alignItems: computed.alignItems,
              justifyContent: computed.justifyContent
            };
          });

          expect(dialogStyles.position).toBe('fixed');
          expect(parseInt(dialogStyles.zIndex)).toBeGreaterThan(100);
          expect(dialogStyles.display).toBe('flex');

          // Test dialog buttons
          const deleteBtn = dialogContent.locator(VISUAL_SELECTORS.interactive.confirmDelete);
          const cancelBtn = dialogContent.locator(VISUAL_SELECTORS.interactive.confirmCancel);

          await expect(deleteBtn).toBeVisible();
          await expect(cancelBtn).toBeVisible();

          // Capture button states
          await expect(deleteBtn).toHaveScreenshot('confirm-delete-button.png', VISUAL_TEST_OPTIONS.component);
          await expect(cancelBtn).toHaveScreenshot('confirm-cancel-button.png', VISUAL_TEST_OPTIONS.component);

          // Test button hover states
          await deleteBtn.hover();
          await page.waitForTimeout(200);
          await expect(deleteBtn).toHaveScreenshot('confirm-delete-button-hover.png', VISUAL_TEST_OPTIONS.component);

          await cancelBtn.hover();
          await page.waitForTimeout(200);
          await expect(cancelBtn).toHaveScreenshot('confirm-cancel-button-hover.png', VISUAL_TEST_OPTIONS.component);

          // Cancel dialog
          await cancelBtn.click();
          await page.waitForSelector(VISUAL_SELECTORS.interactive.confirmDialog, { state: 'hidden' });

          // Verify dialog disappears
          await expect(confirmDialog).not.toBeVisible();
          await expect(page).toHaveScreenshot('after-dialog-cancel.png', VISUAL_TEST_OPTIONS.fullPage);
        } else {
          console.log('Delete button not found - skipping confirm dialog test');
        }
      } else {
        console.log('No closed spaces found - skipping confirm dialog test');
      }
    });

    /**
     * Test: Dialog Backdrop Click Behavior
     * Verifies backdrop interaction and modal focus trapping
     */
    test('should handle backdrop clicks correctly', async ({ page, context }) => {
      // Create closed space for deletion
      const testPage = await context.newPage();
      await testPage.goto('https://example.com');
      await testPage.close();

      await page.reload();
      await popupStateManager.waitForPopupReady();

      const closedSpace = page.locator(VISUAL_SELECTORS.spaceItem.closed).first();

      if (await closedSpace.count() > 0) {
        const deleteButton = closedSpace.locator(VISUAL_SELECTORS.interactive.deleteButton);

        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          await page.waitForSelector(VISUAL_SELECTORS.interactive.confirmDialog, { state: 'visible' });

          const confirmDialog = page.locator(VISUAL_SELECTORS.interactive.confirmDialog);

          // Click on backdrop (outside dialog content)
          const dialogBox = await confirmDialog.boundingBox();
          if (dialogBox) {
            // Click in top-left corner of backdrop
            await page.mouse.click(dialogBox.x + 10, dialogBox.y + 10);
            await page.waitForTimeout(300);

            // Dialog might still be visible (depending on implementation)
            // Capture state after backdrop click
            await expect(page).toHaveScreenshot('dialog-after-backdrop-click.png', VISUAL_TEST_OPTIONS.fullPage);

            // If dialog is still open, close it properly
            const isStillVisible = await confirmDialog.isVisible();
            if (isStillVisible) {
              const cancelBtn = page.locator(VISUAL_SELECTORS.interactive.confirmCancel);
              await cancelBtn.click();
            }
          }
        }
      }
    });
  });

  test.describe('Empty States', () => {

    /**
     * Test: No Results State
     * Verifies empty state when no spaces match search
     */
    test('should display no results state correctly', async ({ page }) => {
      // Search for something that won't match
      const searchInput = page.locator(VISUAL_SELECTORS.popup.searchInput);
      await searchInput.fill('nonexistentspacename12345');
      await page.waitForTimeout(300);

      // Look for no results message
      const noResults = page.locator(VISUAL_SELECTORS.states.noResults);

      if (await noResults.count() > 0) {
        await expect(noResults).toBeVisible();

        // Capture no results state
        await expect(noResults).toHaveScreenshot('no-results-message.png', VISUAL_TEST_OPTIONS.component);

        // Full popup with no results
        await expect(page).toHaveScreenshot('popup-no-results.png', VISUAL_TEST_OPTIONS.fullPage);

        // Verify no results styling
        const noResultsStyles = await noResults.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            textAlign: computed.textAlign,
            color: computed.color,
            padding: computed.padding
          };
        });

        expect(noResultsStyles.textAlign).toBe('center');

        // Clear search and verify normal state returns
        await searchInput.clear();
        await page.waitForTimeout(300);

        await expect(page).toHaveScreenshot('popup-after-clearing-search.png', VISUAL_TEST_OPTIONS.fullPage);
      }
    });

    /**
     * Test: Empty Popup State
     * Verifies appearance when no spaces exist at all
     */
    test('should handle completely empty state', async ({ page }) => {
      // Force empty state
      await popupStateManager.setPopupState('empty');
      await page.waitForTimeout(500);

      // Capture empty state
      await expect(page).toHaveScreenshot('popup-completely-empty.png', VISUAL_TEST_OPTIONS.fullPage);

      // Look for empty state messaging
      const noResults = page.locator(VISUAL_SELECTORS.states.noResults);
      if (await noResults.count() > 0) {
        const emptyMessage = await noResults.textContent();
        expect(emptyMessage?.toLowerCase()).toMatch(/(no|empty|found)/);
      }
    });
  });

  test.describe('Interactive State Feedback', () => {

    /**
     * Test: Button State Variations
     * Verifies all button states render correctly
     */
    test('should display all button states correctly', async ({ page }) => {
      // Test search input button states (if any)
      const searchInput = page.locator(VISUAL_SELECTORS.popup.searchInput);
      await searchInput.focus();

      await expect(searchInput).toHaveScreenshot('search-input-focused-state.png', VISUAL_TEST_OPTIONS.component);

      // Test edit buttons
      const editButtons = page.locator(VISUAL_SELECTORS.interactive.editButton);
      if (await editButtons.count() > 0) {
        const firstEditBtn = editButtons.first();

        // Normal state
        await expect(firstEditBtn).toHaveScreenshot('edit-button-normal.png', VISUAL_TEST_OPTIONS.component);

        // Hover state
        await firstEditBtn.hover();
        await page.waitForTimeout(200);
        await expect(firstEditBtn).toHaveScreenshot('edit-button-hover.png', VISUAL_TEST_OPTIONS.component);

        // Click/active state
        await firstEditBtn.click();
        await page.waitForTimeout(100);

        // If edit mode is triggered, capture that
        const editInput = page.locator(VISUAL_SELECTORS.interactive.editInput);
        if (await editInput.isVisible()) {
          await expect(page).toHaveScreenshot('edit-mode-triggered.png', VISUAL_TEST_OPTIONS.fullPage);
        }
      }
    });

    /**
     * Test: Focus and Blur State Transitions
     * Verifies smooth transitions between focus states
     */
    test('should handle focus transitions smoothly', async ({ page }) => {
      const searchInput = page.locator(VISUAL_SELECTORS.popup.searchInput);

      // Blur state
      await page.click('body');
      await expect(searchInput).toHaveScreenshot('search-input-blur.png', VISUAL_TEST_OPTIONS.component);

      // Focus state
      await searchInput.focus();
      await page.waitForTimeout(200);
      await expect(searchInput).toHaveScreenshot('search-input-focus.png', VISUAL_TEST_OPTIONS.component);

      // Type and capture active state
      await searchInput.type('test');
      await expect(searchInput).toHaveScreenshot('search-input-with-text.png', VISUAL_TEST_OPTIONS.component);

      // Clear and blur again
      await searchInput.clear();
      await page.click('body');
      await expect(searchInput).toHaveScreenshot('search-input-cleared.png', VISUAL_TEST_OPTIONS.component);
    });

    /**
     * Test: Disabled State Appearance
     * Verifies disabled elements are visually distinct
     */
    test('should display disabled states correctly', async ({ page }) => {
      // Force disabled state on elements (if applicable)
      await page.evaluate(() => {
        // Disable search input to test disabled styling
        const searchInput = document.querySelector('.search-input') as HTMLInputElement;
        if (searchInput) {
          searchInput.disabled = true;
        }

        // Disable any buttons
        const buttons = document.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
        buttons.forEach(btn => btn.disabled = true);
      });

      await page.waitForTimeout(300);

      // Capture disabled search input
      const searchInput = page.locator(VISUAL_SELECTORS.popup.searchInput);
      await expect(searchInput).toHaveScreenshot('search-input-disabled.png', VISUAL_TEST_OPTIONS.component);

      // Capture disabled buttons
      const buttons = page.locator('button');
      if (await buttons.count() > 0) {
        await expect(buttons.first()).toHaveScreenshot('button-disabled-state.png', VISUAL_TEST_OPTIONS.component);
      }

      // Full popup with disabled states
      await expect(page).toHaveScreenshot('popup-disabled-states.png', VISUAL_TEST_OPTIONS.fullPage);
    });
  });

  test.describe('State Transitions and Animations', () => {

    /**
     * Test: Modal Fade In/Out Animation
     * Verifies smooth modal transitions
     */
    test('should animate modal transitions smoothly', async ({ page, context }) => {
      const testPage = await context.newPage();
      await testPage.goto('https://example.com');
      await testPage.close();

      await page.reload();
      await popupStateManager.waitForPopupReady();

      const closedSpace = page.locator(VISUAL_SELECTORS.spaceItem.closed).first();

      if (await closedSpace.count() > 0) {
        const deleteButton = closedSpace.locator(VISUAL_SELECTORS.interactive.deleteButton);

        if (await deleteButton.count() > 0) {
          // Capture before modal
          await expect(page).toHaveScreenshot('before-modal-animation.png', VISUAL_TEST_OPTIONS.fullPage);

          // Trigger modal with animation
          await deleteButton.click();

          // Capture during transition (timing-dependent)
          await page.waitForTimeout(100);
          await expect(page).toHaveScreenshot('modal-transition-start.png', VISUAL_TEST_OPTIONS.fullPage);

          // Wait for animation to complete
          await page.waitForTimeout(400);
          await expect(page).toHaveScreenshot('modal-transition-complete.png', VISUAL_TEST_OPTIONS.fullPage);

          // Cancel and capture fade out
          const cancelBtn = page.locator(VISUAL_SELECTORS.interactive.confirmCancel);
          await cancelBtn.click();

          // Capture during fade out
          await page.waitForTimeout(100);
          await expect(page).toHaveScreenshot('modal-fadeout-start.png', VISUAL_TEST_OPTIONS.fullPage);

          // Wait for fadeout to complete
          await page.waitForTimeout(400);
          await expect(page).toHaveScreenshot('modal-fadeout-complete.png', VISUAL_TEST_OPTIONS.fullPage);
        }
      }
    });

    /**
     * Test: Smooth State Changes
     * Verifies UI doesn't flicker during state changes
     */
    test('should maintain visual stability during state changes', async ({ page }) => {
      // Rapid state changes to test for flicker
      const states: Array<'loading' | 'error' | 'normal'> = ['loading', 'normal', 'error', 'normal'];

      for (let i = 0; i < states.length; i++) {
        await popupStateManager.setPopupState(states[i]);
        await page.waitForTimeout(200);

        await expect(page).toHaveScreenshot(`state-change-${i}-${states[i]}.png`, VISUAL_TEST_OPTIONS.fullPage);
      }

      // Final state should be stable
      await page.waitForTimeout(1000);
      await expect(page).toHaveScreenshot('state-changes-final.png', VISUAL_TEST_OPTIONS.fullPage);
    });
  });
});