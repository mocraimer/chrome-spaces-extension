// State
let spaces = {};
let closedSpaces = {};
let currentWindowId = null;
let currentTabId = null;

// DOM Elements
const searchInput = document.getElementById('search-input');
const currentSpaceName = document.getElementById('current-space-name');
const renameSpaceBtn = document.getElementById('rename-space-btn');
const activeSpacesList = document.getElementById('active-spaces-list');
const closedSpacesList = document.getElementById('closed-spaces-list');
const moveTabList = document.getElementById('move-tab-list');

// Track target space for enter key
let enterTargetSpace = null;
let selectedIndex = -1; // Track selected space index

/**
 * Get all spaces that match the current search term, excluding current window
 * @returns {Array} Filtered list of spaces
 */
function getFilteredSpaces() {
  const searchTerm = searchInput.value.toLowerCase();
  return [
    ...Object.values(spaces),
    ...Object.values(closedSpaces)
  ].filter(space => 
    space.name.toLowerCase().includes(searchTerm) && 
    space.id !== currentWindowId
  );
}

/**
 * Updates the selected space and visual highlighting
 * @param {number} newIndex - The index to select in the filtered spaces list
 */
function updateSelectedSpace(newIndex) {
  const filteredSpaces = getFilteredSpaces();
  if (filteredSpaces.length === 0) {
    selectedIndex = -1;
    enterTargetSpace = null;
    return;
  }

  // Ensure index is within bounds
  selectedIndex = Math.max(0, Math.min(newIndex, filteredSpaces.length - 1));
  enterTargetSpace = filteredSpaces[selectedIndex];

  // Update highlighting
  document.querySelectorAll('.space-item.enter-target').forEach(item => {
    item.classList.remove('enter-target');
  });
  
  const targetElement = document.querySelector(`.space-item[data-id="${enterTargetSpace.id}"]`);
  if (targetElement) {
    targetElement.classList.add('enter-target');
    // Ensure selected item is visible
    targetElement.scrollIntoView({ block: 'nearest' });
  }
}

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  await loadCurrentWindowAndTab();
  await loadSpaces();
  setupEventListeners();
  await renderSpaces();
  updateSelectedSpace(0);
});

// Load current window and tab
async function loadCurrentWindowAndTab() {
  try {
    const currentWindow = await chrome.windows.getCurrent();
    currentWindowId = currentWindow.id;
    
    const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTabId = currentTab.id;
  } catch (error) {
    console.error('Error loading current window and tab:', error);
  }
}

// Load spaces from background script
async function loadSpaces() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getAllSpaces' });
    spaces = response.spaces || {};
    closedSpaces = response.closedSpaces || {};
    
    // Update current space name input
    if (spaces[currentWindowId]) {
      currentSpaceName.value = spaces[currentWindowId].name;
    }
  } catch (error) {
    console.error('Error loading spaces:', error);
  }
}

/**
 * Switches to the currently selected space in the list
 * This is used by both click handlers and keyboard navigation
 */
function switchToFirstMatchingSpace() {
  if (enterTargetSpace) {
    const spaceElement = document.querySelector(`.space-item[data-id="${enterTargetSpace.id}"] button`);
    if (spaceElement) {
      spaceElement.click();
    }
  }
}

// Set up event listeners
function setupEventListeners() {
  // Search input
  searchInput.addEventListener('input', async () => {
    await renderSpaces();
    updateSelectedSpace(0);
  });

  searchInput.addEventListener('keydown', (e) => {
    const filteredSpaces = getFilteredSpaces();
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        updateSelectedSpace(selectedIndex === -1 ? filteredSpaces.length - 1 : selectedIndex - 1);
        break;
      case 'ArrowDown':
        e.preventDefault();
        updateSelectedSpace(selectedIndex === -1 ? 0 : selectedIndex + 1);
        break;
      case 'Enter':
        if (enterTargetSpace) {
          switchToFirstMatchingSpace();
        }
        break;
    }
  });
  
  // Ensure search input is focused
  searchInput.focus();
  
  // Rename button
  renameSpaceBtn.addEventListener('click', async () => {
    const newName = currentSpaceName.value.trim();
    if (newName) {
      await chrome.runtime.sendMessage({
        action: 'renameSpace',
        windowId: currentWindowId,
        name: newName
      });
      await loadSpaces();
      await renderSpaces();
      updateSelectedSpace(0);
    }
  });
}

/**
 * Renders all spaces sections (active, closed, and move tab options)
 * Should be called whenever the space list needs to be updated
 */
async function renderSpaces() {
  const searchTerm = searchInput.value.toLowerCase();
  
  // Render active spaces
  await renderActiveSpaces(searchTerm);
  
  // Render closed spaces
  renderClosedSpaces(searchTerm);
  
  // Render move tab options
  await renderMoveTabOptions(searchTerm);
}

/**
 * Renders the main spaces list including both active and closed spaces
 * @param {string} searchTerm - Current search filter text
 */
