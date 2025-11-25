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
    chrome.commands.onCommand.addListener(this.handleCommand.bind(this));
  }

  async handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    if (request.type === 'FORCE_SAVE_STATE') {
      try {
        console.log('[MessageHandler] Force save state requested');
        await this.stateManager.handleShutdown();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[MessageHandler] Force save failed:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return;
    }

    if (request.type === 'RELOAD_STATE') {
      try {
        console.log('[MessageHandler] Reload state requested');
        await this.stateManager.reloadSpaces();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[MessageHandler] Reload state failed:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return;
    }

    if (request.type === 'SYNC_STATE') {
      try {
        console.log('[MessageHandler] Sync state requested from popup');
        await this.stateManager.ensureInitialized();
        await this.stateManager.synchronizeWindowsAndSpaces();
        sendResponse({ success: true });
      } catch (error) {
        console.error('[MessageHandler] Sync state failed:', error);
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      return;
    }

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

      this.broadcastMessage({
        type: MessageTypes.ERROR_OCCURRED,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async processAction(request: any): Promise<any> {
    switch (request.action) {
      case ActionTypes.GET_ALL_SPACES:
        return this.handleGetAllSpaces();
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

  private async handleGetAllSpaces() {
    await this.stateManager.ensureInitialized();

    const currentWindow = await this.windowManager.getCurrentWindow();
    const currentWindowId = currentWindow?.id;
    const spaces = this.stateManager.getAllSpaces();
    const needsSync =
      !currentWindowId ||
      !spaces[currentWindowId.toString()] ||
      Object.keys(spaces).length === 0;

    if (needsSync) {
      try {
        await this.stateManager.synchronizeWindowsAndSpaces();
      } catch (error) {
        console.warn('[MessageHandler] Synchronization failed during GET_ALL_SPACES:', error);
      }
    }

    return {
      spaces: this.stateManager.getAllSpaces(),
      closedSpaces: this.stateManager.getClosedSpaces()
    };
  }

  private async handleRestoreSpace(spaceId: string): Promise<{
    success: boolean;
    windowId?: number;
    error?: string;
  }> {
    try {
      await this.stateManager.ensureInitialized();

      const space = await this.stateManager.getSpaceById(spaceId);
      if (!space) {
        return { success: false, error: 'Invalid space' };
      }

      console.log(`[MessageHandler] Restoring space: ${space.name} (ID: ${spaceId})`);

      this.stateManager.registerRestoreIntent(spaceId);

      const window = await this.windowManager.createWindow(space.urls || []);
      if (!window.id) {
        this.stateManager.cancelRestoreIntent(spaceId, 'Window creation returned without id');
        return { success: false, error: 'Failed to create window' };
      }

      const windowId = window.id;
      this.stateManager.attachWindowToRestore(spaceId, windowId);

      try {
        await this.stateManager.restoreSpace(spaceId, windowId);
        console.log(`[MessageHandler] ✅ Successfully restored space: ${space.name} (window ID: ${windowId})`);
        return { success: true, windowId };
      } catch (error) {
        console.error(`[MessageHandler] Failed to restore space: ${error}`);
        await this.windowManager.closeWindow(windowId);
        this.stateManager.cancelRestoreIntent(spaceId, error instanceof Error ? error.message : 'restore failed');
        throw error;
      }
    } catch (error) {
      this.stateManager.cancelRestoreIntent(spaceId, error instanceof Error ? error.message : 'restore failed');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to restore space'
      };
    }
  }

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

  private broadcastMessage(message: {
    type: string;
    [key: string]: any;
  }): void {
    chrome.runtime.sendMessage(message).catch(() => {
      // No-op when no listeners are connected
    });
  }

  private async handleCommand(command: string): Promise<void> {
    switch (command) {
      case CommandTypes.NEXT_SPACE:
        await this.navigateSpaces('next');
        break;
      case CommandTypes.PREVIOUS_SPACE:
        await this.navigateSpaces('previous');
        break;
      case CommandTypes.TOGGLE_POPUP:
      case '_execute_action':
        await this.handleTogglePopup();
        break;
    }

    this.broadcastMessage({
      type: MessageTypes.COMMAND_EXECUTED,
      command
    });
  }

  private async handleTogglePopup(): Promise<void> {
    this.broadcastMessage({
      type: 'POPUP_TOGGLE'
    });
  }

  private async navigateSpaces(direction: 'next' | 'previous'): Promise<void> {
    const spaces = Object.values(this.stateManager.getAllSpaces());
    if (spaces.length <= 1) return;

    const currentWindow = await this.windowManager.getCurrentWindow();
    const windowId = currentWindow?.id;
    if (windowId === undefined) return;

    const currentSpaceId = windowId.toString();
    const currentIndex = spaces.findIndex(space => space.id === currentSpaceId);
    if (currentIndex === -1) return;

    const nextIndex =
      direction === 'next'
        ? (currentIndex + 1) % spaces.length
        : (currentIndex - 1 + spaces.length) % spaces.length;

    const targetSpace = spaces[nextIndex];
    await this.windowManager.switchToWindow(parseInt(targetSpace.id, 10));

    this.broadcastMessage({
      type: MessageTypes.SPACES_UPDATED,
      spaces: this.stateManager.getAllSpaces()
    });
  }
}
