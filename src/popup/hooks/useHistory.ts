import { useCallback, useRef, useState } from 'react';

interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

interface UseHistoryOptions<T> {
  maxHistory?: number;
  onUndo?: (state: T) => void;
  onRedo?: (state: T) => void;
  onError?: (error: Error) => void;
  equals?: (a: T, b: T) => boolean;
}

interface Action<T> {
  type: string;
  payload?: any;
  timestamp: number;
  undo: (state: T) => T | Promise<T>;
  redo: (state: T) => T | Promise<T>;
}

export function useHistory<T>(
  initialState: T,
  options: UseHistoryOptions<T> = {}
) {
  const {
    maxHistory = 50,
    onUndo,
    onRedo,
    onError,
    equals = Object.is
  } = options;

  const [history, setHistory] = useState<HistoryState<T>>({
    past: [],
    present: initialState,
    future: []
  });

  const actionsRef = useRef<Action<T>[]>([]);
  const currentActionRef = useRef<number>(-1);
  const ignoreNextUpdate = useRef(false);

  // Handle state updates
  const updateState = useCallback(async (newState: T, action?: Action<T>) => {
    if (ignoreNextUpdate.current) {
      ignoreNextUpdate.current = false;
      return;
    }

    setHistory(prev => {
      // Don't update if state hasn't changed
      if (equals(prev.present, newState)) {
        return prev;
      }

      // Add to history
      const past = [...prev.past, prev.present].slice(-maxHistory);
      
      if (action) {
        actionsRef.current = [
          ...actionsRef.current.slice(0, currentActionRef.current + 1),
          action
        ];
        currentActionRef.current++;
      }

      return {
        past,
        present: newState,
        future: []
      };
    });
  }, [equals, maxHistory]);

  // Create a new action
  const createAction = useCallback((
    type: string,
    payload: any,
    undoFn: (state: T) => T | Promise<T>,
    redoFn: (state: T) => T | Promise<T>
  ): Action<T> => {
    return {
      type,
      payload,
      timestamp: Date.now(),
      undo: undoFn,
      redo: redoFn
    };
  }, []);

  // Push a new action
  const push = useCallback(async (action: Action<T>) => {
    try {
      const newState = await action.redo(history.present);
      await updateState(newState, action);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Action failed');
      onError?.(err);
      throw err;
    }
  }, [history.present, updateState, onError]);

  // Undo last action
  const undo = useCallback(async () => {
    if (currentActionRef.current < 0) return;

    try {
      const action = actionsRef.current[currentActionRef.current];
      const newState = await action.undo(history.present);
      
      ignoreNextUpdate.current = true;
      currentActionRef.current--;

      setHistory(prev => ({
        past: prev.past.slice(0, -1),
        present: newState,
        future: [prev.present, ...prev.future]
      }));

      onUndo?.(newState);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Undo failed');
      onError?.(err);
      throw err;
    }
  }, [history.present, onUndo, onError]);

  // Redo last undone action
  const redo = useCallback(async () => {
    if (currentActionRef.current >= actionsRef.current.length - 1) return;

    try {
      const nextAction = actionsRef.current[currentActionRef.current + 1];
      const newState = await nextAction.redo(history.present);
      
      ignoreNextUpdate.current = true;
      currentActionRef.current++;

      setHistory(prev => ({
        past: [...prev.past, prev.present],
        present: newState,
        future: prev.future.slice(1)
      }));

      onRedo?.(newState);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Redo failed');
      onError?.(err);
      throw err;
    }
  }, [history.present, onRedo, onError]);

  // Clear history
  const clear = useCallback(() => {
    setHistory({
      past: [],
      present: history.present,
      future: []
    });
    actionsRef.current = [];
    currentActionRef.current = -1;
  }, [history.present]);

  return {
    state: history.present,
    past: history.past,
    future: history.future,
    canUndo: currentActionRef.current >= 0,
    canRedo: currentActionRef.current < actionsRef.current.length - 1,
    push,
    undo,
    redo,
    clear,
    createAction,
    actions: actionsRef.current
  };
}

/**
 * Example usage:
 * 
 * ```tsx
 * interface SpacesState {
 *   spaces: Record<string, Space>;
 *   selectedId: string | null;
 * }
 * 
 * const MyComponent: React.FC = () => {
 *   const history = useHistory<SpacesState>(
 *     { spaces: {}, selectedId: null },
 *     {
 *       maxHistory: 20,
 *       onUndo: (state) => {
 *         console.log('Undone to:', state);
 *       },
 *       onRedo: (state) => {
 *         console.log('Redone to:', state);
 *       },
 *       onError: (error) => {
 *         console.error('History operation failed:', error);
 *       }
 *     }
 *   );
 * 
 *   const handleMoveTab = async (tabId: string, fromSpaceId: string, toSpaceId: string) => {
 *     const action = history.createAction(
 *       'MOVE_TAB',
 *       { tabId, fromSpaceId, toSpaceId },
 *       // Undo function
 *       (state) => ({
 *         ...state,
 *         spaces: {
 *           ...state.spaces,
 *           [fromSpaceId]: { ...moveTabTo(state.spaces[fromSpaceId], tabId) },
 *           [toSpaceId]: { ...removeTab(state.spaces[toSpaceId], tabId) }
 *         }
 *       }),
 *       // Redo function
 *       (state) => ({
 *         ...state,
 *         spaces: {
 *           ...state.spaces,
 *           [fromSpaceId]: { ...removeTab(state.spaces[fromSpaceId], tabId) },
 *           [toSpaceId]: { ...moveTabTo(state.spaces[toSpaceId], tabId) }
 *         }
 *       })
 *     );
 * 
 *     await history.push(action);
 *   };
 * 
 *   return (
 *     <div>
 *       <button onClick={history.undo} disabled={!history.canUndo}>
 *         Undo
 *       </button>
 *       <button onClick={history.redo} disabled={!history.canRedo}>
 *         Redo
 *       </button>
 *     </div>
 *   );
 * };
 * ```
 */
