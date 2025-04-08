import { test, expect } from '@playwright/test';
import { Page } from '@playwright/test';
import { setupExtensionState, createTempExportFile, cleanupTempFiles, createMockSpace, createMockExportData, waitForDownload, readDownloadedFile, verifyExtensionState } from './helpers';
import type { Space, SpaceState } from '../../shared/types/Space';
import type { SpaceExportData } from '../../shared/types/ImportExport';

const extensionId = process.env.EXTENSION_ID || '';

test.describe('Import/Export functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Open the options page
    await page.goto(`chrome-extension://${extensionId}/options/index.html`);
  });

  test('should export spaces and allow re-import', async ({ page }) => {
    // Create test spaces
    const testSpace = createMockSpace('space-1', 'Test Space');
    await setupExtensionState(page, { spaces: { 'space-1': testSpace } });

    // Click export button and verify loading state
    await page.click('button:text("Export Spaces")');
    await expect(page.locator('text=Exporting...')).toBeVisible();

    // Wait for download to complete
    await waitForDownload(page);

    // Verify buttons are re-enabled
    await expect(page.locator('button:text("Export Spaces")')).toBeEnabled();
    await expect(page.locator('button:text("Import Spaces")')).toBeEnabled();

    // Verify success message
    await expect(page.locator('text=Successfully imported')).toBeVisible();

    // Verify the state was updated correctly
    const state = await verifyExtensionState(page);
    expect(state.spaces['space-1'].name).toBe(testSpace.name);
  });

  test('should handle invalid import files', async ({ page }) => {
    // Create an invalid export data
    const invalidExportData = createMockExportData({
      'space-1': {
        ...createMockSpace('space-1', 'Invalid Space'),
        urls: 'not-an-array' as any
      }
    });

    // Create a temporary file with invalid data
    const invalidFilePath = await createTempExportFile(invalidExportData);

    // Import the invalid file
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:text("Import Spaces")')
    ]);
    await fileChooser.setFiles(invalidFilePath);

    // Verify error message
    await expect(page.locator('text=Invalid URLs')).toBeVisible();

    // Clean up the temporary file
    await cleanupTempFiles(invalidFilePath);
  });

  test('should show loading states during import/export', async ({ page }) => {
    // Click export button and verify loading state
    await page.click('button:text("Export Spaces")');
    await expect(page.locator('text=Exporting...')).toBeVisible();

    // Wait for download to complete
    await waitForDownload(page);

    // Verify both buttons are re-enabled
    await expect(page.locator('button:text("Export Spaces")')).toBeEnabled();
    await expect(page.locator('button:text("Import Spaces")')).toBeEnabled();

    // Click import button and verify loading state
    await page.click('button:text("Import Spaces")');
    await expect(page.locator('text=Importing...')).toBeVisible();

    // Wait for import to complete
    await waitForDownload(page);

    // Verify both buttons are re-enabled
    await expect(page.locator('button:text("Export Spaces")')).toBeEnabled();
    await expect(page.locator('button:text("Import Spaces")')).toBeEnabled();
  });

  test('should replace existing spaces when import option is selected', async ({ page }) => {
    // Create initial state with an existing space
    const existingSpace = createMockSpace('space-1', 'Original Space');
    await setupExtensionState(page, { spaces: { 'space-1': existingSpace } });

    // Create new space data for import
    const newSpace = createMockSpace('space-1', 'Updated Space');
    const exportData = createMockExportData({ 'space-1': newSpace });

    // Create a temporary file with new space data
    const filePath = await createTempExportFile(exportData);

    // Import the new space data with replace option
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('button:text("Import Spaces")')
    ]);
    await fileChooser.setFiles(filePath);

    // Verify success message
    await expect(page.locator('text=Successfully imported')).toBeVisible();

    // Verify the state was updated correctly
    const state = await verifyExtensionState(page);
    expect(state.spaces['space-1'].name).toBe(newSpace.name);

    // Clean up the temporary file
    await cleanupTempFiles(filePath);
  });
});