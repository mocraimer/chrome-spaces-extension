import React, { useState, useEffect, useCallback } from 'react';
import { useAppSelector, useAppDispatch } from '../../shared/hooks/storeHooks';
import { SpaceHeader } from './SpaceHeader';
import { SearchBar } from './SearchBar';
import { SpaceList } from './SpaceList';
import { useKeyboardNavigation } from '../hooks/useKeyboardNavigation';
import { searchSpaces } from '../utils/search';
import {
  fetchSpaces,
  setCurrentWindow,
  switchToSpace,
  closeSpace,
  restoreSpace,
  removeClosedSpace
} from '../store/slices/spacesSlice';

export const Popup: React.FC = () => {
  const dispatch = useAppDispatch();
  const spaces = useAppSelector(state => state.spaces.spaces);
  const closedSpaces = useAppSelector(state => state.spaces.closedSpaces);
  const isLoading = useAppSelector(state => state.spaces.isLoading);
  const error = useAppSelector(state => state.spaces.error);

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

  // Get filtered spaces using search utility
  const getFilteredSpaces = useCallback((spaces: Record<string, any>) => {
    if (!searchTerm) return spaces;
    const filteredArray = searchSpaces(Object.values(spaces), searchTerm);
    return filteredArray.reduce((acc, space) => {
      acc[space.id] = space;
      return acc;
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

  // Initialize keyboard navigation
  const { searchFocused } = useKeyboardNavigation({
    spaces,
    closedSpaces,
    searchQuery: searchTerm
  });

  // Handle keyboard events in search bar
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (searchFocused) return; // Let the hook handle navigation when not focused on search
    
    // Handle search-specific keyboard events
    switch (e.key) {
      case 'Escape':
        setSearchTerm('');
        e.currentTarget.blur();
        break;
      case 'Enter':
        if (searchTerm) {
          const filteredActiveSpaces = getFilteredSpaces(spaces);
          const firstMatch = Object.keys(filteredActiveSpaces)[0];
          if (firstMatch) {
            handleSpaceAction(firstMatch, 'switch');
          }
        }
        break;
    }
  }, [searchTerm, spaces, searchFocused, handleSpaceAction]);

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
            spaces={getFilteredSpaces(spaces)}
            type="active"
            onSpaceAction={handleSpaceAction}
          />
        </section>

        {Object.keys(closedSpaces).length > 0 && (
          <section className="closed-spaces">
            <h3>Closed Spaces</h3>
            <SpaceList
              spaces={getFilteredSpaces(closedSpaces)}
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
