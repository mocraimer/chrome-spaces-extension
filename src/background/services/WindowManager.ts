import { WindowManager as IWindowManager } from '@/shared/types/Services';
import { executeChromeApi } from '@/shared/utils';
import { ErrorMessages } from '@/shared/constants';

export class WindowManager implements IWindowManager {
  /**
   * Create a new window with the given URLs
   */
  async createWindow(urls: string[]): Promise<chrome.windows.Window> {
    if (!urls.length) {
      throw new Error('Cannot create window with no URLs');
    }

    return executeChromeApi(
      async () => {
        // Create window with first URL
        const window = await chrome.windows.create({ 
          url: urls[0],
          focused: true 
        });

        // Add remaining URLs as tabs
        if (urls.length > 1) {
          await Promise.all(
            urls.slice(1).map(url =>
              chrome.tabs.create({
                windowId: window.id,
                url,
                active: false
              })
            )
          );
        }

        // Return updated window with all tabs
        return this.getWindow(window.id!);
      },
      'WINDOW_ERROR'
    );
  }

  /**
   * Close a window by ID
   */
  async closeWindow(windowId: number): Promise<void> {
    await executeChromeApi(
      () => chrome.windows.remove(windowId),
      'WINDOW_ERROR'
    );
  }

  /**
   * Switch focus to a specific window
   */
  async switchToWindow(windowId: number): Promise<void> {
    await executeChromeApi(
      () => chrome.windows.update(windowId, { 
        focused: true,
        state: 'normal' // Ensure window is visible
      }),
      'WINDOW_ERROR'
    );
  }

  /**
   * Get a window by ID with populated tabs
   */
  async getWindow(windowId: number): Promise<chrome.windows.Window> {
    return executeChromeApi(
      () => chrome.windows.get(windowId, { populate: true }),
      'WINDOW_ERROR'
    );
  }

  /**
   * Get all windows with populated tabs
   */
  async getAllWindows(): Promise<chrome.windows.Window[]> {
    return executeChromeApi(
      () => chrome.windows.getAll({ populate: true }),
      'WINDOW_ERROR'
    );
  }

  /**
   * Check if a window exists
   */
  async windowExists(windowId: number): Promise<boolean> {
    try {
      await this.getWindow(windowId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get currently focused window
   */
  async getCurrentWindow(): Promise<chrome.windows.Window> {
    return executeChromeApi(
      () => chrome.windows.getCurrent({ populate: true }),
      'WINDOW_ERROR'
    );
  }

  /**
   * Arrange windows in a grid layout
   */
  async arrangeWindows(): Promise<void> {
    const windows = await this.getAllWindows();
    const displays = await chrome.system.display.getInfo();
    const { workArea } = displays[0];
    
    const rows = Math.floor(Math.sqrt(windows.length));
    const cols = Math.ceil(windows.length / rows);
    
    const width = Math.floor(workArea.width / cols);
    const height = Math.floor(workArea.height / rows);

    await Promise.all(
      windows.map((window, i) => {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        return chrome.windows.update(window.id!, {
          left: workArea.left + (col * width),
          top: workArea.top + (row * height),
          width,
          height,
          state: 'normal'
        });
      })
    );
  }
}
