import { StorageManager as IStorageManager } from '@/shared/types/Services';
import { Space, ChromeSpacesStorage, MigrationData } from '@/shared/types/Space';
import { executeChromeApi, typeGuards } from '@/shared/utils';
import { STORAGE_KEY } from '@/shared/constants';

const CURRENT_STORAGE_VERSION = 1;

export class StorageManager implements IStorageManager {
  private static validateSpaces(spaces: unknown): Record<string, Space> {
    if (typeof spaces !== 'object' || spaces === null) {
      throw new Error('Invalid spaces data structure');
    }

    const validated: Record<string, Space> = {};
    for (const [key, value] of Object.entries(spaces)) {
      // Use legacy space guard for migration, then convert to full space
      if (typeGuards.legacySpace(value)) {
        // Convert legacy space to new format
        const legacySpace = value as any;
        validated[key] = this.migrateLegacySpace(legacySpace);
      } else if (typeGuards.space(value)) {
        validated[key] = value;
      } else {
        throw new Error(`Invalid space data for key: ${key}`);
      }
    }

    return validated;
  }

  private static migrateLegacySpace(legacySpace: any): Space {
    return {
      ...legacySpace,
      permanentId: legacySpace.permanentId || this.generatePermanentId(),
      createdAt: legacySpace.createdAt || Date.now(),
      lastUsed: legacySpace.lastUsed || Date.now(),
      isActive: legacySpace.isActive || false,
      customName: legacySpace.customName,
      windowId: legacySpace.windowId,
      version: legacySpace.version || 1
    };
  }

  private static generatePermanentId(): string {
    return 'space_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Load the complete storage structure
   */
  private async loadStorage(): Promise<ChromeSpacesStorage> {
    return executeChromeApi(
      async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const storedData = data[STORAGE_KEY];
        
        if (!storedData) {
          // Check if migration is needed
          return await this.migrateFromLegacyStorage();
        }

        // Validate and return existing storage
        const storage: ChromeSpacesStorage = {
          spaces: StorageManager.validateSpaces(storedData.spaces || {}),
          closedSpaces: StorageManager.validateSpaces(storedData.closedSpaces || {}),
          permanentIdMappings: storedData.permanentIdMappings || {},
          lastModified: storedData.lastModified || Date.now(),
          version: storedData.version || CURRENT_STORAGE_VERSION
        };

        return storage;
      },
      'STORAGE_ERROR'
    );
  }

  /**
   * Save the complete storage structure
   */
  private async saveStorage(storage: ChromeSpacesStorage): Promise<void> {
    await executeChromeApi(
      async () => {
        storage.lastModified = Date.now();
        await chrome.storage.local.set({
          [STORAGE_KEY]: storage
        });

        // Verify the write was successful by reading back
        const verification = await chrome.storage.local.get(STORAGE_KEY);
        if (!verification[STORAGE_KEY] || verification[STORAGE_KEY].lastModified !== storage.lastModified) {
          throw new Error('Storage verification failed - data was not persisted correctly');
        }
      },
      'STORAGE_ERROR'
    );
  }

  /**
   * Migrate from legacy storage format
   */
  private async migrateFromLegacyStorage(): Promise<ChromeSpacesStorage> {
    console.log('[StorageManager] Migrating from legacy storage format');
    
    // Load legacy data
    const legacyKeys = ['spaceCustomNames', 'spacePermanentIds', 'closedSpaces'];
    const legacyData = await chrome.storage.local.get(legacyKeys);
    
    const migrationData: MigrationData = {
      spaceCustomNames: legacyData.spaceCustomNames || {},
      spacePermanentIds: legacyData.spacePermanentIds || {},
      closedSpaces: legacyData.closedSpaces || []
    };

    // Initialize new storage structure
    const newStorage: ChromeSpacesStorage = {
      spaces: {},
      closedSpaces: {},
      permanentIdMappings: migrationData.spacePermanentIds || {},
      lastModified: Date.now(),
      version: CURRENT_STORAGE_VERSION
    };

    // Migrate closed spaces from legacy format
    if (migrationData.closedSpaces && Array.isArray(migrationData.closedSpaces)) {
      for (const closedSpace of migrationData.closedSpaces) {
        if (closedSpace && typeof closedSpace === 'object') {
          const spaceId = closedSpace.id || StorageManager.generatePermanentId();
          const customName = migrationData.spaceCustomNames?.[closedSpace.permanentId]?.customName;
          
          newStorage.closedSpaces[spaceId] = {
            id: spaceId,
            name: closedSpace.name || 'Untitled Space',
            urls: closedSpace.urls || [],
            lastModified: closedSpace.closedAt || Date.now(),
            named: !!customName,
            version: 1,
            permanentId: closedSpace.permanentId || StorageManager.generatePermanentId(),
            customName: customName,
            createdAt: closedSpace.createdAt || Date.now(),
            lastUsed: closedSpace.closedAt || Date.now(),
            isActive: false,
            windowId: undefined
          };
        }
      }
    }

    // Save new storage format
    await this.saveStorage(newStorage);

    // Clean up legacy storage (optional, for now keep for safety)
    // await chrome.storage.local.remove(legacyKeys);

    console.log('[StorageManager] Migration completed');
    return newStorage;
  }

