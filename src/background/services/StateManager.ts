import { StateManager as IStateManager, QueuedStateUpdate } from '@/shared/types/Services';
import { MessageTypes } from '@/shared/constants';
import { WindowManager } from './WindowManager';
import { TabManager } from './TabManager';
import { StorageManager } from './StorageManager';
import { StateUpdateQueue, StateUpdatePriority } from './StateUpdateQueue';
import { StateBroadcastService } from './StateBroadcastService';
import { Space } from '@/shared/types/Space';
import { DEFAULT_SPACE_NAME } from '@/shared/constants';
import { PerformanceTrackingService, MetricCategories } from './performance/PerformanceTrackingService';

export interface StateCache {
  timestamp: number;
  data: any;
  version: number;
}

export class StateManager implements IStateManager {
  private spaces: Record<string, Space> = {};
  private closedSpaces: Record<string, Space> = {};
  private initialized = false;
  private updateLock = new Map<string, Promise<void>>();
  
  // Cache configuration
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly INCREMENTAL_UPDATE_THRESHOLD = 10; // Number of changes before full sync
  private stateCache: Map<string, StateCache> = new Map();
  private changeCounter: Map<string, number> = new Map();

  constructor(
    private windowManager: WindowManager,
    private tabManager: TabManager,
    private storageManager: StorageManager,
    private updateQueue: StateUpdateQueue,
    private broadcastService: StateBroadcastService
  ) {}

  /**
   * Creates an incremental state update
   */
  private createIncrementalUpdate(oldState: any, newState: any): any {
    const diff: any = {};
    
    for (const key in newState) {
      if (!oldState || oldState[key] !== newState[key]) {
        diff[key] = newState[key];
      }
    }
    
    return Object.keys(diff).length > 0 ? diff : null;
  }

  /**
   * Gets state from cache or source
   */
  private async getStateWithCache<T>(
    key: string,
    fetchFn: () => Promise<T>
  ): Promise<T> {
    const cached = this.stateCache.get(key);
    const now = Date.now();

    if (cached && now - cached.timestamp < StateManager.CACHE_TTL) {
      return cached.data as T;
    }

    const data = await fetchFn();
    this.stateCache.set(key, {
      timestamp: now,
      data,
      version: (cached?.version || 0) + 1
    });

    return data;
  }

