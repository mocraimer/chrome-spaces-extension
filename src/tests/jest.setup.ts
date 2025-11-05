import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
import { webcrypto as nodeWebCrypto } from 'crypto';
import { TransformStream as NodeTransformStream } from 'stream/web';
import type { RootState } from '../popup/store/types';
import { mockSpaces, mockClosedSpaces } from './mocks/mockTypes';

global.TextEncoder = TextEncoder as any;
global.TextDecoder = TextDecoder as any;

// Polyfill Web Crypto and TransformStream for libraries expecting browser APIs
(global as any).crypto = (global as any).crypto || nodeWebCrypto;
(global as any).TransformStream = (global as any).TransformStream || NodeTransformStream;

// Polyfill structuredClone for fake-indexeddb (Node < 17)
if (typeof (global as any).structuredClone === 'undefined') {
  (global as any).structuredClone = <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  };
}

// Mock Chrome API
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onConnect: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: (jest.fn() as any).mockResolvedValue({}),
      set: (jest.fn() as any).mockResolvedValue(undefined)
    },
    sync: {
      get: (jest.fn() as any).mockResolvedValue({}),
      set: (jest.fn() as any).mockResolvedValue(undefined)
    }
  },
  tabs: {
    query: (jest.fn() as any).mockResolvedValue([]),
    create: (jest.fn() as any).mockResolvedValue({}),
    update: (jest.fn() as any).mockResolvedValue({}),
    remove: (jest.fn() as any).mockResolvedValue(undefined)
  },
  windows: {
    create: (jest.fn() as any).mockResolvedValue({ id: 1, focused: true, tabs: [] }),
    update: (jest.fn() as any).mockResolvedValue({}),
    remove: (jest.fn() as any).mockResolvedValue(undefined),
    get: (jest.fn() as any).mockResolvedValue({ id: 1, focused: true, tabs: [] }),
    getAll: (jest.fn() as any).mockResolvedValue([])
  },
  commands: {
    getAll: jest.fn(),
    onCommand: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

global.chrome = mockChrome as any;

// Mock window.matchMedia for theme tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock IntersectionObserver
(global as any).IntersectionObserver = jest.fn().mockImplementation((_callback, _options) => ({
  observe: jest.fn(),
  disconnect: jest.fn(),
  unobserve: jest.fn(),
}));

// Mock Redux hooks
const mockDispatch = jest.fn();

// Create a mockable useAppDispatch function
const mockUseAppDispatch = jest.fn(() => mockDispatch);

// Make mockDispatch and mockUseAppDispatch available globally
(global as any).mockDispatch = mockDispatch;
(global as any).mockUseAppDispatch = mockUseAppDispatch;

// Mock Redux hooks
jest.mock('../popup/store', () => ({
  __esModule: true,
  useAppDispatch: mockUseAppDispatch,
  useAppSelector: jest.fn((selector: (state: RootState) => any) => selector({
    spaces: {
      spaces: mockSpaces,
      closedSpaces: mockClosedSpaces,
      currentWindowId: '1',
      isLoading: false,
      error: null,
      selectedSpaceId: '1',
      searchQuery: '',
      editMode: false,
      optimisticUpdates: {},
      actionQueue: [],
      lastSyncTimestamp: Date.now(),
      syncInProgress: false,
      operationErrors: {}
    }
  }))
}));

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Clean up mocks after each test
afterEach(() => {
  jest.resetModules();
});

// Type augmentation for Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWith(expected: any): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledTimes(times: number): R;
    }
  }
}
