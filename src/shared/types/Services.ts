import { Space } from './Space';
import { RestoreSnapshot } from '../../background/services/types/RestoreRegistry';

export interface TabRecord {
  id: string;
  spaceId: string;
  kind: 'active' | 'closed';
  url: string;
  index?: number;
  pinned?: boolean;
  title?: string;
  createdAt: number;
}

export interface WindowManager {
  createWindow(urls: string[], options?: chrome.windows.CreateData): Promise<chrome.windows.Window>;
  closeWindow(windowId: number): Promise<void>;
  switchToWindow(windowId: number): Promise<void>;
  getWindow(windowId: number): Promise<chrome.windows.Window>;
  getAllWindows(): Promise<chrome.windows.Window[]>;
  windowExists(windowId: number): Promise<boolean>;
  getCurrentWindow(): Promise<chrome.windows.Window>;
  arrangeWindows(): Promise<void>;
}

export interface StorageManager {
  saveSpaces(spaces: Record<string, Space>): Promise<void>;
  loadSpaces(): Promise<Record<string, Space>>;
  saveClosedSpaces(spaces: Record<string, Space>): Promise<void>;
  loadClosedSpaces(): Promise<Record<string, Space>>;
  clear(): Promise<void>;
  exportData(): Promise<string>;
  importData(data: string): Promise<void>;
  // Additional methods used by StateManager
  createSpace(windowId: number, name: string, urls: string[], named?: boolean): Promise<Space>;
  loadTabsForSpace(spaceId: string, kind: 'active' | 'closed'): Promise<TabRecord[]>;
  saveTabsForSpace(spaceId: string, kind: 'active' | 'closed', tabs: TabRecord[]): Promise<void>;
  deleteTabsForSpace(spaceId: string, kind: 'active' | 'closed'): Promise<void>;
  updatePermanentIdMapping(windowId: number, permanentId: string): Promise<void>;
  saveState(spaces: Record<string, Space>, closedSpaces: Record<string, Space>): Promise<void>;
}

export interface TabManager {
  getTabs(windowId: number): Promise<chrome.tabs.Tab[]>;
  getTabUrl(tab: chrome.tabs.Tab): string;
  createTab(windowId: number, url: string): Promise<chrome.tabs.Tab>;
  createTabs(windowId: number, urls: string[]): Promise<chrome.tabs.Tab[]>;
  moveTab(tabId: number, windowId: number): Promise<chrome.tabs.Tab>;
  removeTab(tabId: number): Promise<void>;
  updateTab(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab>;
  waitForTabLoad(tabId: number): Promise<void>;
  getActiveTab(windowId: number): Promise<chrome.tabs.Tab>;
  moveTabs(tabIds: number[], windowId: number): Promise<chrome.tabs.Tab[]>;
  duplicateTab(tabId: number): Promise<chrome.tabs.Tab>;
  reloadTab(tabId: number): Promise<void>;
  captureTab(tabId: number): Promise<string>;
}

export interface StateManager {
  initialize(): Promise<void>;
  getAllSpaces(): Record<string, Space>;
  getClosedSpaces(): Record<string, Space>;
  hasSpace(windowId: number): boolean;
  handleShutdown(): Promise<void>;
  synchronizeWindowsAndSpaces(): Promise<void>;
  setSpaceName(spaceId: string, name: string): Promise<void>;
  getSpaceName(spaceId: string): Promise<string>;
  createSpace(windowId: number): Promise<void>;
  closeSpace(windowId: number): Promise<void>;
  renameSpace(windowId: number, name: string): Promise<void>;
  getSpaceById(spaceId: string): Promise<Space | null>;
  updateSpaceWindow(spaceId: string, window: chrome.windows.Window): Promise<void>;
  restoreSpace(spaceId: string): Promise<void>;
  deleteClosedSpace(spaceId: string): Promise<void>;
  // New functionality
  registerRestoreIntent(spaceId: string, expectedType?: string): RestoreSnapshot;
  attachWindowToRestore(spaceId: string, windowId: number): RestoreSnapshot | null;
  cancelRestoreIntent(spaceId: string): void;
  handleWindowCreated(window: chrome.windows.Window): Promise<boolean>;
  ensureInitialized(): Promise<void>;
  forceSave(): Promise<void>;
  get_space_by_id_with_reload(spaceId: string): Promise<Space | null>;
  rekeySpace(oldSpaceId: string, newWindowId: number): Promise<void>;
  addClosedSpace(space: Space): Promise<void>;
  reloadSpaces(): Promise<void>;
}

export interface MessageHandler {
  handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void>;
}

export interface QueuedStateUpdate<T = any> {
  id: string;
  type: string;
  timestamp: number;
  payload: T;
  priority?: number;
}
