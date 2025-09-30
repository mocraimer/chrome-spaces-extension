/**
 * Switch → Edit → Switch Back Flow Test
 *
 * Tests context switching with edits in between
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Switch → Edit → Switch Back Flow', () => {
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

  test('user edits multiple spaces in sequence with context switching', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    const common = new CommonUserFlows(flow);

    await common.contextSwitching([
      { spaceName: 'example', newName: 'Example - Updated' },
      { spaceName: 'github', newName: 'GitHub - Updated' },
      { spaceName: 'google', newName: 'Google - Updated' }
    ]);
  });

  test('user performs full operation sequence with multiple renames', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.fullOperationSequence(
      'example',
      'Temp Name',
      'Final Production Name'
    );

    console.log('\nFull operation sequence completed');
    console.log('Total actions:', flow.getActionHistory().length);
  });

  test('user switches between rapid and slow interaction styles', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    // Fast interaction
    await common.rapidInteraction('example', 'Quick Edit 1');

    await flow.clearSearch().think('long');

    // Slow interaction
    await common.slowDeliberateInteraction('Quick Edit 1', 'Careful Edit 2');
  });

  test('user maintains search persistence across actions', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.searchPersistence('example');
  });
});