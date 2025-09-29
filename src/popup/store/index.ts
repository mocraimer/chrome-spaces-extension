import { configureStore } from '@reduxjs/toolkit';
import spacesReducer from './slices/spacesSlice';
import { actionQueueMiddleware } from './middleware/actionQueueMiddleware';
import type { RootState } from '@/shared/types/store';

// Debug logging
console.log('Creating Redux store with debug logging...');

// Create and configure store
export const store = configureStore({
  reducer: {
    spaces: spacesReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          'spaces/fetchAll/pending',
          'spaces/fetchAll/fulfilled',
          'spaces/fetchAll/rejected',
          'spaces/addToActionQueue',
          'spaces/removeFromActionQueue'
        ]
      }
    }).concat(actionQueueMiddleware)
});

// Add development debug listener
// if (process.env.NODE_ENV === 'development') {
//   store.subscribe(() => {
//     console.log('[Redux Debug] State updated:', store.getState());
//   });
// }

// Log initial state
console.log('Initial store state:', store.getState());

// Export selectors
export const selectSpaces = (state: RootState) => state.spaces.spaces;
export const selectClosedSpaces = (state: RootState) => state.spaces.closedSpaces;
export const selectCurrentWindow = (state: RootState) => state.spaces.currentWindowId;
export const selectSelectedSpace = (state: RootState) => state.spaces.selectedSpaceId;
export const selectIsLoading = (state: RootState) => state.spaces.isLoading;
export const selectError = (state: RootState) => state.spaces.error;

// Enhanced selectors for optimized state
export const selectOptimisticUpdates = (state: RootState) => state.spaces.optimisticUpdates;
export const selectActionQueue = (state: RootState) => state.spaces.actionQueue;
export const selectOperationErrors = (state: RootState) => state.spaces.operationErrors;
export const selectSyncInProgress = (state: RootState) => state.spaces.syncInProgress;

// Memoized selector for spaces with optimistic updates applied
export const selectSpacesWithOptimisticUpdates = (state: RootState) => {
  const spaces = state.spaces.spaces;
  const optimisticUpdates = state.spaces.optimisticUpdates;

  // If no optimistic updates, return spaces as-is
  if (Object.keys(optimisticUpdates).length === 0) {
    return spaces;
  }

  // Apply optimistic updates
  const updatedSpaces = { ...spaces };
  Object.values(optimisticUpdates).forEach(update => {
    if (update.type === 'rename' && update.payload.spaceId) {
      const spaceId = update.payload.spaceId;
      const space = updatedSpaces[spaceId];
      if (space) {
        updatedSpaces[spaceId] = {
          ...space,
          name: update.payload.name,
          customName: update.payload.name,
          named: true
        };
      }
    }
  });

  return updatedSpaces;
};

// Selector for checking if a space has pending operations
export const selectSpaceOperationStatus = (spaceId: string) => (state: RootState) => {
  const queue = state.spaces.actionQueue;
  const errors = state.spaces.operationErrors;
  const optimisticUpdates = state.spaces.optimisticUpdates;

  const hasPendingOperations = queue.some(item => {
    const itemSpaceId = typeof item.payload === 'object' && item.payload ?
      (item.payload.windowId?.toString() || item.payload.spaceId || item.payload.id) :
      item.payload?.toString();
    return itemSpaceId === spaceId;
  });

  const hasOptimisticUpdates = Object.values(optimisticUpdates).some(update => {
    return update.payload.spaceId === spaceId;
  });

  const hasErrors = Object.keys(errors).some(errorId => errorId.includes(spaceId));

  return {
    isPending: hasPendingOperations,
    isOptimistic: hasOptimisticUpdates,
    hasError: hasErrors,
    error: hasErrors ? errors[Object.keys(errors).find(id => id.includes(spaceId)) || ''] : null
  };
};
