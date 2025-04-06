import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import spacesReducer from './slices/spacesSlice';

// Configure the store with the spaces reducer
export const store = configureStore({
  reducer: {
    spaces: spacesReducer,
  },
  // Middleware is automatically included by configureStore, including thunk middleware
});

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Create typed versions of the useDispatch and useSelector hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Re-export selectors for convenience (optional, but can be helpful)
export const selectSpaces = (state: RootState) => state.spaces.spaces;
export const selectClosedSpaces = (state: RootState) => state.spaces.closedSpaces;
export const selectCurrentWindow = (state: RootState) => state.spaces.currentWindowId;
export const selectSelectedSpace = (state: RootState) => state.spaces.selectedSpaceId;
export const selectIsLoading = (state: RootState) => state.spaces.isLoading;
export const selectError = (state: RootState) => state.spaces.error;
