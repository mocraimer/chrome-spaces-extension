/**
 * Error Simulation Helpers for Error UX Testing
 *
 * Provides utilities to simulate various failure scenarios and verify
 * user-friendly error handling across the Chrome Spaces extension.
 */

import { Page, BrowserContext, Route } from '@playwright/test';

/**
 * Network failure simulation options
 */
export interface NetworkFailureOptions {
  /** Type of network failure to simulate */
  type: 'offline' | 'timeout' | 'connection-refused' | 'dns-error';
  /** URLs to block (default: all) */
  urlPattern?: string | RegExp;
  /** Delay before failure (ms) */
  delay?: number;
}

/**
 * Storage quota options
 */
export interface StorageQuotaOptions {
  /** Current usage in bytes */
  currentUsage: number;
  /** Max quota in bytes */
  maxQuota: number;
  /** Whether to throw immediately or after next write */
  throwImmediately?: boolean;
}

/**
 * Chrome API failure options
 */
export interface ChromeAPIFailureOptions {
  /** API to fail */
  api: 'windows.create' | 'windows.get' | 'tabs.query' | 'tabs.create' | 'storage.set' | 'storage.get';
  /** Error message to throw */
  errorMessage?: string;
  /** Whether to fail once or always */
  failAlways?: boolean;
}

/**
 * Simulate network failure
 */
export async function simulateNetworkFailure(
  page: Page | BrowserContext,
  options: NetworkFailureOptions
): Promise<() => Promise<void>> {
  const { type, urlPattern = '**/*', delay = 0 } = options;

  // For Page or BrowserContext, we use different methods
  const target = page;

  if (type === 'offline') {
    // Abort all requests
    await target.route(urlPattern, async (route: Route) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await route.abort('failed');
    });

    // Return cleanup function
    return async () => {
      await target.unroute(urlPattern);
    };
  }

  if (type === 'timeout') {
    await target.route(urlPattern, async (route: Route) => {
      // Delay indefinitely to simulate timeout
      await new Promise(resolve => setTimeout(resolve, 60000));
      await route.abort('timedout');
    });

    return async () => {
      await target.unroute(urlPattern);
    };
  }

  if (type === 'connection-refused') {
    await target.route(urlPattern, async (route: Route) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await route.abort('connectionrefused');
    });

    return async () => {
      await target.unroute(urlPattern);
    };
  }

  if (type === 'dns-error') {
    await target.route(urlPattern, async (route: Route) => {
      if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      await route.abort('namenotresolved');
    });

    return async () => {
      await target.unroute(urlPattern);
    };
  }

  throw new Error(`Unknown network failure type: ${type}`);
}

/**
 * Simulate storage quota exceeded error
 */
export async function simulateStorageQuotaExceeded(
  page: Page,
  options: StorageQuotaOptions
): Promise<() => Promise<void>> {
  const { currentUsage, maxQuota, throwImmediately = true } = options;

  await page.addInitScript(({ current, max, immediate }) => {
    const originalSet = chrome.storage.local.set;
    const originalGet = chrome.storage.local.get;

    let callCount = 0;

    // Mock storage quota
    chrome.storage.local.set = async function(items: any) {
      callCount++;

      if (immediate || callCount > 1) {
        const error = new Error('QUOTA_BYTES_PER_ITEM quota exceeded');
        error.name = 'QuotaExceededError';
        throw error;
      }

      return originalSet.call(this, items);
    } as any;

    // Mock getBytesInUse to return realistic values
    (chrome.storage.local as any).getBytesInUse = async () => {
      return current;
    };

    // Store originals for cleanup
    (window as any).__originalStorageSet = originalSet;
    (window as any).__originalStorageGet = originalGet;
  }, { current: currentUsage, max: maxQuota, immediate: throwImmediately });

  // Return cleanup function
  return async () => {
    await page.evaluate(() => {
      if ((window as any).__originalStorageSet) {
        chrome.storage.local.set = (window as any).__originalStorageSet;
      }
      if ((window as any).__originalStorageGet) {
        chrome.storage.local.get = (window as any).__originalStorageGet;
      }
    });
  };
}

/**
 * Simulate Chrome permission denied
 */
export async function simulatePermissionDenied(
  page: Page,
  permission: string = 'tabs'
): Promise<() => Promise<void>> {
  await page.addInitScript((perm) => {
    const originalContains = chrome.permissions.contains;
    const originalRequest = chrome.permissions.request;

    chrome.permissions.contains = async () => false;
    chrome.permissions.request = async () => false;

    (window as any).__originalPermissions = {
      contains: originalContains,
      request: originalRequest
    };
  }, permission);

  return async () => {
    await page.evaluate(() => {
      if ((window as any).__originalPermissions) {
        chrome.permissions.contains = (window as any).__originalPermissions.contains;
        chrome.permissions.request = (window as any).__originalPermissions.request;
      }
    });
  };
}

