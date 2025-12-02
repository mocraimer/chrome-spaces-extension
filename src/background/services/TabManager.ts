import { TabManager as ITabManager } from '@/shared/types/Services';
import { executeChromeApi } from '@/shared/utils';
import { TAB_LOAD_TIMEOUT } from '@/shared/constants';

export class TabManager implements ITabManager {
  /**
   * Get all tabs in a window
   */
  async getTabs(windowId: number): Promise<chrome.tabs.Tab[]> {
    return executeChromeApi(
      () => chrome.tabs.query({ windowId }),
      'TAB_ERROR'
    );
  }

  /**
   * Create a new tab in a window
   */
  async createTab(windowId: number, url: string): Promise<chrome.tabs.Tab> {
    return executeChromeApi(
      () => chrome.tabs.create({ windowId, url }),
      'TAB_ERROR'
    );
  }

  /**
   * Create multiple tabs in a window
   */
  async createTabs(windowId: number, urls: string[]): Promise<chrome.tabs.Tab[]> {
    return executeChromeApi(
      () => Promise.all(
        urls.map(url => chrome.tabs.create({ windowId, url }))
      ),
      'TAB_ERROR'
    );
  }

  /**
   * Move a tab to a different window
   */
  async moveTab(tabId: number, windowId: number): Promise<chrome.tabs.Tab> {
    return executeChromeApi(
      async () => {
        const tab = await chrome.tabs.get(tabId);
        
        // If tab is already in the target window, just return it
        if (tab.windowId === windowId) {
          return tab;
        }

        // Move the tab to the new window
        await chrome.tabs.move(tabId, { windowId, index: -1 });
        
        // Get updated tab info
        return chrome.tabs.get(tabId);
      },
      'TAB_ERROR'
    );
  }

  /**
   * Remove a tab
   */
  async removeTab(tabId: number): Promise<void> {
    await executeChromeApi(
      () => chrome.tabs.remove(tabId),
      'TAB_ERROR'
    );
  }

  /**
   * Update tab properties
   */
  async updateTab(
    tabId: number,
    updateProperties: chrome.tabs.UpdateProperties
  ): Promise<chrome.tabs.Tab> {
    return executeChromeApi(
      () => chrome.tabs.update(tabId, updateProperties),
      'TAB_ERROR'
    );
  }

  /**
   * Wait for a tab to finish loading
   */
  async waitForTabLoad(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
      };

      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(new Error('Tab load timeout'));
      }, TAB_LOAD_TIMEOUT);

      const listener = (
        changedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (changedTabId === tabId && changeInfo.status === 'complete') {
          if (settled) return;
          settled = true;
          cleanup();
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
    });
  }

  /**
   * Get the active tab in a window
   */
  async getActiveTab(windowId: number): Promise<chrome.tabs.Tab> {
    const [tab] = await executeChromeApi(
      () => chrome.tabs.query({ active: true, windowId }),
      'TAB_ERROR'
    );
    if (!tab) {
      throw new Error(`No active tab found in window ${windowId}`);
    }
    return tab;
  }

  /**
   * Move multiple tabs to a window
   */
  async moveTabs(
    tabIds: number[],
    windowId: number
  ): Promise<chrome.tabs.Tab[]> {
    return executeChromeApi(
      async () => {
        const movedTabs = await chrome.tabs.move(tabIds, {
          windowId,
          index: -1
        });
        
        // Return array of moved tabs
        return Array.isArray(movedTabs) ? movedTabs : [movedTabs];
      },
      'TAB_ERROR'
    );
  }

  /**
   * Duplicate a tab
   */
  async duplicateTab(tabId: number): Promise<chrome.tabs.Tab> {
    return executeChromeApi(
      async () => {
        const duplicatedTab = await chrome.tabs.duplicate(tabId);
        if (!duplicatedTab) {
          throw new Error('Failed to duplicate tab');
        }
        return duplicatedTab;
      },
      'TAB_ERROR'
    );
  }

  /**
   * Reload a tab
   */
  async reloadTab(tabId: number): Promise<void> {
    await executeChromeApi(
      () => chrome.tabs.reload(tabId),
      'TAB_ERROR'
    );
  }

  /**
   * Get tab URL safely (handling chrome:// URLs)
   */
  getTabUrl(tab: chrome.tabs.Tab): string {
    // Chrome API doesn't expose URL for chrome:// pages
    if (tab.url && !tab.url.startsWith('chrome://')) {
      return tab.url;
    }
    return tab.pendingUrl || '';
  }

  /**
   * Capture a screenshot of a tab
   */
  async captureTab(tabId: number): Promise<string> {
    return executeChromeApi(
      async () => {
        // Ensure tab is fully loaded
        await this.waitForTabLoad(tabId);
        
        // Get tab to get its window ID
        const tab = await chrome.tabs.get(tabId);
        if (!tab.windowId) {
          throw new Error('Tab has no window ID');
        }
        
        // Capture visible area of the tab
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png'
        });
        
        if (!dataUrl) {
          throw new Error('Failed to capture tab screenshot');
        }
        
        return dataUrl;
      },
      'TAB_ERROR'
    );
  }
}
