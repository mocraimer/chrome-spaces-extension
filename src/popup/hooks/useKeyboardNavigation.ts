import { useEffect, useRef, useState, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/shared/hooks/storeHooks';
import { Space } from '@/shared/types/Space';
import { searchSpaces } from '../utils/search';

interface KeyboardNavigationOptions {
  spaces: Record<string, Space>;
  closedSpaces: Record<string, Space>;
  searchQuery: string;
}

/**
 * Hook for handling keyboard navigation in the spaces list
 */
export const useKeyboardNavigation = ({ spaces, closedSpaces, searchQuery }: KeyboardNavigationOptions) => {
  const dispatch = useAppDispatch();
  const selectedSpaceId = useAppSelector(state => state.spaces.selectedSpaceId);
  const [searchFocused, setSearchFocused] = useState(false);
  const initialized = useRef(false);

  // Initialize selection and handle state changes
  useEffect(() => {
    const ids = Object.keys(spaces);
    if (!initialized.current && ids.length > 0) {
      // First time initialization
      initialized.current = true;
      if (!selectedSpaceId) {
        dispatch({ type: 'spaces/selectSpace', payload: ids[0] });
      }
    }
  }, [spaces, dispatch, selectedSpaceId]);

  // Reset initialization when spaces change
  useEffect(() => {
    initialized.current = false;
  }, [spaces]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle keyboard navigation if search is focused
      if (document.activeElement?.tagName === 'INPUT') {
        // Clear search on Escape
        if (e.key === 'Escape') {
          (document.activeElement as HTMLElement).blur();
          setSearchFocused(false);
        }
        return;
      }

      // Filter spaces based on search query
      const allSpaces = useMemo(() => {
        const combined = [...Object.values(spaces), ...Object.values(closedSpaces)];
        return searchQuery
          ? searchSpaces(combined, searchQuery)
          : combined;
      }, [spaces, closedSpaces, searchQuery]);

      if (allSpaces.length === 0) {
        // Clear selection if no spaces match search
        if (selectedSpaceId) {
          dispatch({ type: 'spaces/selectSpace', payload: '' });
        }
        return;
      }

      // If current selection is not in filtered results, select first result
      if (selectedSpaceId && !allSpaces.some(space => space.id === selectedSpaceId)) {
        dispatch({ type: 'spaces/selectSpace', payload: allSpaces[0].id });
      }

      // Index of currently selected space
      const currentIdx = selectedSpaceId
        ? allSpaces.findIndex(space => space.id === selectedSpaceId)
        : -1;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          {
            // Select next space, wrapping to first if at end
            const nextIdx = currentIdx < allSpaces.length - 1 ? currentIdx + 1 : 0;
            dispatch({ type: 'spaces/selectSpace', payload: allSpaces[nextIdx].id });
          }
          break;
        case 'ArrowUp':
          e.preventDefault();
          {
            // Select previous space, wrapping to last if at beginning
            const prevIdx = currentIdx > 0 ? currentIdx - 1 : allSpaces.length - 1;
            dispatch({ type: 'spaces/selectSpace', payload: allSpaces[prevIdx].id });
          }
          break;
        case 'Enter':
          // Activate selected space
          if (selectedSpaceId) {
            const selectedSpace = spaces[selectedSpaceId] || closedSpaces[selectedSpaceId];
            if (selectedSpace) {
              if (spaces[selectedSpaceId]) {
                // For open spaces, use them directly
                dispatch({ type: 'spaces/useSpace', payload: selectedSpaceId } as any);
              } else {
                // For closed spaces, restore and use them
                dispatch({ type: 'spaces/restoreSpace', payload: selectedSpaceId } as any);
              }
              
              // Close popup after activation with a little delay
              setTimeout(() => window.close(), 50);
            }
          }
          break;
        case 'Escape':
          // Clear selection
          dispatch({ type: 'spaces/selectSpace', payload: '' });
          break;
        case '/':
          // Focus search
          e.preventDefault();
          const searchInput = document.getElementById('search-input');
          if (searchInput) {
            searchInput.focus();
            setSearchFocused(true);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [spaces, closedSpaces, selectedSpaceId, dispatch]);

  return {
    searchFocused
  };
};
