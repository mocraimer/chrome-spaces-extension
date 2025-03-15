// State management
const state = {
  spaces: {},
  closedSpaces: {},
  currentWindowId: null,
  currentTabId: null,
  enterTargetSpace: null,
  selectedIndex: -1,
  updateListener: null
};

// DOM Elements
const elements = {
  searchInput: document.getElementById('search-input'),
  currentSpaceName: document.getElementById('current-space-name'),
  renameSpaceBtn: document.getElementById('rename-space-btn'),
  activeSpacesList: document.getElementById('active-spaces-list'),
  moveTabList: document.getElementById('move-tab-list')
};

/**
 * Space management utilities
 */
const SpaceUtils = {
  /**
   * Get all spaces that match the current search term, excluding current window
   * @returns {Array} Filtered list of spaces
   */
  getFilteredSpaces() {
    const searchTerm = elements.searchInput.value.toLowerCase();
    return [
      ...Object.values(state.spaces),
      ...Object.values(state.closedSpaces)
    ].filter(space => 
      space.name.toLowerCase().includes(searchTerm) && 
      Number(space.id) !== Number(state.currentWindowId)
    );
  },

  /**
   * Updates the selected space and visual highlighting
   * @param {number} newIndex - The index to select in the filtered spaces list
   */
  updateSelectedSpace(newIndex) {
    const filteredSpaces = this.getFilteredSpaces();
    if (filteredSpaces.length === 0) {
      state.selectedIndex = -1;
      state.enterTargetSpace = null;
      return;
    }

    // Ensure index is within bounds
    state.selectedIndex = Math.max(0, Math.min(newIndex, filteredSpaces.length - 1));
    state.enterTargetSpace = filteredSpaces[state.selectedIndex];

    // Update highlighting
    document.querySelectorAll('.space-item.enter-target').forEach(item => {
      item.classList.remove('enter-target');
    });
    
    const targetElement = document.querySelector(`.space-item[data-id="${state.enterTargetSpace.id}"]`);
    if (targetElement) {
      targetElement.classList.add('enter-target');
      // Ensure selected item is visible
      targetElement.scrollIntoView({ block: 'nearest' });
    }
  }
};

/**
 * Initialize popup
 */
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentWindowAndTab();
  await loadSpaces();
  setupEventListeners();
  await renderPopup();
  SpaceUtils.updateSelectedSpace(0);
});

// Cleanup on popup close
window.addEventListener('unload', () => {
  cleanupEventListeners();
});

/**
 * Data loading functions
 */
async function loadCurrentWindowAndTab() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    state.currentWindowId = Number(currentWindow.id);
    
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    state.currentTabId = Number(currentTab.id);
  } catch (error) {
    console.error('Error loading current window and tab:', error);
  }
}

async function loadSpaces() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });
    state.spaces = response.spaces || {};
    state.closedSpaces = response.closedSpaces || {};
    
    // Update current space name input
    if (state.spaces[String(state.currentWindowId)]) {
      elements.currentSpaceName.value = state.spaces[String(state.currentWindowId)].name;
    }
  } catch (error) {
    console.error('Error loading spaces:', error);
  }
}

/**
 * Event handling
 */
function setupEventListeners() {
  // Search input handler with debouncing
  const debounceTimeout = 150;
  let debounceTimer;
  
  elements.searchInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      await renderPopup();
      SpaceUtils.updateSelectedSpace(0);
    }, debounceTimeout);
  });

  // Keyboard navigation
  elements.searchInput.addEventListener('keydown', (e) => {
    const filteredSpaces = SpaceUtils.getFilteredSpaces();
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        SpaceUtils.updateSelectedSpace(state.selectedIndex === -1 ? filteredSpaces.length - 1 : state.selectedIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        SpaceUtils.updateSelectedSpace(state.selectedIndex === -1 ? 0 : state.selectedIndex + 1);
        break;
      case 'Enter':
        e.preventDefault();
        if (state.enterTargetSpace) {
          const spaceElement = document.querySelector(`.space-item[data-id="${state.enterTargetSpace.id}"]`);
          if (spaceElement) {
            // Find and click the switch/restore button
            const actionButton = spaceElement.querySelector('.switch-btn, .restore-btn');
            if (actionButton) {
              actionButton.click();
            }
          }
        }
        break;
    }
  });
  
  // Focus search input
  elements.searchInput.focus();
  
  // Rename space handler
  elements.renameSpaceBtn.addEventListener('click', async () => {
    const newName = elements.currentSpaceName.value.trim();
    if (newName) {
      await chrome.runtime.sendMessage({
        action: 'renameSpace',
        windowId: state.currentWindowId,
        name: newName
      });
      await loadSpaces();
      await renderPopup();
      SpaceUtils.updateSelectedSpace(0);
    }
  });

  // Set up event delegation for space actions
  setupSpaceEventDelegation();
  
  // Listen for space updates from background
  setupSpaceUpdateListener();
}