  /**
   * Invalidates cache entry
   */
  private invalidateCache(key: string): void {
    this.stateCache.delete(key);
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 2000)
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();
    this.initialized = true;
  }

  getAllSpaces(): Record<string, Space> {
    return { ...this.spaces };
  }

  getClosedSpaces(): Record<string, Space> {
    return { ...this.closedSpaces };
  }

  hasSpace(windowId: number): boolean {
    return Object.values(this.spaces).some(space => 
      space.sourceWindowId === windowId.toString()
    );
  }

  /**
   * Get space by ID from either active or closed spaces
   */
  async getSpaceById(spaceId: string): Promise<Space | null> {
    return this.getStateWithCache(`space:${spaceId}`, async () => {
      const space = this.spaces[spaceId] || this.closedSpaces[spaceId];
      return space || null;
    });
  }

  /**
   * Update space window association
   */
  private async acquireLock(spaceId: string): Promise<void> {
    while (this.updateLock.has(spaceId)) {
      await this.updateLock.get(spaceId);
    }
    
    const lockPromise = new Promise<void>(resolve => {
      this.updateLock.set(spaceId, Promise.resolve().then(resolve));
    });
    
    await lockPromise;
  }

  private releaseLock(spaceId: string): void {
    this.updateLock.delete(spaceId);
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 500)
  async updateSpaceWindow(spaceId: string, window: chrome.windows.Window): Promise<void> {
    await this.acquireLock(spaceId);
    
    try {
      const space = await this.getSpaceById(spaceId);
      if (!space) {
        throw new Error(`Space not found: ${spaceId}`);
      }

      if (!window.id) {
        throw new Error('Window has no ID');
      }

      const updatedSpace: Space = {
        ...space,
        sourceWindowId: window.id.toString(),
        lastModified: Date.now(),
        version: space.version + 1
      };

      // Validate state transition
      this.validateStateTransition(space, updatedSpace);

      // Update in appropriate collection with atomic write
      if (spaceId in this.spaces) {
        const updatedSpaces = { ...this.spaces, [spaceId]: updatedSpace };
        await this.storageManager.saveSpaces(updatedSpaces);
        this.spaces = updatedSpaces;
      } else if (spaceId in this.closedSpaces) {
        const updatedClosedSpaces = { ...this.closedSpaces, [spaceId]: updatedSpace };
        await this.storageManager.saveClosedSpaces(updatedClosedSpaces);
        this.closedSpaces = updatedClosedSpaces;
      }

      this.broadcastStateUpdate();
    } catch (error) {
      throw new Error(`Failed to update space window: ${(error as Error).message}`);
    } finally {
      this.releaseLock(spaceId);
    }
  }

  private validateStateTransition(oldState: Space, newState: Space): void {
    // Validate basic invariants
    if (oldState.id !== newState.id) {
      throw new Error('Space ID cannot change during update');
    }
    
    if (newState.version <= oldState.version) {
      throw new Error('Space version must increase on update');
    }

    // Additional validation logic can be added here
  }

  /**
   * Enhanced state broadcast with incremental updates
   */
  private broadcastStateUpdate(): void {
    try {
      const spacesCacheKey = 'spaces';
      const cachedState = this.stateCache.get(spacesCacheKey);
      const currentState = {
        spaces: { ...this.spaces },
        closedSpaces: { ...this.closedSpaces }
      };

      let payload;
      if (cachedState) {
        // Check if we should send incremental update
        const changeCount = this.changeCounter.get(spacesCacheKey) || 0;
        if (changeCount < StateManager.INCREMENTAL_UPDATE_THRESHOLD) {
          const diff = this.createIncrementalUpdate(cachedState.data, currentState);
          if (diff) {
            payload = {
              type: 'incremental',
              changes: diff,
              baseVersion: cachedState.version
            };
            this.changeCounter.set(spacesCacheKey, changeCount + 1);
          }
        } else {
          // Reset change counter and send full state
          this.changeCounter.set(spacesCacheKey, 0);
        }
      }

      // If no incremental update, send full state
      if (!payload) {
        payload = {
          type: 'full',
          state: currentState
        };
      }

      const update: QueuedStateUpdate = {
        id: Date.now().toString(),
        type: MessageTypes.SPACES_UPDATED,
        timestamp: Date.now(),
        payload,
        priority: payload.type === 'full' ?
          StateUpdatePriority.HIGH :
          StateUpdatePriority.NORMAL
      };

      // Update cache with new state
      this.stateCache.set(spacesCacheKey, {
        timestamp: Date.now(),
        data: currentState,
        version: (cachedState?.version || 0) + 1
      });

      this.broadcastService.broadcast(update);
    } catch (error) {
      console.error('Failed to broadcast state update:', error);
      // Invalidate cache on error
      this.invalidateCache('spaces');
    }
  }

  async handleShutdown(): Promise<void> {
    await this.synchronizeWindowsAndSpaces();
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 3000)
  async synchronizeWindowsAndSpaces(): Promise<void> {
    const windows = await this.windowManager.getAllWindows();
    const existingSpaces = { ...this.spaces };
    const updatedSpaces: Record<string, Space> = {};

    // Update spaces based on existing windows
    for (const window of windows) {
      if (!window.id) continue;

      const spaceId = window.id.toString();
      const existingSpace = Object.values(existingSpaces).find(
        space => space.sourceWindowId === spaceId
      );

      if (existingSpace) {
        // Update existing space
        updatedSpaces[existingSpace.id] = {
          ...existingSpace,
          lastModified: Date.now(),
          version: existingSpace.version + 1
        };
      } else {
        // Create new space using StorageManager
        const tabs = await this.tabManager.getTabs(window.id);
        const urls = tabs.map(tab => this.tabManager.getTabUrl(tab));
        const name = `${DEFAULT_SPACE_NAME} ${spaceId}`;
        const space = await this.storageManager.createSpace(window.id, name, urls);
        
        // Add additional fields for backward compatibility
        space.lastSync = Date.now();
        space.sourceWindowId = spaceId;
        
        updatedSpaces[spaceId] = space;
      }
    }

    // Save updated spaces
    this.spaces = updatedSpaces;
    await this.storageManager.saveSpaces(this.spaces);
    this.broadcastStateUpdate();
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 300)
  async setSpaceName(spaceId: string, name: string): Promise<void> {
    await this.acquireLock(spaceId);
    
    try {
      const trimmedName = name.trim().replace(/\s+/g, ' ');
      
      if (!trimmedName) {
        throw new Error('Space name cannot be empty');
      }

      const space = await this.getSpaceById(spaceId);
      if (!space) {
        throw new Error(`Space not found: ${spaceId}`);
      }

      const updatedSpace: Space = {
        ...space,
        name: trimmedName,
        lastModified: Date.now(),
        version: space.version + 1,
        named: true
      };

      // Validate state transition
      this.validateStateTransition(space, updatedSpace);

      // Atomic update with cache invalidation
      if (spaceId in this.spaces) {
        const updatedSpaces = { ...this.spaces, [spaceId]: updatedSpace };
        await this.storageManager.saveSpaces(updatedSpaces);
        this.spaces = updatedSpaces;
        this.invalidateCache('spaces');
      } else if (spaceId in this.closedSpaces) {
        const updatedClosedSpaces = { ...this.closedSpaces, [spaceId]: updatedSpace };
        await this.storageManager.saveClosedSpaces(updatedClosedSpaces);
        this.closedSpaces = updatedClosedSpaces;
        this.invalidateCache('closedSpaces');
      }

      // Invalidate specific space cache
      this.invalidateCache(`space:${spaceId}`);

      // Send update with appropriate priority
      const update: QueuedStateUpdate = {
        id: Date.now().toString(),
        type: MessageTypes.SPACE_UPDATED,
        timestamp: Date.now(),
        payload: {
          spaceId,
          changes: { name: trimmedName },
          version: updatedSpace.version
        },
        priority: StateUpdatePriority.HIGH // Name changes are high priority
      };

      this.broadcastService.broadcast(update);
    } catch (error) {
      const newError = new Error(`Failed to set space name: ${(error as Error).message}`);
      (newError as any).cause = error;
      throw newError;
    } finally {
      this.releaseLock(spaceId);
    }
  }

  async getSpaceName(spaceId: string): Promise<string> {
    const space = await this.getSpaceById(spaceId);
    return space?.name || `${DEFAULT_SPACE_NAME} ${spaceId}`;
  }

  /**
   * Test-only method to bypass cache and reload from storage.
   */
  async get_space_by_id_with_reload(spaceId: string): Promise<Space | null> {
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();
    return this.spaces[spaceId] || this.closedSpaces[spaceId] || null;
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 1000)
  async createSpace(windowId: number, spaceName?: string, options?: { name?: string; named?: boolean }): Promise<void> {
    const spaceId = windowId.toString();
    await this.acquireLock(spaceId);
    
    try {
      // Verify space doesn't already exist
      if (await this.getSpaceById(spaceId)) {
        throw new Error(`Space already exists with ID: ${spaceId}`);
      }

      // Get tabs from window
      const tabs = await this.tabManager.getTabs(windowId);
      const urls = tabs.map(tab => this.tabManager.getTabUrl(tab));

      // Create new space using StorageManager
      const name = options?.name || spaceName || `${DEFAULT_SPACE_NAME} ${spaceId}`;
      const customName = options?.named ? name : undefined;
      const space = await this.storageManager.createSpace(windowId, name, urls, customName);

      // Atomic update
      const updatedSpaces = { ...this.spaces, [spaceId]: space };
      await this.storageManager.saveSpaces(updatedSpaces);
      this.spaces = updatedSpaces;
      
      this.broadcastStateUpdate();
    } catch (error) {
      throw new Error(`Failed to create space: ${(error as Error).message}`);
    } finally {
      this.releaseLock(spaceId);
    }
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 1000)
  async closeSpace(windowId: number): Promise<void> {
    console.log(`[StateManager] closeSpace called for windowId: ${windowId}`);
    const spaceId = windowId.toString();
    const space = this.spaces[spaceId];

    if (!space) {
      // If space is not found, it might have been closed already.
      // This can happen in scenarios like browser shutdown.
      console.log(`[StateManager] Space not found for windowId: ${windowId}, returning.`);
      return;
    }

    // Move space to closed spaces
    delete this.spaces[spaceId];
    this.closedSpaces[spaceId] = {
      ...space,
      lastModified: Date.now(),
      version: space.version + 1,
    };

    // Save updates
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces),
    ]);

    this.broadcastStateUpdate();
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 2000)
  async restoreSpace(spaceId: string): Promise<void> {
    await this.acquireLock(spaceId);
    
    try {
      const space = this.closedSpaces[spaceId];
      if (!space) {
        throw new Error(`Closed space not found: ${spaceId}`);
      }

      const updatedSpace: Space = {
        ...space,
        lastModified: Date.now(),
        version: space.version + 1
      };

      // Validate state transition
      this.validateStateTransition(space, updatedSpace);

      // Atomic updates
      const updatedClosedSpaces = { ...this.closedSpaces };
      delete updatedClosedSpaces[spaceId];
      
      const updatedSpaces = {
        ...this.spaces,
        [spaceId]: updatedSpace
      };

      // Save updates atomically
      await Promise.all([
        this.storageManager.saveSpaces(updatedSpaces),
        this.storageManager.saveClosedSpaces(updatedClosedSpaces)
      ]);

      // Update memory state
      this.spaces = updatedSpaces;
      this.closedSpaces = updatedClosedSpaces;

      this.broadcastStateUpdate();
    } catch (error) {
      throw new Error(`Failed to restore space: ${(error as Error).message}`);
    } finally {
      this.releaseLock(spaceId);
    }
  }

  async deleteClosedSpace(spaceId: string): Promise<void> {
    const space = this.closedSpaces[spaceId];
    if (!space) {
      throw new Error('Closed space not found');
    }

    delete this.closedSpaces[spaceId];
    await this.storageManager.saveClosedSpaces(this.closedSpaces);
    this.broadcastStateUpdate();
  }

  async renameSpace(windowId: number, name: string): Promise<void> {
    const spaceId = windowId.toString();
    await this.acquireLock(spaceId);
    
    try {
      // Update custom name using StorageManager
      await this.storageManager.updateSpaceCustomName(spaceId, name);
      
      // Reload spaces to get updated data
      this.spaces = await this.storageManager.loadSpaces();
      this.closedSpaces = await this.storageManager.loadClosedSpaces();
      
      // Invalidate cache
      this.invalidateCache(`space:${spaceId}`);
      this.invalidateCache('spaces');
      this.invalidateCache('closedSpaces');
      
      this.broadcastStateUpdate();
    } catch (error) {
      throw new Error(`Failed to rename space: ${(error as Error).message}`);
    } finally {
      this.releaseLock(spaceId);
    }
  }
}
