/**
 * Represents a collection of tabs as a named space
 */
export interface Space {
  id: string;
  name: string;               // Display name (user's custom name when named=true, auto-generated when named=false)
  urls: string[];
  lastModified: number;
  named: boolean;             // True if user explicitly set the name
  version: number;            // Tracks state version for sync
  lastSync?: number;          // Last successful sync timestamp
  sourceWindowId?: string;    // ID of window that last modified this space

  // UI fields (from popup)
  permanentId: string;        // Stable ID across browser restarts
  createdAt: number;          // When space was first created
  lastUsed: number;           // Last time space was accessed
  isActive: boolean;          // Whether window is currently open
  windowId?: number;          // Current window ID (if active)
}

/**
 * Storage structure for unified chrome_spaces key
 */
export interface ChromeSpacesStorage {
  spaces: Record<string, Space>;
  closedSpaces: Record<string, Space>;
  permanentIdMappings: Record<string, string>; // windowId -> permanentId
  lastModified: number;
  version: number; // Schema version for migrations
}

/**
 * Migration types for backward compatibility
 */
export interface LegacySpaceNameStorage {
  [permanentId: string]: {
    customName: string;
    lastModified: number;
    originalName: string;
  };
}

export interface MigrationData {
  spaceCustomNames?: LegacySpaceNameStorage;
  spacePermanentIds?: Record<string, string>;
  closedSpaces?: any[]; // Legacy closed spaces format
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
