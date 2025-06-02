import React from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { jest } from '@jest/globals';
import { settingsSlice } from '../../options/store/slices/settingsSlice';

// Create a test store
export function createTestStore(preloadedState?: any) {
  return configureStore({
    reducer: {
      settings: settingsSlice.reducer,
    },
    preloadedState,
  });
}

// Create wrapper component with providers
interface AllTheProvidersProps {
  children: React.ReactNode;
  store?: ReturnType<typeof createTestStore>;
}

export function AllTheProviders({ children, store }: AllTheProvidersProps) {
  const testStore = store || createTestStore();
  
  return React.createElement(Provider, { store: testStore, children });
}

// Custom render function
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & {
    preloadedState?: any;
    store?: ReturnType<typeof createTestStore>;
  }
) {
  const {
    preloadedState,
    store = createTestStore(preloadedState),
    ...renderOptions
  } = options || {};

  function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(AllTheProviders, { store, children });
  }

  return { store, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}

export type MockEventListener = (event: string, handler: EventListener) => void;

// Define only the keyboard event properties we actually use in our tests
export interface MockKeyboardEventProps {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  target?: HTMLElement | null;
  preventDefault?: () => void;
  stopPropagation?: () => void;
}

// Create a minimal mock keyboard event
export function createMockKeyboardEvent(init: MockKeyboardEventProps) {
  const mockEvent = {
    key: init.key,
    ctrlKey: init.ctrlKey || false,
    shiftKey: init.shiftKey || false,
    altKey: init.altKey || false,
    metaKey: init.metaKey || false,
    target: init.target || {
      tagName: 'DIV',
      isContentEditable: false,
      nodeName: 'DIV'
    },
    preventDefault: jest.fn(),
    stopPropagation: jest.fn(),
    type: 'keydown'
  };

  return mockEvent as unknown as KeyboardEvent;
}

export const mockDocumentEventListeners = () => {
  const eventMap: Record<string, EventListener> = {};
  
  const addEventListener: MockEventListener = (event, handler) => {
    eventMap[event] = handler;
  };

  const removeEventListener: MockEventListener = (event, handler) => {
    delete eventMap[event];
  };

  return {
    eventMap,
    mockAddEventListener: jest.fn(addEventListener),
    mockRemoveEventListener: jest.fn(removeEventListener)
  };
};

// Helper to create an input element for testing
export function createMockInputElement(value: string = '') {
  const input = document.createElement('input');
  input.value = value;
  return input;
}

// Mock Chrome API
export const mockChrome = {
  windows: {
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    getCurrent: jest.fn(),
    onCreated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  tabs: {
    create: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
    remove: jest.fn(),
    get: jest.fn(),
    onCreated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onRemoved: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onAttached: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onDetached: {
      addListener: jest.fn(),
      removeListener: jest.fn()
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
} as unknown as typeof chrome;

// Types for testing with React Testing Library
declare global {
  namespace jest {
    interface Matchers<R> {
      toHaveBeenCalledWith(expected: any): R;
      toHaveBeenCalled(): R;
      toHaveBeenCalledTimes(times: number): R;
    }
  }
}

// Create mock event listener storage for simulating Chrome events
export type ChromeEventListener = (...args: any[]) => void;

export interface ChromeEventEmitter {
  addListener: (callback: ChromeEventListener) => void;
  removeListener: (callback: ChromeEventListener) => void;
  hasListener: (callback: ChromeEventListener) => boolean;
  hasListeners: () => boolean;
  dispatch: (...args: any[]) => void;
}

export function createChromeEventEmitter(): ChromeEventEmitter {
  const listeners = new Set<ChromeEventListener>();
  
  return {
    addListener: (callback) => listeners.add(callback),
    removeListener: (callback) => listeners.delete(callback),
    hasListener: (callback) => listeners.has(callback),
    hasListeners: () => listeners.size > 0,
    dispatch: (...args) => listeners.forEach(listener => listener(...args))
  };
}

export type MockChromeAPI = typeof mockChrome;