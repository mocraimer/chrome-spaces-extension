import React, { useState, useEffect } from 'react';

interface Space {
  id: string;
  name: string;
  urls: string[];
  windowId?: number;
}

const SimplePopup: React.FC = () => {
  // All hooks at the top level - no conditional hooks
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  // Initialize data
  useEffect(() => {
    const initializePopup = async () => {
      try {
        setIsLoading(true);
        
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        setCurrentWindowId(currentWindow.id || null);
        
        // Get all windows to create spaces
        const windows = await chrome.windows.getAll({ populate: true });
        const spacesList: Space[] = [];
        
        for (const window of windows) {
          if (window.tabs && window.tabs.length > 0) {
            const urls = window.tabs
              .filter(tab => tab.url && !tab.url.startsWith('chrome://'))
              .map(tab => tab.url!)
              .filter(Boolean);
            
            if (urls.length > 0) {
              spacesList.push({
                id: window.id!.toString(),
                name: `Window ${window.id}`,
                urls: urls,
                windowId: window.id
              });
            }
          }
        }
        
        setSpaces(spacesList);
        setError(null);
      } catch (err) {
        console.error('Failed to initialize popup:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setIsLoading(false);
      }
    };

    initializePopup();
  }, []);

  const handleSwitchToSpace = async (windowId: number) => {
    try {
      await chrome.windows.update(windowId, { focused: true });
      window.close();
    } catch (err) {
      console.error('Failed to switch to space:', err);
      setError(err instanceof Error ? err.message : 'Failed to switch');
    }
  };

  const handleCreateNewSpace = async () => {
    try {
      await chrome.windows.create({
        url: 'chrome://newtab',
        focused: true
      });
      window.close();
    } catch (err) {
      console.error('Failed to create new space:', err);
      setError(err instanceof Error ? err.message : 'Failed to create space');
    }
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1>Chrome Spaces</h1>
        </div>
        <div className="loading">
          <p>Loading spaces...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="popup-container">
        <div className="popup-header">
          <h1>Chrome Spaces</h1>
        </div>
        <div className="error">
          <p>Error: {error}</p>
          <button onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Render main content
  return (
    <div className="popup-container">
      <div className="popup-header">
        <h1>Chrome Spaces</h1>
        <button className="new-space-btn" onClick={handleCreateNewSpace}>
          + New Space
        </button>
      </div>
      
      <div className="spaces-list">
        {spaces.length === 0 ? (
          <div className="empty-state">
            <p>No spaces found</p>
            <button onClick={handleCreateNewSpace}>
              Create your first space
            </button>
          </div>
        ) : (
          spaces.map((space) => (
            <div 
              key={space.id} 
              className={`space-item ${space.windowId === currentWindowId ? 'current' : ''}`}
            >
              <div className="space-info">
                <h3>{space.name}</h3>
                <p>{space.urls.length} tab{space.urls.length !== 1 ? 's' : ''}</p>
                <div className="space-urls">
                  {space.urls.slice(0, 3).map((url, index) => (
                    <div key={index} className="url-preview">
                      {new URL(url).hostname}
                    </div>
                  ))}
                  {space.urls.length > 3 && (
                    <div className="url-preview">+{space.urls.length - 3} more</div>
                  )}
                </div>
              </div>
              
              <div className="space-actions">
                {space.windowId !== currentWindowId && (
                  <button 
                    onClick={() => handleSwitchToSpace(space.windowId!)}
                    className="switch-btn"
                  >
                    Switch
                  </button>
                )}
                {space.windowId === currentWindowId && (
                  <span className="current-label">Current</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SimplePopup;