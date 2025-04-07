import { Space } from './Space';

export interface WindowManager {
  createWindow(urls: string[]): Promise<chrome.windows.Window>;
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
}

export interface TabManager {
  getTabs(windowId: number): Promise<chrome.tabs.Tab[]>;
  getTabUrl(tab: chrome.tabs.Tab): string;
  createTab(windowId: number, url: string): Promise<chrome.tabs.Tab>;
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
}

export interface MessageHandler {
  handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void>;
}
