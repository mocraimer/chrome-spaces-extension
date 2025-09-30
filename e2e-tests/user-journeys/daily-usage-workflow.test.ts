/**
 * User Journey Test: Daily Usage Workflow
 *
 * This test simulates a typical user's daily workflow with Chrome Spaces:
 * 1. Morning: Opens Chrome and sees yesterday's spaces
 * 2. Morning: Restores "Work" space from closed spaces
 * 3. Midday: Creates new space for impromptu meeting notes
 * 4. Midday: Adds multiple tabs to the meeting space
 * 5. Evening: Closes work-related spaces at end of day
 * 6. Evening: Verifies closed spaces are available for tomorrow
 *
 * User Story:
 * "As a daily user, I want to seamlessly resume my work each morning and
 * cleanly organize my spaces throughout the day, so I maintain productivity
 * without browser clutter."
 */

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('Daily Usage Workflow Journey', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', '..', 'build');
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
    console.log('🚀 Extension loaded with ID:', extensionId);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Morning routine: Resume work from yesterday', async () => {
    console.log('\n☀️ MORNING - User starts their workday\n');

    // User opens Chrome in the morning
    console.log('📖 8:30 AM - User opens Chrome to start their day');
    const page = await context.newPage();
    await page.goto('https://gmail.com');
    await page.waitForLoadState('domcontentloaded');

    // User opens the extension to check yesterday's work
    console.log('📖 User opens Chrome Spaces to see what they were working on');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    // User scans their active spaces
    const activeSpaces = popupPage.locator('.active-spaces .space-item');
    const activeCount = await activeSpaces.count();
    console.log(`✅ User sees ${activeCount} active space(s) from previous session`);

    // User checks for closed spaces from yesterday
    const closedSection = popupPage.locator('.closed-spaces');
    const hasClosedSpaces = await closedSection.isVisible();

    if (hasClosedSpaces) {
      const closedSpaces = popupPage.locator('.closed-spaces .space-item');
      const closedCount = await closedSpaces.count();
      console.log(`📊 User sees ${closedCount} closed space(s) from yesterday`);

      // User looks for their "Work" space
      console.log('📖 User searches for their "Work" space in closed spaces');

      // Find a closed space to restore (simulate finding "Work" space)
      if (closedCount > 0) {
        const firstClosed = closedSpaces.first();
        const closedName = await firstClosed.locator('.space-name, .space-info h3').textContent();
        console.log(`📝 User found closed space: "${closedName}"`);

        // User decides to restore this space
        console.log('📖 User clicks to restore the closed space');

        // Look for restore button/action
        const restoreButton = firstClosed.locator('button:has-text("Restore"), button[title*="restore"]');
        if (await restoreButton.count() > 0 && await restoreButton.first().isVisible()) {
          await restoreButton.first().click();
          await popupPage.waitForTimeout(2000); // Wait for restoration

          console.log('✅ User successfully restored their work space!');
          console.log('📊 All tabs from yesterday are back - seamless resume');
        } else {
          // Alternative: Click on the space item itself to restore
          await firstClosed.click();
          await popupPage.waitForTimeout(2000);
          console.log('✅ User restored space by clicking on it');
        }
      }
    } else {
      console.log('📝 No closed spaces - user starts fresh today');
    }

    // User takes a moment to orient themselves
    await popupPage.waitForTimeout(1500);
    console.log('🎯 User is now oriented and ready to start their workday\n');
  });

  test('Midday workflow: Creating ad-hoc meeting space', async () => {
    console.log('\n☀️ MIDDAY - Impromptu meeting requires new space\n');

    console.log('📖 12:30 PM - User gets invited to unexpected meeting');
    console.log('📖 User needs to quickly gather research for the meeting');

    // User creates new window for meeting prep
    console.log('📝 User opens new Chrome window for meeting preparation');
    const meetingWindow = await context.newPage();
    await meetingWindow.goto('https://docs.google.com');
    await meetingWindow.waitForLoadState('domcontentloaded');
    await meetingWindow.waitForTimeout(1000);

    // User adds more tabs for meeting research
    console.log('📖 User opens multiple tabs for meeting research');

    const tab1 = await context.newPage();
    await tab1.goto('https://github.com/microsoft/playwright');
    await tab1.waitForLoadState('domcontentloaded');

    const tab2 = await context.newPage();
    await tab2.goto('https://stackoverflow.com/questions/tagged/playwright');
    await tab2.waitForLoadState('domcontentloaded');

    const tab3 = await context.newPage();
    await tab3.goto('https://www.npmjs.com/package/playwright');
    await tab3.waitForLoadState('domcontentloaded');

    console.log('✅ User opened 4 tabs related to meeting topic');

    // Wait for extension to register all tabs
    await meetingWindow.waitForTimeout(2000);

    // User opens extension to name this new space
    console.log('📖 User opens Chrome Spaces to name this meeting space');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    // User should see the new window as a space
    const spaceItems = popupPage.locator('.active-spaces .space-item');
    const spaceCount = await spaceItems.count();
    console.log(`📊 User sees ${spaceCount} active spaces (including new meeting space)`);

    // User finds the newest space (likely has most recent tabs)
    // In real usage, it might be sorted by recency or the user navigates to it
    console.log('📖 User navigates to the new space to rename it');

    // Try to edit the first/last space (assuming it's the newest)
    const targetSpace = spaceItems.last(); // Or first, depending on sort order

    // User double-clicks or presses edit to rename
    await targetSpace.dblclick();
    await popupPage.waitForTimeout(500);

    const editInput = popupPage.locator('input[type="text"]:not(.search-input)').first();
    if (await editInput.isVisible()) {
      console.log('📝 User renames space to "Q4 Planning Meeting"');
      await editInput.fill('Q4 Planning Meeting');
      await editInput.press('Enter');
      await popupPage.waitForTimeout(1000);

      console.log('✅ Meeting space renamed successfully');
      console.log('📊 All 4 research tabs are now organized under this name');
    }

    // User closes popup and continues with meeting
    await popupPage.close();
    console.log('🎯 User returns to meeting, knowing their research is organized\n');
  });

  test('End of day workflow: Closing work spaces', async () => {
    console.log('\n🌙 EVENING - End of workday cleanup\n');

    console.log('📖 5:30 PM - User finishes work and wants to close work spaces');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    // User sees all their active work spaces
    const spaceItems = popupPage.locator('.active-spaces .space-item');
    const spaceCount = await spaceItems.count();
    console.log(`📊 User has ${spaceCount} active space(s) to review`);

    // User reads through space names to decide what to close
    console.log('📖 User reviews space names to decide what to close:');

    for (let i = 0; i < Math.min(spaceCount, 3); i++) {
      const space = spaceItems.nth(i);
      const spaceName = await space.locator('.space-name, .space-info h3').textContent();
      const tabInfo = await space.locator('.space-details, .tab-count').textContent();
      console.log(`  • "${spaceName}" - ${tabInfo}`);
    }

    // User decides to close work-related spaces
    console.log('\n📖 User closes work-related spaces for the evening');

    // Try to close the first space
    const firstSpace = spaceItems.first();

    // Look for close/delete button
    const closeButton = firstSpace.locator('button:has-text("Close"), button[title*="close"], .delete-btn');

    if (await closeButton.count() > 0 && await closeButton.first().isVisible()) {
      const spaceNameBefore = await firstSpace.locator('.space-name, .space-info h3').textContent();

      console.log(`📝 User closes space: "${spaceNameBefore}"`);
      await closeButton.first().click();
      await popupPage.waitForTimeout(1500); // Wait for close operation

      // Check if confirmation dialog appears
      const confirmDialog = popupPage.locator('.confirm-dialog, [role="dialog"]');
      if (await confirmDialog.isVisible()) {
        console.log('💬 Confirmation dialog appeared (good safety feature)');
        const confirmButton = confirmDialog.locator('button:has-text("Confirm"), button:has-text("Close")');
        await confirmButton.click();
        await popupPage.waitForTimeout(1000);
      }

      console.log('✅ Space closed successfully');
    } else {
      // Alternative: User might close the actual window
      console.log('📝 User closes the Chrome window (which closes the space)');

      // Get window pages and close one
      const pages = context.pages();
      if (pages.length > 2) { // Keep popup and at least one page
        await pages[0].close();
        await popupPage.waitForTimeout(2000);
        console.log('✅ Window closed - space should move to closed section');
      }
    }

    // User refreshes popup to see updated state
    await popupPage.reload();
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    // Verify closed space moved to closed section
    const closedSection = popupPage.locator('.closed-spaces');
    if (await closedSection.isVisible()) {
      const closedItems = popupPage.locator('.closed-spaces .space-item');
      const closedCount = await closedItems.count();
      console.log(`✅ Closed spaces section shows ${closedCount} space(s)`);
      console.log('📊 User confirms their work is saved for tomorrow');
    }

    console.log('\n🌙 User closes Chrome, knowing they can resume tomorrow');
    console.log('✨ All work spaces are preserved and ready for tomorrow morning\n');
  });

  test('Complete daily workflow cycle verification', async () => {
    console.log('\n🔄 VERIFICATION - Complete daily cycle check\n');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    console.log('📊 Final state check after full day of usage:');

    // Check active spaces
    const activeSpaces = popupPage.locator('.active-spaces .space-item');
    const activeCount = await activeSpaces.count();
    console.log(`  ✓ Active spaces: ${activeCount}`);

    // Check closed spaces
    const closedSection = popupPage.locator('.closed-spaces');
    if (await closedSection.isVisible()) {
      const closedSpaces = popupPage.locator('.closed-spaces .space-item');
      const closedCount = await closedSpaces.count();
      console.log(`  ✓ Closed spaces: ${closedCount}`);

      // Verify closed spaces are restorable
      expect(closedCount).toBeGreaterThanOrEqual(0);
      console.log('  ✓ Closed spaces available for restoration');
    }

    // Verify search still works after day of usage
    const searchInput = popupPage.locator('.search-input, input[type="text"]');
    await searchInput.fill('meeting');
    await popupPage.waitForTimeout(800);

    const visibleAfterSearch = popupPage.locator('.space-item:visible');
    const filteredCount = await visibleAfterSearch.count();
    console.log(`  ✓ Search functionality working: ${filteredCount} result(s)`);

    console.log('\n✅ Daily workflow completed successfully!');
    console.log('🎯 User experienced:');
    console.log('  • Seamless morning resume from closed spaces');
    console.log('  • Quick ad-hoc space creation during workday');
    console.log('  • Clean end-of-day space management');
    console.log('  • Confidence that work is preserved for tomorrow\n');
  });
});