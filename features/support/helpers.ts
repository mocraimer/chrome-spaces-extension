import { BrowserContext, Page, chromium } from 'playwright';
import path from 'path';

export interface ExtensionDetails {
  context: BrowserContext;
  extensionId: string;
  popup?: Page;
}

/**
 * Setup Chrome browser context with extension loaded
 */
export async function setupExtensionContext(extensionPath?: string): Promise<BrowserContext> {
  const buildPath = extensionPath || path.join(process.cwd(), 'build');

  const context = await chromium.launchPersistentContext('', {
    headless: process.env.CI ? true : false,
    args: [
      `--disable-extensions-except=${buildPath}`,
      `--load-extension=${buildPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-gpu',
      '--disable-dev-shm-usage'
    ],
    viewport: { width: 1280, height: 720 },
    timeout: 30000
  });

  // Wait for extension to initialize
  await new Promise(resolve => setTimeout(resolve, 2000));

  return context;
}

/**
 * Get the extension ID from the loaded extension
 */
export async function getExtensionId(context: BrowserContext): Promise<string> {
  const extensionsPage = await context.newPage();
  await extensionsPage.goto('chrome://extensions/');
  await extensionsPage.waitForTimeout(1000);

  // Enable developer mode if needed
  const devModeToggle = await extensionsPage.$('#devMode');
  if (devModeToggle) {
    const isChecked = await devModeToggle.isChecked();
    if (!isChecked) {
      await devModeToggle.click();
      await extensionsPage.waitForTimeout(1000);
    }
  }

  // Find our extension
  const extensionId = await extensionsPage.evaluate(() => {
    const extensionItems = Array.from(document.querySelectorAll('extensions-item'));
    for (const item of extensionItems) {
      const nameEl = item.shadowRoot?.querySelector('#name');
      if (nameEl?.textContent?.includes('chrome-spaces') ||
          nameEl?.textContent?.includes('Chrome Spaces')) {
        return item.getAttribute('id');
      }
    }
    return null;
  });

  await extensionsPage.close();

  if (!extensionId) {
    // Try alternative method - look for service workers
    const serviceWorkers = context.serviceWorkers();
    if (serviceWorkers.length > 0) {
      return serviceWorkers[0].url().split('/')[2];
    }

    throw new Error('Extension ID not found. Make sure the extension is built and loaded.');
  }

  return extensionId;
}

/**
 * Open the extension popup
 */
export async function openPopup(context: BrowserContext, extensionId: string): Promise<Page> {
  const popupUrl = `chrome-extension://${extensionId}/popup.html`;
  const popup = await context.newPage();
  await popup.goto(popupUrl);
  await popup.waitForLoadState('domcontentloaded');

  // Wait for React to render
  await popup.waitForSelector('[data-testid="space-item"], .empty-list', {
    timeout: 5000
  }).catch(() => {
    // It's okay if no spaces exist yet
  });

  return popup;
}

/**
 * Open the extension options page
 */
export async function openOptions(context: BrowserContext, extensionId: string): Promise<Page> {
  const optionsUrl = `chrome-extension://${extensionId}/options.html`;
  const options = await context.newPage();
  await options.goto(optionsUrl);
  await options.waitForLoadState('domcontentloaded');

  return options;
}

/**
 * Wait for the popup to be fully loaded and interactive
 */
export async function waitForPopupReady(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return document.readyState === 'complete' &&
           (window as any).__reactMounted === true;
  }, { timeout: 5000 }).catch(() => {
    // Fallback if __reactMounted flag is not set
    console.log('React mount flag not found, assuming ready');
  });
}

/**
 * Create a mock space for testing
 */
export async function createMockSpace(
  page: Page,
  name: string,
  urls: string[]
): Promise<void> {
  await page.evaluate(({ spaceName, spaceUrls }: { spaceName: string; spaceUrls: string[] }) => {
    // Inject mock space into chrome.storage
    const mockSpace = {
      id: `mock-${Date.now()}-${Math.random()}`,
      name: spaceName,
      urls: spaceUrls,
      lastModified: Date.now(),
      named: true,
      version: 1
    };

    // Store in window for testing
    if (!(window as any).__mockSpaces) {
      (window as any).__mockSpaces = [];
    }
    (window as any).__mockSpaces.push(mockSpace);
  }, { spaceName: name, spaceUrls: urls });
}

/**
 * Create a space with specific number of tabs
 */
export async function createSpaceWithTabs(
  context: BrowserContext,
  name: string,
  tabCount: number
): Promise<Page[]> {
  const pages: Page[] = [];

  for (let i = 0; i < tabCount; i++) {
    const page = await context.newPage();
    await page.goto(`https://example.com/tab${i}`);
    pages.push(page);
  }

  return pages;
}

/**
 * Simulate closing a Chrome window
 */
export async function closeWindow(pages: Page[]): Promise<void> {
  for (const page of pages) {
    await page.close();
  }
}

/**
 * Get all visible space items from the popup
 */
export async function getVisibleSpaces(page: Page): Promise<string[]> {
  const spaceItems = await page.$$('[data-testid="space-item"]');
  const spaceNames: string[] = [];

  for (const item of spaceItems) {
    const isVisible = await item.isVisible();
    if (!isVisible) continue;

    const nameElement = await item.$('.space-name');
    const name = await nameElement?.textContent();
    if (name) {
      spaceNames.push(name.trim());
    }
  }

  return spaceNames;
}

/**
 * Search for spaces using the search input
 */
export async function searchForSpace(page: Page, query: string): Promise<void> {
  const searchInput = await page.$('#search-input, input[type="search"]');
  if (searchInput) {
    await searchInput.fill(query);
    // Wait for filtering to apply
    await page.waitForTimeout(300);
  }
}

/**
 * Wait for a specific space item to appear
 */
export async function waitForSpaceItem(page: Page, spaceName: string): Promise<void> {
  await page.waitForSelector(
    `[data-testid="space-item"]:has-text("${spaceName}")`,
    { timeout: 5000 }
  );
}

/**
 * Click a button within a specific space item
 */
export async function clickSpaceButton(
  page: Page,
  spaceName: string,
  buttonText: string
): Promise<void> {
  const spaceItem = await page.$(`[data-testid="space-item"]:has-text("${spaceName}")`);
  if (!spaceItem) {
    throw new Error(`Space "${spaceName}" not found`);
  }

  const button = await spaceItem.$(`button:has-text("${buttonText}")`);
  if (!button) {
    throw new Error(`Button "${buttonText}" not found in space "${spaceName}"`);
  }

  await button.click();
}

/**
 * Edit a space name
 */
export async function editSpaceName(
  page: Page,
  currentName: string,
  newName: string
): Promise<void> {
  // Find the space and click edit
  const spaceItem = await page.$(`[data-testid="space-item"]:has-text("${currentName}")`);
  const editButton = await spaceItem?.$('button[aria-label="Edit space name"]');

  if (!editButton) {
    throw new Error(`Edit button not found for space "${currentName}"`);
  }

  await editButton.click();

  // Fill in new name
  const input = await page.$('[data-testid="space-name-input"]');
  if (!input) {
    throw new Error('Space name input not found');
  }

  await input.fill(newName);
  await input.press('Enter');

  // Wait for update to complete
  await page.waitForSelector(`.space-name:has-text("${newName}")`, { timeout: 5000 });
}

/**
 * Get the number of tabs in a space
 */
export async function getSpaceTabCount(page: Page, spaceName: string): Promise<number> {
  const spaceItem = await page.$(`[data-testid="space-item"]:has-text("${spaceName}")`);
  if (!spaceItem) {
    throw new Error(`Space "${spaceName}" not found`);
  }

  const tabCountElement = await spaceItem.$('.space-tabs-count, .tab-count');
  const text = await tabCountElement?.textContent();

  if (!text) {
    return 0;
  }

  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1]) : 0;
}

