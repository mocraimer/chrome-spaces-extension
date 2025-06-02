import { test, expect, chromium, BrowserContext } from '@playwright/test';
import path from 'path';

test.describe('Popup Loading Tests', () => {
  let context: BrowserContext;
  let extensionId: string;

  test.beforeAll(async () => {
    const pathToExtension = path.join(__dirname, '..', 'build');
    context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
        '--disable-web-security',
      ],
    });

    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }

    extensionId = background.url().split('/')[2];
    console.log('Extension ID:', extensionId);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('Popup loads without React hooks errors', async () => {
    const page = await context.newPage();
    
    // Listen for console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Listen for page errors
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    // Navigate to popup
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    
    // Wait for React to render
    await page.waitForTimeout(3000);

    // Check for specific React hooks errors
    const hasHooksError = consoleErrors.some(error => 
      error.includes('hooks') || 
      error.includes('Rendered more hooks') ||
      error.includes('React error #310')
    );

    const hasPageError = pageErrors.some(error => 
      error.includes('hooks') || 
      error.includes('Rendered more hooks') ||
      error.includes('React error #310')
    );

    // Log all errors for debugging
    if (consoleErrors.length > 0) {
      console.log('Console errors:', consoleErrors);
    }
    if (pageErrors.length > 0) {
      console.log('Page errors:', pageErrors);
    }

    // Check that popup loaded with expected content
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();

    // The popup should not have React hooks violations
    expect(hasHooksError).toBe(false);
    expect(hasPageError).toBe(false);

    // Try to find expected elements
    const hasSpacesList = await page.locator('[class*="space-list"]').count() > 0;
    const hasHeader = await page.locator('h2').count() > 0;
    
    console.log('Has spaces list element:', hasSpacesList);
    console.log('Has header element:', hasHeader);
    
    // At minimum, we should have some content rendered
    expect(bodyText.length).toBeGreaterThan(10);
  });

  test('Popup renders without crashing on empty spaces', async () => {
    const page = await context.newPage();
    
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(2000);

    // Should handle empty state gracefully
    const bodyText = await page.textContent('body');
    const hasEmptyStateText = bodyText?.includes('No') || bodyText?.includes('Empty') || bodyText?.includes('Active Spaces');
    
    console.log('Body text:', bodyText);
    console.log('Has empty state or content:', hasEmptyStateText);

    // Should not crash on empty spaces
    const hasCrashError = consoleErrors.some(error => 
      error.includes('Cannot read properties') ||
      error.includes('TypeError') ||
      error.includes('ReferenceError')
    );

    expect(hasCrashError).toBe(false);
  });

  test('React DevTools can inspect components', async () => {
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await page.waitForTimeout(2000);

    // Check if React is properly loaded
    const hasReact = await page.evaluate(() => {
      return typeof window.React !== 'undefined' || 
             document.querySelector('[data-reactroot]') !== null ||
             document.querySelector('#root') !== null;
    });

    console.log('React detected:', hasReact);
    
    // The page should have React components
    const hasRootElement = await page.locator('#root').count() > 0;
    expect(hasRootElement).toBe(true);
  });
});