/**
 * Chrome Spaces - Window Management Extension
 * Background service worker that manages window spaces and their states
 */

// Constants
const DEFAULT_SPACE_NAME = "Untitled Space";
const STORAGE_KEY = "chrome_spaces";
const MESSAGE_TIMEOUT = 5000; // 5 seconds timeout for message operations

/**
 * Simple logger for development and debugging
 */
const log = (type, message, data) => {
  console.log(`[${type}] ${message}`, data || '');
};

/**
 * SpacesManager - Handles storage and state management for spaces
 */
const SpacesManager = {
  _spaces: {},
  _closedSpaces: {},
  _initialized: false,
  _lastKnownState: { activeWindows: {} },
  
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

  async _saveToStorage() {
    const data = {
      spaces: this._spaces,
      closedSpaces: this._closedSpaces,
      lastKnownState: this._lastKnownState,
      lastModified: Date.now()
    };

    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  },

  async createSpace(windowId, tabs = []) {
    const windowIdStr = String(windowId);
    this._spaces[windowIdStr] = {
      id: windowId,
      name: DEFAULT_SPACE_NAME,
      urls: tabs.map(tab => tab.url || '').filter(Boolean),
      lastModified: Date.now()
    };
    await this._saveToStorage();
  },

  async updateSpaceTabs(windowId, tabs) {
    const windowIdStr = String(windowId);
    if (this._spaces[windowIdStr]) {
      this._spaces[windowIdStr].urls = tabs.map(tab => tab.url || '').filter(Boolean);
      this._spaces[windowIdStr].lastModified = Date.now();
      await this._saveToStorage();
    }
  },

  async closeSpace(windowId) {
    const windowIdStr = String(windowId);
    if (this._spaces[windowIdStr]) {
      try {
        const window = await chrome.windows.get(windowId, { populate: true });
        const activeSpace = this._spaces[windowIdStr];
        this._closedSpaces[windowIdStr] = {
          id: windowId,
          name: activeSpace.name,
          urls: window.tabs.map(tab => tab.url || '').filter(Boolean),
          lastModified: Date.now()
        };
        
        delete this._spaces[windowIdStr];
        await this._saveToStorage();
      } catch (error) {
        console.error(`Error closing space ${windowId}:`, error);
        // Fallback preservation
        const activeSpace = this._spaces[windowIdStr];
        this._closedSpaces[windowIdStr] = {
          id: windowId,
          name: activeSpace.name,
          urls: activeSpace.urls || [],
          lastModified: Date.now()
        };
        delete this._spaces[windowIdStr];
        await this._saveToStorage();
      }
    }
  },

  async renameSpace(windowId, name) {
    const windowIdStr = String(windowId);
    if (this._spaces[windowIdStr]) {
      this._spaces[windowIdStr].name = name;
      this._spaces[windowIdStr].lastModified = Date.now();
      await this._saveToStorage();
      return true;
    }
    return false;
  },

  getAllSpaces() {
    return {
      spaces: this._spaces,
      closedSpaces: this._closedSpaces
    };
  },

  hasSpace(windowId) {
    return !!this._spaces[String(windowId)];
  },

  async removeClosedSpace(spaceId) {
    const spaceIdStr = String(spaceId);
    if (this._closedSpaces[spaceIdStr]) {
      delete this._closedSpaces[spaceIdStr];
      await this._saveToStorage();
      return true;
    }
    return false;
  },

  async _windowExists(windowId) {
    try {
      await chrome.windows.get(Number(windowId));
      return true;
    } catch {
      return false;
    }
  }
};

// Ensure windows and spaces stay synchronized
async function synchronizeWindowsAndSpaces() {
  if (!SpacesManager._initialized) {
    await SpacesManager.initialize();
  }

  try {
    // Get all current windows
    const windows = await chrome.windows.getAll({ populate: true });
    const currentWindowIds = new Set(windows.map(w => String(w.id)));
    
    // Clean up spaces for windows that no longer exist
    for (const windowId of Object.keys(SpacesManager._spaces)) {
      if (!currentWindowIds.has(windowId)) {
        await SpacesManager.closeSpace(Number(windowId));
      }
    }
    
    // Create spaces for windows that don't have them
    for (const window of windows) {
      const windowId = String(window.id);
      if (!SpacesManager._spaces[windowId]) {
        // Wait for tabs to be fully loaded
        await new Promise(resolve => setTimeout(resolve, 500));
        const tabs = await chrome.tabs.query({ windowId: window.id });
        await SpacesManager.createSpace(window.id, tabs);
      }
    }

    await SpacesManager._saveToStorage();
  } catch (error) {
    console.error('Error synchronizing windows and spaces:', error);
  }
}

