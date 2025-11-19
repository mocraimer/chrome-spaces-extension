import { StateManager } from '../../../background/services/StateManager';
import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateUpdateQueue } from '../../../background/services/StateUpdateQueue';
import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { RestoreRegistry } from '../../../background/services/types/RestoreRegistry';
import { Space } from '@/shared/types/Space';

export class MockTabManager extends TabManager {
  async getTabs() {
    return [];
  }
  getTabUrl(tab: chrome.tabs.Tab) {
    return tab.url || '';
  }
}

export class MockStorageManager extends StorageManager {
  private spaces: Record<string, Space> = {};
  private closedSpaces: Record<string, Space> = {};
  private permanentIds = new Map<number, string>();

  async loadSpaces(): Promise<Record<string, Space>> {
    return { ...this.spaces };
  }

  async loadClosedSpaces(): Promise<Record<string, Space>> {
    return { ...this.closedSpaces };
  }

  async saveSpaces(spaces: Record<string, Space>): Promise<void> {
    this.spaces = { ...spaces };
  }

  async saveClosedSpaces(spaces: Record<string, Space>): Promise<void> {
    this.closedSpaces = { ...spaces };
  }

  async getPermanentId(windowId: number): Promise<string> {
    const existing = this.permanentIds.get(windowId);
    if (existing) {
      return existing;
    }

    const permanentId = `mock_space_${windowId}_${Math.random().toString(36).slice(2, 8)}`;
    this.permanentIds.set(windowId, permanentId);
    return permanentId;
  }

  async updatePermanentIdMapping(windowId: number, permanentId: string): Promise<void> {
    this.permanentIds.set(windowId, permanentId);
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
    // Simulate optimized window creation timings to reflect expected performance
    const delay = Math.min(300, Math.max(3, urls.length * 3));
    await new Promise(resolve => setTimeout(resolve, delay));
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
  const restoreRegistry = new RestoreRegistry();
  const stateManager = new StateManager(
    windowManager,
    tabManager,
    storageManager,
    updateQueue,
    broadcastService,
    restoreRegistry
  );

  return {
    tabManager,
    windowManager,
    storageManager,
    updateQueue,
    broadcastService,
    restoreRegistry,
    stateManager
  };
}
