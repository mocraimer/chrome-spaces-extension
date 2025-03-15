import { StateManager as IStateManager } from '@/shared/types/Services';
import { Space } from '@/shared/types/Space';
import { WindowManager } from './WindowManager';
import { TabManager } from './TabManager';
import { StorageManager } from './StorageManager';
import { DEFAULT_SPACE_NAME, SYNC_INTERVAL } from '@/shared/constants';
import { createError } from '@/shared/utils';

export class StateManager implements IStateManager {
  private spaces: Record<string, Space> = {};
  private closedSpaces: Record<string, Space> = {};
  private initialized = false;
  private syncInterval?: number;

  constructor(
    private windowManager: WindowManager,
    private tabManager: TabManager,
    private storageManager: StorageManager
  ) {}

  /**
   * Initialize the state manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Load saved spaces
      this.spaces = await this.storageManager.loadSpaces();
      this.closedSpaces = await this.storageManager.loadClosedSpaces();

      // Initial synchronization
      await this.synchronizeWindowsAndSpaces();

      // Set up periodic sync
      if (typeof window !== 'undefined') {
        this.syncInterval = window.setInterval(
          () => this.synchronizeWindowsAndSpaces(),
          SYNC_INTERVAL
        );
      }

      this.initialized = true;
    } catch (error) {
      throw createError(
        'Failed to initialize state manager',
        'INITIALIZATION_FAILED',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Get all active spaces
   */
  getAllSpaces(): Record<string, Space> {
    return { ...this.spaces };
  }

  /**
   * Get all closed spaces
   */
  getClosedSpaces(): Record<string, Space> {
    return { ...this.closedSpaces };
  }

  /**
   * Check if a window has an associated space
   */
  hasSpace(windowId: number): boolean {
    return windowId.toString() in this.spaces;
  }

  /**
   * Create a new space for a window
   */
  async createSpace(windowId: number): Promise<void> {
    const window = await this.windowManager.getWindow(windowId);
    const tabs = await this.tabManager.getTabs(windowId);
    
    const space: Space = {
      id: windowId.toString(),
      name: DEFAULT_SPACE_NAME,
      urls: tabs.map(tab => this.tabManager.getTabUrl(tab)).filter(Boolean),
      lastModified: Date.now()
    };

    this.spaces[windowId.toString()] = space;
    await this.storageManager.saveSpaces(this.spaces);
  }

  /**
   * Close a space
   */
  async closeSpace(windowId: number): Promise<void> {
    const windowIdStr = windowId.toString();
    const space = this.spaces[windowIdStr];
    
    if (!space) return;

    // Move to closed spaces
    this.closedSpaces[windowIdStr] = {
      ...space,
      lastModified: Date.now()
    };

    // Remove from active spaces
    delete this.spaces[windowIdStr];

    // Save both states
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);
  }

  /**
   * Rename a space
   */
  async renameSpace(windowId: number, name: string): Promise<void> {
    const windowIdStr = windowId.toString();
    const space = this.spaces[windowIdStr];
    
    if (!space) return;

    space.name = name;
    space.lastModified = Date.now();
    
    await this.storageManager.saveSpaces(this.spaces);
  }

  /**
   * Handle extension shutdown
   */
  async handleShutdown(): Promise<void> {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // Final sync before shutdown
    await this.synchronizeWindowsAndSpaces();
  }

  /**
   * Synchronize windows and spaces
   */
  async synchronizeWindowsAndSpaces(): Promise<void> {
    try {
      const windows = await this.windowManager.getAllWindows();
      const windowIds = new Set(windows.map(w => w.id!.toString()));

      // Remove spaces for closed windows
      for (const windowId of Object.keys(this.spaces)) {
        if (!windowIds.has(windowId)) {
          await this.closeSpace(Number(windowId));
        }
      }

      // Create spaces for new windows
      for (const window of windows) {
        if (!this.hasSpace(window.id!)) {
          await this.createSpace(window.id!);
        }
      }

      // Update tabs for all spaces
      await Promise.all(
        windows.map(async window => {
          const tabs = await this.tabManager.getTabs(window.id!);
          const space = this.spaces[window.id!.toString()];
          
          if (space) {
            space.urls = tabs.map(tab => this.tabManager.getTabUrl(tab)).filter(Boolean);
            space.lastModified = Date.now();
          }
        })
      );

      await this.storageManager.saveSpaces(this.spaces);
    } catch (error) {
      console.error('Sync error:', error);
      throw createError(
        'Failed to synchronize windows and spaces',
        'SYNC_ERROR',
        error instanceof Error ? error : undefined
      );
    }
  }
}
