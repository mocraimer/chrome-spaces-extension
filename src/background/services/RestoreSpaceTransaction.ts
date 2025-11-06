import { WindowManager } from './WindowManager';
import { StateManager } from './StateManager';
import { TabManager } from './TabManager';
import { Space } from '@/shared/types/Space';

export type RestoreState = 
  | 'INITIALIZING'
  | 'CREATING_WINDOW'
  | 'RESTORING_TABS' 
  | 'COMPLETED'
  | 'FAILED';

type StateChangeHandler = (state: RestoreState) => void;
type ErrorHandler = (error: Error) => void;

export class RestoreSpaceTransaction {
  private state: RestoreState = 'INITIALIZING';
  private stateChangeHandlers: StateChangeHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private activeRestoration: Promise<void> | null = null;
  private restorationQueue: Array<{ spaceId: string; resolve: () => void; reject: (error: Error) => void }> = [];
  private isProcessingQueue = false;

  constructor(
    private windowManager: WindowManager,
    private stateManager: StateManager,
    private tabManager: TabManager,
    private restoringWindowIds: Set<number>
  ) {}

  onStateChange(handler: StateChangeHandler): void {
    this.stateChangeHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  private setState(newState: RestoreState) {
    this.state = newState;
    this.stateChangeHandlers.forEach(handler => handler(newState));
  }

  private handleError(error: Error) {
    this.setState('FAILED');
    this.errorHandlers.forEach(handler => handler(error));
    throw error;
  }

  async restore(spaceId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.restorationQueue.push({ spaceId, resolve, reject });
      this.processQueue();
    });
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.restorationQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.restorationQueue.length > 0) {
      const { spaceId, resolve, reject } = this.restorationQueue[0];
      let createdWindowId: number | undefined;

      try {
        this.setState('INITIALIZING');
        this.activeRestoration = this.executeRestore(spaceId);
        await this.activeRestoration;
        this.setState('COMPLETED');
        resolve();
      } catch (error) {
        if (createdWindowId) {
          await this.cleanupFailedRestoration(createdWindowId);
        }
        reject(error as Error);
        this.handleError(error as Error);
      } finally {
        this.activeRestoration = null;
        this.restorationQueue.shift();
      }
    }

    this.isProcessingQueue = false;
  }

  private async cleanupFailedRestoration(windowId: number): Promise<void> {
    try {
      await this.windowManager.closeWindow(windowId);
    } catch (cleanupError) {
      console.error('Failed to cleanup window after restore failure:', cleanupError);
      // Log additional error details for debugging
      console.error('Cleanup error details:', {
        windowId,
        error: cleanupError,
        timestamp: new Date().toISOString()
      });
    }
  }

  private async executeRestore(spaceId: string): Promise<void> {
    const space = await this.getSpaceWithRetry(spaceId);

    console.log(`[RestoreSpaceTransaction] Restoring space:`, {
      id: spaceId,
      name: space.name,
      named: space.named,
      urls: space.urls.length
    });

    // Create window with retry mechanism
    this.setState('CREATING_WINDOW');
    const window = await this.createWindowWithRetry(space.urls);

    if (!window?.id) {
      throw new Error('Failed to create window with valid ID');
    }

    // Mark this window as being restored to prevent event handlers from creating a default space
    console.log(`[RestoreSpaceTransaction] Marking window ${window.id} as restoring`);
    this.restoringWindowIds.add(window.id);

    try {
      // Re-key the space from old ID to new window ID
      // This is crucial because window IDs change after browser restart
      console.log(`[RestoreSpaceTransaction] Re-keying space ${spaceId} to new window ID ${window.id}`);
      await this.stateManager.rekeySpace(spaceId, window.id);
      // Tabs were created by createWindow; rekeySpace persisted active tab rows.

      // Verify the name was preserved
      const restoredSpace = this.stateManager.getAllSpaces()[window.id.toString()];
      console.log(`[RestoreSpaceTransaction] Rekey result:`, {
        id: restoredSpace?.id,
        name: restoredSpace?.name,
        named: restoredSpace?.named
      });

      if (restoredSpace && restoredSpace.name !== space.name) {
        console.error(`[RestoreSpaceTransaction] ⚠️ Name mismatch after rekey!`, {
          before: space.name,
          after: restoredSpace.name
        });
      }
    } finally {
      // Always clean up the restoration marker, even if there's an error
      console.log(`[RestoreSpaceTransaction] Unmarking window ${window.id} as restoring`);
      this.restoringWindowIds.delete(window.id);
    }
  }

  private async getSpaceWithRetry(spaceId: string, maxRetries = 3): Promise<Space> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const space = await this.stateManager.getSpaceById(spaceId);
        if (space) {
          return space;
        }
        throw new Error(`Space not found: ${spaceId}`);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }
    
    throw lastError || new Error(`Failed to retrieve space after ${maxRetries} attempts`);
  }

  private async createWindowWithRetry(urls: string[]): Promise<chrome.windows.Window> {
    try {
      return await this.windowManager.createWindow(urls, {
        focused: true,
        state: 'normal'
      });
    } catch (error) {
      console.error('Window creation failed, retrying with single tab:', error);
      // Fallback: Try creating with just the first URL
      return await this.windowManager.createWindow([urls[0]], {
        focused: true,
        state: 'normal'
      });
    }
  }

  private async atomicSpaceUpdate(spaceId: string, window: chrome.windows.Window): Promise<void> {
    try {
      await this.stateManager.updateSpaceWindow(spaceId, window);
    } catch (error) {
      throw new Error(`Failed to update space window association: ${(error as Error).message}`);
    }
  }

  private async restoreTabsWithValidation(windowId: number, urls: string[]): Promise<void> {
    if (!urls.length) {
      throw new Error('No URLs provided for tab restoration');
    }

    try {
      await this.tabManager.createTabs(windowId, urls);
    } catch (error) {
      throw new Error(`Failed to restore tabs: ${(error as Error).message}`);
    }
  }
}