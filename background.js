/**
 * Chrome Spaces - Window Management Extension
 * Background service worker that manages window spaces and their states
 */

// Constants
const DEFAULT_SPACE_NAME = "Untitled Space";
const STORAGE_KEY = "chrome_spaces";

/**
 * Simple logger for development and debugging
 * @param {string} type - The type of log (e.g., 'startup', 'lifecycle', 'action')
 * @param {string} message - The log message
 * @param {Object} [data] - Optional data to include in the log
 */
const log = (type, message, data) => {
  console.log(`[${type}] ${message}`, data || '');
};

/**
 * @typedef {Object} Space
 * @property {number} id - Window ID of the space
 * @property {string} name - User-defined name of the space
 * @property {string[]} urls - List of URLs in the space
 * @property {number} lastModified - Timestamp of last modification
 */

/**
 * SpacesManager - Handles storage and state management for spaces
 * Manages both active and closed spaces, and handles persistence
 */
const SpacesManager = {
  _spaces: {},
  _closedSpaces: {},
  _initialized: false,
  _lastKnownState: { activeWindows: {} },
  
  /**
   * Initialize from storage
   */
  async initialize() {
    if (this._initialized) return;
    
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      if (data[STORAGE_KEY]) {
        this._spaces = data[STORAGE_KEY].spaces || {};
        this._closedSpaces = data[STORAGE_KEY].closedSpaces || {};
        this._lastKnownState = data[STORAGE_KEY].lastKnownState || { activeWindows: {} };
        
        log('startup', 'Loaded saved spaces', {
          activeSpaces: Object.keys(this._spaces).length,
          closedSpaces: Object.keys(this._closedSpaces).length
        });
      } else {
        log('startup', 'No saved spaces found');
      }
      this._initialized = true;
    } catch (error) {
      console.error('Failed to initialize:', error);
      this._spaces = {};
      this._closedSpaces = {};
      this._initialized = true;
    }
  },

  /**
   * Persist state to storage
   * @param {number} retries - Number of retry attempts
   * @returns {Promise<boolean>} Success status
   */
  async _saveToStorage(retries = 3) {
    while (retries > 0) {
      try {
        await chrome.storage.local.set({
          [STORAGE_KEY]: {
            spaces: this._spaces,
            closedSpaces: this._closedSpaces,
            lastKnownState: this._lastKnownState,
            lastModified: Date.now()
          }
        });
        return true;
      } catch (error) {
        retries--;
        if (retries === 0) {
          console.error('Failed to save state after all retries:', error);
          return false;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  },

  /**
   * Create a new space
   * @param {number} windowId Window ID
   * @param {chrome.tabs.Tab[]} tabs Initial tabs
   */
  async createSpace(windowId, tabs = []) {
    this._spaces[windowId] = {
      id: windowId,
      name: DEFAULT_SPACE_NAME,
      urls: tabs.map(tab => tab.url || '').filter(Boolean),
      lastModified: Date.now()
    };
    await this._saveToStorage();
  },

  /**
   * Update space's tabs
   * @param {number} windowId Window ID
   * @param {chrome.tabs.Tab[]} tabs Updated tabs list
   */
  async updateSpaceTabs(windowId, tabs) {
    if (this._spaces[windowId]) {
      this._spaces[windowId].urls = tabs.map(tab => tab.url || '').filter(Boolean);
      this._spaces[windowId].lastModified = Date.now();
      await this._saveToStorage();
    }
  },

  /**
   * Move a space to closed spaces
   * @param {number} windowId Window ID
   */
  async closeSpace(windowId) {
    if (this._spaces[windowId]) {
      try {
        const window = await chrome.windows.get(windowId, { populate: true });
        const activeSpace = this._spaces[windowId];
        this._closedSpaces[windowId] = {
          id: windowId,
          name: activeSpace.name,
          urls: window.tabs.map(tab => tab.url || '').filter(Boolean),
          lastModified: Date.now()
        };
        
        log('lifecycle', `Space ${windowId} moved to closedSpaces`, {
          activeSpace,
          closedSpace: this._closedSpaces[windowId]
        });
        
        delete this._spaces[windowId];
        await this._saveToStorage();
      } catch (error) {
        console.error(`Error closing space ${windowId}:`, error);
        // Fallback preservation
        const activeSpace = this._spaces[windowId];
        this._closedSpaces[windowId] = {
          id: windowId,
          name: activeSpace.name,
          urls: activeSpace.urls || [],
          lastModified: Date.now()
        };
        delete this._spaces[windowId];
        await this._saveToStorage();
      }
    }
  },

  /**
   * Rename a space
   * @param {number} windowId Window ID
   * @param {string} name New name
   * @returns {Promise<boolean>} Success status
   */
  async renameSpace(windowId, name) {
    if (this._spaces[windowId]) {
      this._spaces[windowId].name = name;
      this._spaces[windowId].lastModified = Date.now();
      await this._saveToStorage();
      return true;
    }
    return false;
  },

  /**
   * Save all state before browser shutdown
   */
  async handleShutdown() {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      for (const window of windows) {
        if (this._spaces[window.id]) {
          this._closedSpaces[window.id] = {
            id: window.id,
            name: this._spaces[window.id].name,
            urls: window.tabs.map(tab => tab.url || '').filter(Boolean),
            lastModified: Date.now()
          };
          delete this._spaces[window.id];
        }
      }
      await this._saveToStorage();
    } catch (error) {
      console.error('Error during shutdown:', error);
      await this._saveToStorage(1);
    }
  },

  /**
   * Get all spaces data
   * @returns {{spaces: Object, closedSpaces: Object}} All spaces
   */
  getAllSpaces() {
    return {
      spaces: this._spaces,
      closedSpaces: this._closedSpaces
    };
  },

  /**
   * Check if space exists
   * @param {number} windowId Window ID
   * @returns {boolean} Exists status
   */
  hasSpace(windowId) {
    return !!this._spaces[windowId];
  },

  /**
   * Get a closed space by ID
   * @param {number} spaceId Space ID
   * @returns {Space|undefined} Space object if found
   */
  getClosedSpace(spaceId) {
    return this._closedSpaces[spaceId];
  },

  /**
   * Remove a closed space
   * @param {number} spaceId Space ID
   * @returns {Promise<boolean>} Success status
   */
  async removeClosedSpace(spaceId) {
    if (this._closedSpaces[spaceId]) {
      delete this._closedSpaces[spaceId];
      await this._saveToStorage();
      return true;
    }
    return false;
  },

  /**
   * Check if window exists
   * @param {number} windowId Window ID
   * @returns {Promise<boolean>} Exists status
   */
  async _windowExists(windowId) {
    try {
      await chrome.windows.get(Number(windowId));
      return true;
    } catch {
      return false;
    }
  }
};

// Event Listeners
chrome.runtime.onStartup.addListener(async () => {
  log('startup', 'Chrome Spaces initializing');
  try {
    await SpacesManager.initialize();
    // Move all spaces to closed on startup
    const spacesToMove = {...SpacesManager._spaces};
    for (const [windowId, space] of Object.entries(spacesToMove)) {
      SpacesManager._closedSpaces[windowId] = {
        ...space,
        lastModified: Date.now()
      };
    }
    SpacesManager._spaces = {};
    await SpacesManager._saveToStorage();
  } catch (error) {
    console.error('Startup error:', error);
  }
});

chrome.runtime.onInstalled.addListener(async (details) => {
  log('install', `Extension ${details.reason}`, details);
  await SpacesManager.initialize();
  if (details.reason === 'install') {
    await initializeNewWindows();
  }
});

chrome.windows.onCreated.addListener(async (window) => {
  if (!SpacesManager.hasSpace(window.id)) {
    await SpacesManager.createSpace(window.id);
    const tabs = await chrome.tabs.query({ windowId: window.id });
    await SpacesManager.updateSpaceTabs(window.id, tabs);
  }
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  if (SpacesManager.hasSpace(windowId)) {
    await SpacesManager.closeSpace(windowId);
    const isLastWindow = (await chrome.windows.getAll()).length <= 1;
    if (isLastWindow) {
      await SpacesManager.handleShutdown();
    }
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    try {
      switch (request.action) {
        case "getAllSpaces":
          sendResponse(SpacesManager.getAllSpaces());
          break;
        case "renameSpace":
          sendResponse(await SpacesManager.renameSpace(request.windowId, request.name));
          break;
        case "windowExists":
          sendResponse(await SpacesManager._windowExists(Number(request.windowId)));
          break;
        case "getDebugData":
          sendResponse({
            currentState: {
              spaces: SpacesManager._spaces,
              closedSpaces: SpacesManager._closedSpaces,
              lastKnownState: SpacesManager._lastKnownState
            }
          });
          break;
      }
    } catch (error) {
      console.error(`Error handling ${request.action}:`, error);
      sendResponse({ error: error.message });
    }
  })();
  return true;
});

/**
 * Initialize new windows with spaces
 */
async function initializeNewWindows() {
  const windows = await chrome.windows.getAll({ populate: true });
  for (const window of windows) {
    if (!SpacesManager.hasSpace(window.id)) {
      await SpacesManager.createSpace(window.id, window.tabs);
    }
  }
}
