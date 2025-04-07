import '@testing-library/jest-dom';

// Mock Chrome API
Object.defineProperty(global, 'chrome', {
  value: {
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
  },
  writable: true
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});