// Event Listeners
chrome.runtime.onStartup.addListener(async () => {
  log('startup', 'Chrome Spaces initializing');
  try {
    // Initialize first
    await SpacesManager.initialize();
    
    // Wait a bit for Chrome to settle
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Then synchronize
    await synchronizeWindowsAndSpaces();
    
    // Do a second sync after a delay to catch any late changes
    setTimeout(async () => {
      await synchronizeWindowsAndSpaces();
      
      // Set up periodic sync
      setInterval(synchronizeWindowsAndSpaces, 60000);
      
      // Notify that initialization is complete
      chrome.runtime.sendMessage({
        type: 'spaces-updated',
        action: 'initialized'
      }).catch(() => {
        // Ignore errors if popup is closed
      });
    }, 5000);
  } catch (error) {
    console.error('Startup error:', error);
  }
});

// Add delayed check for missed windows
async function checkForMissedWindows() {
  try {
    const windows = await chrome.windows.getAll({ populate: true });
    for (const window of windows) {
      const windowId = String(window.id);
      if (!SpacesManager._spaces[windowId]) {
        log('recovery', `Found missed window ${windowId}, creating space`);
        await ensureWindowHasSpace(window);
      }
    }
  } catch (error) {
    console.error('Error checking for missed windows:', error);
  }
}

// Also initialize on session restore
chrome.runtime.onSessionRestore?.addListener(async () => {
  log('startup', 'Restoring from previous session');
  await SpacesManager.initialize();
  await synchronizeWindowsAndSpaces();
  
  // Double check after a delay to catch any restored windows
  setTimeout(checkForMissedWindows, 5000);
});

// Check on installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
  log('install', `Extension ${details.reason}`, details);
  await SpacesManager.initialize();
  if (details.reason === 'install') {
    // Wait for Chrome to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    await synchronizeWindowsAndSpaces();
  }
});

// Tab update tracking
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Create space if window doesn't have one
  if (!SpacesManager.hasSpace(tab.windowId)) {
    const window = await chrome.windows.get(tab.windowId, { populate: true });
    await ensureWindowHasSpace(window);
  }
  
  // Update tabs when URL changes
  if (changeInfo.url) {
    const tabs = await chrome.tabs.query({ windowId: tab.windowId });
    await SpacesManager.updateSpaceTabs(tab.windowId, tabs);
  }
});

// Ensure every window has an active space
async function ensureWindowHasSpace(window) {
  const windowId = String(window.id);
  
  // If space already exists, return
  if (SpacesManager._spaces[windowId]) {
    return;
  }

  // Create space immediately with any available tabs
  const tabs = await chrome.tabs.query({ windowId: window.id });
  await SpacesManager.createSpace(window.id, tabs);

  // Notify that a new space was created
  chrome.runtime.sendMessage({
    type: 'spaces-updated',
    windowId: window.id,
    action: 'created'
  }).catch(() => {
    // Ignore errors if popup is closed
  });

  // Update tabs after a delay to catch any loading tabs
  setTimeout(async () => {
    const updatedTabs = await chrome.tabs.query({ windowId: window.id });
    await SpacesManager.updateSpaceTabs(window.id, updatedTabs);
  }, 1000);
}

// Window tracking
chrome.windows.onCreated.addListener(async (window) => {
  // Ensure we're initialized
  if (!SpacesManager._initialized) {
    await SpacesManager.initialize();
  }

  // Create space immediately
  await ensureWindowHasSpace(window);

  // Double check after a delay in case window creation was part of a restore
  setTimeout(async () => {
    try {
      const currentWindow = await chrome.windows.get(window.id, { populate: true });
      if (!SpacesManager._spaces[String(window.id)]) {
        await ensureWindowHasSpace(currentWindow);
      } else {
        // Update tabs in case they changed during window creation
        const tabs = await chrome.tabs.query({ windowId: window.id });
        await SpacesManager.updateSpaceTabs(window.id, tabs);
      }
    } catch (error) {
      console.error('Error in window creation follow-up:', error);
    }
  }, 2000);
});

// Check all windows on focus change
chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;

  // Ensure we're initialized
  if (!SpacesManager._initialized) {
    await SpacesManager.initialize();
  }

  try {
    const window = await chrome.windows.get(windowId);
    await ensureWindowHasSpace(window);
  } catch (error) {
    console.error('Error handling window focus:', error);
  }
});

// Watch for Chrome process state changes
chrome.runtime.onSuspend?.addListener(async () => {
  await SpacesManager.handleShutdown();
});

// Track window removal and creation
chrome.windows.onRemoved.addListener(async (windowId) => {
  // Ensure we're initialized
  if (!SpacesManager._initialized) {
    await SpacesManager.initialize();
  }

  if (SpacesManager.hasSpace(windowId)) {
    await SpacesManager.closeSpace(windowId);
    
    // Notify that a space was closed
    chrome.runtime.sendMessage({
      type: 'spaces-updated',
      windowId: windowId,
      action: 'closed'
    }).catch(() => {
      // Ignore errors if popup is closed
    });

    // Check if this was the last window and trigger shutdown if so
    const remainingWindows = await chrome.windows.getAll();
    if (remainingWindows.length === 0) {
      await SpacesManager.handleShutdown();
    } else {
      // Check other windows to ensure they have spaces
      for (const window of remainingWindows) {
        await ensureWindowHasSpace(window);
      }
    }
  }
});

