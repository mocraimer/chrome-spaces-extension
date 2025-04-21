/**
 * Represents a collection of tabs as a named space
 */
export interface Space {
  id: string;
  name: string;
  urls: string[];
  lastModified: number;
  named: boolean;
  version: number; // Tracks state version for sync
  lastSync?: number; // Last successful sync timestamp
  sourceWindowId?: string; // ID of window that last modified this space
}

export interface SpaceState {
  spaces: Record<string, Space>;
  closedSpaces: Record<string, Space>;
  currentWindowId: string | null;
  isLoading: boolean;
  error: string | null;
}

export interface SpaceActions {
  createSpace(windowId: number, tabs: chrome.tabs.Tab[]): Promise<void>;
  updateSpaceTabs(windowId: number, tabs: chrome.tabs.Tab[]): Promise<void>;
  closeSpace(windowId: number): Promise<void>;
  renameSpace(windowId: number, name: string): Promise<boolean>;
  removeClosedSpace(spaceId: string): Promise<boolean>;
}
