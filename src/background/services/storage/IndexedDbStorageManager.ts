import { StorageManager as IStorageManager, TabRecord } from '@/shared/types/Services';
import { Space } from '@/shared/types/Space';
import { getDb } from '@/shared/db/indexedDb';
import { STORAGE_KEY } from '@/shared/constants';
import { executeChromeApi, typeGuards } from '@/shared/utils';
import { generateUUID } from '@/shared/utils/uuid';

export class IndexedDbStorageManager implements IStorageManager {
  private bootstrapped = false;

  private async ensureBootstrapped(): Promise<void> {
    if (this.bootstrapped) return;
    const db = await getDb();
    const [spacesCount, closedCount] = await Promise.all([
      db.count('spaces'),
      db.count('closedSpaces')
    ]);
    if (spacesCount > 0 || closedCount > 0) {
      this.bootstrapped = true;
      return;
    }

    try {
      const data = await executeChromeApi(async () => chrome.storage.local.get(STORAGE_KEY), 'STORAGE_ERROR');
      const legacy = data[STORAGE_KEY];
      if (!legacy || typeof legacy !== 'object') {
        this.bootstrapped = true;
        return;
      }

      // Validate and coerce legacy shapes
      const spaces: Record<string, Space> = {};
      for (const [id, val] of Object.entries(legacy.spaces || {})) {
        if (typeGuards.space(val)) spaces[id] = val as Space;
      }
      const closedSpaces: Record<string, Space> = {};
      for (const [id, val] of Object.entries(legacy.closedSpaces || {})) {
        if (typeGuards.space(val)) closedSpaces[id] = val as Space;
      }

      // Write into IDB
      const tx = db.transaction(['spaces', 'closedSpaces', 'tabs', 'meta'], 'readwrite');
      await tx.objectStore('spaces').clear();
      await tx.objectStore('closedSpaces').clear();
      for (const s of Object.values(spaces)) await tx.objectStore('spaces').put(s);
      for (const s of Object.values(closedSpaces)) await tx.objectStore('closedSpaces').put(s);

      // Derive tabs from urls for both active and closed
      const tabsStore = tx.objectStore('tabs');
      const now = Date.now();
      for (const s of Object.values(spaces)) {
        for (let i = 0; i < s.urls.length; i++) {
          await tabsStore.put({ id: generateUUID('tab'), spaceId: s.id, kind: 'active', url: s.urls[i], index: i, createdAt: now } as TabRecord);
        }
      }
      for (const [oldId, s] of Object.entries(closedSpaces)) {
        // Keep same ID for bootstrap; later operations will use UUIDs
        for (let i = 0; i < s.urls.length; i++) {
          await tabsStore.put({ id: generateUUID('tab'), spaceId: oldId, kind: 'closed', url: s.urls[i], index: i, createdAt: now } as TabRecord);
        }
      }

      await tx.objectStore('meta').put({ key: 'lastModified', value: Date.now() });
      await tx.done;
    } catch {
      // Ignore bootstrap failures; proceed empty (fast path)
    } finally {
      this.bootstrapped = true;
    }
  }
  async saveSpaces(spaces: Record<string, Space>): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['spaces', 'meta'], 'readwrite');
    const spacesStore = tx.objectStore('spaces');
    await spacesStore.clear();
    for (const space of Object.values(spaces)) {
      await spacesStore.put(space);
    }
    await tx.objectStore('meta').put({ key: 'lastModified', value: Date.now() });
    await tx.done;
  }

  async loadSpaces(): Promise<Record<string, Space>> {
    await this.ensureBootstrapped();
    const db = await getDb();
    const all = await db.getAll('spaces');
    const map: Record<string, Space> = {};
    for (const s of all) {
      map[s.id] = s as Space;
    }
    return map;
  }

  async saveClosedSpaces(spaces: Record<string, Space>): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['closedSpaces', 'meta'], 'readwrite');
    const store = tx.objectStore('closedSpaces');
    await store.clear();
    for (const space of Object.values(spaces)) {
      await store.put(space);
    }
    await tx.objectStore('meta').put({ key: 'lastModified', value: Date.now() });
    await tx.done;
  }

  async loadClosedSpaces(): Promise<Record<string, Space>> {
    await this.ensureBootstrapped();
    const db = await getDb();
    const all = await db.getAll('closedSpaces');
    const map: Record<string, Space> = {};

    // Load tabs for each closed space to populate urls field
    for (const s of all) {
      const tabs = await this.loadTabsForSpace(s.id, 'closed');
      const urls = tabs
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
        .map(t => t.url);

      map[s.id] = {
        ...s,
        urls  // Populate urls from tabs store
      } as Space;
    }

    return map;
  }

  async clear(): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['spaces', 'closedSpaces', 'tabs', 'meta'], 'readwrite');
    await Promise.all([
      tx.objectStore('spaces').clear(),
      tx.objectStore('closedSpaces').clear(),
      tx.objectStore('tabs').clear(),
      tx.objectStore('meta').clear(),
    ]);
    await tx.done;
  }

  async exportData(): Promise<string> {
    const db = await getDb();
    const [spaces, closedSpaces, tabs] = await Promise.all([
      db.getAll('spaces'),
      db.getAll('closedSpaces'),
      db.getAll('tabs'),
    ]);
    return JSON.stringify({ spaces, closedSpaces, tabs });
  }

  async importData(data: string): Promise<void> {
    const payload = JSON.parse(data) as {
      spaces?: Space[];
      closedSpaces?: Space[];
      tabs?: TabRecord[];
    };
    const db = await getDb();
    const tx = db.transaction(['spaces', 'closedSpaces', 'tabs', 'meta'], 'readwrite');
    if (payload.spaces) {
      const s = tx.objectStore('spaces');
      await s.clear();
      for (const item of payload.spaces) await s.put(item);
    }
    if (payload.closedSpaces) {
      const cs = tx.objectStore('closedSpaces');
      await cs.clear();
      for (const item of payload.closedSpaces) await cs.put(item);
    }
    if (payload.tabs) {
      const t = tx.objectStore('tabs');
      await t.clear();
      for (const item of payload.tabs) await t.put(item);
    }
    await tx.objectStore('meta').put({ key: 'lastModified', value: Date.now() });
    await tx.done;
  }

  // Tabs helpers (for future tasks)
  async loadTabsForSpace(spaceId: string, kind: 'active' | 'closed'): Promise<TabRecord[]> {
    const db = await getDb();
    const index = db.transaction('tabs').store.index('tabs_by_spaceId');
    const all = await index.getAll(spaceId);
    return all
      .filter(t => t.kind === kind)
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  }

  async saveTabsForSpace(spaceId: string, kind: 'active' | 'closed', tabs: TabRecord[]): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('tabs', 'readwrite');
    const index = tx.store.index('tabs_by_spaceId');
    const existing = await index.getAll(spaceId);
    for (const rec of existing.filter(r => r.kind === kind)) {
      await tx.store.delete(rec.id);
    }
    for (const rec of tabs) {
      await tx.store.put(rec);
    }
    await tx.done;
  }

  async deleteTabsForSpace(spaceId: string, kind: 'active' | 'closed'): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('tabs', 'readwrite');
    const index = tx.store.index('tabs_by_spaceId');
    const existing = await index.getAll(spaceId);
    for (const rec of existing.filter(r => r.kind === kind)) {
      await tx.store.delete(rec.id);
    }
    await tx.done;
  }

  // Compatibility helpers expected by StateManager
  async createSpace(windowId: number, name: string, urls: string[], named: boolean = false): Promise<Space> {
    const id = windowId.toString();
    const now = Date.now();
    const space: Space = {
      id,
      name,
      urls,
      lastModified: now,
      named,
      version: 1,
      lastSync: now,
      sourceWindowId: id,
      permanentId: id, // initial mapping, may be updated later
      createdAt: now,
      lastUsed: now,
      isActive: true,
      windowId: windowId
    } as Space;

    const db = await getDb();
    const tx = db.transaction(['spaces', 'tabs', 'meta'], 'readwrite');
    await tx.objectStore('spaces').put(space);

    // seed active tabs rows from urls
    for (let i = 0; i < urls.length; i++) {
      const rec: TabRecord = {
        id: generateUUID('tab'),
        spaceId: id,
        kind: 'active',
        url: urls[i],
        index: i,
        createdAt: now
      };
      await tx.objectStore('tabs').put(rec);
    }
    await tx.objectStore('meta').put({ key: 'lastModified', value: now });
    await tx.done;
    return space;
  }


  async updatePermanentIdMapping(windowId: number, permanentId: string): Promise<void> {
    const db = await getDb();
    const tx = db.transaction('meta', 'readwrite');
    const key = 'permanentIdMappings';
    const existing = (await tx.store.get(key))?.value || {};
    existing[String(windowId)] = permanentId;
    await tx.store.put({ key, value: existing });
    await tx.done;
  }

  async saveState(spaces: Record<string, Space>, closedSpaces: Record<string, Space>): Promise<void> {
    const db = await getDb();
    const tx = db.transaction(['spaces', 'closedSpaces', 'meta'], 'readwrite');

    // Clear and update spaces
    const spacesStore = tx.objectStore('spaces');
    await spacesStore.clear();
    for (const space of Object.values(spaces)) {
      await spacesStore.put(space);
    }

    // Clear and update closed spaces
    const closedSpacesStore = tx.objectStore('closedSpaces');
    await closedSpacesStore.clear();
    for (const space of Object.values(closedSpaces)) {
      await closedSpacesStore.put(space);
    }

    await tx.objectStore('meta').put({ key: 'lastModified', value: Date.now() });
    await tx.done;
  }
}


