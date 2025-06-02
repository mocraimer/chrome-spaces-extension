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
        let createdWindow: chrome.windows.Window | undefined;
        
        try {
          // Create window with first URL and specified options
          createdWindow = await chrome.windows.create({
            ...options,
            url: urls[0],
            focused: options.focused ?? true
          });

          if (!createdWindow.id) {
            throw new Error('Failed to create window: no window ID returned');
          }

          // Add remaining URLs as tabs in batches to prevent overwhelming the browser
          if (urls.length > 1) {
            const batchSize = 5;
            for (let i = 1; i < urls.length; i += batchSize) {
              const batch = urls.slice(i, i + batchSize);
              const windowId = createdWindow?.id;
              
              if (!windowId) {
                throw new Error('Window reference lost during tab creation');
              }
              
              await Promise.all(
                batch.map(url =>
                  chrome.tabs.create({
                    windowId,
                    url,
                    active: false
                  })
                )
              );
              // Small delay between batches
              if (i + batchSize < urls.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }

          // Get updated window state with all tabs
          if (!createdWindow || !createdWindow.id) {
            throw new Error('Window reference lost after tab creation');
          }
          return await this.getWindow(createdWindow.id);
        } catch (error) {
          // If window was created but tab creation failed, attempt cleanup
          if (createdWindow?.id) {
            try {
              await this.closeWindow(createdWindow.id);
            } catch (cleanupError) {
              console.error('Failed to cleanup window after tab creation error:', cleanupError);
            }
          }
          throw error;
        }
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
