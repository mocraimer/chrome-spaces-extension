import { WindowManager } from './services/WindowManager';
import { TabManager } from './services/TabManager';
import { IndexedDbStorageManager } from './services/storage/IndexedDbStorageManager';
import { StateManager } from './services/StateManager';
import { MessageHandler } from './services/MessageHandler';
import { StateUpdateQueue } from './services/StateUpdateQueue';
import { StateBroadcastService } from './services/StateBroadcastService';
import { RestoreSpaceTransaction } from './services/RestoreSpaceTransaction';
import { STARTUP_DELAY, RECOVERY_CHECK_DELAY } from '@/shared/constants';
import { PerformanceMessageHandler } from './services/performance/PerformanceMessageHandler';
import { PerformanceTrackingService, MetricCategories } from './services/performance/PerformanceTrackingService';
import { StorageManager as IStorageManager } from '@/shared/types/Services';
import { RestoreRegistry } from './services/types/RestoreRegistry';
import { Space } from '@/shared/types/Space';

class BackgroundService {
  private windowManager: WindowManager;
  private tabManager: TabManager;
  private storageManager: IStorageManager;
  private stateManager: StateManager;
  private messageHandler: MessageHandler;
  private restoreTransaction: RestoreSpaceTransaction;
  private restoreRegistry = new RestoreRegistry();

  constructor() {
    console.log('[BackgroundService] Constructor called - Initializing background service');

    // Initialize performance tracking
    PerformanceTrackingService.getInstance();
    PerformanceMessageHandler.getInstance();

    // Initialize services with performance tracking
    this.windowManager = new WindowManager();
    this.tabManager = new TabManager();
    this.storageManager = new IndexedDbStorageManager();
    const updateQueue = new StateUpdateQueue({
      debounceTime: 100,
      maxQueueSize: 50,
      validateUpdates: true
    });

    const broadcastService = new StateBroadcastService();

    this.stateManager = new StateManager(
      this.windowManager,
      this.tabManager,
      this.storageManager,
      updateQueue,
      broadcastService,
      this.restoreRegistry
    );

    this.restoreTransaction = new RestoreSpaceTransaction(
      this.windowManager,
      this.stateManager
    );

    this.messageHandler = new MessageHandler(
      this.windowManager,
      this.tabManager,
      this.stateManager
    );

    // Initialize services asynchronously but immediately
    this.initializeServices();
  }

  /**
   * Initialize state manager and setup event listeners
   * This ensures state is loaded before any events can modify it
   */
  private async initializeServices(): Promise<void> {
    try {
      console.log('[BackgroundService] Initializing state manager...');
      await this.stateManager.initialize();
      console.log('[BackgroundService] State manager initialized');

      // Setup event listeners only after initialization
      this.setupEventListeners();
    } catch (error) {
      console.error('[BackgroundService] Failed to initialize services:', error);
      // Still setup listeners to handle future events
      this.setupEventListeners();
    }
  }