  /**
   * Get or create permanent ID for a window
   */
  async getPermanentId(windowId: number): Promise<string> {
    const storage = await this.loadStorage();
    const windowIdStr = windowId.toString();
    
    let permanentId = storage.permanentIdMappings[windowIdStr];
    if (!permanentId) {
      permanentId = StorageManager.generatePermanentId();
      storage.permanentIdMappings[windowIdStr] = permanentId;
      await this.saveStorage(storage);
    }
    
    return permanentId;
  }

  /**
   * Save active spaces to storage
   */
  async saveSpaces(spaces: Record<string, Space>): Promise<void> {
    const storage = await this.loadStorage();
    storage.spaces = spaces;
    await this.saveStorage(storage);
  }

  /**
   * Load active spaces from storage
   */
  async loadSpaces(): Promise<Record<string, Space>> {
    const storage = await this.loadStorage();
    return storage.spaces;
  }

  /**
   * Save closed spaces to storage
   */
  async saveClosedSpaces(spaces: Record<string, Space>): Promise<void> {
    console.log('[StorageManager] Saving closed spaces:', spaces);
    const storage = await this.loadStorage();
    storage.closedSpaces = spaces;
    await this.saveStorage(storage);
  }

  /**
   * Load closed spaces from storage
   */
  async loadClosedSpaces(): Promise<Record<string, Space>> {
    const storage = await this.loadStorage();
    return storage.closedSpaces;
  }

  /**
   * Update space custom name
   */
  async updateSpaceCustomName(spaceId: string, customName: string): Promise<void> {
    const storage = await this.loadStorage();

    // Update in active spaces
    if (storage.spaces[spaceId]) {
      storage.spaces[spaceId].customName = customName;
      storage.spaces[spaceId].name = customName; // Keep name field in sync
      storage.spaces[spaceId].named = true;
      storage.spaces[spaceId].lastModified = Date.now();
      storage.spaces[spaceId].version = (storage.spaces[spaceId].version || 1) + 1;
    }

    // Update in closed spaces
    if (storage.closedSpaces[spaceId]) {
      storage.closedSpaces[spaceId].customName = customName;
      storage.closedSpaces[spaceId].name = customName; // Keep name field in sync
      storage.closedSpaces[spaceId].named = true;
      storage.closedSpaces[spaceId].lastModified = Date.now();
      storage.closedSpaces[spaceId].version = (storage.closedSpaces[spaceId].version || 1) + 1;
    }

    // Add error handling for storage operation
    try {
      await this.saveStorage(storage);
    } catch (error) {
      throw new Error(`Failed to save custom name to storage: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a new space with all required fields
   */
  async createSpace(windowId: number, name: string, urls: string[], customName?: string): Promise<Space> {
    const permanentId = await this.getPermanentId(windowId);
    
    const space: Space = {
      id: windowId.toString(),
      name: name,
      urls: urls,
      lastModified: Date.now(),
      named: !!customName,
      version: 1,
      permanentId: permanentId,
      customName: customName,
      createdAt: Date.now(),
      lastUsed: Date.now(),
      isActive: true,
      windowId: windowId,
      sourceWindowId: windowId.toString() // Set sourceWindowId to enable hasSpace checks
    };

    return space;
  }

  /**
   * Clear all stored data
   */
  async clear(): Promise<void> {
    await executeChromeApi(
      async () => {
        await chrome.storage.local.remove(STORAGE_KEY);
      },
      'STORAGE_ERROR'
    );
  }

  /**
   * Export all spaces data
   */
  async exportData(): Promise<string> {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    return JSON.stringify(data[STORAGE_KEY] || {}, null, 2);
  }

  /**
   * Import spaces data from JSON
   */
  async importData(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      if (data.spaces) {
        StorageManager.validateSpaces(data.spaces);
      }
      if (data.closedSpaces) {
        StorageManager.validateSpaces(data.closedSpaces);
      }

      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          ...data,
          lastModified: Date.now()
        }
      });
    } catch (error) {
      throw new Error(`Invalid import data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
