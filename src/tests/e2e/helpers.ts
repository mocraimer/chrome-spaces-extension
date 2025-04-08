import { Page } from '@playwright/test';
import type { Space, SpaceState } from '../../shared/types/Space';
import { SpaceExportData } from '../../shared/types/ImportExport';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Set the initial state for the extension
 */
export async function setupExtensionState(page: Page, state: Partial<SpaceState>) {
  await page.evaluate(async (initialState) => {
    await chrome.storage.local.set({ state: initialState });
  }, state);
}

/**
 * Create a temporary export file for testing
 */
export async function createTempExportFile(data: SpaceExportData): Promise<string> {
  const tempDir = await fs.mkdtemp('test-spaces-');
  const filePath = path.join(tempDir, 'test-export.json');
  await fs.writeFile(filePath, JSON.stringify(data));
  return filePath;
}

/**
 * Clean up temporary test files
 */
export async function cleanupTempFiles(filePath: string) {
  try {
    await fs.unlink(filePath);
    await fs.rmdir(path.dirname(filePath));
  } catch (error) {
    console.warn('Failed to cleanup temp files:', error);
  }
}

/**
 * Create a mock space for testing
 */
export function createMockSpace(id: string, name: string, urls: string[] = ['https://example.com']): Space {
  return {
    id,
    name,
    urls,
    lastModified: Date.now(),
    named: true
  };
}

/**
 * Create mock export data for testing
 */
export function createMockExportData(spaces: Record<string, Space> = {}): SpaceExportData {
  return {
    version: '1.0.0',
    timestamp: Date.now(),
    spaces: {
      active: spaces,
      closed: {}
    },
    metadata: {
      exportedBy: 'test'
    }
  };
}

/**
 * Wait for a file to be downloaded and get its path
 */
export async function waitForDownload(page: Page): Promise<string> {
  const download = await page.waitForEvent('download');
  const path = await download.path();
  if (!path) throw new Error('Download failed');
  return path;
}

/**
 * Read the contents of a downloaded file
 */
export async function readDownloadedFile(filePath: string): Promise<SpaceExportData> {
  const content = await fs.readFile(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Verify the extension state after import
 */
export async function verifyExtensionState(page: Page): Promise<SpaceState> {
  return await page.evaluate(async () => {
    const result = await chrome.storage.local.get('state');
    return result.state;
  });
}