import { openDB, IDBPDatabase } from 'idb';
import { TabRecord } from '../types/Services';

export const DB_NAME = 'chrome-spaces';
export const DB_VERSION = 2; // v1: spaces/closedSpaces/meta; v2: tabs + index

let cachedDb: IDBPDatabase | null = null;

export async function getDb(): Promise<IDBPDatabase> {
  if (cachedDb) return cachedDb;

  cachedDb = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('spaces', { keyPath: 'id' });
        db.createObjectStore('closedSpaces', { keyPath: 'id' });
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (oldVersion < 2) {
        const tabs = db.createObjectStore('tabs', { keyPath: 'id' });
        tabs.createIndex('tabs_by_spaceId', 'spaceId');
      }
    }
  });

  return cachedDb;
}

// Re-export TabRecord for convenience
export type { TabRecord };


