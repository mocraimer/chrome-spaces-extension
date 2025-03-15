// Storage Keys
export const STORAGE_KEY = 'chrome_spaces';
export const SETTINGS_KEY = 'chrome_spaces_settings';

// Default Values
export const DEFAULT_SPACE_NAME = 'Untitled Space';
export const DEFAULT_SETTINGS = {
  autoSaveInterval: 60000, // 1 minute
  maxClosedSpaces: 10,
  showNotifications: true,
  darkMode: false,
  syncEnabled: false
};

// Timeouts and Intervals
export const MESSAGE_TIMEOUT = 5000;        // 5 seconds timeout for message operations
export const SYNC_INTERVAL = 60000;         // 1 minute interval for window sync
export const STARTUP_DELAY = 1000;          // 1 second delay on startup
export const RECOVERY_CHECK_DELAY = 5000;   // 5 seconds delay for recovery checks
export const TAB_LOAD_TIMEOUT = 30000;      // 30 seconds timeout for tab loading

// Message Types
export const MessageTypes = {
  SPACES_UPDATED: 'spaces-updated',
  STATE_CHANGED: 'state-changed',
  ERROR_OCCURRED: 'error-occurred',
  SETTINGS_CHANGED: 'settings-changed'
} as const;

// Action Types
export const ActionTypes = {
  GET_ALL_SPACES: 'getAllSpaces',
  RENAME_SPACE: 'renameSpace',
  CLOSE_SPACE: 'closeSpace',
  SWITCH_TO_SPACE: 'switchToSpace',
  RESTORE_SPACE: 'restoreSpace',
  REMOVE_CLOSED_SPACE: 'removeClosedSpace',
  MOVE_TAB: 'moveTab',
  UPDATE_SETTINGS: 'updateSettings',
  GET_SETTINGS: 'getSettings'
} as const;

// Error Messages
export const ErrorMessages = {
  INITIALIZATION_FAILED: 'Failed to initialize Chrome Spaces',
  STORAGE_ERROR: 'Failed to access storage',
  WINDOW_ERROR: 'Failed to manage window',
  TAB_ERROR: 'Failed to manage tabs',
  SYNC_ERROR: 'Failed to synchronize windows and spaces',
  INVALID_STATE: 'Invalid state detected',
  MESSAGE_TIMEOUT: 'Message operation timed out'
} as const;

// CSS Classes
export const CssClasses = {
  SPACE_ITEM: 'space-item',
  ACTIVE_SPACE: 'active-space',
  CLOSED_SPACE: 'closed-space',
  ENTER_TARGET: 'enter-target',
  EMPTY_LIST: 'empty-list',
  DARK_MODE: 'dark-mode'
} as const;

// Event Names
export const Events = {
  WINDOW_CREATED: 'onCreated',
  WINDOW_REMOVED: 'onRemoved',
  WINDOW_FOCUS_CHANGED: 'onFocusChanged',
  TAB_CREATED: 'onCreated',
  TAB_UPDATED: 'onUpdated',
  TAB_REMOVED: 'onRemoved',
  STARTUP: 'onStartup',
  INSTALLED: 'onInstalled',
  SESSION_RESTORED: 'onSessionRestore'
} as const;
