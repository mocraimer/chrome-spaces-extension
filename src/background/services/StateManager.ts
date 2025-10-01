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
  private lockResolvers = new Map<string, () => void>();

  // Cache configuration
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private static readonly INCREMENTAL_UPDATE_THRESHOLD = 10; // Number of changes before full sync
  private stateCache: Map<string, StateCache> = new Map();
  private changeCounter: Map<string, number> = new Map();

  // Debounced broadcast configuration
  private broadcastDebounceTime = 100; // ms
  private broadcastTimeoutId: NodeJS.Timeout | null = null;
  private pendingBroadcastData: any = null;
  private lastBroadcastTime = 0;
  private broadcastQueue: Array<{ timestamp: number; data: any }> = [];
  private maxBroadcastQueue = 50; // Maximum queued broadcasts

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

    // CRITICAL FIX: Reset all active states on startup
    // This ensures no stale active states persist across Chrome restarts
    console.log('[StateManager] Resetting active states on startup');
    const updatedSpaces: Record<string, Space> = {};
    for (const [spaceId, space] of Object.entries(this.spaces)) {
      updatedSpaces[spaceId] = {
        ...space,
        isActive: false, // Reset to false, synchronization will set true if valid
        windowId: undefined, // Clear any stale window associations
        lastSync: Date.now()
      };
    }

    // Update in-memory state
    this.spaces = updatedSpaces;

    // Save the reset state to storage immediately
    if (Object.keys(updatedSpaces).length > 0) {
      await this.storageManager.saveSpaces(this.spaces);
      console.log(`[StateManager] Reset ${Object.keys(updatedSpaces).length} spaces to inactive state`);
    }

    this.initialized = true;
  }

  /**
   * Ensures the state manager is initialized before any operations
   * This is critical for service worker wake-up scenarios
   */
  async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
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
   * Acquire a lock for a specific space ID to prevent race conditions
   */
  private async acquireLock(spaceId: string): Promise<void> {
    // Wait for any existing lock to be released
    while (this.updateLock.has(spaceId)) {
      await this.updateLock.get(spaceId);
    }

    // Create a new lock promise with its resolver
    let resolveFunc: (() => void) | undefined;
    const lockPromise = new Promise<void>(resolve => {
      resolveFunc = resolve;
    });

    // Store the lock and its resolver
    this.updateLock.set(spaceId, lockPromise);
    this.lockResolvers.set(spaceId, resolveFunc!);
  }

  private releaseLock(spaceId: string): void {
    const resolver = this.lockResolvers.get(spaceId);
    if (resolver) {
      resolver(); // Release the lock
      this.lockResolvers.delete(spaceId);
    }
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
    console.log('[StateManager] handleShutdown called - marking all spaces as inactive');

    // CRITICAL FIX: Mark all spaces as inactive before shutdown
    // This prevents stale active states from persisting across Chrome restarts
    const updatedSpaces: Record<string, Space> = {};
    for (const [spaceId, space] of Object.entries(this.spaces)) {
      updatedSpaces[spaceId] = {
        ...space,
        isActive: false,
        windowId: undefined, // Clear window association
        lastModified: Date.now(),
        version: space.version + 1
      };
    }

    // Save the inactive state to storage
    this.spaces = updatedSpaces;

    // CRITICAL: Save BOTH spaces and closed spaces
    // Without this, closed spaces are lost during shutdown
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces),
    ]);

    console.log('[StateManager] Saved spaces and closed spaces during shutdown');

    // Clean up broadcast timeout on shutdown
    if (this.broadcastTimeoutId) {
      clearTimeout(this.broadcastTimeoutId);
      this.broadcastTimeoutId = null;
    }

    // Send final broadcast before shutdown
    this.broadcastStateUpdate();

    // No need to synchronize after marking everything inactive
    console.log('[StateManager] All spaces marked as inactive for shutdown');
  }

  /**
   * Force immediate save of all state (spaces and closed spaces)
   * This is useful during critical operations like browser shutdown
   * to ensure data is persisted before service worker termination
   */
  public async forceSave(): Promise<void> {
    console.log('[StateManager] forceSave called - saving all state immediately');
    try {
      await Promise.all([
        this.storageManager.saveSpaces(this.spaces),
        this.storageManager.saveClosedSpaces(this.closedSpaces),
      ]);
      console.log('[StateManager] Force save completed successfully');
    } catch (error) {
      console.error('[StateManager] Force save failed:', error);
      throw error;
    }
  }

  /**
   * Validates if a window actually belongs to a space by comparing URLs
   * This prevents window ID reuse from incorrectly activating closed spaces
   */
  private async validateWindowOwnership(space: Space, window: chrome.windows.Window): Promise<boolean> {
    if (!window.id) return false;

    // Get current window tabs
    const tabs = await this.tabManager.getTabs(window.id);
    const currentUrls = tabs.map(tab => this.tabManager.getTabUrl(tab));

    // If window has no tabs or space has no URLs, can't validate
    if (currentUrls.length === 0 || !space.urls || space.urls.length === 0) {
      return false;
    }

    // Simple validation: check if at least 50% of URLs match
    // This handles cases where some tabs might have changed
    const matchingUrls = currentUrls.filter(url => space.urls.includes(url));
    const matchPercentage = matchingUrls.length / Math.max(currentUrls.length, space.urls.length);

    return matchPercentage >= 0.5;
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 3000)
  async synchronizeWindowsAndSpaces(): Promise<void> {
    const windows = await this.windowManager.getAllWindows();
    const now = Date.now();
    const openWindowIds = new Set<string>();

    const updatedSpaces: Record<string, Space> = {};
    const updatedClosedSpaces: Record<string, Space> = { ...this.closedSpaces };

    // Reconcile currently open windows with stored spaces
    for (const window of windows) {
      if (!window.id) continue;

      const spaceId = window.id.toString();
      openWindowIds.add(spaceId);

      const existingSpace =
        this.spaces[spaceId] ?? this.closedSpaces[spaceId] ?? null;

      if (existingSpace) {
        // CRITICAL FIX: Don't sync closed spaces with open windows
        // This prevents window ID reuse from reactivating closed spaces
        if (this.closedSpaces[existingSpace.id]) {
          console.log(`[StateManager] Skipping closed space ${existingSpace.id} - window ID reused`);
          continue;
        }

        // Validate that this window actually belongs to the space
        const isValidWindow = await this.validateWindowOwnership(existingSpace, window);
        if (!isValidWindow) {
          console.log(`[StateManager] Window ${window.id} doesn't belong to space ${existingSpace.id} - window ID reused`);
          continue;
        }

        // Update existing space with current window state
        const tabs = await this.tabManager.getTabs(window.id);
        const urls = tabs.map(tab => this.tabManager.getTabUrl(tab));

        updatedSpaces[existingSpace.id] = {
          ...existingSpace,
          urls, // Update URLs from current tabs
          windowId: window.id, // Update current window ID
          isActive: true, // FIXED: Only mark as active if we reach this point (valid window)
          sourceWindowId: spaceId, // Update source window ID
          lastModified: Date.now(),
          lastSync: Date.now(),
          version: existingSpace.version + 1,
          // CRITICAL: Preserve custom naming - don't override customName or name if they exist
          name: existingSpace.customName || existingSpace.name, // Use custom name if set
          customName: existingSpace.customName, // Preserve custom name
          named: existingSpace.named // Preserve named status
        };
      } else {
        const tabs = await this.tabManager.getTabs(window.id);
        const urls = tabs.map(tab => this.tabManager.getTabUrl(tab));
        const name = `${DEFAULT_SPACE_NAME} ${spaceId}`;
        const space = await this.storageManager.createSpace(window.id, name, urls);

        updatedSpaces[spaceId] = {
          ...space,
          sourceWindowId: spaceId,
          windowId: window.id,
          isActive: true,
          lastSync: now,
          lastModified: now,
          lastUsed: now
        };
      }
    }

    // Move orphaned spaces to closed set
    for (const [spaceId, space] of Object.entries(this.spaces)) {
      if (!openWindowIds.has(spaceId)) {
        const baseVersion = space.version ?? 0;
        updatedClosedSpaces[spaceId] = {
          ...space,
          isActive: false,
          windowId: undefined,
          lastModified: now,
          lastUsed: now,
          lastSync: now,
          version: baseVersion + 1
        };
      }
    }

    this.spaces = updatedSpaces;
    this.closedSpaces = updatedClosedSpaces;

    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);


    // Queue the state update for broadcasting
    await this.updateQueue.enqueue({
      id: `sync-spaces-${Date.now()}`,
      type: MessageTypes.SPACES_UPDATED,
      payload: {
        spaces: this.spaces,
        action: 'synchronized'
      },
      priority: StateUpdatePriority.NORMAL
    });
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
      windowId: undefined, // Clear window ID since window is closed
      isActive: false, // Mark as inactive
      lastModified: Date.now(),
      version: space.version + 1,
    };

    // Save updates
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces),
    ]);

    // Queue the state update for broadcasting
    await this.updateQueue.enqueue({
      id: `close-space-${spaceId}-${Date.now()}`,
      type: MessageTypes.SPACE_UPDATED,
      payload: {
        spaceId,
        space: this.closedSpaces[spaceId],
        action: 'closed'
      },
      priority: StateUpdatePriority.HIGH
    });

    this.broadcastStateUpdate();
  }

  @PerformanceTrackingService.track(MetricCategories.STATE, 2000)
  async restoreSpace(spaceId: string, windowId?: number): Promise<void> {
    await this.acquireLock(spaceId);

    try {
      const space = this.closedSpaces[spaceId];
      if (!space) {
        throw new Error(`Closed space not found: ${spaceId}`);
      }

      const updatedSpace: Space = {
        ...space,
        windowId: windowId, // Associate with new window if provided
        isActive: true, // Mark as active when restored
        sourceWindowId: windowId?.toString() || space.sourceWindowId,
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

      // Queue the state update for broadcasting
      await this.updateQueue.enqueue({
        id: `restore-space-${spaceId}-${Date.now()}`,
        type: MessageTypes.SPACE_UPDATED,
        payload: {
          spaceId,
          space: updatedSpace,
          action: 'restored'
        },
        priority: StateUpdatePriority.HIGH
      });

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
      const trimmedName = name.trim().replace(/\s+/g, ' ');

      if (!trimmedName) {
        throw new Error('Space name cannot be empty');
      }

      // Update custom name using StorageManager
      await this.storageManager.updateSpaceCustomName(spaceId, trimmedName);

      // Reload spaces to get updated data from storage
      this.spaces = await this.storageManager.loadSpaces();
      this.closedSpaces = await this.storageManager.loadClosedSpaces();

      // Verify the update was persisted
      const updatedSpace = this.spaces[spaceId] || this.closedSpaces[spaceId];
      if (updatedSpace && updatedSpace.customName !== trimmedName) {
        throw new Error('Failed to persist custom name to storage');
      }

      // Invalidate cache
      this.invalidateCache(`space:${spaceId}`);
      this.invalidateCache('spaces');
      this.invalidateCache('closedSpaces');

      this.broadcastStateUpdate();

      console.log(`[StateManager] Successfully renamed space ${spaceId} to "${trimmedName}"`);
    } catch (error) {
      const errorMessage = `Failed to rename space: ${(error as Error).message}`;
      console.error(`[StateManager] ${errorMessage}`);
      throw new Error(errorMessage);
    } finally {
      this.releaseLock(spaceId);
    }
  }
}
