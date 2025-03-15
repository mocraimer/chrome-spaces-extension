import { Space } from './Space';

export interface WindowManager {
  createWindow(urls: string[]): Promise<chrome.windows.Window>;
  closeWindow(windowId: number): Promise<void>;
  switchToWindow(windowId: number): Promise<void>;
  getWindow(windowId: number): Promise<chrome.windows.Window>;
  getAllWindows(): Promise<chrome.windows.Window[]>;
}

export interface StorageManager {
  saveSpaces(spaces: Record<string, Space>): Promise<void>;
  loadSpaces(): Promise<Record<string, Space>>;
  saveClosedSpaces(spaces: Record<string, Space>): Promise<void>;
  loadClosedSpaces(): Promise<Record<string, Space>>;
  clear(): Promise<void>;
}

export interface TabManager {
  getTabs(windowId: number): Promise<chrome.tabs.Tab[]>;
  createTab(windowId: number, url: string): Promise<chrome.tabs.Tab>;
  moveTab(tabId: number, windowId: number): Promise<chrome.tabs.Tab>;
  removeTab(tabId: number): Promise<void>;
  updateTab(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab>;
}

export interface StateManager {
  initialize(): Promise<void>;
  getAllSpaces(): Record<string, Space>;
  getClosedSpaces(): Record<string, Space>;
  hasSpace(windowId: number): boolean;
  handleShutdown(): Promise<void>;
  synchronizeWindowsAndSpaces(): Promise<void>;
}

export interface MessageHandler {
  handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void>;
}
