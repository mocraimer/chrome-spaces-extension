export interface Space {
  id: string;
  name: string;
  urls: string[];
  lastModified: number;
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
