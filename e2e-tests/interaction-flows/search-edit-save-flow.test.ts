/**
 * Search → Edit → Save Flow Test
 *
 * Demonstrates a complete search, edit, and save workflow
 */

import { test, expect, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder } from '../framework';

test.describe('Search → Edit → Save Flow', () => {
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
        '--disable-web-security',
      ],
    });
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('user searches, edits space name, and saves successfully', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');
    await page.waitForLoadState('networkidle');

    // Create the flow
    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true,
      captureFailures: true
    });

    await flow.initialize();

    // Execute the flow
    await flow
      .openPopup()
      .think('short')
      .searchFor('example')
      .verifySearchFiltered(1)
      .selectFirstResult()
      .think('short')
      .pressF2()
      .verifyInEditMode()
      .editName('My Example Project')
      .saveEdit()
      .verifyNameChanged('My Example Project')
      .clearSearch()
      .verifyAllSpacesVisible();

    console.log('\nAction History:');
    console.log(flow.getActionHistory().join('\n'));
  });

  test('user searches with no results, clears, and sees all spaces', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('nonexistentspace123')
      .verifySearchFiltered(0)
      .think('medium')
      .clearSearch()
      .verifyAllSpacesVisible();
  });

  test('user searches, cancels edit, name remains unchanged', async () => {
    const page = await context.newPage();
    await page.goto('https://github.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('github')
      .selectFirstResult()
      .pressF2()
      .typeWithRealisticDelay('This Should Not Save')
      .cancelEdit()
      .verifySpaceVisible('github'); // Original name should still be there
  });
});