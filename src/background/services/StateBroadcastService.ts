import { QueuedStateUpdate, StateUpdatePriority } from './StateUpdateQueue';
import { MessageTypes } from '@/shared/constants';

function debounce(fn: Function, delay: number): () => void {
  let timeoutId: any;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(), delay);
  };
}

/**
 * Handler for state update events
 */
export interface StateUpdateHandler {
  (update: QueuedStateUpdate): void;
}

/**
 * Interface for window connection state
 */
interface ConnectedWindow {
  id: number;
  port: chrome.runtime.Port;
}

/**
 * Service for managing cross-window state synchronization
 */
export interface BroadcastOptions {
  /** Debounce time for non-critical broadcasts in ms */
  debounceTime?: number;
  /** Whether to coalesce rapid updates */
  coalesceUpdates?: boolean;
}

export class StateBroadcastService {
  private connections: ConnectedWindow[] = [];
  private static readonly CONNECTION_NAME = 'state-sync';
  private debouncedBroadcast: () => void;
  private pendingUpdates: Map<string, QueuedStateUpdate> = new Map();
  private options: Required<BroadcastOptions>;

  constructor(options: BroadcastOptions = {}) {
    this.options = {
      debounceTime: options.debounceTime ?? 100,
      coalesceUpdates: options.coalesceUpdates ?? true
    };

    // Initialize debounced broadcast
    this.debouncedBroadcast = debounce(
      () => this.processPendingBroadcasts(),
      this.options.debounceTime
    );

    // Listen for connection attempts from windows
    chrome.runtime.onConnect.addListener(this.handleConnect.bind(this));
  }

  /**
   * Handles new window connections
   */
  private handleConnect(port: chrome.runtime.Port): void {
    if (port.name !== StateBroadcastService.CONNECTION_NAME) {
      return;
    }

    const sender = port.sender?.tab?.windowId;
    if (!sender) {
      console.error('Could not identify window for connection');
      return;
    }

    // Store new connection
    this.connections.push({ id: sender, port });

    // Set up disconnect listener
    port.onDisconnect.addListener(() => {
      this.handleDisconnect(sender);
    });

    // Set up message listener
    port.onMessage.addListener((message: QueuedStateUpdate) => {
      this.handleStateUpdate(message, sender);
    });
  }

  /**
   * Handles window disconnection
   */
  private handleDisconnect(windowId: number): void {
    this.connections = this.connections.filter(conn => conn.id !== windowId);
  }


  private updateHandlers: Set<StateUpdateHandler> = new Set();

  /**
   * Register a handler for state updates
   */
  public onStateUpdate(handler: StateUpdateHandler): void {
    this.updateHandlers.add(handler);
  }

  /**
   * Broadcasts a state update to all connected windows
   */
  /**
   * Broadcasts a state update to all connected windows
   */
  public broadcast(update: QueuedStateUpdate): void {
    const isCritical = update.priority === StateUpdatePriority.CRITICAL;
    const isHighPriority = update.priority === StateUpdatePriority.HIGH;
    const isSpaceNameUpdate = update.type === MessageTypes.SPACE_UPDATED &&
                              update.payload?.changes?.name;

    if (isCritical || isHighPriority || isSpaceNameUpdate) {
      // Process critical/high priority updates and space name updates immediately
      // HIGH priority bypasses debounce for user-initiated actions like renaming
      // This prevents space title reversion due to debounce race conditions
      this.handleStateUpdate(update, -1);
      return;
    }

    if (this.options.coalesceUpdates) {
      // Coalesce rapid updates of the same type
      this.pendingUpdates.set(update.type, this.coalesceUpdate(update));
      this.debouncedBroadcast();
    } else {
      // Queue update for debounced broadcast
      this.pendingUpdates.set(update.id, update);
      this.debouncedBroadcast();
    }
  }

  /**
   * Coalesces a new update with existing pending update of same type
   */
  private coalesceUpdate(update: QueuedStateUpdate): QueuedStateUpdate {
    const existing = this.pendingUpdates.get(update.type);
    if (!existing) return update;

    return {
      ...update,
      payload: this.mergePayloads(existing.payload, update.payload)
    };
  }

  /**
   * Merges update payloads based on their type
   */
  private mergePayloads(oldPayload: any, newPayload: any): any {
    if (Array.isArray(oldPayload) && Array.isArray(newPayload)) {
      // For arrays, keep only latest unique items
      return [...new Set([...oldPayload, ...newPayload])];
    } else if (typeof oldPayload === 'object' && typeof newPayload === 'object') {
      // For objects, do deep merge
      return { ...oldPayload, ...newPayload };
    }
    // For primitive values, take the new one
    return newPayload;
  }

  /**
   * Processes all pending broadcasts
   */
  private processPendingBroadcasts(): void {
    if (this.pendingUpdates.size === 0) return;

    // Process all pending updates
    for (const update of this.pendingUpdates.values()) {
      this.handleStateUpdate(update, -1);
    }

    // Clear pending updates
    this.pendingUpdates.clear();
  }

  /**
   * Returns count of active connections
   */
  public get connectionCount(): number {
    return this.connections.length;
  }

  /**
   * Handles state update from a window
   */
  private handleStateUpdate(update: QueuedStateUpdate, senderId: number): void {
    try {
      // Notify all handlers
      this.updateHandlers.forEach(handler => {
        try {
          handler(update);
        } catch (err) {
          console.error('Error in state update handler:', err);
        }
      });

      // Broadcast to all other windows
      this.connections
        .filter(conn => conn.id !== senderId)
        .forEach(conn => {
          try {
            conn.port.postMessage(update);
          } catch (err) {
            console.error(`Failed to send update to window ${conn.id}:`, err);
            // Remove failed connection
            this.handleDisconnect(conn.id);
          }
        });
    } catch (error) {
      console.error('Error broadcasting state update:', error);
    }
  }
}