/**
 * Simulate Chrome API failure
 */
export async function simulateAPIFailure(
  page: Page,
  options: ChromeAPIFailureOptions
): Promise<() => Promise<void>> {
  const { api, errorMessage = 'API temporarily unavailable', failAlways = true } = options;

  await page.addInitScript(({ apiPath, message, always }) => {
    const [namespace, method] = apiPath.split('.');
    const chromeNamespace = (chrome as any)[namespace];

    if (!chromeNamespace || !chromeNamespace[method]) {
      console.warn(`API ${apiPath} not found`);
      return;
    }

    const originalMethod = chromeNamespace[method];
    let callCount = 0;

    chromeNamespace[method] = async function(...args: any[]) {
      callCount++;

      if (always || callCount === 1) {
        const error = new Error(message);
        error.name = 'APIError';
        throw error;
      }

      return originalMethod.apply(this, args);
    };

    // Store original for cleanup
    if (!(window as any).__originalAPIs) {
      (window as any).__originalAPIs = {};
    }
    (window as any).__originalAPIs[apiPath] = originalMethod;
  }, { apiPath: api, message: errorMessage, always: failAlways });

  return async () => {
    await page.evaluate((apiPath) => {
      if ((window as any).__originalAPIs && (window as any).__originalAPIs[apiPath]) {
        const [namespace, method] = apiPath.split('.');
        (chrome as any)[namespace][method] = (window as any).__originalAPIs[apiPath];
        delete (window as any).__originalAPIs[apiPath];
      }
    }, api);
  };
}

/**
 * Simulate concurrent modification conflict
 */
export async function simulateConcurrentModification(
  page1: Page,
  page2: Page,
  operation: () => Promise<void>
): Promise<void> {
  // Execute operations simultaneously
  await Promise.all([
    page1.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    }),
    page2.evaluate(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    })
  ]);

  // Perform the conflicting operation
  await Promise.all([
    operation(),
    operation()
  ]);
}

/**
 * Simulate data corruption
 */
export async function simulateDataCorruption(
  page: Page,
  corruptionType: 'partial' | 'invalid-json' | 'missing-fields' | 'wrong-types'
): Promise<void> {
  await page.evaluate(async (type) => {
    const currentState = await chrome.storage.local.get('state');
    let corruptedState: any;

    switch (type) {
      case 'partial':
        corruptedState = {
          ...currentState.state,
          spaces: null,
          corrupted: true
        };
        break;

      case 'invalid-json':
        // Can't actually store invalid JSON, so simulate with corrupted structure
        corruptedState = {
          ...currentState.state,
          spaces: 'this should be an object',
          closedSpaces: 'this should also be an object'
        };
        break;

      case 'missing-fields':
        corruptedState = {
          someRandomField: 'random value'
        };
        break;

      case 'wrong-types':
        corruptedState = {
          ...currentState.state,
          spaces: ['should', 'be', 'object'],
          closedSpaces: 12345
        };
        break;

      default:
        throw new Error(`Unknown corruption type: ${type}`);
    }

    await chrome.storage.local.set({ state: corruptedState });
  }, corruptionType);
}

/**
 * Verify error message is user-friendly
 */
export interface ErrorMessageVerification {
  /** Whether error is visible */
  isVisible: boolean;
  /** Error message text */
  message: string;
  /** Whether it's user-friendly (no technical jargon) */
  isUserFriendly: boolean;
  /** Whether it has actionable guidance */
  hasActionableGuidance: boolean;
  /** Whether retry option is available */
  hasRetryOption: boolean;
}

/**
 * Verify error message quality
 */
