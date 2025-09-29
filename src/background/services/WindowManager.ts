import { WindowManager as IWindowManager } from '@/shared/types/Services';
import { executeChromeApi } from '@/shared/utils';
import { PerformanceTrackingService, MetricCategories } from './performance/PerformanceTrackingService';

export class WindowManager implements IWindowManager {
  /**
   * Create a new window with the given URLs
   */
  @PerformanceTrackingService.track(MetricCategories.WINDOW, 2000)
  async createWindow(urls: string[], options: chrome.windows.CreateData = {}): Promise<chrome.windows.Window> {
    if (!urls.length) {
      throw new Error('Cannot create window with no URLs');
    }

    return executeChromeApi(
      async () => {
        // Create window with all URLs at once - Chrome handles multiple tabs automatically
        const createdWindow = await chrome.windows.create({
          ...options,
          url: urls, // Pass entire URLs array - Chrome creates all tabs
          focused: options.focused ?? true
        });

        if (!createdWindow?.id) {
          throw new Error('Failed to create window: no window ID returned');
        }

        // Get updated window state with all populated tabs
        return await this.getWindow(createdWindow.id);
      },
      'WINDOW_ERROR'
    );
  }

  /**
   * Close a window by ID
   */
  @PerformanceTrackingService.track(MetricCategories.WINDOW, 500)
  async closeWindow(windowId: number): Promise<void> {
    await executeChromeApi(
      () => chrome.windows.remove(windowId),
      'WINDOW_ERROR'
    );
  }

  /**
   * Switch focus to a specific window
   */
  @PerformanceTrackingService.track(MetricCategories.WINDOW, 300)
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
    try {
      return await executeChromeApi(
        () => chrome.windows.get(windowId, { populate: true }),
        'WINDOW_ERROR'
      );
    } catch (error) {
      throw new Error(`Failed to get window ${windowId}: ${(error as Error).message}`);
    }
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
  @PerformanceTrackingService.track(MetricCategories.WINDOW, 1000)
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
        
        const windowId = window.id;
        if (!windowId) {
          throw new Error(`Window ${i} has no ID`);
        }
        return chrome.windows.update(windowId, {
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
