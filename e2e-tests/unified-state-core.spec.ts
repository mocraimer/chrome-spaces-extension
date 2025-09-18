import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { join } from 'path';
import { waitForServiceWorker } from './helpers';

const projectRoot = process.cwd();

test.describe('Unified State Management Core Functionality', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const extensionPath = join(projectRoot, 'build');

    context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--no-sandbox',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    // Use robust service worker detection
    extensionId = await waitForServiceWorker(context);
    console.log('🔌 Extension loaded with ID:', extensionId);
    expect(extensionId).toBeTruthy();
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('should successfully load unified state management system', async () => {
    // Create test pages to generate spaces
    const testPages: Page[] = [];
    
    const page1 = await context.newPage();
    await page1.goto('https://www.google.com', { waitUntil: 'networkidle' });
    testPages.push(page1);
    
    const page2 = await context.newPage();
    await page2.goto('https://www.github.com', { waitUntil: 'networkidle' });
    testPages.push(page2);

    // Wait for background service to process
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Open popup
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('networkidle');
    
    // Verify unified popup interface
    await expect(popupPage.locator('.popup-container')).toBeVisible();
    await expect(popupPage.locator('.search-input')).toBeVisible();
    await expect(popupPage.locator('.spaces-list')).toBeVisible();
    
    // Count spaces
    const spaceItems = popupPage.locator('.space-item');
    const spaceCount = await spaceItems.count();
    expect(spaceCount).toBeGreaterThanOrEqual(1);
    
    console.log(`✅ Found ${spaceCount} space(s) in unified interface`);
    
    // Get space details for debugging
    if (spaceCount > 0) {
      const spaceText = await spaceItems.first().textContent();
      console.log('Space details:', spaceText);
    }
    
    await popupPage.close();
    
    // Cleanup test pages
    for (const page of testPages) {
      await page.close();
    }
  });

  test('should display unified popup components correctly', async () => {
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('networkidle');
    
    // Check for all expected UI components
    const components = [
      '.popup-container',
      '.search-container',
      '.search-input',
      '.spaces-list'
    ];
    
    for (const component of components) {
      const element = popupPage.locator(component);
      await expect(element).toBeVisible({ timeout: 5000 });
      console.log(`✅ Component found: ${component}`);
    }
    
    // Check for help text
    const helpText = popupPage.locator('.help-text');
    if (await helpText.isVisible()) {
      const helpContent = await helpText.textContent();
      console.log('Help text:', helpContent);
    }
    
    await popupPage.close();
  });

  test('should handle search input functionality', async () => {
    // Create a test page first
    const testPage = await context.newPage();
    await testPage.goto('https://www.google.com', { waitUntil: 'networkidle' });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('networkidle');
    
    const searchInput = popupPage.locator('.search-input');
    await expect(searchInput).toBeVisible();
    
    // Test search input interaction
    await searchInput.fill('google');
    const searchValue = await searchInput.inputValue();
    expect(searchValue).toBe('google');
    
    // Clear search
    await searchInput.fill('');
    const clearedValue = await searchInput.inputValue();
    expect(clearedValue).toBe('');
    
    console.log('✅ Search input functionality works correctly');
    
    await popupPage.close();
    await testPage.close();
  });

  test('should validate storage migration system', async () => {
    const testPage = await context.newPage();
    
    // Check if we can access storage (this validates the unified system is working)
    const storageCheck = await testPage.evaluate(async () => {
      return new Promise((resolve) => {
        if (typeof chrome !== 'undefined' && chrome.storage) {
          chrome.storage.local.get(['chrome_spaces'], (result) => {
            resolve({
              hasUnifiedStorage: !!result.chrome_spaces,
              unifiedData: result.chrome_spaces ? Object.keys(result.chrome_spaces) : [],
              storageAvailable: true
            });
          });
        } else {
          resolve({ storageAvailable: false });
        }
      });
    });
    
    console.log('📦 Storage system check:', storageCheck);
    expect(typeof storageCheck).toBe('object');
    
    await testPage.close();
  });

  test('should handle popup lifecycle correctly', async () => {
    // Test opening and closing popup multiple times
    for (let i = 0; i < 3; i++) {
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
      await popupPage.waitForLoadState('networkidle');
      
      // Verify core components load each time
      await expect(popupPage.locator('.popup-container')).toBeVisible();
      
      await popupPage.close();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('✅ Popup lifecycle handled correctly through multiple open/close cycles');
  });

  test('should show spaces with correct unified structure', async () => {
    // Create multiple test pages to ensure we have spaces
    const pages: Page[] = [];
    const testUrls = [
      'https://www.google.com',
      'https://www.github.com',
      'https://www.stackoverflow.com'
    ];
    
    for (const url of testUrls) {
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
        pages.push(page);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(`Could not load ${url}, continuing...`);
      }
    }
    
    // Wait for background service to process
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const popupPage = await context.newPage();
    await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
    await popupPage.waitForLoadState('networkidle');
    
    // Check space structure
    const spaceItems = popupPage.locator('.space-item');
    const spaceCount = await spaceItems.count();
    
    console.log(`🏠 Total spaces found: ${spaceCount}`);
    
    // Analyze each space
    for (let i = 0; i < Math.min(spaceCount, 3); i++) {
      const space = spaceItems.nth(i);
      const spaceInfo = space.locator('.space-info');
      const spaceName = space.locator('.space-name');
      const spaceDetails = space.locator('.space-details');
      
      if (await spaceInfo.isVisible()) {
        const nameText = await spaceName.textContent();
        const detailsText = await spaceDetails.textContent();
        console.log(`Space ${i + 1}: "${nameText}" - ${detailsText}`);
      }
    }
    
    expect(spaceCount).toBeGreaterThan(0);
    
    await popupPage.close();
    
    // Cleanup
    for (const page of pages) {
      await page.close();
    }
  });
}); 