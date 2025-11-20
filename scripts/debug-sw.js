
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const extensionPath = path.join(process.cwd(), 'build');
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--no-sandbox'
    ]
  });

  await new Promise(r => setTimeout(r, 2000));

  const worker = context.serviceWorkers()[0];
  if (!worker) {
      console.log('No service worker found');
      await context.close();
      return;
  }

  console.log('Service worker found:', worker.url());

  const result = await worker.evaluate(() => {
      // Check if services are exposed globally or if we can access them
      // In the background/index.ts, usually services aren't global unless explicitly set
      return {
          hasChrome: typeof chrome !== 'undefined',
          hasWindow: typeof window !== 'undefined',
          // Try to find where services might be attached.
          // Often they are not attached to window/globalThis in production builds.
          globals: Object.keys(self)
      };
  });

  console.log('Evaluation result:', result);
  
  await context.close();
})();

