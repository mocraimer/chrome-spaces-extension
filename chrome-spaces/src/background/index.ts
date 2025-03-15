import { WindowManager } from './services/WindowManager';
import { TabManager } from './services/TabManager';
import { StorageManager } from './services/StorageManager';
import { StateManager } from './services/StateManager';
import { MessageHandler } from './services/MessageHandler';
import { Events, STARTUP_DELAY, RECOVERY_CHECK_DELAY } from '@/shared/constants';

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
    chrome.runtime.onStartup.addListener(() => {
      console.log('[Startup] Chrome Spaces initializing');
      this.handleStartup();
    });

    // Handle installation and updates
    chrome.runtime.onInstalled.addListener((details) => {
      console.log(`[Install] Extension ${details.reason}`, details);
      this.handleInstall(details);
    });

    // Handle messages from UI
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.messageHandler.handleMessage(request, sender, sendResponse);
      return true; // Will respond asynchronously
    });

    // Window event listeners
    chrome.windows.onCreated.addListener((window) => {
      this.stateManager.createSpace(window.id!);
    });

    chrome.windows.onRemoved.addListener((windowId) => {
      this.stateManager.closeSpace(windowId);
    });

    chrome.windows.onFocusChanged.addListener((windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        this.ensureWindowHasSpace(windowId);
      }
    });

    // Tab event listeners
    chrome.tabs.onCreated.addListener((tab) => {
      if (tab.windowId) {
        this.ensureWindowHasSpace(tab.windowId);
      }
    });

    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.windowId) {
        this.stateManager.synchronizeWindowsAndSpaces();
      }
    });

    // Handle extension suspend/shutdown
    chrome.runtime.onSuspend?.addListener(() => {
      this.stateManager.handleShutdown();
    });
  }

  private async handleStartup(): Promise<void> {
    try {
      // Wait for Chrome to settle
      await this.delay(STARTUP_DELAY);
      
      // Initialize state
      await this.stateManager.initialize();
      
      // Double-check after a delay
      await this.delay(RECOVERY_CHECK_DELAY);
      await this.stateManager.synchronizeWindowsAndSpaces();
    } catch (error) {
      console.error('Startup error:', error);
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
