import { Middleware } from '@reduxjs/toolkit';
import { RootState, ActionQueue } from '../types';
import { addToActionQueue, removeFromActionQueue } from '../slices/spacesSlice';

// Action types that should be queued to prevent race conditions
const QUEUEABLE_ACTIONS = [
  'spaces/rename/pending',
  'spaces/close/pending',
  'spaces/restore/pending',
  'spaces/removeClosed/pending'
];

// Actions that are currently being processed (to prevent duplicate operations)
const PROCESSING_ACTIONS = new Set<string>();

// Debounced action processors - one per space to prevent concurrent modifications
const SPACE_PROCESSORS = new Map<string, NodeJS.Timeout>();

/**
 * Middleware that queues actions to prevent race conditions and provides
 * debounced execution for rapid operations on the same space.
 */
export const actionQueueMiddleware: Middleware<{}, RootState> = (store) => (next) => (action) => {
  // Check if this action should be queued
  if (QUEUEABLE_ACTIONS.includes(action.type) && action.meta?.arg) {
    const spaceId = getSpaceIdFromAction(action);

    if (spaceId) {
      // Check if there's already a similar operation in progress
      const operationKey = `${action.type}_${spaceId}`;

      if (PROCESSING_ACTIONS.has(operationKey)) {
        // Queue the action instead of executing immediately
        const queueItem: ActionQueue = {
          id: `${operationKey}_${Date.now()}`,
          type: action.type,
          payload: action.meta.arg,
          timestamp: Date.now(),
          status: 'pending',
          retryCount: 0
        };

        store.dispatch(addToActionQueue(queueItem));
        return; // Don't execute the action now
      }

      // Mark operation as processing
      PROCESSING_ACTIONS.add(operationKey);

      // Clear any existing debounced processor for this space
      const existingTimeout = SPACE_PROCESSORS.get(spaceId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set up debounced execution
      const timeout = setTimeout(() => {
        // Execute the action
        const result = next(action);

        // Clean up after execution
        PROCESSING_ACTIONS.delete(operationKey);
        SPACE_PROCESSORS.delete(spaceId);

        // Process any queued actions for this space
        processQueuedActions(store, spaceId);

        return result;
      }, 100); // 100ms debounce

      SPACE_PROCESSORS.set(spaceId, timeout);
      return;
    }
  }

  // For non-queueable actions, execute normally
  return next(action);
};

/**
 * Extract space ID from various action types
 */
function getSpaceIdFromAction(action: any): string | null {
  const arg = action.meta?.arg;

  if (!arg) return null;

  // Handle different action argument patterns
  if (typeof arg === 'object') {
    return arg.windowId?.toString() || arg.spaceId || arg.id || null;
  }

  if (typeof arg === 'string') {
    return arg;
  }

  if (typeof arg === 'number') {
    return arg.toString();
  }

  return null;
}

/**
 * Process queued actions for a specific space after current operation completes
 */
function processQueuedActions(store: any, spaceId: string) {
  const state = store.getState() as RootState;
  const queue = state.spaces.actionQueue;

  // Find queued actions for this space
  const spaceQueue = queue.filter(item => {
    const itemSpaceId = getSpaceIdFromQueueItem(item);
    return itemSpaceId === spaceId && item.status === 'pending';
  });

  if (spaceQueue.length === 0) return;

  // Process the oldest queued action
  const nextAction = spaceQueue.sort((a, b) => a.timestamp - b.timestamp)[0];

  // Remove from queue
  store.dispatch(removeFromActionQueue(nextAction.id));

  // Create and dispatch the actual action
  const actionToDispatch = createActionFromQueueItem(nextAction);
  if (actionToDispatch) {
    store.dispatch(actionToDispatch);
  }
}

/**
 * Extract space ID from queue item
 */
function getSpaceIdFromQueueItem(item: ActionQueue): string | null {
  const payload = item.payload;

  if (typeof payload === 'object' && payload) {
    return payload.windowId?.toString() || payload.spaceId || payload.id || null;
  }

  if (typeof payload === 'string') {
    return payload;
  }

  if (typeof payload === 'number') {
    return payload.toString();
  }

  return null;
}

/**
 * Recreate the original action from a queue item
 */
function createActionFromQueueItem(item: ActionQueue): any {
  // Map action types back to their action creators
  // This would need to import the actual action creators
  // For now, return a basic action structure
  return {
    type: item.type,
    meta: {
      arg: item.payload,
      requestId: `queued_${item.id}`,
      requestStatus: 'pending'
    }
  };
}

/**
 * Enhanced debounce specifically for space operations
 * Ensures that rapid operations on the same space are batched
 */
export function createSpaceOperationDebouncer<T extends (...args: any[]) => any>(
  operation: T,
  delay: number = 300
): T & { cancel: () => void; flush: () => void } {
  const timeouts = new Map<string, NodeJS.Timeout>();
  const pendingCalls = new Map<string, { resolve: Function; reject: Function; args: Parameters<T> }>();

  const debounced = ((...args: Parameters<T>) => {
    // Extract space ID from arguments
    const spaceId = args[0]?.windowId?.toString() || args[0]?.spaceId || args[0]?.toString() || 'default';

    return new Promise((resolve, reject) => {
      // Clear existing timeout for this space
      const existingTimeout = timeouts.get(spaceId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Store the pending call
      pendingCalls.set(spaceId, { resolve, reject, args });

      // Set new timeout
      const timeout = setTimeout(async () => {
        const pendingCall = pendingCalls.get(spaceId);
        if (pendingCall) {
          try {
            const result = await operation(...pendingCall.args);
            pendingCall.resolve(result);
          } catch (error) {
            pendingCall.reject(error);
          } finally {
            pendingCalls.delete(spaceId);
            timeouts.delete(spaceId);
          }
        }
      }, delay);

      timeouts.set(spaceId, timeout);
    });
  }) as T;

  (debounced as any).cancel = () => {
    timeouts.forEach(timeout => clearTimeout(timeout));
    timeouts.clear();
    pendingCalls.clear();
  };

  (debounced as any).flush = () => {
    timeouts.forEach((timeout, spaceId) => {
      clearTimeout(timeout);
      const pendingCall = pendingCalls.get(spaceId);
      if (pendingCall) {
        operation(...pendingCall.args)
          .then(pendingCall.resolve)
          .catch(pendingCall.reject);
      }
    });
    timeouts.clear();
    pendingCalls.clear();
  };

  return debounced as T & { cancel: () => void; flush: () => void };
}