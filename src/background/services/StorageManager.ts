import { StorageManager as IStorageManager, TabRecord } from '@/shared/types/Services';
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
    // If legacy space had customName, use it for name and mark as named
    const name = legacySpace.customName || legacySpace.name;
    const named = !!legacySpace.customName || legacySpace.named;

    return {
      ...legacySpace,
      name,
      named,
      permanentId: legacySpace.permanentId || this.generatePermanentId(),
      createdAt: legacySpace.createdAt || Date.now(),
      lastUsed: legacySpace.lastUsed || Date.now(),
      isActive: legacySpace.isActive || false,
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

        console.log('[StorageManager] Loading storage from chrome.storage.local');
        console.log('[StorageManager] Raw storage data:', storedData ? 'exists' : 'null/undefined');

        if (!storedData) {
          console.log('[StorageManager] No stored data found, initiating migration');
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

        console.log('[StorageManager] Loaded storage:', {
          activeSpacesCount: Object.keys(storage.spaces).length,
          closedSpacesCount: Object.keys(storage.closedSpaces).length,
          lastModified: new Date(storage.lastModified).toISOString(),
          version: storage.version
        });

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

        console.log('[StorageManager] Saving storage to chrome.storage.local:', {
          activeSpacesCount: Object.keys(storage.spaces).length,
          closedSpacesCount: Object.keys(storage.closedSpaces).length,
          lastModified: new Date(storage.lastModified).toISOString(),
          version: storage.version,
          activeSpaceIds: Object.keys(storage.spaces),
          closedSpaceIds: Object.keys(storage.closedSpaces)
        });

        await chrome.storage.local.set({
          [STORAGE_KEY]: storage
        });

        console.log('[StorageManager] Storage write completed, performing verification...');

        // Verify the write was successful by reading back
        const verification = await chrome.storage.local.get(STORAGE_KEY);
        if (!verification[STORAGE_KEY]) {
          console.error('[StorageManager] ❌ Storage verification FAILED!', {
            verificationExists: !!verification[STORAGE_KEY]
          });
          throw new Error('Storage verification failed - data was not persisted correctly');
        }

        console.log('[StorageManager] ✅ Storage verification passed');
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
          const legacyCustomName = migrationData.spaceCustomNames?.[closedSpace.permanentId]?.customName;

          newStorage.closedSpaces[spaceId] = {
            id: spaceId,
            name: legacyCustomName || closedSpace.name || 'Untitled Space',  // Use legacy customName if available
            urls: closedSpace.urls || [],
            lastModified: closedSpace.closedAt || Date.now(),
            named: !!legacyCustomName,
            version: 1,
            permanentId: closedSpace.permanentId || StorageManager.generatePermanentId(),
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
   * Update the permanent ID mapping for a window ID
   * Used when re-keying spaces during restoration
   */
  async updatePermanentIdMapping(windowId: number, permanentId: string): Promise<void> {
    const storage = await this.loadStorage();
    const windowIdStr = windowId.toString();
    storage.permanentIdMappings[windowIdStr] = permanentId;
    await this.saveStorage(storage);
    console.log(`[StorageManager] Updated permanent ID mapping: ${windowIdStr} → ${permanentId}`);
  }

  /**
   * Save active spaces to storage
   */
  async saveSpaces(spaces: Record<string, Space>): Promise<void> {
    console.log('[StorageManager] saveSpaces() called', {
      count: Object.keys(spaces).length,
      spaceIds: Object.keys(spaces),
      customNames: Object.entries(spaces).map(([id, space]) => ({ id, name: space.name, named: space.named }))
    });

    const storage = await this.loadStorage();
    storage.spaces = spaces;
    await this.saveStorage(storage);

    console.log('[StorageManager] saveSpaces() completed successfully');
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
    console.log('[StorageManager] saveClosedSpaces() called', {
      count: Object.keys(spaces).length,
      spaceIds: Object.keys(spaces),
      customNames: Object.entries(spaces).map(([id, space]) => ({ id, name: space.name, named: space.named })),
      fullData: spaces
    });

    const storage = await this.loadStorage();
    storage.closedSpaces = spaces;
    await this.saveStorage(storage);

    console.log('[StorageManager] saveClosedSpaces() completed successfully');
  }

  /**
   * Load closed spaces from storage
   */
  async loadClosedSpaces(): Promise<Record<string, Space>> {
    const storage = await this.loadStorage();
    return storage.closedSpaces;
  }


  /**
   * Create a new space with all required fields
   */
  async createSpace(windowId: number, name: string, urls: string[], named: boolean = false): Promise<Space> {
    const permanentId = await this.getPermanentId(windowId);

    const space: Space = {
      id: windowId.toString(),
      name: name,
      urls: urls,
      lastModified: Date.now(),
      named,
      version: 1,
      permanentId: permanentId,
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

  // Stub implementations for tab-related methods (legacy StorageManager doesn't support tabs)
  async loadTabsForSpace(_spaceId: string, _kind: 'active' | 'closed'): Promise<TabRecord[]> {
    // Legacy StorageManager doesn't support tabs - return empty array
    return [];
  }

  async saveTabsForSpace(_spaceId: string, _kind: 'active' | 'closed', _tabs: TabRecord[]): Promise<void> {
    // Legacy StorageManager doesn't support tabs - no-op
  }

  async deleteTabsForSpace(_spaceId: string, _kind: 'active' | 'closed'): Promise<void> {
    // Legacy StorageManager doesn't support tabs - no-op
  }
}
