import { WindowManager } from './WindowManager';
import { TabManager } from './TabManager';
import { StorageManager } from './StorageManager';
import { StateUpdateQueue, QueuedStateUpdate } from './StateUpdateQueue';
import { StateBroadcastService } from './StateBroadcastService';
import {
  DEFAULT_SPACE_NAME,
  SPACE_NAME_MAX_LENGTH,
  SPACE_NAME_MIN_LENGTH
} from '@/shared/constants';
import { StateManager as IStateManager } from '@/shared/types/Services';
import type { Space } from '@/shared/types/Space';

interface StateUpdateHandler {
  (update: QueuedStateUpdate<Space>): void;
}

/**
 * @module StateManager
 * @description Manages synchronized space state across browser windows
 * @author Senior Developer
 */
export class StateManager implements IStateManager {
  private spaces: Record<string, Space> = {};
  private closedSpaces: Record<string, Space> = {};
  
  constructor(
    private windowManager: WindowManager,
    private tabManager: TabManager,
    private storageManager: StorageManager,
    private updateQueue: StateUpdateQueue,
    private broadcastService: StateBroadcastService
  ) {}

  async initialize(): Promise<void> {
    // Load initial state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();
    
    // Initialize version if needed
    await this.initializeVersions();
    
    // Synchronize with current window state
    await this.synchronizeWindowsAndSpaces();
    
    // Set up state broadcast handling
    this.broadcastService.onStateUpdate((update) => this.handleStateUpdate(update));
    
    // Listen for window changes
    chrome.windows.onCreated.addListener(() => this.synchronizeWindowsAndSpaces());
    chrome.windows.onRemoved.addListener(() => this.synchronizeWindowsAndSpaces());
    
    // Listen for tab changes
    chrome.tabs.onCreated.addListener((tab) => this.handleTabCreated(tab));
    chrome.tabs.onRemoved.addListener((tabId, info) => this.handleTabRemoved(tabId, info));
    chrome.tabs.onAttached.addListener((tabId, info) => this.handleTabAttached(tabId, info));
    chrome.tabs.onDetached.addListener((tabId, info) => this.handleTabDetached(tabId, info));
  }

  getAllSpaces(): Record<string, Space> {
    return this.spaces;
  }

  getClosedSpaces(): Record<string, Space> {
    return this.closedSpaces;
  }

  hasSpace(windowId: number): boolean {
    return Object.values(this.spaces).some(space => space.id === windowId.toString());
  }

  async handleShutdown(): Promise<void> {
    // Only persist named spaces during shutdown
    const namedSpaces = Object.entries(this.spaces).reduce((acc, [id, space]) => {
      if (space.named) {
        acc[id] = space;
      }
      return acc;
    }, {} as Record<string, Space>);

    await this.storageManager.saveSpaces(namedSpaces);
    await this.storageManager.saveClosedSpaces(this.closedSpaces);
  }

