import { WindowManager } from './services/WindowManager';
import { TabManager } from './services/TabManager';
import { StorageManager } from './services/StorageManager';
import { StateManager } from './services/StateManager';
import { MessageHandler } from './services/MessageHandler';
import { Events, STARTUP_DELAY, RECOVERY_CHECK_DELAY } from '@/shared/constants';
import { SettingsState } from '@/options/store/slices/settingsSlice';

class BackgroundService {
  private windowManager: WindowManager;
  private tabManager: TabManager;
  private storageManager: StorageManager;
  private stateManager: StateManager;
  private messageHandler: MessageHandler;

  constructor() {
    // Initialize services
    this.windowManager = new WindowManager();
    this.tabManager = new TabManager();
    this.storageManager = new StorageManager();
    this.stateManager = new StateManager(
      this.windowManager,
      this.tabManager,
      this.storageManager
    );
    this.messageHandler = new MessageHandler(
      this.windowManager,
      this.tabManager,
      this.stateManager
    );

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // Listen for extension startup
    chrome.runtime.onStartup.addListener(async () => {
      console.log('[Startup] Chrome Spaces initializing');
      await this.handleStartup();
    });

    // Handle installation and updates
    chrome.runtime.onInstalled.addListener(async (details) => {
      console.log(`[Install] Extension ${details.reason}`, details);
      await this.handleInstall(details);
    });

    // Handle messages from UI
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.messageHandler.handleMessage(request, sender, sendResponse);
      return true; // Will respond asynchronously
    });

    // Window event listeners
    chrome.windows.onCreated.addListener(async (window) => {
      await this.stateManager.createSpace(window.id!);
    });

    chrome.windows.onRemoved.addListener(async (windowId) => {
      await this.stateManager.closeSpace(windowId);
    });

    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        await this.ensureWindowHasSpace(windowId);
      }
    });

    // Tab event listeners
    chrome.tabs.onCreated.addListener(async (tab) => {
      if (tab.windowId) {
        await this.ensureWindowHasSpace(tab.windowId);
      }
    });

    chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.windowId) {
        await this.stateManager.synchronizeWindowsAndSpaces();
      }
    });

    // Handle extension suspend/shutdown
    chrome.runtime.onSuspend?.addListener(async () => {
      await this.stateManager.handleShutdown();
    });
  }

  private async handleStartup(): Promise<void> {
    try {
      // Wait for Chrome to settle
      await this.delay(STARTUP_DELAY);
      
      // Initialize state
      await this.stateManager.initialize();
      
      // Check if auto-restore is enabled
      const settings = await this.loadSettings();
      if (settings?.general?.autoRestore) {
        console.log('[Startup] Auto-restore enabled, restoring spaces');
        await this.restoreSpaces();
      }
      
      // Double-check after a delay
      await this.delay(RECOVERY_CHECK_DELAY);
      await this.stateManager.synchronizeWindowsAndSpaces();
    } catch (error) {
      console.error('Startup error:', error);
    }
  }

  private async loadSettings(): Promise<SettingsState | null> {
    try {
      const data = await chrome.storage.local.get('settings');
      return data.settings || null;
    } catch (error) {
      console.error('Error loading settings:', error);
      return null;
    }
  }

  private async restoreSpaces(): Promise<void> {
    try {
      const closedSpaces = await this.stateManager.getClosedSpaces();
      
      // Restore each named closed space
      for (const [id, space] of Object.entries(closedSpaces)) {
        if (space.named) {
          console.log(`[Restore] Restoring space: ${space.name}`);
          await this.stateManager.restoreSpace(id);
        }
      }
    } catch (error) {
      console.error('Error restoring spaces:', error);
    }
  }

  private async handleInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
    try {
      await this.stateManager.initialize();
      
      if (details.reason === 'install') {
        await this.delay(STARTUP_DELAY);
        await this.stateManager.synchronizeWindowsAndSpaces();
      }
    } catch (error) {
      console.error('Install error:', error);
    }
  }

  private async handleSessionRestore(): Promise<void> {
    try {
      await this.stateManager.initialize();
      await this.stateManager.synchronizeWindowsAndSpaces();
      
      // Double check after a delay
      await this.delay(RECOVERY_CHECK_DELAY);
      await this.checkForMissedWindows();
    } catch (error) {
      console.error('Session restore error:', error);
    }
  }

  private async checkForMissedWindows(): Promise<void> {
    const windows = await this.windowManager.getAllWindows();
    for (const window of windows) {
      await this.ensureWindowHasSpace(window.id!);
    }
  }

  private async ensureWindowHasSpace(windowId: number): Promise<void> {
    if (!this.stateManager.hasSpace(windowId)) {
      await this.stateManager.createSpace(windowId);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Initialize background service
new BackgroundService();
