import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import settingsReducer from './slices/settingsSlice';
import { validationMiddleware } from './middleware/validationMiddleware';

// Define root state type
export interface RootState {
  settings: ReturnType<typeof settingsReducer>;
}

// Configure store with settings reducer and middleware
export const store = configureStore({
  reducer: {
    settings: settingsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Enable serializable check
        warnAfter: 100,
        ignoredActions: ['persist/REHYDRATE', 'persist/PERSIST'],
      },
    }).concat(validationMiddleware),
});

// Export typed versions of hooks
export type AppDispatch = typeof store.dispatch;
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// Export store instance for use in components
export default store;