// Also check on tab creation in case it's a new window being populated
chrome.tabs.onCreated.addListener(async (tab) => {
  if (!SpacesManager._spaces[String(tab.windowId)]) {
    const window = await chrome.windows.get(tab.windowId, { populate: true });
    await ensureWindowHasSpace(window);
  }
});

// Add periodic state verification
setInterval(async () => {
  if (SpacesManager._initialized) {
    const windows = await chrome.windows.getAll();
    const windowIds = new Set(windows.map(w => String(w.id)));
    
    // Create spaces for any windows that don't have them
    for (const window of windows) {
      if (!SpacesManager._spaces[String(window.id)]) {
        await ensureWindowHasSpace(window);
      }
    }
    
    // Clean up spaces for windows that no longer exist
    for (const spaceId of Object.keys(SpacesManager._spaces)) {
      if (!windowIds.has(spaceId)) {
        await SpacesManager.closeSpace(Number(spaceId));
      }
    }
  }
}, 5000);  // Check more frequently to ensure no window is ever without a space

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const messageHandler = async () => {
    try {
      let response;
      
      switch (request.action) {
        case "getAllSpaces":
          response = SpacesManager.getAllSpaces();
          break;

        case "renameSpace":
          response = await SpacesManager.renameSpace(request.windowId, request.name);
          break;

        case "windowExists":
          response = await SpacesManager._windowExists(Number(request.windowId));
          break;

        case "closeSpace":
          const windowId = Number(request.windowId);
          if (SpacesManager.hasSpace(windowId)) {
            await SpacesManager.closeSpace(windowId);
            await chrome.windows.remove(windowId);
            response = true;
          } else {
            response = false;
          }
          break;

        case "removeClosedSpace":
          response = await SpacesManager.removeClosedSpace(request.spaceId);
          break;

        case "switchToSpace":
          const targetWindowId = Number(request.windowId);
          
          try {
            // First check if window still exists
            const windowExists = await SpacesManager._windowExists(targetWindowId);
            if (!windowExists) {
              throw new Error('Target window no longer exists');
            }

            // Verify space exists for the window
            if (!SpacesManager.hasSpace(targetWindowId)) {
              const window = await chrome.windows.get(targetWindowId, { populate: true });
              await ensureWindowHasSpace(window);
            }

            // Focus the window
            await chrome.windows.update(targetWindowId, { focused: true });
            
            // Verify all spaces after switch
            const windows = await chrome.windows.getAll();
            for (const window of windows) {
              await ensureWindowHasSpace(window);
            }

            response = {
              success: true,
              spaces: SpacesManager.getAllSpaces()
            };
          } catch (error) {
            console.error('Error switching to space:', error);
            response = { 
              success: false, 
              error: error.message,
              spaces: SpacesManager.getAllSpaces()
            };
          }
          break;
          
        case "restoreSpace":
          const closedSpace = SpacesManager._closedSpaces[String(request.spaceId)];
          if (!closedSpace?.urls.length) {
            response = false;
            break;
          }

          try {
            // Create window with first tab
            const newWindow = await chrome.windows.create({
              url: closedSpace.urls[0],
              focused: true
            });

            // Wait for first tab to load
            await new Promise((resolve) => {
              const firstTabLoadListener = (tabId, changeInfo, tab) => {
                if (tab.windowId === newWindow.id && changeInfo.status === 'complete') {
                  chrome.tabs.onUpdated.removeListener(firstTabLoadListener);
                  resolve();
                }
              };
              chrome.tabs.onUpdated.addListener(firstTabLoadListener);
              
              // Timeout after 30 seconds
              setTimeout(() => {
                chrome.tabs.onUpdated.removeListener(firstTabLoadListener);
                resolve();
              }, 30000);
            });

            // Create remaining tabs
            if (closedSpace.urls.length > 1) {
              for (const url of closedSpace.urls.slice(1)) {
                await chrome.tabs.create({
                  windowId: newWindow.id,
                  url: url,
                  active: false
                });
              }
            }
            
            // Create space with restored tabs
            const loadedTabs = await chrome.tabs.query({ windowId: newWindow.id });
            await SpacesManager.createSpace(newWindow.id, loadedTabs);
            SpacesManager._spaces[String(newWindow.id)].name = closedSpace.name;
            
            // Remove from closed spaces
            delete SpacesManager._closedSpaces[String(request.spaceId)];
            await SpacesManager._saveToStorage();
            
            response = { success: true, windowId: newWindow.id };
          } catch (error) {
            console.error('Error restoring space:', error);
            response = { success: false, error: error.message };
          }
          break;

        default:
          throw new Error(`Unknown action: ${request.action}`);
      }

      sendResponse(response);
    } catch (error) {
      console.error(`Error handling ${request.action}:`, error);
      sendResponse({ error: error.message });
    }
  };

  messageHandler().catch(error => {
    console.error('Message handling failed:', error);
    sendResponse({ error: error.message });
  });

  return true; // Will respond asynchronously
});
