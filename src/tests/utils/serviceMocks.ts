import { jest } from '@jest/globals';
import type { WindowManager, TabManager, StorageManager } from '../../shared/types/Services';
import type { Space } from '../../shared/types/Space';

type SpaceRecord = Record<string, Space>;
type StorageResponse = Promise<SpaceRecord>;

export function createMockWindowManager(): jest.Mocked<WindowManager> {
  return {
    createWindow: jest.fn(),
    closeWindow: jest.fn(),
    switchToWindow: jest.fn(),
    getWindow: jest.fn(),
    getAllWindows: jest.fn(),
    windowExists: jest.fn(),
    getCurrentWindow: jest.fn(),
    arrangeWindows: jest.fn()
  };
}

export function createMockTabManager(): jest.Mocked<TabManager> {
  return {
    getTabs: jest.fn(),
    getTabUrl: jest.fn((tab: chrome.tabs.Tab) => tab.url || ''),
    createTab: jest.fn(),
    moveTab: jest.fn(),
    removeTab: jest.fn(),
    updateTab: jest.fn(),
    waitForTabLoad: jest.fn(),
    getActiveTab: jest.fn(),
    moveTabs: jest.fn(),
    duplicateTab: jest.fn(),
    reloadTab: jest.fn(),
    captureTab: jest.fn()
  };
}

export function createMockStorageManager(): jest.Mocked<StorageManager> {
  const emptySpaces: SpaceRecord = {};
  
  return {
    saveSpaces: jest.fn(async (spaces: SpaceRecord) => {}),
    loadSpaces: jest.fn(async () => emptySpaces),
    saveClosedSpaces: jest.fn(async (spaces: SpaceRecord) => {}),
    loadClosedSpaces: jest.fn(async () => emptySpaces),
    clear: jest.fn(async () => {}),
    exportData: jest.fn(async () => JSON.stringify(emptySpaces)),
    importData: jest.fn(async (data: string) => {})
  };
}

export function createMockSpace(id: string, name: string): Space {
  return {
    id,
    name,
    urls: [],
    lastModified: Date.now(),
    named: false,
    version: 1 // Initialize version for sync tracking
  };
}