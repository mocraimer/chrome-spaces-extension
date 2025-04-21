import { QueuedStateUpdate } from './StateUpdateQueue';

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
export class StateBroadcastService {
  private connections: ConnectedWindow[] = [];
  private static readonly CONNECTION_NAME = 'state-sync';

  constructor() {
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
  public broadcast(update: QueuedStateUpdate): void {
    // No sender ID means broadcast to all windows
    this.handleStateUpdate(update, -1);
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