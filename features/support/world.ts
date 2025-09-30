import { World, IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { BrowserContext, Page, chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface CustomWorld extends World {
  context?: BrowserContext;
  page?: Page;
  extensionId?: string;
  extensionPath: string;
  testData: Map<string, any>;
}

export class ExtensionWorld extends World implements CustomWorld {
  context?: BrowserContext;
  page?: Page;
  extensionId?: string;
  extensionPath: string;
  testData: Map<string, any>;

  constructor(options: IWorldOptions) {
    super(options);
    this.extensionPath = path.join(process.cwd(), 'build');
    this.testData = new Map();
  }

  async openExtension() {
    // Launch Chrome with the extension loaded (same as e2e tests)
    this.context = await chromium.launchPersistentContext('', {
      headless: process.env.CI ? true : false,
      args: [
        `--disable-extensions-except=${this.extensionPath}`,
        `--load-extension=${this.extensionPath}`,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-gpu',
        '--disable-dev-shm-usage'
      ],
      viewport: { width: 1280, height: 720 },
      timeout: 30000 // 30 second timeout for launch
    });

    // Wait for extension to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Get extension ID from chrome://extensions page
    const extensionsPage = await this.context.newPage();
    await extensionsPage.goto('chrome://extensions/');
    await extensionsPage.waitForTimeout(1000);

    // Enable developer mode if needed
    const devModeToggle = await extensionsPage.$('#devMode');
    if (devModeToggle) {
      const isChecked = await devModeToggle.isChecked();
      if (!isChecked) {
        await devModeToggle.click();
        await extensionsPage.waitForTimeout(1000);
      }
    }

    // Find our extension
    const extensionId = await extensionsPage.evaluate(() => {
      const extensionItems = Array.from(document.querySelectorAll('extensions-item'));
      for (const item of extensionItems) {
        const nameEl = item.shadowRoot?.querySelector('#name');
        if (nameEl?.textContent?.includes('chrome-spaces') ||
            nameEl?.textContent?.includes('Chrome Spaces')) {
          return item.getAttribute('id');
        }
      }
      return null;
    });
    
    this.extensionId = extensionId || undefined;

    await extensionsPage.close();

    if (!this.extensionId) {
      // Try alternative method - look for service workers
      const serviceWorkers = this.context.serviceWorkers();
      if (serviceWorkers.length > 0) {
        this.extensionId = serviceWorkers[0].url().split('/')[2];
      }
    }

    if (!this.extensionId) {
      throw new Error('Extension ID not found. Make sure the extension is built and loaded.');
    }

    console.log(`Extension loaded with ID: ${this.extensionId}`);

    // Create a new page for testing
    this.page = await this.context.newPage();
  }

  async openPopup() {
    if (!this.extensionId) {
      throw new Error('Extension ID not found. Make sure extension is loaded.');
    }
    
    const popupUrl = `chrome-extension://${this.extensionId}/popup.html`;
    if (!this.page) {
      this.page = await this.context!.newPage();
    }
    
    await this.page.goto(popupUrl);
    await this.page.waitForLoadState('domcontentloaded');
    
    // Wait for React to render
    await this.page.waitForSelector('[data-testid="space-item"], .empty-list', {
      timeout: 5000
    });
    
    return this.page;
  }

  async openOptions() {
    if (!this.extensionId) {
      throw new Error('Extension ID not found. Make sure extension is loaded.');
    }
    
    const optionsUrl = `chrome-extension://${this.extensionId}/options.html`;
    if (!this.page) {
      this.page = await this.context!.newPage();
    }
    
    await this.page.goto(optionsUrl);
    await this.page.waitForLoadState('domcontentloaded');
    
    return this.page;
  }

  async cleanup() {
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
  }

  async createMockSpace(name: string, urls: string[]) {
    const mockSpace = {
      id: `mock-${Date.now()}`,
      name,
      urls,
      lastModified: Date.now(),
      named: true,
      version: 1
    };
    
    this.testData.set(`space-${name}`, mockSpace);
    return mockSpace;
  }

  async waitForSpaceItem(spaceName: string) {
    await this.page!.waitForSelector(
      `[data-testid="space-item"]:has-text("${spaceName}")`,
      { timeout: 5000 }
    );
  }

  async searchForSpace(query: string) {
    const searchInput = await this.page!.$('#search-input');
    if (searchInput) {
      await searchInput.fill(query);
    }
  }

  async getVisibleSpaces() {
    const spaceItems = await this.page!.$$('[data-testid="space-item"]');
    const spaces = [];
    
    for (const item of spaceItems) {
      const nameElement = await item.$('.space-name');
      const name = await nameElement?.textContent();
      if (name) {
        spaces.push(name);
      }
    }
    
    return spaces;
  }
}

setWorldConstructor(ExtensionWorld);