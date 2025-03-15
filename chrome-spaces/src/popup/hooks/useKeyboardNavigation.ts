import { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from '../store';
import { selectSpace, switchToSpace } from '../store/slices/spacesSlice';
import type { AppDispatch } from '../store/types';

interface UseKeyboardNavigationOptions {
  spaces: Record<string, any>;
  closedSpaces: Record<string, any>;
}

export function useKeyboardNavigation({ spaces, closedSpaces }: UseKeyboardNavigationOptions) {
  const dispatch = useDispatch() as AppDispatch;
  const selectedSpaceId = useSelector(state => state.spaces.selectedSpaceId);
  const [searchFocused, setSearchFocused] = useState(false);

  // Get all space IDs in display order
  const allSpaceIds = useCallback(() => {
    const activeIds = Object.keys(spaces);
    const closedIds = Object.keys(closedSpaces);
    return [...activeIds, ...closedIds];
  }, [spaces, closedSpaces]);

  // Find index of currently selected space
  const getCurrentIndex = useCallback(() => {
    if (!selectedSpaceId) return -1;
    return allSpaceIds().indexOf(selectedSpaceId);
  }, [selectedSpaceId, allSpaceIds]);

  // Navigate to next/previous space
  const navigate = useCallback((direction: 'next' | 'previous') => {
    const ids = allSpaceIds();
    if (ids.length === 0) return;

    const currentIndex = getCurrentIndex();
    let newIndex: number;

    if (currentIndex === -1) {
      newIndex = 0;
    } else {
      newIndex = direction === 'next'
        ? (currentIndex + 1) % ids.length
        : (currentIndex - 1 + ids.length) % ids.length;
    }

    dispatch(selectSpace(ids[newIndex]));
  }, [dispatch, allSpaceIds, getCurrentIndex]);

  // Handle activation of selected space
  const activateSelected = useCallback(async () => {
    if (!selectedSpaceId) return;

    // If it's an active space, switch to it
    if (selectedSpaceId in spaces) {
      await dispatch(switchToSpace(Number(selectedSpaceId)));
      window.close();
    }
    // Handle closed spaces in the future
  }, [dispatch, selectedSpaceId, spaces]);

  // Keyboard event handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Don't handle keyboard navigation when search is focused
    if (searchFocused && e.key !== 'Escape') return;

    switch (e.key) {
      case 'ArrowDown':
      case 'j':
        e.preventDefault();
        navigate('next');
        break;

      case 'ArrowUp':
      case 'k':
        e.preventDefault();
        navigate('previous');
        break;

      case 'Enter':
        e.preventDefault();
        activateSelected();
        break;

      case 'Escape':
        e.preventDefault();
        if (searchFocused) {
          // Blur search input
          (document.activeElement as HTMLElement)?.blur();
          setSearchFocused(false);
        } else {
          // Clear selection
          dispatch(selectSpace(''));
        }
        break;

      case '/':
        if (!searchFocused) {
          e.preventDefault();
          // Focus search input
          document.getElementById('search-input')?.focus();
          setSearchFocused(true);
        }
        break;
    }
  }, [dispatch, navigate, activateSelected, searchFocused]);

  // Set up keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Handle search focus state
  const handleSearchFocus = useCallback((focused: boolean) => {
    setSearchFocused(focused);
  }, []);

  return {
    selectedSpaceId,
    handleSearchFocus
  };
}
