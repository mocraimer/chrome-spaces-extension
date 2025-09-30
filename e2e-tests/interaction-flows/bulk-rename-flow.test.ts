/**
 * Bulk Rename Flow Test
 *
 * Tests renaming multiple spaces in sequence
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Bulk Rename Flow', () => {
  let context: BrowserContext;
  const pathToExtension = path.join(__dirname, '..', '..', 'build');

  test.beforeAll(async () => {
    context = await chromium.launchPersistentContext('', {
      headless: false,  // Must be false when using --headless=new
      args: [
        '--headless=new',  // CRITICAL: Use new headless mode for extension support
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-sandbox',
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('user renames multiple spaces in one session', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    const common = new CommonUserFlows(flow);

    await common.bulkRename([
      { oldName: 'example', newName: 'Example - Work' },
      { oldName: 'github', newName: 'GitHub - Development' },
      { oldName: 'google', newName: 'Google - Research' }
    ]);

    console.log('\nCompleted bulk rename operation');
    console.log('Actions taken:', flow.getActionHistory().length);
  });

  test('user organizes spaces with systematic renaming', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    // Rename with a systematic pattern
    await flow
      .openPopup()
      .searchFor('example')
      .selectFirstResult()
      .pressF2()
      .editName('[1] Primary Workspace')
      .saveEdit()
      .clearSearch()
      .think('short')
      .searchFor('github')
      .selectFirstResult()
      .pressF2()
      .editName('[2] Code Repository')
      .saveEdit()
      .clearSearch()
      .verifyAllSpacesVisible();
  });

  test('user renames with increasing complexity', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('example')
      .selectFirstResult()
      .pressF2()
      .editName('A')
      .saveEdit()
      .clearSearch()
      .searchFor('A')
      .selectFirstResult()
      .pressF2()
      .editName('AB')
      .saveEdit()
      .clearSearch()
      .searchFor('AB')
      .selectFirstResult()
      .pressF2()
      .editName('ABC - Full Name')
      .saveEdit()
      .verifyNameChanged('ABC - Full Name');
  });
});