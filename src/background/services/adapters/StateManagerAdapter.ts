import { SpaceState } from '../../../shared/types/Space';
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

  dispatch(action: { type: string; payload: any }): void {
    switch (action.type) {
      case 'spaces/importActive':
        this.importActiveSpaces(action.payload);
        break;
      case 'spaces/importClosed':
        this.importClosedSpaces(action.payload);
        break;
    }
  }

  private async importActiveSpaces(spaces: Record<string, any>): Promise<void> {
    for (const [id, space] of Object.entries(spaces)) {
      await this.stateManager.setSpaceName(id, space.name);
    }

    // Broadcast state update
    chrome.runtime.sendMessage({
      type: 'SPACES_UPDATED',
      spaces: this.getState()
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }

  private async importClosedSpaces(spaces: Record<string, any>): Promise<void> {
    // First import them as active spaces
    for (const [id, space] of Object.entries(spaces)) {
      // Create the space with its URLs and set its name
      await this.stateManager.createSpace(parseInt(id), space.urls);
      await this.stateManager.setSpaceName(id, space.name);
      
      // Then close it to move it to closed spaces
      await this.stateManager.closeSpace(parseInt(id));
    }

    // Broadcast state update
    chrome.runtime.sendMessage({
      type: 'SPACES_UPDATED',
      spaces: this.getState()
    }).catch(() => {
      // Ignore errors if no listeners
    });
  }
}