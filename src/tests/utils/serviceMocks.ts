import { jest } from '@jest/globals';
import type { MockedObject } from 'jest-mock';
import type { WindowManager, TabManager, StateManager, StorageManager } from '@/shared/types/Services';
import type { StateUpdateQueue } from '@/background/services/StateUpdateQueue';
import type { StateBroadcastService } from '@/background/services/StateBroadcastService';
import type { PerformanceTrackingService } from '@/background/services/performance/PerformanceTrackingService';

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
    deleteClosedSpace: jest.fn(),
    registerRestoreIntent: jest.fn(),
    attachWindowToRestore: jest.fn(),
    cancelRestoreIntent: jest.fn(),
    handleWindowCreated: jest.fn(),
    ensureInitialized: jest.fn(),
    forceSave: jest.fn(),
    get_space_by_id_with_reload: jest.fn(),
    rekeySpace: jest.fn(),
    addClosedSpace: jest.fn(),
    reloadSpaces: jest.fn()
  };
};

export const createStorageManagerMock = (): MockedObject<StorageManager> => {
  return {
    saveSpaces: jest.fn(),
    loadSpaces: jest.fn(),
    saveClosedSpaces: jest.fn(),
    loadClosedSpaces: jest.fn(),
    saveState: jest.fn(),
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

// New mock creators added to support AutoRestore.test.ts
export const createStateUpdateQueueMock = (): MockedObject<StateUpdateQueue> => {
  return {
    enqueue: jest.fn(),
    processQueue: jest.fn(),
    clear: jest.fn(),
    length: 0,
    isProcessing: false,
  } as unknown as MockedObject<StateUpdateQueue>;
};

export const createStateBroadcastServiceMock = (): MockedObject<StateBroadcastService> => {
  return {
    broadcast: jest.fn()
  } as unknown as MockedObject<StateBroadcastService>;
};

export const createPerformanceTrackingServiceMock = (): MockedObject<PerformanceTrackingService> => {
  return {
    track: jest.fn(),
    getMetrics: jest.fn(),
    clearMetrics: jest.fn(),
    measure: jest.fn(),
    measureAsync: jest.fn()
  } as unknown as MockedObject<PerformanceTrackingService>;
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
