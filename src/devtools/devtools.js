// Create performance panel in Chrome DevTools
chrome.devtools.panels.create(
  'Performance',
  null, // No icon path
  'performance-panel.html',
  (panel) => {
    panel.onShown.addListener(function(window) {
      // Initialize panel when shown
      chrome.runtime.sendMessage({
        type: 'devtools-panel-shown',
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    });

    panel.onHidden.addListener(function() {
      // Cleanup when panel is hidden
      chrome.runtime.sendMessage({
        type: 'devtools-panel-hidden',
        tabId: chrome.devtools.inspectedWindow.tabId
      });
    });
  }
);

// Create background page connection
let backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools'
});

backgroundPageConnection.postMessage({
  type: 'init',
  tabId: chrome.devtools.inspectedWindow.tabId
});

// Forward messages from background page to panel
backgroundPageConnection.onMessage.addListener(function(message) {
  if (message.type === 'performance-update') {
    chrome.runtime.sendMessage({
      type: 'performance-data',
      data: message.data
    });
  }
});

// Listen for errors in the inspected window
chrome.devtools.inspectedWindow.onResourceContentCommitted.addListener(
  function(resource, content) {
    backgroundPageConnection.postMessage({
      type: 'resource-update',
      resource: resource.url,
      tabId: chrome.devtools.inspectedWindow.tabId
    });
  }
);