/**
 * Clean up event listeners and intervals
 */
function cleanupEventListeners() {
  if (state.updateListener) {
    clearInterval(state.updateListener);
    state.updateListener = null;
  }
  
  // Remove all delegated listeners
  elements.activeSpacesList.removeEventListener('click', handleSpaceClick);
  elements.moveTabList.removeEventListener('click', handleSpaceClick);
}

/**
 * Event delegation setup for space interactions
 */
function setupSpaceEventDelegation() {
  elements.activeSpacesList.addEventListener('click', handleSpaceClick);
  elements.moveTabList.addEventListener('click', handleSpaceClick);
  // Add context menu handler
  [elements.activeSpacesList, elements.moveTabList].forEach(list => {
    list.addEventListener('contextmenu', handleContextMenu);
  });
}

/**
 * Handle context menu for spaces
 */
function handleContextMenu(event) {
  event.preventDefault();
  const spaceItem = event.target.closest('.space-item');
  if (!spaceItem) return;

  const spaceId = spaceItem.dataset.id;
  if (!spaceId) return;

  // Create context menu
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.innerHTML = `
    <button class="context-menu-item">
      <span class="context-menu-icon">🗑️</span>
      <span class="context-menu-label">Delete Space</span>
    </button>
  `;

  // Position menu
  const rect = spaceItem.getBoundingClientRect();
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;

  // Adjust position if near window edges
  const menuRect = menu.getBoundingClientRect();
  if (menuRect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - menuRect.width - 5}px`;
  }
  if (menuRect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - menuRect.height - 5}px`;
  }

  // Add click handler for delete
  menu.querySelector('.context-menu-item').addEventListener('click', () => {
    handleSpaceDelete(spaceId);
    menu.remove();
  });

  // Close menu on outside click
  document.addEventListener('click', function closeMenu(e) {
    if (!menu.contains(e.target)) {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }
  });

  // Close menu on Escape
  document.addEventListener('keydown', function closeMenu(e) {
    if (e.key === 'Escape') {
      menu.remove();
      document.removeEventListener('keydown', closeMenu);
    }
  });

  document.body.appendChild(menu);
}

/**
 * Handle delegated space click events
 */
function handleSpaceClick(event) {
  const spaceItem = event.target.closest('.space-item');
  if (!spaceItem) return;

  const spaceId = spaceItem.dataset.id;
  
  // Handle action button click (switch/restore)
  if (event.target.matches('.switch-btn, .restore-btn')) {
    event.stopPropagation();
    handleSpaceAction(spaceId);
    return;
  }
  
  // Handle move tab button click
  if (event.target.matches('.move-tab-btn')) {
    event.stopPropagation();
    handleMoveTab(spaceId);
    return;
  }
  
  // Handle space item click (same as clicking action button)
  const actionBtn = spaceItem.querySelector('.switch-btn, .restore-btn');
  if (actionBtn) {
    actionBtn.click();
  }
}

/**
 * Set up background updates listener
 */
function setupSpaceUpdateListener() {
  // Remove any existing listener
  if (state.updateListener) {
    clearInterval(state.updateListener);
  }
  
  // Set up new listener for space updates
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'spaces-updated') {
      loadSpaces().then(() => renderPopup());
    }
  });
}

/**
 * Render the popup UI
 */
async function renderPopup() {
  const searchTerm = elements.searchInput.value.toLowerCase();
  const allSpaces = SpaceUtils.getFilteredSpaces();

  // Clear existing content
  elements.activeSpacesList.innerHTML = '';
  elements.moveTabList.innerHTML = '';
  
  // Show empty state if no spaces found
  if (allSpaces.length === 0) {
    elements.activeSpacesList.innerHTML = '<li class="empty-list">No spaces found</li>';
    elements.moveTabList.innerHTML = '<li class="empty-list">No other spaces available</li>';
    return;
  }

  // Create document fragments for better performance
  const spacesFragment = document.createDocumentFragment();
  const moveFragment = document.createDocumentFragment();

  // Create all elements in parallel
  const [spaceElements, moveElements] = await Promise.all([
    Promise.all(allSpaces.map(createSpaceElement)),
    Promise.all(allSpaces
      .filter(space => Number(space.id) !== Number(state.currentWindowId))
      .map(createMoveTabElement))
  ]);

  // Add space elements to fragment
  spaceElements.filter(Boolean).forEach(element => {
    spacesFragment.appendChild(element);
  });

  // Add move elements to fragment
  moveElements.filter(Boolean).forEach(element => {
    moveFragment.appendChild(element);
  });

  // Add fragments to DOM
  elements.activeSpacesList.appendChild(spacesFragment);
  elements.moveTabList.appendChild(moveFragment);
}

