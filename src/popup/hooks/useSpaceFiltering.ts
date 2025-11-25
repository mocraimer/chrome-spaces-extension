import { useMemo, useCallback } from 'react';
import { Space } from '@/shared/types/Space';

export interface SpaceFilteringResult {
  filteredSpaces: Space[];
  filteredClosedSpaces: Space[];
  totalFilteredCount: number;
  hasResults: boolean;
}

export const useSpaceFiltering = (
  spaces: Record<string, Space>,
  closedSpaces: Record<string, Space>,
  searchQuery: string,
  currentWindowId: string | null
): SpaceFilteringResult => {
  // Get display name for a space
  const getDisplayName = useCallback((space: Space): string => {
    return space.name;
  }, []);

  // Filter function for spaces based on search query
  const filterSpaces = useCallback((spacesArray: Space[], query: string): Space[] => {
    if (!query.trim()) {
      return spacesArray;
    }

    const lowerQuery = query.toLowerCase();
    return spacesArray.filter(space => {
      const displayName = getDisplayName(space);
      // Search in display name
      if (displayName.toLowerCase().includes(lowerQuery)) {
        return true;
      }
      // Search in URLs
      return space.urls.some(url => url.toLowerCase().includes(lowerQuery));
    });
  }, [getDisplayName]);

  // Convert spaces objects to arrays and apply filtering
  const result = useMemo(() => {
    // Convert to arrays, filtering for active/inactive status
    const activeSpacesArray = Object.values(spaces).filter(space => space.isActive);
    const closedSpacesArray = Object.values(closedSpaces).filter(space => !space.isActive);

    // Apply search filtering
    const filteredActiveSpaces = filterSpaces(activeSpacesArray, searchQuery);
    const filteredClosedSpaces = filterSpaces(closedSpacesArray, searchQuery);

    // Sort active spaces: current window first, then by lastModified descending
    const sortedFilteredSpaces = [...filteredActiveSpaces].sort((a, b) => {
      const aIsCurrent = a.windowId?.toString() === currentWindowId;
      const bIsCurrent = b.windowId?.toString() === currentWindowId;

      if (aIsCurrent && !bIsCurrent) return -1;
      if (!aIsCurrent && bIsCurrent) return 1;

      // Both not current - sort by lastModified descending
      return b.lastModified - a.lastModified;
    });

    // Sort closed spaces by lastModified descending
    const sortedClosedSpaces = [...filteredClosedSpaces].sort((a, b) =>
      b.lastModified - a.lastModified
    );

    const totalFilteredCount = sortedFilteredSpaces.length + sortedClosedSpaces.length;
    const hasResults = totalFilteredCount > 0;

    return {
      filteredSpaces: sortedFilteredSpaces,
      filteredClosedSpaces: sortedClosedSpaces,
      totalFilteredCount,
      hasResults
    };
  }, [spaces, closedSpaces, searchQuery, filterSpaces, currentWindowId]);

  return result;
};