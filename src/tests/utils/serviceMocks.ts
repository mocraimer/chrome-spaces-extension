import { jest } from '@jest/globals';
import type { MockedObject } from 'jest-mock';
import type { WindowManager, TabManager, StateManager, StorageManager } from '@/shared/types/Services';

export const createWindowManagerMock = (): MockedObject<WindowManager> => {
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
};

export const createTabManagerMock = (): MockedObject<TabManager> => {
  return {
    getTabs: jest.fn(),
    getTabUrl: jest.fn(),
    createTab: jest.fn(),
    createTabs: jest.fn(),
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
};

export const createStateManagerMock = (): MockedObject<StateManager> => {
  return {
    initialize: jest.fn(),
    getAllSpaces: jest.fn(),
    getClosedSpaces: jest.fn(),
    hasSpace: jest.fn(),
    handleShutdown: jest.fn(),
    synchronizeWindowsAndSpaces: jest.fn(),
    setSpaceName: jest.fn(),
    getSpaceName: jest.fn(),
    createSpace: jest.fn(),
    closeSpace: jest.fn(),
    renameSpace: jest.fn(),
    getSpaceById: jest.fn(),
    updateSpaceWindow: jest.fn(),
    restoreSpace: jest.fn(),
    deleteClosedSpace: jest.fn()
  };
};

export const createStorageManagerMock = (): MockedObject<StorageManager> => {
  return {
    saveSpaces: jest.fn(),
    loadSpaces: jest.fn(),
    saveClosedSpaces: jest.fn(),
    loadClosedSpaces: jest.fn(),
    clear: jest.fn(),
    exportData: jest.fn(),
    importData: jest.fn(),
    createSpace: jest.fn(),
    loadTabsForSpace: jest.fn(),
    saveTabsForSpace: jest.fn(),
    deleteTabsForSpace: jest.fn(),
    updatePermanentIdMapping: jest.fn()
  };
};

export const mockChrome = {
  windows: {
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    getCurrent: jest.fn()
  },
  tabs: {
    create: jest.fn(),
    query: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    move: jest.fn(),
    get: jest.fn(),
    duplicate: jest.fn(),
    reload: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  system: {
    display: {
      getInfo: jest.fn()
    }
  }
};