/**
 * Flow Recording Demo Test
 *
 * Demonstrates the FlowRecorder capabilities
 */

import { test, chromium, BrowserContext } from '@playwright/test';
import * as path from 'path';
import { InteractionFlowBuilder, FlowRecorder } from '../framework';

test.describe('Flow Recording Demo', () => {
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

  test('record a complete user interaction flow', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context, {
      logActions: true
    });

    const recorder = new FlowRecorder(page, {
      captureScreenshots: false,
      autoSave: true
    });

    // Start recording
    await recorder.startRecording('Complete Search and Edit Flow', {
      testSuite: 'Interaction Flows',
      browser: 'Chrome',
      environment: 'Test'
    });

    await flow.initialize();

    // Record the flow
    await recorder.recordCustomAction('Opening popup');
    await flow.openPopup();

    await recorder.recordAction('type', 'search-input', 'example');
    await flow.searchFor('example');

    await recorder.recordNavigate('down', 1);
    await flow.selectFirstResult();

    await recorder.recordKeyPress('F2');
    await flow.pressF2();

    await recorder.recordType('edit-input', 'Recorded Example');
    await flow.editName('Recorded Example');

    await recorder.recordKeyPress('Enter');
    await flow.saveEdit();

    await recorder.recordAssertion('nameChanged', 'Recorded Example');
    await flow.verifyNameChanged('Recorded Example');

    // Stop recording
    const session = await recorder.stopRecording('passed');

    if (session) {
      console.log('\n=== Recording Summary ===');
      console.log(recorder.generateFlowDescription(session));
      console.log('\n=== Statistics ===');
      console.log(recorder.getSessionStatistics(session));
      console.log('\n=== Generated Script ===');
      console.log(recorder.generateReplayScript(session));
    }
  });

  test('record and analyze failed flow', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const recorder = new FlowRecorder(page);

    await recorder.startRecording('Failed Flow Example');

    try {
      await flow.initialize();
      await recorder.recordCustomAction('Opening popup');
      await flow.openPopup();

      await recorder.recordAction('type', 'search-input', 'nonexistent');
      await flow.searchFor('nonexistent');

      await recorder.recordAssertion('searchFiltered', '0 results');
      await flow.verifySearchFiltered(0);

      await recorder.recordCustomAction('Recovering from empty results');
      await flow.clearSearch();

      await recorder.recordAssertion('allSpacesVisible', 'all spaces');
      await flow.verifyAllSpacesVisible();

      await recorder.stopRecording('passed');
    } catch (error) {
      await recorder.stopRecording('failed', error.message);
      console.log('\nFlow failed, but recording captured the error');
    }
  });

  test('record complex multi-step interaction', async () => {
    const page = await context.newPage();
    await page.goto('https://example.com');

    const flow = new InteractionFlowBuilder(page, context);
    const recorder = new FlowRecorder(page, {
      outputDir: 'test-results/recordings',
      captureScreenshots: false
    });

    await recorder.startRecording('Complex Multi-Step Flow', {
      description: 'Tests multiple edits with search and navigation'
    });

    await flow.initialize();

    // Step 1: First edit
    await recorder.recordCustomAction('Step 1: First edit operation');
    await flow
      .openPopup()
      .searchFor('example');
    await recorder.recordAction('type', 'search', 'example');

    await flow.selectFirstResult();
    await recorder.recordNavigate('down', 1);

    await flow.pressF2().editName('Edit 1').saveEdit();
    await recorder.recordAction('type', 'edit-input', 'Edit 1');

    // Step 2: Second edit
    await recorder.recordCustomAction('Step 2: Second edit operation');
    await flow.clearSearch().searchFor('github');
    await recorder.recordAction('type', 'search', 'github');

    await flow.selectFirstResult().pressF2().editName('Edit 2').saveEdit();
    await recorder.recordAction('type', 'edit-input', 'Edit 2');

    // Step 3: Verify all changes
    await recorder.recordCustomAction('Step 3: Verifying all changes');
    await flow.clearSearch().verifyAllSpacesVisible();

    const session = await recorder.stopRecording('passed');

    if (session) {
      console.log('\n=== Complex Flow Recording ===');
      console.log(`Actions recorded: ${session.actions.length}`);
      console.log(`Duration: ${(session.endTime! - session.startTime) / 1000}s`);

      const stats = recorder.getSessionStatistics(session);
      console.log('\nActions by type:');
      console.log(stats.actionsByType);
    }
  });
});