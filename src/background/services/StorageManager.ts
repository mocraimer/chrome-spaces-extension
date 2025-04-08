import { StorageManager as IStorageManager } from '@/shared/types/Services';
import { Space } from '@/shared/types/Space';
import { executeChromeApi, typeGuards } from '@/shared/utils';
import { STORAGE_KEY } from '@/shared/constants';

export class StorageManager implements IStorageManager {
  private static validateSpaces(spaces: unknown): Record<string, Space> {
    if (typeof spaces !== 'object' || spaces === null) {
      throw new Error('Invalid spaces data structure');
    }

    const validated: Record<string, Space> = {};
    for (const [key, value] of Object.entries(spaces)) {
      if (!typeGuards.space(value)) {
        throw new Error(`Invalid space data for key: ${key}`);
      }
      validated[key] = value;
    }

    return validated;
  }

  /**
   * Save active spaces to storage
   */
  async saveSpaces(spaces: Record<string, Space>): Promise<void> {
    await executeChromeApi(
      async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const storedData = data[STORAGE_KEY] || {};
        await chrome.storage.local.set({
          [STORAGE_KEY]: {
            ...storedData,
            spaces,
            lastModified: Date.now()
          }
        });
      },
      'STORAGE_ERROR'
    );
  }

  /**
   * Load active spaces from storage
   */
  async loadSpaces(): Promise<Record<string, Space>> {
    return executeChromeApi(
      async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (!data[STORAGE_KEY]?.spaces) {
          return {};
        }
        return StorageManager.validateSpaces(data[STORAGE_KEY].spaces);
      },
      'STORAGE_ERROR'
    );
  }

  /**
   * Save closed spaces to storage
   */
  async saveClosedSpaces(spaces: Record<string, Space>): Promise<void> {
    await executeChromeApi(
      async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        const storedData = data[STORAGE_KEY] || {};
        await chrome.storage.local.set({
          [STORAGE_KEY]: {
            ...storedData,
            closedSpaces: spaces,
            lastModified: Date.now()
          }
        });
      },
      'STORAGE_ERROR'
    );
  }

  /**
   * Load closed spaces from storage
   */
  async loadClosedSpaces(): Promise<Record<string, Space>> {
    return executeChromeApi(
      async () => {
        const data = await chrome.storage.local.get(STORAGE_KEY);
        if (!data[STORAGE_KEY]?.closedSpaces) {
          return {};
        }
        return StorageManager.validateSpaces(data[STORAGE_KEY].closedSpaces);
      },
      'STORAGE_ERROR'
    );
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
