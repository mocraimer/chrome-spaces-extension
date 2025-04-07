import { WindowManager } from './WindowManager';
import { TabManager } from './TabManager';
import { StorageManager } from './StorageManager';
import {
  DEFAULT_SPACE_NAME,
  SPACE_NAME_MAX_LENGTH,
  SPACE_NAME_MIN_LENGTH
} from '@/shared/constants';
import { StateManager as IStateManager } from '@/shared/types/Services';
import type { Space } from '@/shared/types/Space';

export class StateManager implements IStateManager {
  private spaces: Record<string, Space> = {};
  private closedSpaces: Record<string, Space> = {};
  
  constructor(
    private windowManager: WindowManager,
    private tabManager: TabManager,
    private storageManager: StorageManager
  ) {}

  async initialize(): Promise<void> {
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();
  }

  getAllSpaces(): Record<string, Space> {
    return this.spaces;
  }

  getClosedSpaces(): Record<string, Space> {
    return this.closedSpaces;
  }

  hasSpace(windowId: number): boolean {
    return Object.values(this.spaces).some(space => space.id === windowId.toString());
  }

  async handleShutdown(): Promise<void> {
    await this.storageManager.saveSpaces(this.spaces);
    await this.storageManager.saveClosedSpaces(this.closedSpaces);
  }

  async synchronizeWindowsAndSpaces(): Promise<void> {
    // To be implemented
  }

  async createSpace(windowId: number): Promise<void> {
    const tabs = await this.tabManager.getTabs(windowId);
    const urls = tabs.map(tab => this.tabManager.getTabUrl(tab));

    const newSpace: Space = {
      id: windowId.toString(),
      name: `${DEFAULT_SPACE_NAME} ${windowId}`,
      urls,
      lastModified: Date.now()
    };

    this.spaces[windowId.toString()] = newSpace;
    await this.storageManager.saveSpaces(this.spaces);
  }

  async closeSpace(windowId: number): Promise<void> {
    const spaceId = windowId.toString();
    const space = this.spaces[spaceId];
    if (!space) return;

    // Move to closed spaces
    this.closedSpaces[spaceId] = space;
    delete this.spaces[spaceId];

    // Update storage
    await Promise.all([
      this.storageManager.saveSpaces(this.spaces),
      this.storageManager.saveClosedSpaces(this.closedSpaces)
    ]);
  }

  async renameSpace(windowId: number, name: string): Promise<void> {
    await this.setSpaceName(windowId.toString(), name);
  }

  async setSpaceName(spaceId: string, name: string): Promise<void> {
    const cleanName = name.trim().replace(/\s+/g, ' ');

    // Validate name length
    if (cleanName.length < SPACE_NAME_MIN_LENGTH) {
      throw new Error('Space name cannot be empty');
    }
    if (cleanName.length > SPACE_NAME_MAX_LENGTH) {
      throw new Error(`Space name cannot exceed ${SPACE_NAME_MAX_LENGTH} characters`);
    }

    // Load and ensure latest state
    const spaces = await this.storageManager.loadSpaces();
    this.spaces = spaces;
    
    if (!this.spaces[spaceId]) {
      throw new Error('Space not found');
    }

    // Update both in-memory and storage state atomically
    const updatedSpace = {
      ...this.spaces[spaceId],
      name: cleanName,
      lastModified: Date.now()
    };
    
    this.spaces[spaceId] = updatedSpace;
    await this.storageManager.saveSpaces(this.spaces);
  }

  async getSpaceName(spaceId: string): Promise<string> {
    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    // Find space in either active or closed spaces
    const space = this.spaces[spaceId] || this.closedSpaces[spaceId];
    if (space) {
      return space.name;
    }

    // Return default name using constant
    return `${DEFAULT_SPACE_NAME} ${spaceId}`;
  }

  private async getSpaceById(spaceId: string): Promise<Space | null> {
    // Load latest state
    this.spaces = await this.storageManager.loadSpaces();
    this.closedSpaces = await this.storageManager.loadClosedSpaces();

    return this.spaces[spaceId] || this.closedSpaces[spaceId] || null;
  }
}
