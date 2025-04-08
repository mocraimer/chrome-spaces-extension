import '@testing-library/jest-dom';
import { jest } from '@jest/globals';
import { TextEncoder, TextDecoder } from 'util';
import type { RootState } from '../popup/store/types';
import { mockSpaces, mockClosedSpaces } from './mocks/mockTypes';

global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder as any;

// Mock Chrome API
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn()
  },
  windows: {
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn()
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
      editMode: false
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
