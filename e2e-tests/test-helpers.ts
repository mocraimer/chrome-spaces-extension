import { BrowserContext, Page } from '@playwright/test';

/**
 * Helper function to create a new Chrome window (not just a tab)
 * The extension tracks windows, not tabs, so we need to create actual windows for testing
 */
export async function createChromeWindow(
  context: BrowserContext,
  extensionId: string,
  url: string = 'https://example.com'
): Promise<{ windowId: number; page: Page }> {
  // We need to use the extension's background page or popup to call chrome.windows API
  // Create a temporary popup page to access chrome APIs
  const tempPopupPage = await context.newPage();
  await tempPopupPage.goto(`chrome-extension://${extensionId}/popup.html`);
  await tempPopupPage.waitForLoadState('domcontentloaded');

  // Use Chrome Windows API to create a new window
  const windowInfo = await tempPopupPage.evaluate(async (targetUrl) => {
    const newWindow = await chrome.windows.create({
      url: targetUrl,
      focused: false,
      type: 'normal'
    });
    return {
      windowId: newWindow.id,
      tabId: newWindow.tabs?.[0]?.id
    };
  }, url);

  // Close the temp popup
  await tempPopupPage.close();

  // Wait a bit for the window to be created
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Find the page corresponding to the new window
  const pages = context.pages();
  const urlHost = url.replace('https://', '').replace('http://', '').split('/')[0];
  const newPage = pages.find(p => p.url().includes(urlHost));

  if (!newPage) {
    throw new Error(`Could not find page for URL ${url}. Current pages: ${pages.map(p => p.url()).join(', ')}`);
  }

  await newPage.waitForLoadState('networkidle').catch(() => {
    // Ignore if page is already loaded
  });

  return {
    windowId: windowInfo.windowId!,
    page: newPage
  };
}

/**
 * Open the extension popup
 */
export async function openExtensionPopup(
  context: BrowserContext,
  extensionId: string
): Promise<Page> {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.waitForLoadState('domcontentloaded');

  // Wait for React to render
  await popup.waitForSelector('[data-testid="spaces-list"], [data-testid="no-results"]', { timeout: 10000 });

  return popup;
}

/**
 * Wait for space items to appear in the popup
 */
export async function waitForSpaceItems(
  popup: Page,
  minCount: number = 1,
  timeout: number = 10000
): Promise<void> {
  await popup.waitForFunction(
    (count) => {
      const items = document.querySelectorAll('[data-testid^="space-item"]');
      return items.length >= count;
    },
    minCount,
    { timeout }
  );
}

/**
 * Get all space items from the popup
 */
export async function getSpaceItems(popup: Page) {
  return popup.locator('[data-testid^="space-item"]');
}

/**
 * Find a space item by name
 */
export async function findSpaceByName(popup: Page, name: string) {
  const items = await getSpaceItems(popup);
  const count = await items.count();

  for (let i = 0; i < count; i++) {
    const item = items.nth(i);
    const text = await item.textContent();
    if (text?.includes(name)) {
      return item;
    }
  }

  return null;
}

/**
 * Rename a space using F2 key or edit button (avoids popup closing on click)
 */
export async function renameSpace(
  popup: Page,
  spaceIndex: number,
  newName: string
): Promise<void> {
  const spaceItems = await getSpaceItems(popup);
  const spaceItem = spaceItems.nth(spaceIndex);

  // Make sure the popup is still open
  if (popup.isClosed()) {
    throw new Error('Popup was closed before renaming');
  }

  // Try to find and click the edit button first (safer than double-click)
  const editButton = spaceItem.locator('button[aria-label*="Edit"], button[title*="Edit"], .edit-button').first();

  if (await editButton.count() > 0 && await editButton.isVisible()) {
    console.log('[renameSpace] Using edit button');
    await editButton.click();
  } else {
    // Fallback: Focus the space item and press F2
    console.log('[renameSpace] Using F2 key');
    await spaceItem.focus();
    await popup.keyboard.press('F2');
  }

  // Small delay to let the edit mode activate
  await new Promise(resolve => setTimeout(resolve, 500));

  // Wait for input to appear
  const nameInput = popup.locator('[data-testid="space-name-input"], input[type="text"]').first();

  try {
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
  } catch (err) {
    // Debug: log what's visible
    if (!popup.isClosed()) {
      const visibleElements = await popup.evaluate(() => {
        return {
          inputs: Array.from(document.querySelectorAll('input')).map(el => ({
            type: el.type,
            testId: el.getAttribute('data-testid'),
            className: el.className,
            visible: el.offsetParent !== null
          })),
          hasPopupContainer: document.querySelector('[data-testid="spaces-list"]') !== null,
          spaceItems: document.querySelectorAll('[data-testid^="space-item"]').length
        };
      });
      console.error('[renameSpace] Debug info:', visibleElements);
    } else {
      console.error('[renameSpace] Popup was closed before input appeared');
    }
    throw err;
  }

  // Fill and save
  await nameInput.fill(newName);
  await nameInput.press('Enter');

  // Wait for edit mode to exit
  await popup.waitForFunction(
    () => {
      const inputs = document.querySelectorAll('[data-testid="space-name-input"], input[type="text"]');
      return inputs.length === 0 || !Array.from(inputs).some(el => el.offsetParent !== null);
    },
    { timeout: 5000 }
  ).catch(() => {
    // Ignore if already hidden
  });
}

/**
 * Get diagnostic info about the extension state
 */
export async function getDiagnosticInfo(popup: Page): Promise<{
  windowCount: number;
  spaceCount: number;
  storageKeys: string[];
  hasSpaces: boolean;
}> {
  return popup.evaluate(async () => {
    try {
      const windows = await chrome.windows.getAll();
      const storage = await chrome.storage.local.get(null);

      return {
        windowCount: windows.length,
        spaceCount: storage.spaces ? (Array.isArray(storage.spaces) ? storage.spaces.length : 0) : 0,
        storageKeys: Object.keys(storage),
        hasSpaces: 'spaces' in storage
      };
    } catch (err) {
      return {
        windowCount: -1,
        spaceCount: -1,
        storageKeys: [],
        hasSpaces: false
      };
    }
  });
}