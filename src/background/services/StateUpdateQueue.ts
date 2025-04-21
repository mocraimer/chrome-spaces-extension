/**
 * Implements a simple debounce function
 */
function debounce(fn: Function, delay: number): () => void {
  let timeoutId: NodeJS.Timeout;
  return () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(), delay);
  };
}

/**
 * Interface for queued state updates
 */
export interface QueuedStateUpdate<T = any> {
  id: string;
  type: string;
  payload: T;
  timestamp: number;
  priority?: number;
}

/**
 * Configuration options for state updates
 */
export interface StateUpdateOptions {
  /** Debounce time in milliseconds for storage commits */
  debounceTime?: number;
  /** Maximum queue size before forced processing */
  maxQueueSize?: number;
  /** Whether to validate updates before processing */
  validateUpdates?: boolean;
}

/**
 * Custom error class for state update errors
 */
export class StateUpdateError extends Error {
  constructor(message: string, public readonly update?: QueuedStateUpdate) {
    super(message);
    this.name = 'StateUpdateError';
  }
}

/**
 * Manages atomic state updates with queuing and storage synchronization
 */
export class StateUpdateQueue {
  private queue: QueuedStateUpdate[] = [];
  private processing = false;
  private options: Required<StateUpdateOptions>;
  private rollbackSnapshot: QueuedStateUpdate[] = [];
  
  constructor(options: StateUpdateOptions = {}) {
    this.options = {
      debounceTime: options.debounceTime ?? 200,
      maxQueueSize: options.maxQueueSize ?? 100,
      validateUpdates: options.validateUpdates ?? true
    };

    // Initialize debounced storage commit
    this.commitToStorage = debounce(this.processStorageCommit.bind(this), this.options.debounceTime);
  }

  /**
   * Enqueues a state update operation
   */
  public async enqueue<T>(update: Omit<QueuedStateUpdate<T>, 'timestamp'>): Promise<void> {
    try {
      const queuedUpdate = {
        ...update,
        timestamp: Date.now()
      };

      // Validate update if enabled
      if (this.options.validateUpdates) {
        this.validateUpdate(queuedUpdate);
      }

      this.queue.push(queuedUpdate);

      // Process queue if it exceeds max size
      if (this.queue.length >= this.options.maxQueueSize) {
        await this.processQueue();
      } else {
        // Schedule debounced processing
        this.commitToStorage();
      }
    } catch (error) {
      throw new StateUpdateError(
        `Failed to enqueue update: ${error instanceof Error ? error.message : 'Unknown error'}`,
        update as QueuedStateUpdate
      );
    }
  }

  /**
   * Processes all queued updates atomically
   */
  public async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;
    this.rollbackSnapshot = [...this.queue];

    try {
      // Sort updates by timestamp and priority
      const sortedUpdates = this.sortUpdates(this.rollbackSnapshot);
      
      // Process updates atomically
      await this.processUpdates(sortedUpdates);
      
      // Remove processed updates from queue
      this.queue = this.queue.filter(
        update => !this.rollbackSnapshot.find(s => s.id === update.id)
      );

      // Clear rollback snapshot after successful processing
      this.rollbackSnapshot = [];
    } catch (error) {
      // Rollback on error
      await this.handleError(error);
      throw error;
    } finally {
      this.processing = false;
    }
  }

  /**
   * Clears all pending updates from the queue
   */
  public clear(): void {
    this.queue = [];
    this.rollbackSnapshot = [];
  }

  /**
   * Returns current queue length
   */
  public get length(): number {
    return this.queue.length;
  }

  /**
   * Returns whether queue is currently processing
   */
  public get isProcessing(): boolean {
    return this.processing;
  }

  /**
   * Validates an update before enqueueing
   */
  private validateUpdate(update: QueuedStateUpdate): void {
    if (!update.id || !update.type) {
      throw new StateUpdateError('Invalid update: missing required fields', update);
    }

    if (typeof update.payload === 'undefined') {
      throw new StateUpdateError('Invalid update: payload is required', update);
    }
  }

  /**
   * Sorts updates by timestamp and priority
   */
  private sortUpdates(updates: QueuedStateUpdate[]): QueuedStateUpdate[] {
    return [...updates].sort((a, b) => {
      // Sort by priority first (higher priority first)
      const priorityDiff = (b.priority || 0) - (a.priority || 0);
      if (priorityDiff !== 0) return priorityDiff;
      
      // Then by timestamp
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Processes updates atomically
   */
  private async processUpdates(updates: QueuedStateUpdate[]): Promise<void> {
    // Implementation will be integrated with StorageManager
    // This is a placeholder for the actual storage commit logic
    console.log('Processing updates:', updates);
  }

  /**
   * Handles errors during processing
   */
  private async handleError(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error processing updates:', errorMessage);

    // Restore queue from snapshot for rollback
    if (this.rollbackSnapshot.length > 0) {
      this.queue = [...this.rollbackSnapshot];
      this.rollbackSnapshot = [];
    }
  }

  /**
   * Commits queued updates to storage
   */
  private async processStorageCommit(): Promise<void> {
    await this.processQueue();
  }

  // Debounced storage commit function
  private commitToStorage: () => void;
}