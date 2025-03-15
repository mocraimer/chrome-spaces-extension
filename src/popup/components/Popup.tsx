import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch, AppDispatch } from '../store';
import { SpaceHeader } from './SpaceHeader';
import { SearchBar } from './SearchBar';
import { SpaceList } from './SpaceList';
import {
  fetchSpaces,
  setCurrentWindow,
  switchToSpace,
  closeSpace,
  restoreSpace,
  removeClosedSpace
} from '../store/slices/spacesSlice';

export const Popup: React.FC = () => {
  const dispatch = useDispatch() as AppDispatch;
  const spaces = useSelector(state => state.spaces.spaces);
  const closedSpaces = useSelector(state => state.spaces.closedSpaces);
  const isLoading = useSelector(state => state.spaces.isLoading);
  const error = useSelector(state => state.spaces.error);

  const [searchTerm, setSearchTerm] = useState('');
  
  // Initialize data
  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Get current window ID
        const currentWindow = await chrome.windows.getCurrent();
        dispatch(setCurrentWindow(currentWindow.id!.toString()));
        
        // Fetch spaces
        await dispatch(fetchSpaces());
      } catch (error) {
        console.error('Failed to initialize popup:', error);
      }
    };

    initializePopup();
  }, [dispatch]);

  // Filter spaces based on search term
  const filteredSpaces = useCallback((spaces: Record<string, any>) => {
    if (!searchTerm) return spaces;
    
    const searchLower = searchTerm.toLowerCase();
    return Object.entries(spaces).reduce((filtered, [id, space]) => {
      if (space.name.toLowerCase().includes(searchLower)) {
        filtered[id] = space;
      }
      return filtered;
    }, {} as Record<string, any>);
  }, [searchTerm]);

  // Handle space actions
  const handleSpaceAction = useCallback(async (
    spaceId: string,
    action: 'switch' | 'restore' | 'delete'
  ) => {
    try {
      switch (action) {
        case 'switch':
          await dispatch(switchToSpace(Number(spaceId)));
          window.close(); // Close popup after switching
          break;
          
        case 'restore':
          await dispatch(restoreSpace(spaceId));
          window.close(); // Close popup after restoring
          break;
          
        case 'delete':
          if (spaceId in spaces) {
            await dispatch(closeSpace(Number(spaceId)));
          } else {
            await dispatch(removeClosedSpace(spaceId));
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} space:`, error);
    }
  }, [dispatch, spaces]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // Implementation will be added when we add keyboard navigation
  }, []);

  if (error) {
    return (
      <div className="popup-error">
        <p>Error: {error}</p>
        <button onClick={() => dispatch(fetchSpaces())}>Retry</button>
      </div>
    );
  }

  return (
    <div className="popup-container">
      <SpaceHeader />
      
      <SearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        onKeyDown={handleKeyDown}
      />

      <div className="spaces-container">
        <section className="active-spaces">
          <h3>Active Spaces</h3>
          <SpaceList
            spaces={filteredSpaces(spaces)}
            type="active"
            onSpaceAction={handleSpaceAction}
          />
        </section>

        {Object.keys(closedSpaces).length > 0 && (
          <section className="closed-spaces">
            <h3>Closed Spaces</h3>
            <SpaceList
              spaces={filteredSpaces(closedSpaces)}
              type="closed"
              onSpaceAction={handleSpaceAction}
            />
          </section>
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const styles = `
.popup-container {
  width: 350px;
  max-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.spaces-container {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px;
}

section h3 {
  margin: 8px 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.popup-error {
  padding: 16px;
  text-align: center;
  color: var(--error-color);
}

.popup-error button {
  margin-top: 8px;
  padding: 4px 12px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.popup-error button:hover {
  background: var(--primary-color-dark);
}
`;

// Create and inject styles
const styleSheet = document.createElement('style');
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);
