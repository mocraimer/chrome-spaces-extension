/**
 * Mixed Interaction Patterns Flow Test
 *
 * Tests combining different interaction styles in one session
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, CommonUserFlows } from '../framework';

test.describe('Mixed Interaction Patterns Flow', () => {
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

  test('user combines mouse and keyboard interactions', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    await flow.initialize();

    await flow
      .openPopup()
      // Use mouse to search
      .clickElement('.search-input')
      .typeWithRealisticDelay('example')
      // Use keyboard to select
      .navigateDown(1)
      // Use keyboard to edit
      .pressF2()
      .editName('Mixed Interaction')
      // Use keyboard to save
      .pressEnter()
      .verifyNameChanged('Mixed Interaction');
  });

  test('user alternates between fast and slow interactions', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const common = new CommonUserFlows(flow);

    // Fast
    await common.rapidInteraction('example', 'Fast Edit');

    await flow.clearSearch().think('long');

    // Slow
    await common.slowDeliberateInteraction('Fast Edit', 'Slow Edit');
  });

  test('user uses hover, click, keyboard in sequence', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .searchFor('example')
      // Hover to inspect
      .hoverElement('.space-item:has-text("example")')
      .think('medium')
      // Click to select
      .clickElement('.space-item:has-text("example")')
      .think('short')
      // Use keyboard to edit
      .pressF2()
      .editName('Hover Click Keyboard')
      .pressEnter()
      .verifyNameChanged('Hover Click Keyboard');
  });

  test('user performs complex workflow with all interaction types', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .think('short')
      // Search with mouse
      .clickElement('.search-input')
      .typeWithRealisticDelay('example', { minDelay: 50, maxDelay: 150 })
      .think('short')
      // Navigate with keyboard
      .navigateDown(1)
      .verifySpaceSelected()
      .think('short')
      // Edit with F2
      .pressF2()
      .verifyInEditMode()
      // Type slowly
      .typeWithRealisticDelay('Complex', { minDelay: 100, maxDelay: 200 })
      .think('short')
      // Save with Enter
      .pressEnter()
      .verifyNameChanged('Complex')
      // Clear with Escape
      .pressEscape()
      .verifyAllSpacesVisible()
      // Search again with keyboard
      .searchFor('Complex', { minDelay: 30, maxDelay: 80 })
      // Double-click to edit
      .doubleClickToEdit('Complex')
      .editName('Very Complex', { minDelay: 50, maxDelay: 100 })
      .saveEdit()
      .verifyNameChanged('Very Complex');
  });

  test('user switches between thinking speeds', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      .think('short')
      .searchFor('example')
      .think('medium')
      .selectFirstResult()
      .think('long')
      .pressF2()
      .think('short')
      .editName('Variable Speed')
      .think('medium')
      .saveEdit()
      .verifyNameChanged('Variable Speed');
  });

  test('user demonstrates realistic uncertain behavior', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    await flow.initialize();

    await flow
      .openPopup()
      // User starts searching
      .searchFor('exa')
      .think('medium')
      // Changes mind, clears
      .clearSearch()
      .think('short')
      // Tries navigation instead
      .navigateDown(2)
      .think('long')
      // Changes mind again, goes back to search
      .searchFor('example')
      .think('short')
      // Finally commits
      .selectFirstResult()
      .pressF2()
      .editName('After Uncertainty')
      .saveEdit()
      .verifyNameChanged('After Uncertainty');
  });
});