  private setupEventListeners(): void {
    console.log('[BackgroundService] Setting up event listeners');
    
    // Listen for extension startup
    chrome.runtime.onStartup.addListener(async () => {
      console.log('[BackgroundService] ========== onStartup TRIGGERED ==========');
      console.log('[BackgroundService] Timestamp:', new Date().toISOString());
      console.log('[Startup] Chrome Spaces initializing after browser restart');

      const startupTime = Date.now();
      await this.handleStartup();
      const endTime = Date.now();

      console.log('[Startup] ✅ Startup completed', {
        duration: `${endTime - startupTime}ms`
      });
      console.log('[BackgroundService] ========== onStartup COMPLETE ==========');
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
      if (!window.id) return;

      await this.stateManager.ensureInitialized();

      const handled = await this.stateManager.handleWindowCreated(window);
      if (handled) {
        return;
      }

      await this.stateManager.createSpace(window.id);
    });

    chrome.windows.onRemoved.addListener(async (windowId) => {
      console.log(`[BackgroundService] window.onRemoved event for windowId: ${windowId}`);
      await this.stateManager.ensureInitialized();
      await this.stateManager.closeSpace(windowId);
    });

    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        await this.stateManager.ensureInitialized();
        await this.ensureWindowHasSpace(windowId);
      }
    });

    // Tab event listeners
    chrome.tabs.onCreated.addListener(async (tab) => {
      if (tab.windowId) {
        await this.stateManager.ensureInitialized();
        await this.ensureWindowHasSpace(tab.windowId);
      }
    });

    chrome.tabs.onUpdated.addListener(async (_tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.windowId) {
        await this.stateManager.ensureInitialized();
        await this.stateManager.synchronizeWindowsAndSpaces();
      }
    });

    // Handle extension suspend/shutdown
    chrome.runtime.onSuspend?.addListener(async () => {
      console.log('[BackgroundService] ========== onSuspend TRIGGERED ==========');
      console.log('[BackgroundService] Timestamp:', new Date().toISOString());
      console.log('[BackgroundService] Service worker suspending - ensuring all data is saved');

      const suspendStartTime = Date.now();

      try {
        // handleShutdown now saves both spaces AND closed spaces
        console.log('[BackgroundService] Calling stateManager.handleShutdown()...');
        await this.stateManager.handleShutdown();

        const suspendEndTime = Date.now();
        console.log('[BackgroundService] ✅ Shutdown save completed successfully', {
          duration: `${suspendEndTime - suspendStartTime}ms`
        });
      } catch (error) {
        const suspendEndTime = Date.now();
        console.error('[BackgroundService] ❌ Error during shutdown save:', {
          error,
          duration: `${suspendEndTime - suspendStartTime}ms`
        });
      }

      console.log('[BackgroundService] ========== onSuspend COMPLETE ==========');
    });
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 2000)
  private async handleStartup(): Promise<void> {
    try {
      // Wait for Chrome to settle
      await this.delay(STARTUP_DELAY);
      
      // Initialize state
      await this.stateManager.initialize();

      // Always restore named spaces - they are meant to persist
      // Named spaces represent user-defined workspaces that should survive restarts
      console.log('[Startup] Restoring named spaces...');
      await this.restoreSpaces();

      // Double-check after a delay
      await this.delay(RECOVERY_CHECK_DELAY);
      await this.stateManager.synchronizeWindowsAndSpaces();
    } catch (error) {
      console.error('Startup error:', error);
    }
  }

  @PerformanceTrackingService.track(MetricCategories.WINDOW, 5000)
  private async restoreSpaces(): Promise<void> {
    try {
      console.log('[Restore] ========== RESTORATION START ==========');

      // Get all spaces that should be restored
      const spacesToRestore: Array<{ id: string; space: Space; source: 'closed' | 'inactive' }> = [];

      // 1. Check closedSpaces for named spaces
      const closedSpaces = await this.stateManager.getClosedSpaces();
      console.log(`[Restore] Checking closedSpaces: ${Object.keys(closedSpaces).length} total`);
      for (const [id, space] of Object.entries(closedSpaces)) {
        console.log(`[Restore]   - Closed space ${id}: named=${space.named}, name=${space.name}`);
        if (space.named) {
          spacesToRestore.push({ id, space, source: 'closed' });
        }
      }

      // 2. Check spaces for named inactive spaces
      const allSpaces = await this.stateManager.getAllSpaces();
      console.log(`[Restore] Checking spaces: ${Object.keys(allSpaces).length} total`);
      for (const [id, space] of Object.entries(allSpaces)) {
        console.log(`[Restore]   - Space ${id}: named=${space.named}, isActive=${space.isActive}, name=${space.name}`);
        if (space.named && !space.isActive) {
          spacesToRestore.push({ id, space, source: 'inactive' });
        }
      }

      console.log(`[Restore] Found ${spacesToRestore.length} named spaces to restore:`, spacesToRestore.map(s => ({ id: s.id, name: s.space.name, source: s.source })));

      // Restore each named space using RestoreSpaceTransaction
      // This properly creates windows and restores tabs
      for (const { id, space, source } of spacesToRestore) {
        console.log(`[Restore] Restoring ${source} space: ${space.name} (ID: ${id})`);
        try {
          await this.restoreTransaction.restore(id);
          console.log(`[Restore] ✅ Successfully restored space: ${space.name}`);

          // Verify the space was re-keyed
          const allSpacesAfter = await this.stateManager.getAllSpaces();
          console.log(`[Restore] After restoration, active spaces:`, Object.keys(allSpacesAfter).map(k => ({ id: k, name: allSpacesAfter[k].name, isActive: allSpacesAfter[k].isActive })));
        } catch (error) {
          console.error(`[Restore] ❌ Failed to restore space ${space.name}:`, error);
        }
      }

      console.log(`[Restore] ✅ Completed restoration of ${spacesToRestore.length} named spaces`);
      console.log('[Restore] ========== RESTORATION COMPLETE ==========');
    } catch (error) {
      console.error('[Restore] Error restoring spaces:', error);
    }
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 2000)
  private async handleInstall(details: chrome.runtime.InstalledDetails): Promise<void> {
    try {
      console.log(`[Install] ========== onInstalled TRIGGERED (reason: ${details.reason}) ==========`);
      await this.stateManager.initialize();

      if (details.reason === 'install') {
        await this.delay(STARTUP_DELAY);
        await this.stateManager.synchronizeWindowsAndSpaces();
      } else {
        // For updates, browser updates, or when extension reloads in existing profile
        // Check if there are named spaces that need restoration
        console.log('[Install] Checking for named spaces to restore...');
        const allSpaces = await this.stateManager.getAllSpaces();
        const closedSpaces = await this.stateManager.getClosedSpaces();

        const hasNamedSpaces = Object.values(allSpaces).some(s => s.named) ||
                               Object.values(closedSpaces).some(s => s.named);

        if (hasNamedSpaces) {
          console.log('[Install] Found named spaces, triggering restoration...');
          await this.delay(STARTUP_DELAY);
          await this.restoreSpaces();
          await this.delay(RECOVERY_CHECK_DELAY);
          await this.stateManager.synchronizeWindowsAndSpaces();
        } else {
          console.log('[Install] No named spaces found, running normal synchronization...');
          await this.delay(STARTUP_DELAY);
          await this.stateManager.synchronizeWindowsAndSpaces();
        }
      }

      console.log('[Install] ========== onInstalled COMPLETE ==========');
    } catch (error) {
      console.error('Install error:', error);
    }
  }

  @PerformanceTrackingService.track(MetricCategories.WINDOW, 3000)
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

  @PerformanceTrackingService.track(MetricCategories.WINDOW, 1000)
  private async ensureWindowHasSpace(windowId: number): Promise<void> {
    // Skip if this window is being restored - RestoreSpaceTransaction will handle it
    if (this.restoreRegistry.isWindowRestoring(windowId)) {
      console.log(`[BackgroundService] Skipping ensureWindowHasSpace for window ${windowId} - restoration registry active`);
      return;
    }

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