async function renderActiveSpaces(searchTerm) {
  activeSpacesList.innerHTML = '';
  
  // Get all spaces
  const allSpaces = [
    ...Object.values(spaces),
    ...Object.values(closedSpaces)
  ].filter(space => space.name.toLowerCase().includes(searchTerm));
  
  if (allSpaces.length === 0) {
    activeSpacesList.innerHTML = '<li class="empty-list">No spaces found</li>';
    return;
  }
  
  console.log('Available spaces:', allSpaces);
  
  for (const space of allSpaces) {
    const isCurrentSpace = space.id === currentWindowId;
    const isActive = space.id in spaces; // Check if space is in active spaces
    const windowExists = await chrome.runtime.sendMessage({
      action: 'windowExists',
      windowId: space.id
    });
    
    const spaceItem = document.createElement('li');
    spaceItem.className = `space-item ${isCurrentSpace ? 'active' : ''} ${isActive ? 'active-space' : 'closed-space'}`;
    spaceItem.dataset.id = space.id;
    spaceItem.innerHTML = `
      <span class="space-icon">${isActive ? '🖥️' : '📁'}</span>
      <span class="space-name">${escapeHtml(space.name)}</span>
      <div class="space-info">${space.urls?.length || 0} tabs</div>
      ${!isCurrentSpace ? `
        <div class="space-actions">
          <button class="delete-btn" title="Delete Space">×</button>
          <button class="${windowExists ? 'switch-btn' : 'restore-btn'}" data-id="${space.id}">
            ${windowExists ? 'Switch' : 'Restore'}
          </button>
        </div>
      ` : ''}
    `;
    
      // Add event listeners for buttons
      if (!isCurrentSpace) {
        const deleteBtn = spaceItem.querySelector('.delete-btn');
        const actionBtn = spaceItem.querySelector('.switch-btn, .restore-btn');
        
        // Delete button handler
        deleteBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          
          // Check if the space is active or closed
          const isActive = space.id in spaces;
          
          if (isActive) {
            // For active spaces, close the window first
            const closeResult = await chrome.runtime.sendMessage({
              action: 'closeSpace',
              windowId: space.id
            });
            
            if (!closeResult) {
              // Show error notification
              const notification = document.createElement('div');
              notification.className = 'notification error';
              notification.textContent = `Failed to close space "${space.name}"`;
              document.body.appendChild(notification);
              setTimeout(() => notification.remove(), 3000);
              return;
            }
          }
          
          // Then remove from spaces (whether it was active or closed)
          const removeResult = await chrome.runtime.sendMessage({
            action: 'removeClosedSpace',
            spaceId: space.id
          });
          
          if (removeResult) {
            // Show success notification
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.textContent = `Space "${space.name}" deleted`;
            document.body.appendChild(notification);
            
            // Refresh the UI
            await loadSpaces();
            await renderSpaces();
            updateSelectedSpace(0);
            
            // Remove notification after delay
            setTimeout(() => notification.remove(), 3000);
          } else {
            // Show error notification
            const notification = document.createElement('div');
            notification.className = 'notification error';
            notification.textContent = `Failed to delete space "${space.name}"`;
            document.body.appendChild(notification);
            setTimeout(() => notification.remove(), 3000);
          }
        });
      actionBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        console.log(`Action clicked for space:`, {
          name: space.name,
          id: space.id,
          isActive,
          urls: space.urls
        });
        
        const result = await chrome.runtime.sendMessage({
          action: windowExists ? 'switchToSpace' : 'restoreSpace',
          [windowExists ? 'windowId' : 'spaceId']: space.id
        });
        
        console.log('Action result:', result);
        
        if (result) {
          if (!isActive) {
            await loadSpaces();
            await renderSpaces();
            updateSelectedSpace(0);
          } else {
            window.close();
          }
        } else {
          console.error('Action failed for space:', space.name);
        }
      });
      
      // Add event listener for clicking on the item (same as button)
      spaceItem.addEventListener('click', () => actionBtn.click());
    }
    
    activeSpacesList.appendChild(spaceItem);
  }
}

// Empty function to maintain compatibility
function renderClosedSpaces() {}

// Render move tab options
async function renderMoveTabOptions(searchTerm) {
  moveTabList.innerHTML = '';
  
  const allSpaces = [
    ...Object.values(spaces).filter(space => space.id !== currentWindowId),
    ...Object.values(closedSpaces)
  ].filter(space => space.name.toLowerCase().includes(searchTerm));
  
  if (allSpaces.length === 0) {
    moveTabList.innerHTML = '<li class="empty-list">No other spaces available</li>';
    return;
  }
  
  for (const space of allSpaces) {
    const windowExists = await chrome.runtime.sendMessage({
      action: 'windowExists',
      windowId: space.id
    });

    const spaceItem = document.createElement('li');
    spaceItem.className = 'space-item';
    spaceItem.innerHTML = `
      <span class="space-icon">${windowExists ? '🖥️' : '📁'}</span>
      <span class="space-name">${escapeHtml(space.name)}</span>
      <div class="space-actions">
        <button class="move-tab-btn" data-id="${space.id}">Move to ${windowExists ? 'Window' : 'New Window'}</button>
      </div>
    `;
    
    // Add event listener for moving tab
    spaceItem.querySelector('.move-tab-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      const result = await chrome.runtime.sendMessage({
        action: 'moveTabToSpace',
        tabId: currentTabId,
        targetSpaceId: space.id
      });
      
      if (result) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = `Tab moved to ${space.name}`;
        document.body.appendChild(notification);
        
        // Close popup with delay to show notification
        setTimeout(() => {
          window.close();
        }, 1000);
      } else {
        const notification = document.createElement('div');
        notification.className = 'notification error';
        notification.textContent = `Failed to move tab to ${space.name}`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      }
    });
    
    moveTabList.appendChild(spaceItem);
  }
}

// Helper function to escape HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
