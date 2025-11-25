/**
 * LockManager - A proper mutex-style lock with queuing and deadlock prevention.
 *
 * Fixes the following issues in the original StateManager locking:
 * 1. Check-then-act race condition in acquireLock()
 * 2. Deadlock risk when acquiring multiple locks
 * 3. No timeout support for hung operations
 * 4. No queuing mechanism for waiting operations
 */

export interface LockOptions {
  /** Timeout in ms for lock acquisition (default: 30000) */
  timeout?: number;
  /** Optional operation name for debugging */
  operationId?: string;
}

export class LockManager {
  private locks = new Map<string, Promise<void>>();
  private queues = new Map<string, Array<{ tryAcquire: () => void; timeoutId: NodeJS.Timeout }>>();
  private lockHolders = new Map<string, string>(); // For debugging: lockId -> operationId

  private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds

  /**
   * Acquire a single lock. Queues if already held.
   * Returns a release function that MUST be called when done.
   */
  async acquire(lockId: string, options: LockOptions = {}): Promise<() => void> {
    const timeout = options.timeout ?? LockManager.DEFAULT_TIMEOUT;
    const operationId = options.operationId ?? 'unknown';

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Remove from queue on timeout
        const queue = this.queues.get(lockId);
        if (queue) {
          const idx = queue.findIndex(item => item.tryAcquire === tryAcquire);
          if (idx !== -1) {
            queue.splice(idx, 1);
          }
        }
        const holder = this.lockHolders.get(lockId) || 'unknown';
        reject(new Error(`Lock acquisition timeout for "${lockId}" after ${timeout}ms (held by: ${holder}, requested by: ${operationId})`));
      }, timeout);

      const tryAcquire = () => {
        // In single-threaded JS, this check-then-set is atomic within the same event loop tick
        if (!this.locks.has(lockId)) {
          clearTimeout(timeoutId);

          let releaseResolver: () => void;
          const lockPromise = new Promise<void>(res => {
            releaseResolver = res;
          });

          this.locks.set(lockId, lockPromise);
          this.lockHolders.set(lockId, operationId);

          const release = () => {
            if (!this.locks.has(lockId)) {
              console.warn(`[LockManager] Attempted to release already-released lock: ${lockId}`);
              return;
            }

            this.locks.delete(lockId);
            this.lockHolders.delete(lockId);
            releaseResolver!();

            // Process next waiter in queue
            const queue = this.queues.get(lockId);
            if (queue && queue.length > 0) {
              const next = queue.shift()!;
              clearTimeout(next.timeoutId); // Clear the old timeout before trying
              // Use queueMicrotask to ensure we're in a new microtask
              queueMicrotask(() => next.tryAcquire());
            }
          };

          resolve(release);
        } else {
          // Lock is held - add to queue
          let queue = this.queues.get(lockId);
          if (!queue) {
            queue = [];
            this.queues.set(lockId, queue);
          }
          queue.push({ tryAcquire, timeoutId });
        }
      };

      tryAcquire();
    });
  }

  /**
   * Acquire multiple locks atomically in sorted order (prevents deadlock).
   *
   * CRITICAL: Always acquires in consistent (sorted) order to prevent ABBA deadlock.
   * If thread 1 tries to lock [A, B] and thread 2 tries to lock [B, A],
   * both will acquire in order [A, B], preventing circular wait.
   *
   * Returns a single release function that releases all locks in reverse order.
   */
  async acquireMultiple(lockIds: string[], options: LockOptions = {}): Promise<() => void> {
    if (lockIds.length === 0) {
      return () => {}; // No-op release for empty lock list
    }

    if (lockIds.length === 1) {
      return this.acquire(lockIds[0], options);
    }

    // Sort lock IDs to ensure consistent acquisition order across all callers
    const sortedIds = [...lockIds].sort();
    const releases: Array<() => void> = [];

    try {
      for (const id of sortedIds) {
        const release = await this.acquire(id, {
          ...options,
          operationId: `${options.operationId || 'multi'}[${id}]`
        });
        releases.push(release);
      }

      // Return a combined release function that releases in reverse order
      return () => {
        for (let i = releases.length - 1; i >= 0; i--) {
          try {
            releases[i]();
          } catch (err) {
            console.error(`[LockManager] Error releasing lock at index ${i}:`, err);
          }
        }
      };
    } catch (error) {
      // Rollback: release any locks we did acquire
      for (const release of releases) {
        try {
          release();
        } catch (err) {
          console.error('[LockManager] Error during rollback release:', err);
        }
      }
      throw error;
    }
  }

  /**
   * Check if a lock is currently held (for debugging only)
   */
  isLocked(lockId: string): boolean {
    return this.locks.has(lockId);
  }

  /**
   * Get the operation holding a lock (for debugging only)
   */
  getLockHolder(lockId: string): string | undefined {
    return this.lockHolders.get(lockId);
  }

  /**
   * Get count of waiters for a lock (for debugging only)
   */
  getQueueLength(lockId: string): number {
    return this.queues.get(lockId)?.length ?? 0;
  }
}