export async function verifyErrorMessage(page: Page): Promise<ErrorMessageVerification> {
  const errorElement = page.locator('[role="alert"], .error-message, .error-dialog, [data-testid="error"]').first();

  const isVisible = await errorElement.isVisible({ timeout: 5000 }).catch(() => false);

  if (!isVisible) {
    return {
      isVisible: false,
      message: '',
      isUserFriendly: false,
      hasActionableGuidance: false,
      hasRetryOption: false
    };
  }

  const message = await errorElement.textContent() || '';

  // Check for technical jargon (indicates NOT user-friendly)
  const technicalJargon = [
    'undefined',
    'null',
    'NaN',
    'TypeError',
    'ReferenceError',
    'at line',
    'stack trace',
    'function',
    'Object',
    '.js:',
    'chrome-extension://',
    'async/await'
  ];

  const isUserFriendly = !technicalJargon.some(jargon =>
    message.toLowerCase().includes(jargon.toLowerCase())
  );

  // Check for actionable guidance
  const actionableWords = [
    'try',
    'check',
    'verify',
    'enable',
    'disable',
    'allow',
    'grant',
    'click',
    'go to',
    'settings',
    'reload',
    'retry'
  ];

  const hasActionableGuidance = actionableWords.some(word =>
    message.toLowerCase().includes(word.toLowerCase())
  );

  // Check for retry button
  const retryButton = page.locator('button:has-text("Retry"), button:has-text("Try Again")');
  const hasRetryOption = await retryButton.isVisible({ timeout: 1000 }).catch(() => false);

  return {
    isVisible,
    message,
    isUserFriendly,
    hasActionableGuidance,
    hasRetryOption
  };
}

/**
 * Verify visual error indicators
 */
export async function verifyVisualErrorIndicators(page: Page): Promise<{
  hasErrorColor: boolean;
  hasErrorIcon: boolean;
  isNearSource: boolean;
  isAccessible: boolean;
}> {
  const errorElement = page.locator('[role="alert"], .error-message, .error-dialog').first();

  if (!await errorElement.isVisible({ timeout: 2000 }).catch(() => false)) {
    return {
      hasErrorColor: false,
      hasErrorIcon: false,
      isNearSource: false,
      isAccessible: false
    };
  }

  // Check for error color (red)
  const color = await errorElement.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return {
      color: style.color,
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor
    };
  });

  const hasErrorColor =
    color.color.includes('rgb(211, 47, 47)') || // Material red
    color.color.includes('rgb(244, 67, 54)') || // Red 500
    color.color.includes('#d32f2f') ||
    color.color.includes('#f44336') ||
    color.backgroundColor.includes('rgb(255, 235, 238)') || // Red 50
    color.borderColor.includes('rgb(239, 83, 80)'); // Red 400

  // Check for error icon
  const hasErrorIcon = await page.locator('[role="alert"] svg, .error-message svg, .error-dialog svg, [data-icon="error"]').isVisible({ timeout: 1000 }).catch(() => false);

  // Check for accessibility (role="alert" and aria attributes)
  const ariaAttributes = await errorElement.evaluate((el) => ({
    role: el.getAttribute('role'),
    ariaLive: el.getAttribute('aria-live'),
    ariaAtomic: el.getAttribute('aria-atomic')
  }));

  const isAccessible = ariaAttributes.role === 'alert' || ariaAttributes.ariaLive === 'assertive';

  // Check if error is near source (hard to determine programmatically, so check if it's in viewport)
  const isInViewport = await errorElement.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= window.innerHeight &&
      rect.right <= window.innerWidth
    );
  });

  return {
    hasErrorColor,
    hasErrorIcon,
    isNearSource: isInViewport,
    isAccessible
  };
}

/**
 * Wait for error to appear
 */
export async function waitForError(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.locator('[role="alert"], .error-message, .error-dialog, [data-testid="error"]').first().waitFor({
      state: 'visible',
      timeout
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for error to disappear
 */
export async function waitForErrorDismissed(page: Page, timeout: number = 5000): Promise<boolean> {
  try {
    await page.locator('[role="alert"], .error-message, .error-dialog').first().waitFor({
      state: 'hidden',
      timeout
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all console errors
 */
export async function getConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  return errors;
}

/**
 * Clear all mocked APIs and restore originals
 */
export async function clearAllMocks(page: Page): Promise<void> {
  await page.evaluate(() => {
    // Restore storage APIs
    if ((window as any).__originalStorageSet) {
      chrome.storage.local.set = (window as any).__originalStorageSet;
      delete (window as any).__originalStorageSet;
    }
    if ((window as any).__originalStorageGet) {
      chrome.storage.local.get = (window as any).__originalStorageGet;
      delete (window as any).__originalStorageGet;
    }

    // Restore permissions
    if ((window as any).__originalPermissions) {
      chrome.permissions.contains = (window as any).__originalPermissions.contains;
      chrome.permissions.request = (window as any).__originalPermissions.request;
      delete (window as any).__originalPermissions;
    }

    // Restore all other APIs
    if ((window as any).__originalAPIs) {
      for (const [apiPath, originalMethod] of Object.entries((window as any).__originalAPIs)) {
        const [namespace, method] = apiPath.split('.');
        (chrome as any)[namespace][method] = originalMethod;
      }
      delete (window as any).__originalAPIs;
    }
  });
}