import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import '../jest.setup';

// Type definitions for mocks and rules
interface ChromeRule {
  id?: string;
  conditions: unknown[];
  actions: unknown[];
}

type MockFn = jest.Mock;

// Chrome API specific types
interface ChromeCreateWindowOptions {
  [key: string]: unknown;
}

interface ChromeUpdateWindowOptions {
  [key: string]: unknown;
}

// Type guards
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

// Base types for mocks
interface MockWindow {
  id: number;
  focused: boolean;
  state: string;
  type: string;
  alwaysOnTop: boolean;
  height: number;
  width: number;
  top: number;
  left: number;
  tabs: MockTab[];
}

interface MockTab {
  id: number;
  windowId: number;
  url: string;
  active: boolean;
  index: number;
  pinned: boolean;
  title: string;
}

// Create mock window
const createMockWindow = (id: number = 1): MockWindow => ({
  id,
  focused: true,
  state: 'normal',
  type: 'normal',
  alwaysOnTop: false,
  height: 600,
  width: 800,
  top: 0,
  left: 0,
  tabs: []
});

// Create mock tab
const createMockTab = (windowId: number, url: string): MockTab => ({
  id: Math.floor(Math.random() * 10000),
  windowId,
  url,
  active: false,
  index: 0,
  pinned: false,
  title: url
});

// Create mock port
const createMockPort = (windowId: number) => ({
  name: 'test-port',
  sender: {
    tab: createMockTab(windowId, 'chrome://newtab')
  },
  onMessage: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  onDisconnect: {
    addListener: jest.fn(),
    removeListener: jest.fn()
  },
  postMessage: jest.fn(),
  disconnect: jest.fn()
});

// Event handlers
const eventListeners = {
  connect: new Set<Function>(),
  disconnect: new Set<Function>()
};

// Create mock functions
const createWindow = jest.fn((urls: unknown, options: ChromeCreateWindowOptions = {}) => {
  if (!isStringArray(urls)) {
    throw new Error('urls must be an array of strings');
  }
  if (!Array.isArray(urls)) {
    throw new Error('urls.map is not a function');
  }

  const window = createMockWindow();
  window.tabs = urls.map(url => createMockTab(window.id, String(url)));
  
  const result = {
    ...window,
    ...(options as object), // Type assertion for spread
    url: urls[0], // Chrome API expects url in options
  };
  
  return Promise.resolve(result);
});

const getWindow = jest.fn((windowId: unknown) => {
  if (!isNumber(windowId)) {
    throw new Error('windowId must be a number');
  }
  return Promise.resolve(createMockWindow(windowId));
});

const getAllWindows = jest.fn().mockImplementation(() => 
  Promise.resolve([createMockWindow(1), createMockWindow(2)])
);

const updateWindow = jest.fn((windowId: unknown, updates: ChromeUpdateWindowOptions = {}) => {
  if (!isNumber(windowId)) {
    throw new Error('windowId must be a number');
  }
  return Promise.resolve({ ...createMockWindow(windowId), ...updates });
});

const removeWindow = jest.fn().mockImplementation(() => Promise.resolve());

// Create mock runtime API
const mockRuntime = {
  connect: jest.fn().mockImplementation(() => createMockPort(1)),
  onConnect: {
    addListener: (callback: Function) => {
      eventListeners.connect.add(callback);
      callback(createMockPort(1));
    },
    removeListener: (callback: Function) => {
      eventListeners.connect.delete(callback);
    },
    hasListener: jest.fn().mockReturnValue(true),
    hasListeners: jest.fn().mockReturnValue(true),
    getRules: jest.fn(() => Promise.resolve<ChromeRule[]>([])),
    addRules: jest.fn((rules: ChromeRule[]) => Promise.resolve<ChromeRule[]>([])),
    removeRules: jest.fn((ruleIds: string[]) => Promise.resolve())
  }
};

// Create mock windows API
const mockWindows = {
  create: createWindow,
  get: getWindow,
  getAll: getAllWindows,
  update: updateWindow,
  remove: removeWindow
};

// Mock Chrome APIs
Object.assign(chrome.windows, mockWindows);
Object.assign(chrome.runtime, mockRuntime);

// Mock performance API
const performanceMocks = {
  mark: jest.fn(),
  measure: jest.fn()
};

Object.assign(window.performance, performanceMocks);

// Reset before each test
beforeEach(() => {
  jest.clearAllMocks();
  eventListeners.connect.clear();
  eventListeners.disconnect.clear();

  // Reset mock implementations
  createWindow.mockImplementation((urls: unknown, options: ChromeCreateWindowOptions = {}) => {
    if (!isStringArray(urls)) {
      throw new Error('urls must be an array of strings');
    }
    if (!Array.isArray(urls)) {
      throw new Error('urls.map is not a function');
    }

    const window = createMockWindow();
    window.tabs = urls.map(url => createMockTab(window.id, String(url)));
    
    const result = {
      ...window,
      ...(options as object),
      url: urls[0],
    };
    
    return Promise.resolve(result);
  });

  getWindow.mockImplementation((windowId: unknown) => {
    if (!isNumber(windowId)) {
      throw new Error('windowId must be a number');
    }
    return Promise.resolve(createMockWindow(windowId));
  });

  getAllWindows.mockImplementation(() => 
    Promise.resolve([createMockWindow(1), createMockWindow(2)])
  );

  updateWindow.mockImplementation((windowId: unknown, updates: ChromeUpdateWindowOptions = {}) => {
    if (!isNumber(windowId)) {
      throw new Error('windowId must be a number');
    }
    return Promise.resolve({ ...createMockWindow(windowId), ...updates });
  });

  removeWindow.mockImplementation(() => Promise.resolve());
});

// Export test utilities
export const testUtils = {
  createMockWindow,
  createMockTab,
  createMockPort,
  eventListeners,
  mocks: {
    windows: mockWindows,
    runtime: mockRuntime
  }
};