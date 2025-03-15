import { MessageHandler as IMessageHandler } from '@/shared/types/Services';
import { WindowManager } from './WindowManager';
import { TabManager } from './TabManager';
import { StateManager } from './StateManager';
import { ActionTypes, MessageTypes } from '@/shared/constants';
import { createError, typeGuards } from '@/shared/utils';

export class MessageHandler implements IMessageHandler {
  constructor(
    private windowManager: WindowManager,
    private tabManager: TabManager,
    private stateManager: StateManager
  ) {}

  /**
   * Handle incoming messages from the extension UI
   */
  async handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    if (!typeGuards.action(request.action)) {
      throw createError('Invalid message action', 'INVALID_STATE');
    }

    try {
      const response = await this.processAction(request);
      sendResponse(response);
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Notify UI of error
      this.broadcastMessage({
        type: MessageTypes.ERROR_OCCURRED,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Process different action types
   */
  private async processAction(request: any): Promise<any> {
    switch (request.action) {
      case ActionTypes.GET_ALL_SPACES:
        return {
          spaces: this.stateManager.getAllSpaces(),
          closedSpaces: this.stateManager.getClosedSpaces()
        };

      case ActionTypes.RENAME_SPACE:
        await this.stateManager.renameSpace(request.windowId, request.name);
        return true;

      case ActionTypes.CLOSE_SPACE:
        await this.stateManager.closeSpace(request.windowId);
        await this.windowManager.closeWindow(request.windowId);
        return true;

      case ActionTypes.SWITCH_TO_SPACE:
        await this.windowManager.switchToWindow(request.windowId);
        return {
          success: true,
          spaces: this.stateManager.getAllSpaces()
        };

      case ActionTypes.RESTORE_SPACE:
        return this.handleRestoreSpace(request.spaceId);

      case ActionTypes.REMOVE_CLOSED_SPACE:
        const closedSpaces = this.stateManager.getClosedSpaces();
        delete closedSpaces[request.spaceId];
        await this.stateManager.synchronizeWindowsAndSpaces();
        return true;

      case ActionTypes.MOVE_TAB:
        return this.handleMoveTab(request.tabId, request.targetSpaceId);

      default:
        throw createError(`Unknown action: ${request.action}`, 'INVALID_STATE');
    }
  }

  /**
   * Handle restoring a closed space
   */
  private async handleRestoreSpace(spaceId: string): Promise<{
    success: boolean;
    windowId?: number;
    error?: string;
  }> {
    const closedSpaces = this.stateManager.getClosedSpaces();
    const space = closedSpaces[spaceId];

    if (!space?.urls.length) {
      return { success: false, error: 'Invalid space or no URLs' };
    }

    try {
      // Create new window with first URL
      const window = await this.windowManager.createWindow([space.urls[0]]);

      // Add remaining tabs
      if (space.urls.length > 1) {
        await Promise.all(
          space.urls.slice(1).map(url =>
            this.tabManager.createTab(window.id!, url)
          )
        );
      }

      // Remove from closed spaces and create new space
      delete closedSpaces[spaceId];
      await this.stateManager.createSpace(window.id!);
      
      // Set the name of the new space
      await this.stateManager.renameSpace(window.id!, space.name);

      return { success: true, windowId: window.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore space'
      };
    }
  }

  /**
   * Handle moving a tab to another space
   */
  private async handleMoveTab(
    tabId: number,
    targetSpaceId: number
  ): Promise<boolean> {
    try {
      await this.tabManager.moveTab(tabId, targetSpaceId);
      await this.stateManager.synchronizeWindowsAndSpaces();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Broadcast a message to all extension pages
   */
  private broadcastMessage(message: {
    type: string;
    [key: string]: any;
  }): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // Ignore errors if no listeners
    });
  }
}
