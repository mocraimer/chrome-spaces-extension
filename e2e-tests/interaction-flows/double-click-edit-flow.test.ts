/**
 * Double-Click Edit Flow Test
 *
 * Tests editing spaces via double-click interaction
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Double-Click Edit Flow', () => {
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

  test('user double-clicks to edit space name', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    await flow.initialize();

    await flow
      .openPopup()
      .think('short')
      .doubleClickToEdit('example')
      .verifyInEditMode()
      .editName('Double Click Edit')
      .saveEdit()
      .verifyNameChanged('Double Click Edit');
  });

  test('user uses double-click for quick rename', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    await common.doubleClickRename('example', 'Quick Double Click Rename');
  });

  test('user double-clicks, changes mind, cancels', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('example')
      .doubleClickToEdit('example')
      .typeWithRealisticDelay('Should Not Save')
      .cancelEdit()
      .verifySpaceVisible('example');
  });

  test('user mixes double-click and F2 editing', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    // First edit with double-click
    await flow
      .openPopup()
      .doubleClickToEdit('example')
      .editName('First Edit')
      .saveEdit()
      .clearSearch();

    // Second edit with F2
    await flow
      .searchFor('First Edit')
      .selectFirstResult()
      .pressF2()
      .editName('Second Edit')
      .saveEdit()
      .verifyNameChanged('Second Edit');
  });

  test('user hovers before double-clicking', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('example')
      .hoverElement('.space-item:has-text("example")')
      .think('short')
      .doubleClickToEdit('example')
      .editName('Hovered Then Edited')
      .saveEdit()
      .verifyNameChanged('Hovered Then Edited');
  });
});