/**
 * UI Element Creation
 */
async function createSpaceElement(space) {
  const isCurrentSpace = Number(space.id) === Number(state.currentWindowId);
  const isActive = String(space.id) in state.spaces;
  const windowExists = await chrome.runtime.sendMessage({
    action: 'windowExists',
    windowId: Number(space.id)
  });
  
  const spaceItem = document.createElement('li');
  spaceItem.className = `space-item ${isCurrentSpace ? 'active' : ''} ${isActive ? 'active-space' : 'closed-space'}`;
  spaceItem.dataset.id = space.id;
  spaceItem.dataset.type = windowExists ? 'switch' : 'restore';
  
  spaceItem.innerHTML = `
    <span class="space-icon">${isActive ? '🖥️' : '📁'}</span>
    <span class="space-name">${escapeHtml(space.name)}</span>
    <div class="space-info">${space.urls?.length || 0} tabs</div>
    ${!isCurrentSpace ? `
      <div class="space-actions">
        <button class="${windowExists ? 'switch-btn' : 'restore-btn'}" data-id="${space.id}">
          ${windowExists ? 'Switch' : 'Restore'}
        </button>
      </div>
    ` : ''}
  `;
  
  return spaceItem;
}

async function createMoveTabElement(space) {
  const windowExists = await chrome.runtime.sendMessage({
    action: 'windowExists',
    windowId: Number(space.id)
  });

  const spaceItem = document.createElement('li');
  spaceItem.className = 'space-item';
  spaceItem.dataset.id = space.id;
  spaceItem.dataset.type = 'move';
  
  spaceItem.innerHTML = `
    <span class="space-icon">${windowExists ? '🖥️' : '📁'}</span>
    <span class="space-name">${escapeHtml(space.name)}</span>
    <div class="space-actions">
      <button class="move-tab-btn" data-id="${space.id}">
        Move to ${windowExists ? 'Window' : 'New Window'}
      </button>
    </div>
  `;
  
  return spaceItem;
}

/**
 * Space Action Handlers
 */
async function handleSpaceDelete(spaceId) {
  const space = state.spaces[String(spaceId)] || state.closedSpaces[String(spaceId)];
  if (!space) return;
  
  try {
    const isActive = String(spaceId) in state.spaces;
    
    // If it's an active space, close its window first
    if (isActive) {
      const windowExists = await chrome.runtime.sendMessage({
        action: 'windowExists',
        windowId: Number(spaceId)
      });

      if (windowExists) {
        await chrome.runtime.sendMessage({
          action: 'closeSpace',
          windowId: Number(spaceId)
        });
      }
    }
    
    // Then remove from storage
    await chrome.runtime.sendMessage({
      action: 'removeClosedSpace',
      spaceId: String(spaceId)
    });

    showNotification(`Space "${space.name}" deleted`);
    
    // Reload and re-render
    await loadSpaces();
    await renderPopup();
    SpaceUtils.updateSelectedSpace(0);

    // If we just deleted the current window's space, close the popup since window will be closed
    if (Number(spaceId) === Number(state.currentWindowId)) {
      window.close();
    }
  } catch (error) {
    console.error('Error deleting space:', error);
    showNotification(`Failed to delete space "${space.name}"`, true);
  }
}

async function handleSpaceAction(spaceId) {
  const space = state.spaces[String(spaceId)] || state.closedSpaces[String(spaceId)];
  if (!space) return;

  const windowExists = await chrome.runtime.sendMessage({
    action: 'windowExists',
    windowId: Number(spaceId)
  });

  const action = windowExists ? 'switchToSpace' : 'restoreSpace';
  const payload = windowExists ? 
    { windowId: Number(spaceId) } : 
    { spaceId: String(spaceId) };

  try {
    const result = await chrome.runtime.sendMessage({
      action: action,
      ...payload
    });

    if (action === 'switchToSpace') {
      if (result.success) {
        // Update state with latest spaces
        state.spaces = result.spaces.spaces;
        state.closedSpaces = result.spaces.closedSpaces;
        await renderPopup();
        showNotification(`Switched to space "${space.name}"`);
        setTimeout(() => window.close(), 500);
      } else {
        throw new Error(result.error || 'Switch failed');
      }
    } else if (result.success) {
      window.close();
    } else {
      throw new Error('Action failed');
    }
  } catch (error) {
    console.error(`Error with space action:`, error);
    showNotification(`Failed to ${windowExists ? 'switch to' : 'restore'} space "${space.name}"`, true);
  }
}

