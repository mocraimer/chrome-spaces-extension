/**
 * Search → Filter → Clear Flow Test
 *
 * Tests search filtering and clearing functionality
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Search → Filter → Clear Flow', () => {
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

  test('user searches, verifies filter, clears, verifies all', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('example')
      .think('short')
      .verifySearchFiltered(1)
      .think('medium')
      .clearSearch()
      .verifyAllSpacesVisible();
  });

  test('user uses Escape to clear search', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.searchAndEscape('github');
  });

  test('user performs multiple search-clear cycles', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    // First cycle
    await flow
      .openPopup()
      .searchFor('example')
      .think('short')
      .clearSearch()
      .verifyAllSpacesVisible();

    // Second cycle
    await flow
      .searchFor('github')
      .think('short')
      .clearSearch()
      .verifyAllSpacesVisible();

    // Third cycle
    await flow
      .searchFor('google')
      .think('short')
      .pressEscape()
      .verifyAllSpacesVisible();
  });

  test('user searches with progressive refinement', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('e')
      .think('short')
      .typeWithRealisticDelay('x')
      .think('short')
      .typeWithRealisticDelay('a')
      .think('short')
      .typeWithRealisticDelay('m')
      .verifySearchFiltered(1);
  });

  test('user searches no results, then recovers', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.searchWithNoResults('nonexistent');
  });
});