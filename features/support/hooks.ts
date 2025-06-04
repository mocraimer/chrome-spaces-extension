import { Before, After, BeforeAll, AfterAll, Status } from '@cucumber/cucumber';
import { ExtensionWorld } from './world';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Global setup
BeforeAll(async function() {
  // Ensure build directory exists
  const buildPath = path.join(process.cwd(), 'build');
  try {
    await fs.access(buildPath);
  } catch {
    throw new Error('Build directory not found. Please run "npm run build" before running BDD tests.');
  }
  
  console.log('Starting Chrome Spaces BDD tests...');
});

// Before each scenario
Before(async function(this: ExtensionWorld) {
  // Initialize test data
  this.testData.clear();
});

// Before scenarios that need the extension
Before({ tags: '@extension' }, async function(this: ExtensionWorld) {
  await this.openExtension();
});

// After each scenario
After(async function(this: ExtensionWorld, { result }) {
  // Take screenshot on failure
  if (result?.status === Status.FAILED && this.page) {
    const screenshot = await this.page.screenshot();
    this.attach(screenshot, 'image/png');
  }
  
  // Cleanup
  await this.cleanup();
});

// After all tests
AfterAll(async function() {
  console.log('Chrome Spaces BDD tests completed.');
});

// Special hooks for specific scenarios
Before({ tags: '@popup' }, async function(this: ExtensionWorld) {
  if (!this.context) {
    await this.openExtension();
  }
  await this.openPopup();
});

Before({ tags: '@options' }, async function(this: ExtensionWorld) {
  if (!this.context) {
    await this.openExtension();
  }
  await this.openOptions();
});

// Mock data setup for specific scenarios
Before({ tags: '@with-spaces' }, async function(this: ExtensionWorld) {
  // This would normally interact with chrome.storage API
  // For now, we'll set up the expectation that spaces exist
  await this.createMockSpace('Work Projects', [
    'https://github.com',
    'https://localhost:3000',
    'https://figma.com'
  ]);
  
  await this.createMockSpace('Personal', [
    'https://gmail.com',
    'https://calendar.google.com'
  ]);
});

// Performance monitoring
Before({ tags: '@performance' }, async function(this: ExtensionWorld) {
  if (this.page) {
    // Start performance monitoring
    await this.page.evaluate(() => {
      (window as any).__performanceStart = performance.now();
    });
  }
});

After({ tags: '@performance' }, async function(this: ExtensionWorld) {
  if (this.page) {
    const duration = await this.page.evaluate(() => {
      const start = (window as any).__performanceStart;
      return start ? performance.now() - start : 0;
    });
    
    this.attach(`Performance: ${duration.toFixed(2)}ms`, 'text/plain');
  }
});