import { WindowManager } from './WindowManager';
import { StateManager } from './StateManager';
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
    private stateManager: StateManager
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

  private notifyError(error: Error): void {
    this.setState('FAILED');
    this.errorHandlers.forEach(handler => handler(error));
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

      try {
        this.setState('INITIALIZING');
        this.activeRestoration = this.executeRestore(spaceId);
        await this.activeRestoration;
        this.setState('COMPLETED');
        resolve();
      } catch (error) {
        this.notifyError(error as Error);
        reject(error as Error);
      } finally {
        this.activeRestoration = null;
        this.restorationQueue.shift();
      }
    }

    this.isProcessingQueue = false;
  }

  private async executeRestore(spaceId: string): Promise<void> {
    const space = await this.getSpaceWithRetry(spaceId);

    console.log('[RestoreSpaceTransaction] Restoring space snapshot', {
      id: spaceId,
      name: space.name,
      named: space.named,
      urls: space.urls.length
    });

    this.stateManager.registerRestoreIntent(spaceId);

    this.setState('CREATING_WINDOW');
    const window = await this.createWindowWithRetry(space.urls);

    if (!window?.id) {
      this.stateManager.cancelRestoreIntent(spaceId, 'Failed to create window with valid ID');
      throw new Error('Failed to create window with valid ID');
    }

    const windowId = window.id;
    this.stateManager.attachWindowToRestore(spaceId, windowId);

    try {
      console.log(`[RestoreSpaceTransaction] Activating space ${spaceId} with window ${windowId}`);
      await this.stateManager.rekeySpace(spaceId, windowId);

      // Space is keyed by permanentId (spaceId), not windowId
      const restoredSpace = this.stateManager.getAllSpaces()[spaceId];
      console.log('[RestoreSpaceTransaction] Activation result', {
        id: restoredSpace?.id,
        permanentId: restoredSpace?.permanentId,
        name: restoredSpace?.name,
        named: restoredSpace?.named,
        windowId: restoredSpace?.windowId
      });
    } catch (error) {
      this.stateManager.cancelRestoreIntent(spaceId, error instanceof Error ? error.message : 'Restore failed');
      await this.cleanupFailedRestoration(windowId);
      throw error;
    }
  }

  private async cleanupFailedRestoration(windowId: number): Promise<void> {
    try {
      await this.windowManager.closeWindow(windowId);
    } catch (cleanupError) {
      console.error('Failed to cleanup window after restore failure:', cleanupError);
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
      return await this.windowManager.createWindow([urls[0]], {
        focused: true,
        state: 'normal'
      });
    }
  }
}
