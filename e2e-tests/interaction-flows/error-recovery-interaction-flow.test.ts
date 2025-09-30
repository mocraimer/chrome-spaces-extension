/**
 * Error Recovery Interaction Flow Test
 *
 * Tests how users recover from mistakes and correct errors
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Error Recovery Interaction Flow', () => {
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

  test('user makes typo, corrects it, and saves', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    await flow.initialize();

    await flow
      .openPopup()
      .selectFirstResult()
      .pressF2()
      .verifyInEditMode()
      .typeWithRealisticDelay('Porject') // Typo
      .think('short')
      // User realizes mistake, uses Ctrl+A to select all
      .getSimulator().pressShortcut('ctrl+a');

    await flow
      .typeWithRealisticDelay('Project') // Correct spelling
      .saveEdit()
      .verifyNameChanged('Project');
  });

  test('user starts edit, changes mind, cancels, then edits again', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.multipleEditAttempts('example');
  });

  test('user searches wrong term, corrects search, then edits', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('wrong')
      .think('short')
      .verifySearchFiltered(0)
      .clearSearch()
      .searchFor('example')
      .verifySearchFiltered(1)
      .selectFirstResult()
      .pressF2()
      .editName('Corrected Example')
      .saveEdit()
      .verifyNameChanged('Corrected Example');
  });

  test('user accidentally navigates away, comes back, completes task', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('example')
      .selectFirstResult()
      .pressF2()
      .typeWithRealisticDelay('Partial');

    // User accidentally presses Escape (navigates away from edit)
    await flow
      .pressEscape()
      .think('medium')
      // User realizes and comes back
      .searchFor('example')
      .selectFirstResult()
      .pressF2()
      .editName('Complete Name')
      .saveEdit()
      .verifyNameChanged('Complete Name');
  });

  test('user types with simulated typos that get auto-corrected', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.typoCorrection('example', 'Final Corrected Name');
  });
});