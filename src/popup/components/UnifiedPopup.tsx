import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Space } from '@/shared/types/Space';
import { RootState, AppDispatch } from '../store/types';
import {
  fetchSpaces,
  setCurrentWindow,
  setSearch,
  clearError
} from '../store/slices/spacesSlice';

// Import new components
import SearchInput from './SearchInput';
import UnifiedSpacesList, { SpaceAction } from './UnifiedSpacesList';
import ConfirmDialog from './ConfirmDialog';

// Import new hooks
import { useSpaceManagement } from '../hooks/useSpaceManagement';
import { useSpaceFiltering } from '../hooks/useSpaceFiltering';
import { useUnifiedPopupNavigation } from '../hooks/useUnifiedPopupNavigation';

// Import styles
import { popupStyles } from '../styles/UnifiedPopup.styles';

const UnifiedPopup: React.FC = () => {
  // Redux state and dispatch
  const dispatch = useDispatch<AppDispatch>();
  const {
    spaces,
    closedSpaces,
    currentWindowId,
    isLoading,
    error,
    searchQuery
  } = useSelector((state: RootState) => state.spaces);

  // Custom hooks for functionality
  const spaceManagement = useSpaceManagement();
  const spaceFiltering = useSpaceFiltering(spaces, closedSpaces, searchQuery, currentWindowId);

  // Keyboard navigation hook
  const navigation = useUnifiedPopupNavigation({
    filteredSpaces: spaceFiltering.filteredSpaces,
    filteredClosedSpaces: spaceFiltering.filteredClosedSpaces,
    editingSpaceId: spaceManagement.editingSpaceId,
    onSwitchToSpace: spaceManagement.handleSwitchToSpace,
    onRestoreSpace: spaceManagement.handleRestoreSpace,
    onStartEditing: spaceManagement.startEditing,
    onCancelEdit: spaceManagement.handleCancelEdit
  });

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Get display name for a space (custom name takes precedence)
  const getDisplayName = useCallback((space: Space): string => {
    return space.name;
  }, []);

  // Initialize data on mount
  useEffect(() => {
    const initializePopup = async () => {
      try {
        // Get current window
        const currentWindow = await chrome.windows.getCurrent();
        if (currentWindow.id) {
          dispatch(setCurrentWindow(currentWindow.id.toString()));
        }

        // Fetch all spaces data from background service
        await dispatch(fetchSpaces());
        console.log('UnifiedPopup fetched spaces');
      } catch (err) {
        console.error('Failed to initialize popup:', err);
      }
    };

    initializePopup();

    // Cleanup: Ensure any pending actions are flushed before unmount
    return () => {
      console.log('[UnifiedPopup] Unmounting - any onBlur handlers will have fired by now');
    };
  }, [dispatch]);

  // Auto-focus search input
  useEffect(() => {
    if (!isLoading && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoading]);

  // Handle search input
  const handleSearchChange = useCallback((query: string) => {
    dispatch(setSearch(query));
    navigation.setSelectedIndex(0);
  }, [dispatch, navigation]);

  // Handle space actions through the space management hook
  const handleSpaceAction = useCallback((action: SpaceAction) => {
    switch (action.type) {
      case 'edit':
        if (action.space) {
          spaceManagement.startEditing(action.space);
        }
        break;
      case 'switch':
        if (action.windowId) {
          spaceManagement.handleSwitchToSpace(action.windowId);
        }
        break;
      case 'restore':
        if (action.space) {
          spaceManagement.handleRestoreSpace(action.space);
        }
        break;
      case 'delete':
        if (action.spaceId) {
          spaceManagement.showDeleteConfirmation(action.spaceId);
        }
        break;
      case 'save':
        spaceManagement.handleSaveEdit();
        break;
      case 'cancel':
        spaceManagement.handleCancelEdit();
        break;
      case 'editNameChange':
        if (action.name !== undefined) {
          spaceManagement.handleEditNameChange(action.name);
        }
        break;
      default:
        console.warn('Unknown space action:', action);
    }
  }, [spaceManagement]);

  // Handle confirmation dialogs
  const handleConfirmDelete = useCallback(() => {
    if (spaceManagement.showConfirmDelete) {
      spaceManagement.handleRemoveSpace(spaceManagement.showConfirmDelete);
    }
  }, [spaceManagement]);

  const handleCancelDelete = useCallback(() => {
    spaceManagement.hideDeleteConfirmation();
  }, [spaceManagement]);

  // The keyboard navigation is now handled by the navigation hook

  // Inject styles
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = popupStyles;
    document.head.appendChild(styleElement);
    
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="popup-container">
        <div className="loading">Loading spaces...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="popup-container">
        <div className="error">
          Error: {error}
          <button onClick={() => dispatch(clearError())}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="popup-container" onKeyDown={navigation.handleKeyDown} tabIndex={0}>
      <SearchInput
        ref={searchInputRef}
        value={searchQuery}
        onChange={handleSearchChange}
        autoFocus={!isLoading}
        onKeyDown={navigation.handleKeyDown}
      />

      <UnifiedSpacesList
        spaces={spaceFiltering.filteredSpaces}
        closedSpaces={spaceFiltering.filteredClosedSpaces}
        selectedIndex={navigation.selectedIndex}
        currentWindowId={currentWindowId}
        editingSpaceId={spaceManagement.editingSpaceId}
        editingName={spaceManagement.editingName}
        showConfirmDelete={spaceManagement.showConfirmDelete}
        onSpaceAction={handleSpaceAction}
        getDisplayName={getDisplayName}
      />

      <ConfirmDialog
        isOpen={!!spaceManagement.showConfirmDelete}
        title="Delete Space"
        message="Permanently delete this space?"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous={true}
      />

      <div className="help-text">
        Use ↑↓ to navigate, Enter to switch, F2 to rename, Esc to close
      </div>
    </div>
  );
};


export default UnifiedPopup; 