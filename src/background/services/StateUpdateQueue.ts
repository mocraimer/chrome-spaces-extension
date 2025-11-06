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
  /** Batch window time in milliseconds */
  batchWindow?: number;
  /** Debounce time in milliseconds for storage commits */
  debounceTime?: number;
  /** Maximum queue size before forced processing */
  maxQueueSize?: number;
  /** Whether to validate updates before processing */
  validateUpdates?: boolean;
  /** Whether to compress state diffs */
  compressDiffs?: boolean;
}

export enum StateUpdatePriority {
  CRITICAL = 1,
  HIGH = 2,
  NORMAL = 3,
  LOW = 4
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
  
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchedUpdates: Map<string, QueuedStateUpdate> = new Map();

  constructor(options: StateUpdateOptions = {}) {
    this.options = {
      batchWindow: options.batchWindow ?? 50,
      debounceTime: options.debounceTime ?? 200,
      maxQueueSize: options.maxQueueSize ?? 100,
      validateUpdates: options.validateUpdates ?? true,
      compressDiffs: options.compressDiffs ?? true
    };

    // Initialize debounced storage commit
    this.commitToStorage = debounce(this.processStorageCommit.bind(this), this.options.debounceTime);
  }

  /**
   * Compresses state diff by removing redundant updates
   */
  private compressStateDiff(update: QueuedStateUpdate): QueuedStateUpdate {
    if (!this.options.compressDiffs) return update;

    // If this update supersedes a previous one for the same id, merge them
    const existing = this.batchedUpdates.get(update.id);
    if (existing && existing.timestamp + this.options.batchWindow! > Date.now()) {
      return {
        ...update,
        payload: this.mergePayloads(existing.payload, update.payload)
      };
    }

    return update;
  }

  /**
   * Merges two update payloads intelligently
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
   * Enqueues a state update operation
   */
  public async enqueue<T>(update: Omit<QueuedStateUpdate<T>, 'timestamp'>): Promise<void> {
    try {
      const queuedUpdate = {
        ...update,
        timestamp: Date.now(),
        priority: update.priority || StateUpdatePriority.NORMAL
      };

      // Validate update if enabled
      if (this.options.validateUpdates) {
        this.validateUpdate(queuedUpdate);
      }

      // Handle critical updates immediately
      if (queuedUpdate.priority === StateUpdatePriority.CRITICAL) {
        await this.processCriticalUpdate(queuedUpdate);
        return;
      }

      // Compress and batch non-critical updates
      const compressedUpdate = this.compressStateDiff(queuedUpdate);
      this.batchedUpdates.set(compressedUpdate.id, compressedUpdate);

      // Start or reset batch window timer
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }
      
      this.batchTimeout = setTimeout(async () => {
        await this.processBatchedUpdates();
      }, this.options.batchWindow);

      // Process immediately if queue is full
      if (this.batchedUpdates.size >= this.options.maxQueueSize) {
        await this.processBatchedUpdates();
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
    if (this.processing) {
      return;
    }

    // First, move any batched updates to the queue
    if (this.batchedUpdates.size > 0) {
      const updates = Array.from(this.batchedUpdates.values());
      this.batchedUpdates.clear();
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }
      this.queue.push(...updates);
    }

    // If queue is still empty after processing batched updates, return
    if (this.queue.length === 0) {
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
    this.batchedUpdates.clear();
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
  }

  /**
   * Returns current queue length
   */
  public get length(): number {
    return this.queue.length + this.batchedUpdates.size;
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
      // Sort by priority first (lower priority number = higher priority)
      // CRITICAL=1 should come before HIGH=2, etc.
      const priorityDiff = (a.priority || StateUpdatePriority.NORMAL) - (b.priority || StateUpdatePriority.NORMAL);
      if (priorityDiff !== 0) return priorityDiff;

      // Then by timestamp
      return a.timestamp - b.timestamp;
    });
  }

  /**
   * Processes updates atomically
   */
  /**
   * Processes a critical update immediately
   */
  private async processCriticalUpdate(update: QueuedStateUpdate): Promise<void> {
    this.queue.push(update);
    await this.processQueue();
  }

  /**
   * Processes all batched updates
   */
  private async processBatchedUpdates(): Promise<void> {
    if (this.batchedUpdates.size === 0) return;

    // Convert batched updates to array and clear batch
    const updates = Array.from(this.batchedUpdates.values());
    this.batchedUpdates.clear();

    // Add to main queue and process
    this.queue.push(...updates);
    await this.processQueue();
  }

  private async processUpdates(updates: QueuedStateUpdate[]): Promise<void> {
    try {
      // Group updates by priority
      const priorityGroups = new Map<number, QueuedStateUpdate[]>();
      updates.forEach(update => {
        const group = priorityGroups.get(update.priority || StateUpdatePriority.NORMAL) || [];
        group.push(update);
        priorityGroups.set(update.priority || StateUpdatePriority.NORMAL, group);
      });

      // Process updates in priority order
      for (let priority = StateUpdatePriority.CRITICAL; priority <= StateUpdatePriority.LOW; priority++) {
        const priorityUpdates = priorityGroups.get(priority) || [];
        for (const update of priorityUpdates) {
          await this.processUpdate(update);
        }
      }
    } catch (error) {
      console.error('Error processing updates batch:', error);
      throw error;
    }
  }

  /**
   * Processes a single update
   */
  private async processUpdate(update: QueuedStateUpdate): Promise<void> {
    // Implementation will be integrated with StorageManager
    console.log('Processing update:', update);
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