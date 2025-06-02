import { StateManager } from '../../../background/services/StateManager';
import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';

export class MockTabManager extends TabManager {
  async getTabs() {
    return [];
  }
  getTabUrl(tab: chrome.tabs.Tab) {
    return tab.url || '';
  }
}

export class MockStorageManager extends StorageManager {
  private spaces = {};
  private closedSpaces = {};
  
  async loadSpaces() {
    return this.spaces;
  }
  async loadClosedSpaces() {
    return this.closedSpaces;
  }
  async saveSpaces(spaces: any) {
    this.spaces = spaces;
  }
  async saveClosedSpaces(spaces: any) {
    this.closedSpaces = spaces;
  }
}

export class MockStateUpdateQueue extends StateUpdateQueue {
  async enqueue() {
    return;
  }
  async processQueue() {
    return;
  }
}

export class MockStateBroadcastService extends StateBroadcastService {
  broadcast() {
    return;
  }
}

export class MockWindowManager extends WindowManager {
  async createWindow(urls: string[]) {
    // Simulate realistic window creation timing
    await new Promise(resolve => setTimeout(resolve, urls.length * 20));
    return {
      id: Date.now(),
      tabs: urls.map((url, index) => ({
        id: index,
        url,
        windowId: Date.now()
      }))
    } as chrome.windows.Window;
  }
}

export function createMockServices() {
  const tabManager = new MockTabManager();
  const windowManager = new MockWindowManager();
  const storageManager = new MockStorageManager();
  const updateQueue = new MockStateUpdateQueue();
  const broadcastService = new MockStateBroadcastService();
  const stateManager = new StateManager(
    windowManager,
    tabManager,
    storageManager,
    updateQueue,
    broadcastService
  );

  return {
    tabManager,
    windowManager,
    storageManager,
    updateQueue,
    broadcastService,
    stateManager
  };
}