/**
 * Check if a space is active (current window)
 */
export async function isSpaceActive(page: Page, spaceName: string): Promise<boolean> {
  const spaceItem = await page.$(`[data-testid="space-item"]:has-text("${spaceName}")`);
  if (!spaceItem) {
    return false;
  }

  const isActive = await spaceItem.evaluate((el) => {
    return el.classList.contains('active') ||
           el.getAttribute('aria-current') === 'true' ||
           el.hasAttribute('data-active');
  });

  return isActive;
}

/**
 * Check if a space is closed
 */
export async function isSpaceClosed(page: Page, spaceName: string): Promise<boolean> {
  const closedSection = await page.$('.closed-spaces-section');
  if (!closedSection) {
    return false;
  }

  const spaceInClosed = await closedSection.$(`[data-testid="space-item"]:has-text("${spaceName}")`);
  return spaceInClosed !== null;
}

/**
 * Take a screenshot for debugging
 */
export async function takeDebugScreenshot(page: Page, name: string): Promise<Buffer> {
  const screenshotPath = path.join(process.cwd(), 'test-results', `debug-${name}-${Date.now()}.png`);
  return await page.screenshot({ path: screenshotPath, fullPage: true });
}

/**
 * Wait for extension storage to sync
 */
export async function waitForStorageSync(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    return (window as any).__storageSynced === true;
  }, { timeout: 2000 }).catch(() => {
    // Fallback timeout
    console.log('Storage sync flag not found, waiting 500ms');
  });

  await page.waitForTimeout(500);
}

/**
 * Simulate Chrome extension update
 */
export async function simulateExtensionUpdate(context: BrowserContext): Promise<void> {
  // Close all pages except service worker
  const pages = context.pages();
  for (const page of pages) {
    await page.close();
  }

  // Wait a bit to simulate update
  await new Promise(resolve => setTimeout(resolve, 1000));
}

/**
 * Clear all extension data
 */
export async function clearExtensionData(page: Page): Promise<void> {
  await page.evaluate(() => {
    return new Promise((resolve) => {
      chrome.storage.local.clear(() => {
        resolve(undefined);
      });
    });
  });
}

/**
 * Get console errors from the page
 */
export async function getConsoleErrors(page: Page): Promise<string[]> {
  return await page.evaluate(() => {
    return (window as any).__consoleErrors || [];
  });
}

/**
 * Monitor page performance
 */
export async function measurePerformance(page: Page): Promise<number> {
  return await page.evaluate(() => {
    return performance.now();
  });
}

/**
 * Check if element is in viewport
 */
export async function isInViewport(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) return false;

    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  }, selector);
}