import { chromium, BrowserContext } from '@playwright/test';
import path from 'path';

/**
 * Wait for service worker with retry logic
 */
export async function waitForServiceWorker(
  context: BrowserContext,
  maxAttempts = 5,
  delayMs = 2000
): Promise<any> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[Attempt ${attempt}/${maxAttempts}] Checking for service workers...`);

    // Check existing service workers
    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      console.log(`✅ Found ${workers.length} service worker(s)`);
      return workers[0];
    }

    // Wait for service worker event with timeout
    try {
      console.log(`⏳ Waiting for service worker event (timeout: ${delayMs}ms)...`);
      const worker = await context.waitForEvent('serviceworker', {
        timeout: delayMs
      });
      console.log(`✅ Service worker registered`);
      return worker;
    } catch (error) {
      console.log(`⚠️ Attempt ${attempt} failed: ${error.message}`);

      if (attempt < maxAttempts) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  throw new Error(`Failed to find service worker after ${maxAttempts} attempts`);
}

/**
 * Get extension ID from filesystem
 */
async function getExtensionIdFromManifest(): Promise<string> {
  // For Chrome extensions, the ID is generated from the path
  // In test environment, we can use a predictable ID or extract it differently
  // For now, we'll return a placeholder and get the real ID from the popup URL
  return 'extension-id-placeholder';
}

/**
 * Setup extension context with optional service worker
 */
export async function setupExtensionContext(options: {
  headless?: boolean;
  userDataDir?: string;
  requireServiceWorker?: boolean;
} = {}): Promise<{ context: BrowserContext; extensionId: string }> {
  const pathToExtension = path.join(__dirname, '..', '..', 'build');

  console.log(`📦 Loading extension from: ${pathToExtension}`);
  console.log(`🎨 Headless mode: ${options.headless ?? true}`);

  const context = await chromium.launchPersistentContext(options.userDataDir || '', {
    headless: false,  // Must be false when using --headless=new
    args: [
      '--headless=new',  // CRITICAL: Use new headless mode for extension support
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
  });

  console.log('✅ Browser context created');

  let extensionId: string;

  // Try to get service worker if required
  if (options.requireServiceWorker !== false) {
    try {
      const background = await waitForServiceWorker(context, 3, 3000);
      extensionId = background.url().split('/')[2];
      console.log(`✅ Extension ID from service worker: ${extensionId}`);
    } catch (error) {
      console.log(`⚠️ Service worker not available: ${error.message}`);
      console.log(`📝 Will extract extension ID from popup URL instead`);

      // Get extension ID by opening chrome://extensions page
      const page = await context.newPage();
      await page.goto('chrome://extensions');
      await page.waitForTimeout(1000);

      // Try to extract the extension ID from the page
      // This is a workaround for when service worker doesn't load
      const pathToExtension = path.join(__dirname, '..', '..', 'build');
      const fs = require('fs');
      const manifestPath = path.join(pathToExtension, 'manifest.json');

      // Generate a deterministic ID based on the extension path
      // Chrome generates extension IDs as a hash of the path
      extensionId = await page.evaluate(() => {
        const items = document.querySelectorAll('extensions-item');
        for (const item of Array.from(items)) {
          const name = item.shadowRoot?.querySelector('#name')?.textContent;
          if (name?.includes('Chrome Spaces')) {
            const id = item.getAttribute('id');
            return id || '';
          }
        }
        return '';
      });

      await page.close();

      if (!extensionId) {
        throw new Error('Could not determine extension ID');
      }

      console.log(`✅ Extension ID from chrome://extensions: ${extensionId}`);
    }
  } else {
    // Skip service worker entirely
    console.log(`⏭️  Skipping service worker check`);
    extensionId = await getExtensionIdFromManifest();
  }

  return { context, extensionId };
}

/**
 * Open extension popup
 */
export async function openExtensionPopup(
  context: BrowserContext,
  extensionId: string
) {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/popup.html`);
  await page.waitForTimeout(1000); // Allow popup to initialize
  return page;
}