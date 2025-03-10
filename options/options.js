// Helper functions for formatting
function formatTimestamp(isoString) {
  return new Date(isoString).toLocaleString();
}

function formatJSON(obj) {
  return JSON.stringify(obj, null, 2);
}

// Debug data management
async function refreshDebugData() {
  const response = await chrome.runtime.sendMessage({ action: "getDebugData" });
  
  if (response.currentState) {
    document.getElementById('current-state').textContent = formatJSON(response.currentState);
  } else {
    document.getElementById('current-state').textContent = 'No state data available';
  }
}

// Settings management
function showNotification(message, isError = false) {
  const notification = document.createElement('div');
  notification.className = `notification${isError ? ' error' : ''}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 500);
  }, 3000);
}

// Event listeners for debug features
document.getElementById('refresh-debug').addEventListener('click', refreshDebugData);


// Keyboard shortcut navigation
document.getElementById('go-to-shortcuts').addEventListener('click', () => {
  chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
});

// Settings persistence
document.getElementById('save-settings').addEventListener('click', async () => {
  // Save settings logic will be implemented here
  showNotification('Settings saved successfully');
});

document.getElementById('reset-settings').addEventListener('click', async () => {
  // Reset settings logic will be implemented here
  showNotification('Settings reset to defaults');
});

// Export current state
document.getElementById('export-data').addEventListener('click', async () => {
  const response = await chrome.runtime.sendMessage({ action: "getDebugData" });
  const data = new Blob([formatJSON(response.currentState)], { type: 'application/json' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'chrome-spaces-state.json';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('import-data').addEventListener('click', () => {
  document.getElementById('import-file').click();
});

// Load and display closed spaces
async function loadClosedSpaces() {
  const response = await chrome.runtime.sendMessage({ action: "getAllSpaces" });
  const closedSpaces = response.closedSpaces || {};
  const closedSpacesList = document.getElementById('closed-spaces-list');
  closedSpacesList.innerHTML = '';

  if (Object.keys(closedSpaces).length === 0) {
    closedSpacesList.innerHTML = '<p>No closed spaces available</p>';
    return;
  }

  for (const [spaceId, space] of Object.entries(closedSpaces)) {
    const spaceElement = document.createElement('div');
    spaceElement.className = 'closed-space-item';
    spaceElement.innerHTML = `
      <div class="closed-space-info">
        <h3>${space.name}</h3>
        <p>${space.urls.length} tabs · Closed ${formatTimestamp(space.lastModified)}</p>
      </div>
      <div class="closed-space-actions">
        <button class="restore-button" data-space-id="${spaceId}">Restore Space</button>
      </div>
    `;
    closedSpacesList.appendChild(spaceElement);

    // Add restore functionality
    const restoreButton = spaceElement.querySelector('.restore-button');
    restoreButton.addEventListener('click', async () => {
      try {
        const success = await chrome.runtime.sendMessage({
          action: "restoreSpace",
          spaceId: spaceId
        });

        if (success) {
          showNotification('Space restored successfully');
          loadClosedSpaces(); // Refresh the list
        } else {
          showNotification('Failed to restore space', true);
        }
      } catch (error) {
        console.error('Error restoring space:', error);
        showNotification('Error restoring space: ' + error.message, true);
      }
    });
  }
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  refreshDebugData();
  loadClosedSpaces();
});

// Refresh data periodically
setInterval(() => {
  loadClosedSpaces();
}, 5000); // Refresh every 5 seconds
