import { SpacesState, RootState, BaseAction, AsyncAction } from './types';
import spacesReducer from './slices/spacesSlice';

// Simple store implementation
export class Store {
  private state: RootState;
  private listeners: Array<() => void> = [];

  constructor() {
    this.state = {
      spaces: spacesReducer(undefined, { type: '@@INIT' })
    };
  }

  getState(): RootState {
    return this.state;
  }

  dispatch(action: BaseAction | AsyncAction): void {
    // Update spaces state
    this.state = {
      spaces: spacesReducer(this.state.spaces, action)
    };

    // Notify subscribers
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }
}

// Create store instance
export const store = new Store();

// React-Redux like hooks
export function useSelector<Selected>(
  selector: (state: RootState) => Selected,
  equalityFn: (a: Selected, b: Selected) => boolean = Object.is
): Selected {
  let currentState = selector(store.getState());
  
  // Subscribe to store changes
  store.subscribe(() => {
    const nextState = selector(store.getState());
    if (!equalityFn(currentState, nextState)) {
      currentState = nextState;
      // In a real implementation, this would trigger a React re-render
    }
  });

  return currentState;
}

export function useDispatch() {
  return store.dispatch.bind(store);
}

// Type-safe hooks
export type AppStore = typeof store;
export type AppState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const selectSpaces = (state: RootState) => state.spaces.spaces;
export const selectClosedSpaces = (state: RootState) => state.spaces.closedSpaces;
export const selectCurrentWindow = (state: RootState) => state.spaces.currentWindowId;
export const selectSelectedSpace = (state: RootState) => state.spaces.selectedSpaceId;
export const selectIsLoading = (state: RootState) => state.spaces.isLoading;
export const selectError = (state: RootState) => state.spaces.error;

// Helper function to create action creators
export function createAction<T = void>(
  type: string
): T extends void ? () => BaseAction : (payload: T) => BaseAction<T> {
  return ((payload?: T) => ({ type, payload })) as any;
}