  /**
   * Synchronizes window state with spaces and handles state updates
   */
  public async synchronizeWindowsAndSpaces(): Promise<void> {
    // Get current windows from Chrome
    const currentWindows = await this.windowManager.getAllWindows();
    const currentWindowIds = new Set(currentWindows.map(w => w.id!.toString()));

    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    // Create spaces for new windows and update existing ones
    const updatedSpaces: Record<string, Space> = {};
    for (const window of currentWindows) {
      const windowId = window.id!.toString();
      if (window.tabs && window.tabs.length > 0) {
        const urls = window.tabs.map(tab => this.tabManager.getTabUrl(tab));
        
        // Update existing space or create new one
        const existingSpace = this.spaces[windowId];
        if (existingSpace) {
          const updatedSpace = {
            ...existingSpace,
            urls,
            lastModified: Date.now(),
            version: existingSpace.version + 1,
            lastSync: Date.now(),
            sourceWindowId: windowId,
            named: existingSpace.named // Preserve named status
          };
          
          // Queue the update
          await this.updateQueue.enqueue({
            id: windowId,
            type: 'UPDATE_SPACE',
            payload: updatedSpace
          });
          
          updatedSpaces[windowId] = updatedSpace;
        } else if (!this.closedSpaces[windowId]) {
          // Only create new space if it's not in closed spaces
          const name = `${DEFAULT_SPACE_NAME} ${windowId}`;
          const newSpace: Space = {
            id: windowId,
            name,
            urls,
            lastModified: Date.now(),
            version: 1,
            lastSync: Date.now(),
            sourceWindowId: windowId,
            named: false // New spaces start as unnamed
          };
          
          // Queue the creation
          await this.updateQueue.enqueue({
            id: windowId,
            type: 'CREATE_SPACE',
            payload: newSpace
          });
          
          updatedSpaces[windowId] = newSpace;
        }
      }
    }

    // Move non-existent named windows to closed spaces if they aren't already closed
    for (const [id, space] of Object.entries(this.spaces)) {
      if (!currentWindowIds.has(id) && !this.closedSpaces[id] && space.named) {
        const closedSpace = {
          ...space,
          lastModified: Date.now(),
          version: space.version + 1,
          lastSync: Date.now(),
          sourceWindowId: chrome.windows.WINDOW_ID_CURRENT.toString()
        };
        
        // Queue the closure
        await this.updateQueue.enqueue({
          id,
          type: 'CLOSE_SPACE',
          payload: closedSpace
        });
        
        this.closedSpaces[id] = closedSpace;
      }
    }

    // Process all queued updates
    await this.updateQueue.processQueue();

    // Update storage atomically
    this.spaces = updatedSpaces;
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);
  }

  /**
   * Initialize version tracking for existing spaces
   */
  private async initializeVersions(): Promise<void> {
    const timestamp = Date.now();
    
    // Initialize versions for active spaces
    for (const space of Object.values(this.spaces)) {
      if (!space.version) {
        space.version = 1;
        space.lastSync = timestamp;
        space.sourceWindowId = chrome.windows.WINDOW_ID_CURRENT.toString();
      }
    }
    
    // Initialize versions for closed spaces
    for (const space of Object.values(this.closedSpaces)) {
      if (!space.version) {
        space.version = 1;
        space.lastSync = timestamp;
        space.sourceWindowId = chrome.windows.WINDOW_ID_CURRENT.toString();
      }
    }
    
    // Save initialized versions
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);
  }

  /**
   * Handle incoming state updates from other windows
   */
  private async handleStateUpdate(update: QueuedStateUpdate<Space>): Promise<void> {
    const incomingSpace = update.payload;
    const existingSpace = this.spaces[incomingSpace.id];
    
    if (!existingSpace || incomingSpace.version > existingSpace.version) {
      // Accept newer version
      this.spaces[incomingSpace.id] = incomingSpace;
      await this.storageManager.saveSpaces(this.spaces);
    } else if (incomingSpace.version === existingSpace.version) {
      // For same version, take most recent change
      if (incomingSpace.lastModified > existingSpace.lastModified) {
        this.spaces[incomingSpace.id] = incomingSpace;
        await this.storageManager.saveSpaces(this.spaces);
      }
    }
  }

  private async handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.windowId) return;

    const windowId = tab.windowId.toString();
    const space = this.spaces[windowId];
    if (space) {
      const url = this.tabManager.getTabUrl(tab);
      
      // Queue state update
      await this.updateQueue.enqueue({
        id: windowId,
        type: 'UPDATE_SPACE',
        payload: {
          ...space,
          urls: [...space.urls, url],
          version: space.version + 1,
          lastModified: Date.now(),
          sourceWindowId: windowId,
          lastSync: Date.now()
        }
      });
      
      // Process updates
      await this.updateQueue.processQueue();
    }
  }

  private async handleTabRemoved(tabId: number, info: chrome.tabs.TabRemoveInfo): Promise<void> {
    const windowId = info.windowId.toString();
    const space = this.spaces[windowId];
    if (space) {
      // Get current tabs to update URLs
      const tabs = await this.tabManager.getTabs(info.windowId);
      const urls = tabs.map(tab => this.tabManager.getTabUrl(tab));
      
      // Queue state update
      await this.updateQueue.enqueue({
        id: windowId,
        type: 'UPDATE_SPACE',
        payload: {
          ...space,
          urls,
          version: space.version + 1,
          lastModified: Date.now(),
          sourceWindowId: windowId,
          lastSync: Date.now()
        }
      });
      
      // Process updates
      await this.updateQueue.processQueue();
    }
  }

  private async handleTabAttached(tabId: number, info: chrome.tabs.TabAttachInfo): Promise<void> {
    const newWindowId = info.newWindowId.toString();
    const tab = await chrome.tabs.get(tabId);
    const url = this.tabManager.getTabUrl(tab);

    const space = this.spaces[newWindowId];
    if (space) {
      const timestamp = Date.now();
      const updatedSpace = {
        ...space,
        urls: [...space.urls, url],
        version: space.version + 1,
        lastModified: timestamp,
        lastSync: timestamp,
        sourceWindowId: newWindowId
      };

      // Queue the update
      await this.updateQueue.enqueue({
        id: newWindowId,
        type: 'UPDATE_SPACE',
        payload: updatedSpace
      });

      this.spaces[newWindowId] = updatedSpace;
      await this.updateQueue.processQueue();
    }
  }

  private async handleTabDetached(tabId: number, info: chrome.tabs.TabDetachInfo): Promise<void> {
    const oldWindowId = info.oldWindowId.toString();
    const space = this.spaces[oldWindowId];
    if (space) {
      // Get current tabs to update URLs
      const tabs = await this.tabManager.getTabs(info.oldWindowId);
      const timestamp = Date.now();
      const updatedSpace = {
        ...space,
        urls: tabs.map(tab => this.tabManager.getTabUrl(tab)),
        version: space.version + 1,
        lastModified: timestamp,
        lastSync: timestamp,
        sourceWindowId: oldWindowId
      };

      // Queue the update
      await this.updateQueue.enqueue({
        id: oldWindowId,
        type: 'UPDATE_SPACE',
        payload: updatedSpace
      });

      this.spaces[oldWindowId] = updatedSpace;
      await this.updateQueue.processQueue();
    }
  }

  async createSpace(
    windowId: number,
    initialUrls?: string[],
    options?: { name?: string; named?: boolean }
  ): Promise<void> {
    const urls = initialUrls ||
      (await this.tabManager.getTabs(windowId)).map(tab => this.tabManager.getTabUrl(tab));

    // Load latest spaces to ensure we have the most up-to-date data
    const latestSpaces = await this.storageManager.loadSpaces();
    
    // Use provided name or generate default
    const name = options?.name || `${DEFAULT_SPACE_NAME} ${windowId}`;
    const isNamed = options?.named ?? false;
    
    // Check for duplicate names if named
    const usedNames = Object.values(latestSpaces).map(space => space.name);
    const timestamp = Date.now();

    if (usedNames.includes(name)) {
      // If name exists, create a unique variant
      let counter = 1;
      let uniqueName = `${name} (${counter})`;
      while (usedNames.includes(uniqueName)) {
        counter++;
        uniqueName = `${name} (${counter})`;
      }
      
      const newSpace: Space = {
        id: windowId.toString(),
        name: uniqueName,
        urls,
        lastModified: timestamp,
        version: 1,
        lastSync: timestamp,
        sourceWindowId: windowId.toString(),
        named: isNamed
      };

      // Queue the creation
      await this.updateQueue.enqueue({
        id: windowId.toString(),
        type: 'CREATE_SPACE',
        payload: newSpace
      });
      
      this.spaces[windowId.toString()] = newSpace;
    } else {
      // Use the default name if it's unique
      const newSpace: Space = {
        id: windowId.toString(),
        name,
        urls,
        lastModified: timestamp,
        version: 1,
        lastSync: timestamp,
        sourceWindowId: windowId.toString(),
        named: isNamed
      };

      // Queue the creation
      await this.updateQueue.enqueue({
        id: windowId.toString(),
        type: 'CREATE_SPACE',
        payload: newSpace
      });
      
      this.spaces[windowId.toString()] = newSpace;
    }
    
    // Process updates and save
    await this.updateQueue.processQueue();
    await this.storageManager.saveSpaces(this.spaces);
    
    // Broadcast creation
    this.broadcastService.broadcast({
      id: windowId.toString(),
      type: 'CREATE_SPACE',
      payload: this.spaces[windowId.toString()],
      timestamp: Date.now()
    });
    
    // Ensure state is synchronized
    await this.synchronizeWindowsAndSpaces();
  }

  async closeSpace(windowId: number): Promise<void> {
    const spaceId = windowId.toString();
    
    // Load latest state to ensure consistency
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();
    
    const space = this.spaces[spaceId];
    if (!space) return;

    // Check if window still exists
    const exists = await this.windowManager.windowExists(windowId);
    if (exists) {
      // Close the window first
      await this.windowManager.closeWindow(windowId);
    }

    // Only move to closed spaces if the space was explicitly named by the user
    if (space.named) {
      // Move to closed spaces with updated timestamp
      const closedSpace = {
        ...space,
        lastModified: Date.now()
      };
      this.closedSpaces[spaceId] = closedSpace;
    }

    // Always remove from active spaces
    delete this.spaces[spaceId];

    // Save both states in a single operation
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);
  }

  async renameSpace(windowId: number, name: string): Promise<void> {
    await this.setSpaceName(windowId.toString(), name);
  }

  async setSpaceName(spaceId: string, name: string): Promise<void> {
    const cleanName = name.trim().replace(/\s+/g, ' ');

    // Validate name length
    if (cleanName.length < SPACE_NAME_MIN_LENGTH) {
      throw new Error('Space name cannot be empty');
    }
    if (cleanName.length > SPACE_NAME_MAX_LENGTH) {
      throw new Error(`Space name cannot exceed ${SPACE_NAME_MAX_LENGTH} characters`);
    }

    // Load and ensure latest state
    const spaces = await this.storageManager.loadSpaces();
    this.spaces = spaces;
    
    if (!this.spaces[spaceId]) {
      throw new Error('Space not found');
    }
    
    // Check for duplicate names
    const usedNames = Object.entries(this.spaces)
      .filter(([id]) => id !== spaceId) // Exclude current space
      .map(([_, space]) => space.name);
      
    if (usedNames.includes(cleanName)) {
      throw new Error('Space name already exists');
    }

    // Update both in-memory and storage state atomically
    const updatedSpace = {
      ...this.spaces[spaceId],
      name: cleanName,
      lastModified: Date.now(),
      named: true // Mark as named when explicitly renamed
    };
    
    this.spaces[spaceId] = updatedSpace;
    await this.storageManager.saveSpaces(this.spaces);
  }

  async restoreSpace(spaceId: string): Promise<void> {
    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    const space = this.closedSpaces[spaceId];
    if (!space) {
      throw new Error('Closed space not found');
    }

    const timestamp = Date.now();
    
    // Create restored space with new version
    const restoredSpace = {
      ...space,
      version: space.version + 1,
      lastModified: timestamp,
      lastSync: timestamp,
      sourceWindowId: chrome.windows.WINDOW_ID_CURRENT.toString()
    };

    // Queue the restore operation
    await this.updateQueue.enqueue({
      id: spaceId,
      type: 'RESTORE_SPACE',
      payload: restoredSpace
    });

    // Update both states atomically
    this.spaces[spaceId] = restoredSpace;
    delete this.closedSpaces[spaceId];

    // Process updates and save
    await this.updateQueue.processQueue();
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);

    // Broadcast restore
    this.broadcastService.broadcast({
      id: spaceId,
      type: 'RESTORE_SPACE',
      payload: restoredSpace,
      timestamp
    });
  }

  async getSpaceName(spaceId: string): Promise<string> {
    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    // Find space in either active or closed spaces
    const space = this.spaces[spaceId] || this.closedSpaces[spaceId];
    if (space) {
      return space.name;
    }

    // Return default name using constant
    return `${DEFAULT_SPACE_NAME} ${spaceId}`;
  }

  async getSpaceById(spaceId: string): Promise<Space | null> {
    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    return this.spaces[spaceId] || this.closedSpaces[spaceId] || null;
  }

  async deleteClosedSpace(spaceId: string): Promise<void> {
    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    // Remove from closed spaces if it exists
    if (this.closedSpaces[spaceId]) {
      const timestamp = Date.now();
      const { [spaceId]: deletedSpace, ...remainingClosedSpaces } = this.closedSpaces;
      
      // Queue deletion
      await this.updateQueue.enqueue({
        id: spaceId,
        type: 'DELETE_CLOSED_SPACE',
        payload: { id: spaceId }
      });

      this.closedSpaces = remainingClosedSpaces;
      await this.updateQueue.processQueue();
      await this.storageManager.saveClosedSpaces(this.closedSpaces);

      // Broadcast deletion
      this.broadcastService.broadcast({
        id: spaceId,
        type: 'DELETE_CLOSED_SPACE',
        payload: { id: spaceId },
        timestamp
      });
    }
  }
}
