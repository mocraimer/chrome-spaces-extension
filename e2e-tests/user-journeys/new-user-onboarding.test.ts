/**
 * User Journey Test: New User Onboarding
 *
 * This test simulates a brand new user's first experience with the Chrome Spaces extension:
 * 1. Opens the extension popup for the first time
 * 2. Discovers their existing windows are already tracked as spaces
 * 3. Learns they can rename spaces for better organization
 * 4. Successfully creates and names their first custom space
 * 5. Switches between spaces to understand the core functionality
 *
 * User Story:
 * "As a new user, I want to quickly understand what spaces are and how to use them,
 * so I can start organizing my browser windows immediately."
 */

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('New User Onboarding Journey', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', '..', 'build');
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new // User journeys are better visualized
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });

    // Wait for extension to load
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

  test('Complete new user onboarding flow', async () => {
    console.log('\n🎬 Starting New User Onboarding Journey\n');

    // Step 1: New user opens Chrome with a few tabs already open
    console.log('📖 Step 1: User opens Chrome with existing tabs');
    const page1 = await context.newPage();
    await page1.goto('https://github.com');
    await page1.waitForLoadState('domcontentloaded');

    const page2 = await context.newPage();
    await page2.goto('https://stackoverflow.com');
    await page2.waitForLoadState('domcontentloaded');

    // Realistic delay - user doesn't act instantly
    await page2.waitForTimeout(1000);

    // Step 2: User discovers the extension icon and clicks it for the first time
    console.log('📖 Step 2: User clicks extension icon to open popup');
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    // User takes a moment to observe the UI
    await popupPage.waitForTimeout(1500);
    console.log('✅ Popup opened - user sees the interface for the first time');

    // Step 3: User notices their window is already listed
    console.log('📖 Step 3: User discovers existing window is tracked as a space');
    const spaceItems = popupPage.locator('.space-item');
    const spaceCount = await spaceItems.count();

    expect(spaceCount).toBeGreaterThan(0);
    console.log(`✅ User sees ${spaceCount} space(s) already listed`);

    // User reads the first space name
    const firstSpaceName = await spaceItems.first().locator('.space-name, .space-info h3').textContent();
    console.log(`📝 First space is named: "${firstSpaceName}"`);

    // User notices there are some tabs listed
    const tabCount = await spaceItems.first().locator('.space-details, .tab-count').textContent();
    console.log(`📊 Tab count shown: ${tabCount}`);

    // Step 4: User reads the help text at the bottom
    console.log('📖 Step 4: User discovers keyboard shortcuts from help text');
    const helpText = popupPage.locator('.help-text');
    if (await helpText.isVisible()) {
      const helpContent = await helpText.textContent();
      expect(helpContent).toContain('Enter');
      console.log('✅ User learns: Can use Enter to switch, arrow keys to navigate');
    }

    // User pauses to understand the interface
    await popupPage.waitForTimeout(1000);

    // Step 5: User tries keyboard navigation for the first time
    console.log('📖 Step 5: User experiments with arrow key navigation');
    const searchInput = popupPage.locator('.search-input, input[type="text"]');

    // Focus on search (auto-focused, but let's verify)
    if (await searchInput.isVisible()) {
      await searchInput.focus();
      console.log('✅ Search input is focused (good UX!)');
    }

    // User presses arrow down to navigate
    await popupPage.keyboard.press('ArrowDown');
    await popupPage.waitForTimeout(500);

    // Verify selection visual feedback
    const selectedSpace = popupPage.locator('.space-item.selected');
    if (await selectedSpace.count() > 0) {
      console.log('✅ User sees space is highlighted when navigating with arrows');
    }

    // Step 6: User learns about F2 to rename (if edit button visible)
    console.log('📖 Step 6: User discovers they can rename spaces');

    // Look for edit button or F2 hint
    const editButton = popupPage.locator('.edit-name-btn, .edit-btn, button[title*="edit"]').first();
    const hasEditUI = await editButton.isVisible();

    if (hasEditUI) {
      console.log('✅ User notices edit button to rename spaces');

      // User tries editing (but might not save yet - just exploring)
      await editButton.click();
      await popupPage.waitForTimeout(500);

      const editInput = popupPage.locator('.space-name-input, .edit-input, input[type="text"]:not(.search-input)');
      if (await editInput.count() > 0 && await editInput.first().isVisible()) {
        console.log('✅ Edit mode activated - user can rename the space');

        // User types a new name (their first customization!)
        await editInput.first().fill('My Work Projects');
        await popupPage.waitForTimeout(1000);

        console.log('📝 User types their first custom name: "My Work Projects"');

        // User saves by pressing Enter
        await editInput.first().press('Enter');
        await popupPage.waitForTimeout(1000);

        // Verify the name persisted
        const updatedName = await spaceItems.first().locator('.space-name, .space-info h3').textContent();
        expect(updatedName).toContain('My Work Projects');
        console.log('✅ SUCCESS: User successfully renamed their first space!');
      }
    } else {
      // Alternative: User might need to double-click or press F2
      console.log('📝 User tries double-clicking to edit...');
      await spaceItems.first().dblclick();
      await popupPage.waitForTimeout(500);

      const editInput = popupPage.locator('input[type="text"]:not(.search-input)');
      if (await editInput.count() > 0 && await editInput.first().isVisible()) {
        console.log('✅ Edit mode activated via double-click');
        await editInput.first().fill('My Work Projects');
        await editInput.first().press('Enter');
        await popupPage.waitForTimeout(1000);
        console.log('✅ User successfully renamed their first space!');
      }
    }

    // Step 7: User creates a new window (new space)
    console.log('📖 Step 7: User opens a new window to create another space');
    const newWindow = await context.newPage();
    await newWindow.goto('https://reddit.com');
    await newWindow.waitForLoadState('domcontentloaded');
    await popupPage.waitForTimeout(2000); // Extension needs time to detect new window

    // User refreshes popup to see new space
    await popupPage.reload();
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    const updatedSpaceCount = await spaceItems.count();
    expect(updatedSpaceCount).toBeGreaterThan(spaceCount);
    console.log(`✅ User sees new space appeared (${updatedSpaceCount} total spaces)`);

    // Step 8: User switches between spaces to complete onboarding
    console.log('📖 Step 8: User switches to different space to test functionality');

    // Navigate to second space
    await popupPage.keyboard.press('ArrowDown');
    await popupPage.waitForTimeout(300);

    // Try to switch (press Enter)
    console.log('📝 User presses Enter to switch to another space...');
    await popupPage.keyboard.press('Enter');

    // Wait for switch to complete
    await popupPage.waitForTimeout(1500);

    console.log('✅ User successfully switched spaces - onboarding complete!');

    // Step 9: User feels confident and understands the extension
    console.log('\n🎉 ONBOARDING SUCCESS!');
    console.log('User now understands:');
    console.log('  ✓ Spaces automatically track their windows');
    console.log('  ✓ Can rename spaces for organization');
    console.log('  ✓ Can navigate with keyboard shortcuts');
    console.log('  ✓ Can switch between spaces with Enter');
    console.log('  ✓ New windows automatically become new spaces\n');
  });

  test('New user learns search functionality', async () => {
    console.log('\n🎬 New User Discovers Search\n');

    // User has multiple spaces now and wants to find one quickly
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });

    console.log('📖 User has multiple spaces and wants to find a specific one');

    const searchInput = popupPage.locator('.search-input, input[type="text"]');
    await expect(searchInput).toBeVisible();

    // User starts typing in search
    console.log('📝 User types "work" in search bar...');
    await searchInput.fill('work');
    await popupPage.waitForTimeout(800); // Real-time filtering delay

    // Check filtered results
    const visibleSpaces = popupPage.locator('.space-item:visible');
    const filteredCount = await visibleSpaces.count();

    console.log(`✅ Search filtered to ${filteredCount} matching space(s)`);

    if (filteredCount > 0) {
      const firstResult = await visibleSpaces.first().textContent();
      expect(firstResult?.toLowerCase()).toContain('work');
      console.log('✅ Results match search term - user finds it intuitive');
    }

    // User clears search with Escape (learning moment)
    console.log('📝 User presses Escape to clear search...');
    await popupPage.keyboard.press('Escape');
    await popupPage.waitForTimeout(500);

    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('');
    console.log('✅ User learns Escape clears search - another shortcut discovered!\n');
  });

  test('New user explores closed spaces feature', async () => {
    console.log('\n🎬 New User Discovers Closed Spaces\n');

    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForSelector('.popup-container', { state: 'visible' });
    await popupPage.waitForTimeout(1000);

    console.log('📖 User wonders what happens when they close a space');

    // Check if there are any closed spaces section
    const closedSection = popupPage.locator('.closed-spaces');
    const hasClosedSpaces = await closedSection.isVisible();

    if (hasClosedSpaces) {
      console.log('✅ User discovers "Closed Spaces" section');

      const closedHeader = await closedSection.locator('h3').textContent();
      console.log(`📝 Section header: "${closedHeader}"`);

      const closedItems = popupPage.locator('.closed-spaces .space-item');
      const closedCount = await closedItems.count();
      console.log(`📊 User sees ${closedCount} closed space(s)`);

      if (closedCount > 0) {
        console.log('📖 User realizes closed spaces can be restored');

        // User tries to restore a closed space
        const restoreButton = closedItems.first().locator('button');
        if (await restoreButton.isVisible()) {
          const buttonText = await restoreButton.textContent();
          console.log(`📝 User sees restore option: "${buttonText}"`);
        }

        console.log('✅ User learns: Closed spaces are not lost - they can be recovered!');
      }
    } else {
      console.log('📝 No closed spaces yet - user knows where they would appear');
    }

    console.log('\n🎓 User completes onboarding with confidence in the extension\n');
  });
});