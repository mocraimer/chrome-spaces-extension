import { Space } from '@/shared/types/Space';

export type RestoreStatus = 'pending_window' | 'window_attached' | 'finalized' | 'failed';

export interface RestoreSnapshot {
  spaceId: string;
  permanentId: string;
  originalName: string;
  named: boolean;
  urls: string[];
  closedSpaceId?: string;
  requestedAt: number;
  windowId?: number;
  status: RestoreStatus;
  expectedType?: string;
}

export class RestoreRegistry {
  private bySpaceId = new Map<string, RestoreSnapshot>();
  private byWindowId = new Map<number, RestoreSnapshot>();
  private pendingQueue: string[] = [];

  registerPending(space: Space, closedSpaceId: string, expectedType: string = 'normal'): RestoreSnapshot {
    const snapshot: RestoreSnapshot = {
      spaceId: space.id,
      permanentId: space.permanentId,
      originalName: space.name,
      named: space.named,
      urls: [...(space.urls || [])],
      closedSpaceId,
      requestedAt: Date.now(),
      status: 'pending_window',
      expectedType
    };

    this.bySpaceId.set(closedSpaceId, snapshot);
    this.pendingQueue.push(closedSpaceId);
    return snapshot;
  }

  attachWindow(closedSpaceId: string, windowId: number): RestoreSnapshot | null {
    const snapshot = this.bySpaceId.get(closedSpaceId);
    if (!snapshot) return null;

    snapshot.windowId = windowId;
    snapshot.status = 'window_attached';
    this.byWindowId.set(windowId, snapshot);
    return snapshot;
  }

  claimPendingWindow(window: chrome.windows.Window): RestoreSnapshot | null {
    if (!window.id) return null;
    const actualType = window.type || 'normal';

    // Iterate through pending queue to find a matching request
    for (let i = 0; i < this.pendingQueue.length; i++) {
      const closedSpaceId = this.pendingQueue[i];
      const snapshot = this.bySpaceId.get(closedSpaceId);
      
      if (!snapshot || snapshot.status !== 'pending_window') continue;

      // 1. Type Check
      // Default expectation is 'normal' if not specified
      const expectedType = snapshot.expectedType || 'normal';
      
      // If types mismatch, this window is definitely not for this restore
      if (actualType !== expectedType) {
        console.log(`[RestoreRegistry] Window ${window.id} type mismatch for space ${closedSpaceId}: expected ${expectedType}, got ${actualType}`);
        continue;
      }

      // 2. URL Check (if available)
      // If window.tabs is populated, we can check if the URLs match the snapshot
      // This is a heuristic: if we find >50% match, we claim it.
      // If window.tabs is empty (common in onCreated), we assume it's a match based on type and ordering.
      if (window.tabs && window.tabs.length > 0 && snapshot.urls.length > 0) {
        const windowUrls = window.tabs.map(t => t.url || '').filter(u => u);
        const matchCount = windowUrls.filter(url => snapshot.urls.includes(url)).length;
        
        // If we have URLs but none match, it's likely an unrelated window (e.g. user opened a specific bookmark)
        if (matchCount === 0 && windowUrls.length > 0) {
           // Special case: new tab page might be ignored?
           // If user opened "google.com", matchCount is 0.
           console.log(`[RestoreRegistry] Window ${window.id} URL mismatch for space ${closedSpaceId}`);
           continue;
        }
      }

      // Found a match!
      this.pendingQueue.splice(i, 1); // Remove from queue
      snapshot.windowId = window.id;
      snapshot.status = 'window_attached';
      this.byWindowId.set(window.id, snapshot);
      
      console.log(`[RestoreRegistry] Claimed window ${window.id} for space ${closedSpaceId}`);
      return snapshot;
    }

    return null;
  }

  getByClosedSpaceId(closedSpaceId: string): RestoreSnapshot | null {
    return this.bySpaceId.get(closedSpaceId) ?? null;
  }

  getByWindowId(windowId: number): RestoreSnapshot | null {
    return this.byWindowId.get(windowId) ?? null;
  }

  finalize(windowId: number): void {
    const snapshot = this.byWindowId.get(windowId);
    if (!snapshot) return;

    snapshot.status = 'finalized';
    if (snapshot.closedSpaceId) {
      this.pendingQueue = this.pendingQueue.filter(id => id !== snapshot.closedSpaceId);
    }
    if (snapshot.closedSpaceId) {
      this.bySpaceId.delete(snapshot.closedSpaceId);
    }
    this.byWindowId.delete(windowId);
  }

  fail(closedSpaceId: string, reason?: string): void {
    const snapshot = this.bySpaceId.get(closedSpaceId);
    if (!snapshot) return;

    snapshot.status = 'failed';
    if (snapshot.windowId !== undefined) {
      this.byWindowId.delete(snapshot.windowId);
    }
    this.bySpaceId.delete(closedSpaceId);
    this.pendingQueue = this.pendingQueue.filter(id => id !== closedSpaceId);

    if (reason) {
      console.warn('[RestoreRegistry] Marked restore as failed', {
        closedSpaceId,
        windowId: snapshot.windowId,
        reason
      });
    }
  }

  isWindowRestoring(windowId: number): boolean {
    return this.byWindowId.has(windowId);
  }

  listActive(): RestoreSnapshot[] {
    return Array.from(this.bySpaceId.values());
  }

  /**
   * Clean up stale restoration entries that have been pending/attached too long.
   * This prevents windows from being stuck in "restoring" state indefinitely.
   * @param maxAgeMs Maximum age in milliseconds before an entry is considered stale (default: 30 seconds)
   */
  cleanupStale(maxAgeMs: number = 30000): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [closedSpaceId, snapshot] of this.bySpaceId.entries()) {
      const age = now - snapshot.requestedAt;
      if (age > maxAgeMs) {
        console.warn('[RestoreRegistry] Cleaning up stale restoration entry', {
          closedSpaceId,
          windowId: snapshot.windowId,
          status: snapshot.status,
          ageMs: age
        });

        // Clean up all references
        if (snapshot.windowId !== undefined) {
          this.byWindowId.delete(snapshot.windowId);
        }
        this.bySpaceId.delete(closedSpaceId);
        this.pendingQueue = this.pendingQueue.filter(id => id !== closedSpaceId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[RestoreRegistry] Cleaned up ${cleanedCount} stale restoration entries`);
    }

    return cleanedCount;
  }
}
