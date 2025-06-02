import { configureStore } from '@reduxjs/toolkit';
import spacesReducer from './slices/spacesSlice';
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
          'spaces/fetchAll/rejected'
        ]
      }
    })
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
