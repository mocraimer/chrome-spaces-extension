import { MessageHandler as IMessageHandler } from '@/shared/types/Services';
import { WindowManager } from './WindowManager';
import { TabManager } from './TabManager';
import { StateManager } from './StateManager';
import { ActionTypes, MessageTypes, CommandTypes } from '@/shared/constants';
import { createError, typeGuards } from '@/shared/utils';

export class MessageHandler implements IMessageHandler {
  constructor(
    private windowManager: WindowManager,
    private tabManager: TabManager,
    private stateManager: StateManager
  ) {
    // Listen for keyboard commands
    chrome.commands.onCommand.addListener(this.handleCommand.bind(this));
  }

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
        await this.stateManager.deleteClosedSpace(request.spaceId);
        return {
          success: true,
          spaces: this.stateManager.getAllSpaces(),
          closedSpaces: this.stateManager.getClosedSpaces()
        };

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
    try {
      // Get space info before restoration
      const space = await this.stateManager.getSpaceById(spaceId);
      if (!space?.urls.length) {
        return { success: false, error: 'Invalid space or no URLs' };
      }

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

      // Create and name the new space first
      await this.stateManager.createSpace(window.id!);
      await this.stateManager.renameSpace(window.id!, space.name);
      
      // Now restore the space state (moves from closed to active)
      await this.stateManager.restoreSpace(spaceId);

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

  /**
   * Handle keyboard command events
   */
  private async handleCommand(command: string): Promise<void> {
    switch (command) {
      case CommandTypes.NEXT_SPACE:
        await this.navigateSpaces('next');
        break;
      case CommandTypes.PREVIOUS_SPACE:
        await this.navigateSpaces('previous');
        break;
      case "_execute_action":
        await this.handleTogglePopup();
        break;
    }
    this.broadcastMessage({
      type: MessageTypes.COMMAND_EXECUTED,
      command
    });
  }

  /**
   * Toggle popup display
   */
  private async handleTogglePopup(): Promise<void> {
    // Trigger popup toggle by broadcasting a toggle message to extension pages
    this.broadcastMessage({
      type: "POPUP_TOGGLE"
    });
  }

  /**
   * Navigate between spaces
   */
  private async navigateSpaces(direction: 'next' | 'previous'): Promise<void> {
    const spaces = Object.values(this.stateManager.getAllSpaces());
    if (spaces.length <= 1) return;

    // Get current window ID
    const currentWindow = await this.windowManager.getCurrentWindow();
    const windowId = currentWindow?.id;
    if (windowId === undefined) return;

    // Find current space index
    const currentSpaceId = windowId.toString();
    const currentIndex = spaces.findIndex(space => space.id === currentSpaceId);
    if (currentIndex === -1) return;

    // Calculate next space index
    const nextIndex = direction === 'next'
      ? (currentIndex + 1) % spaces.length
      : (currentIndex - 1 + spaces.length) % spaces.length;

    // Switch to the target space
    const targetSpace = spaces[nextIndex];
    await this.windowManager.switchToWindow(parseInt(targetSpace.id));
    
    // Update UI state
    this.broadcastMessage({
      type: MessageTypes.SPACES_UPDATED,
      spaces: this.stateManager.getAllSpaces()
    });
  }
}