async function handleMoveTab(spaceId) {
  const space = state.spaces[String(spaceId)] || state.closedSpaces[String(spaceId)];
  if (!space) return;

  try {
    const result = await chrome.runtime.sendMessage({
      action: 'moveTabToSpace',
      tabId: state.currentTabId,
      targetSpaceId: Number(spaceId)
    });
    
    if (result) {
      showNotification(`Tab moved to ${space.name}`);
      setTimeout(() => window.close(), 1000);
    } else {
      throw new Error('Move failed');
    }
  } catch (error) {
    console.error('Error moving tab:', error);
    showNotification(`Failed to move tab to ${space.name}`, true);
  }
}

/**
 * Notification Management
 */
const NotificationManager = {
  queue: [],
  maxVisible: 3,
  animationDuration: 500,
  displayDuration: 3000,
  container: null,

  /**
   * Initialize notification container
   */
  init() {
    this.container = document.createElement('div');
    this.container.className = 'notification-container';
    document.body.appendChild(this.container);
    
    // Add styles if not already present
    if (!document.getElementById('notification-styles')) {
      const styles = document.createElement('style');
      styles.id = 'notification-styles';
      styles.textContent = `
        .notification-container {
          position: fixed;
          bottom: 16px;
          right: 16px;
          display: flex;
          flex-direction: column-reverse;
          gap: 8px;
          z-index: 1000;
        }
        .notification {
          padding: 8px 16px;
          border-radius: 4px;
          background-color: var(--secondary-color, #34a853);
          color: white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          opacity: 0;
          transform: translateX(100%);
          transition: opacity 0.3s, transform 0.3s;
          margin: 0;
          max-width: 300px;
        }
        .notification.error {
          background-color: var(--error-color, #ea4335);
        }
        .notification.visible {
          opacity: 1;
          transform: translateX(0);
        }
        /* Context Menu Styles */
        .context-menu {
          position: fixed;
          background: var(--background-primary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
          padding: 4px 0;
          z-index: 1000;
          min-width: 150px;
        }
        .context-menu-item {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          width: 100%;
          border: none;
          background: none;
          color: var(--text-primary);
          cursor: pointer;
          text-align: left;
          font-size: 14px;
        }
        .context-menu-item:hover {
          background: var(--background-secondary);
        }
        .context-menu-icon {
          margin-right: 8px;
        }
      `;
      document.head.appendChild(styles);
    }
  },

  /**
   * Add notification to queue and display if possible
   */
  show(message, isError = false) {
    const notification = {
      message,
      isError,
      element: null,
      timeoutId: null
    };

    this.queue.push(notification);
    this._processQueue();
  },

  /**
   * Process notification queue
   */
  _processQueue() {
    // Count visible notifications
    const visibleCount = Array.from(this.container.children).length;

    // Show notifications if space available
    while (this.queue.length > 0 && visibleCount < this.maxVisible) {
      const notification = this.queue.shift();
      this._displayNotification(notification);
    }
  },

  /**
   * Display a single notification
   */
  _displayNotification(notification) {
    const element = document.createElement('div');
    element.className = `notification${notification.isError ? ' error' : ''}`;
    element.textContent = notification.message;
    notification.element = element;

    this.container.appendChild(element);
    
    // Trigger animation
    requestAnimationFrame(() => {
      element.classList.add('visible');
    });

    // Set removal timeout
    notification.timeoutId = setTimeout(() => {
      element.classList.remove('visible');
      setTimeout(() => {
        element.remove();
        this._processQueue();
      }, this.animationDuration);
    }, this.displayDuration);
  },

  /**
   * Clean up notifications
   */
  cleanup() {
    this.queue = [];
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
};

/**
 * Initialize notification manager
 */
document.addEventListener('DOMContentLoaded', () => {
  NotificationManager.init();
});

// Clean up on unload
window.addEventListener('unload', () => {
  NotificationManager.cleanup();
});

/**
 * Show notification wrapper
 */
function showNotification(message, isError = false) {
  NotificationManager.show(message, isError);
}

/**
 * HTML escape utility
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
