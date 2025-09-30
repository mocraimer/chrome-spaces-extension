/**
 * Keyboard-Only Navigation Flow Test
 *
 * Tests full keyboard interaction without mouse usage
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder } from '../framework';

test.describe('Keyboard-Only Navigation Flow', () => {
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

  test('user navigates using only arrow keys', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    await flow.initialize();

    await flow
      .openPopup()
      .think('short')
      .navigateDown(3)
      .verifySpaceSelected()
      .think('short')
      .navigateUp(1)
      .verifySpaceSelected()
      .think('short')
      .navigateDown(1)
      .verifySpaceSelected();
  });

  test('user navigates, edits with F2, saves with Enter', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .navigateDown(2)
      .verifySpaceSelected()
      .pressF2()
      .verifyInEditMode()
      .editName('Keyboard Navigation Test')
      .pressEnter()
      .verifyNameChanged('Keyboard Navigation Test');
  });

  test('user uses Escape to cancel edit', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .navigateDown(1)
      .pressF2()
      .verifyInEditMode()
      .typeWithRealisticDelay('Should Not Save')
      .pressEscape()
      .verifyAllSpacesVisible(); // Should exit edit mode cleanly
  });

  test('user navigates entire list using keyboard', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .navigateDown(5)
      .think('short')
      .navigateUp(3)
      .think('short')
      .navigateDown(2)
      .verifySpaceSelected();
  });
});