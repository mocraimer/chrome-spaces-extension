/**
 * Rapid Interaction Flow Test
 *
 * Tests fast user clicking through multiple actions
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Rapid Interaction Flow', () => {
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

  test('power user performs rapid sequential actions', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    const common = new CommonUserFlows(flow);

    const startTime = Date.now();

    await common.rapidInteraction('example', 'Rapid Edit 1');

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\nRapid interaction completed in ${duration}ms`);
  });

  test('user performs rapid navigation without delays', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    // Rapid keyboard navigation
    await flow
      .openPopup()
      .navigateDown(1)
      .navigateDown(1)
      .navigateDown(1)
      .navigateUp(1)
      .navigateUp(1)
      .verifySpaceSelected();
  });

  test('user rapidly searches and edits multiple spaces', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    const typingOptions = { minDelay: 10, maxDelay: 30 };

    await flow
      .openPopup()
      .searchFor('example', typingOptions)
      .selectFirstResult()
      .pressF2()
      .editName('Quick 1', typingOptions)
      .saveEdit()
      .clearSearch()
      .searchFor('github', typingOptions)
      .selectFirstResult()
      .pressF2()
      .editName('Quick 2', typingOptions)
      .saveEdit()
      .clearSearch()
      .verifyAllSpacesVisible();
  });

  test('user performs rapid edit-cancel cycles', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .selectFirstResult()
      .pressF2()
      .typeWithRealisticDelay('Test 1', { minDelay: 10, maxDelay: 20 })
      .cancelEdit()
      .pressF2()
      .typeWithRealisticDelay('Test 2', { minDelay: 10, maxDelay: 20 })
      .cancelEdit()
      .pressF2()
      .typeWithRealisticDelay('Final', { minDelay: 10, maxDelay: 20 })
      .saveEdit()
      .verifyNameChanged('Final');
  });

  test('user rapidly switches between search and navigation', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('ex', { minDelay: 5, maxDelay: 15 })
      .pressEscape()
      .navigateDown(2)
      .searchFor('gi', { minDelay: 5, maxDelay: 15 })
      .pressEscape()
      .navigateDown(1)
      .verifySpaceSelected();
  });
});