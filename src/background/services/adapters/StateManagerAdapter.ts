import { SpaceState, Space } from '../../../shared/types/Space';
import { StateManager } from '../StateManager';

/**
 * Adapts the StateManager interface to provide getState and dispatch methods
 * required by the import/export managers
 */
export class StateManagerAdapter {
  constructor(private stateManager: StateManager) {}

  getState(): SpaceState {
    return {
      spaces: this.stateManager.getAllSpaces(),
      closedSpaces: this.stateManager.getClosedSpaces(),
      currentWindowId: null,
      isLoading: false,
      error: null
    };
  }

  async dispatch(action: { type: string; payload: any }): Promise<void> {
    switch (action.type) {
      case 'spaces/importActive':
        await this.importActiveSpaces(action.payload);
        break;
      case 'spaces/importClosed':
        await this.importClosedSpaces(action.payload);
        break;
    }
  }

  private async importActiveSpaces(spaces: Record<string, any>): Promise<void> {
    for (const [id, space] of Object.entries(spaces)) {
      const windowId = parseInt(id);
      if (!isNaN(windowId)) {
          // Try to create space, might fail if exists, we catch nothing here?
          // Ideally we should check or use a robust method.
          // But importActiveSpaces seems unused by ImportManager currently.
          try {
            await this.stateManager.createSpace(windowId);
            await this.stateManager.setSpaceName(id, space.name);
          } catch (e) {
              console.warn('Failed to import active space:', id, e);
          }
      }
    }

    this.broadcastUpdate();
  }

  private async importClosedSpaces(spaces: Record<string, any>): Promise<void> {
    for (const space of Object.values(spaces)) {
      await this.stateManager.addClosedSpace(space);
    }

    this.broadcastUpdate();
  }

  private broadcastUpdate(): void {
    chrome.runtime.sendMessage({
      type: 'SPACES_UPDATED',
      spaces: this.getState()
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }
}
