import { WindowManager } from '../../../background/services/WindowManager';
import { mockChrome } from '../../utils/testUtils';

jest.mock('../../../background/services/WindowManager');

describe('WindowManager', () => {
  let windowManager: WindowManager;

  const mockWindow: chrome.windows.Window = {
    id: 1,
    focused: true,
    tabs: [
      { id: 1, url: 'https://example.com', windowId: 1 } as chrome.tabs.Tab
    ]
  } as chrome.windows.Window;

  beforeEach(() => {
    jest.resetAllMocks();
    (mockChrome.windows.create as jest.Mock).mockResolvedValue(mockWindow);
    (mockChrome.windows.get as jest.Mock).mockResolvedValue(mockWindow);
    (mockChrome.windows.remove as jest.Mock).mockResolvedValue(undefined);
    windowManager = new WindowManager();
  });

  describe('window operations', () => {
    it('should create a new window with given tabs', async () => {
      const urls = ['https://example.com'];
      await windowManager.createWindow(urls);

      expect(mockChrome.windows.create).toHaveBeenCalledWith({
        url: urls, // Now passes entire URLs array
        focused: true
      });
    });

    it('should create a new window with multiple tabs', async () => {
      const urls = ['https://example.com', 'https://google.com', 'https://github.com'];
      await windowManager.createWindow(urls);

      expect(mockChrome.windows.create).toHaveBeenCalledWith({
        url: urls, // Passes entire URLs array for multiple tabs
        focused: true
      });
    });

    it('should handle window creation failure gracefully', async () => {
      (mockChrome.windows.create as jest.Mock).mockRejectedValue(new Error('Failed to create window'));
      
      await expect(windowManager.createWindow(['https://example.com']))
        .rejects.toThrow('WINDOW_ERROR');
    });

    it('should close window by id', async () => {
      await windowManager.closeWindow(1);
      expect(mockChrome.windows.remove).toHaveBeenCalledWith(1);
    });

    it('should verify window existence', async () => {
      const exists = await windowManager.windowExists(1);
      expect(exists).toBe(true);
      expect(mockChrome.windows.get).toHaveBeenCalledWith(1, { populate: true });
    });

    it('should return false for non-existent window', async () => {
      (mockChrome.windows.get as jest.Mock).mockRejectedValue(new Error('Window not found'));
      const exists = await windowManager.windowExists(999);
      expect(exists).toBe(false);
    });
  });

  describe('window state tracking', () => {
    it('should track active windows', async () => {
      const windows = [mockWindow];
      (mockChrome.windows.getAll as jest.Mock).mockResolvedValue(windows);

      const activeWindows = await windowManager.getAllWindows();
      expect(activeWindows).toEqual(windows);
      expect(mockChrome.windows.getAll).toHaveBeenCalledWith({ populate: true });
    });

    it('should filter out non-normal windows', async () => {
      const windows = [
        mockWindow,
        { ...mockWindow, id: 2, type: 'popup' }
      ] as chrome.windows.Window[];
      
      (mockChrome.windows.getAll as jest.Mock).mockResolvedValue(windows);

      const activeWindows = await windowManager.getAllWindows();
      expect(activeWindows).toHaveLength(1);
      expect(activeWindows[0].id).toBe(1);
    });

    it('should handle empty window list', async () => {
      (mockChrome.windows.getAll as jest.Mock).mockResolvedValue([]);
      const activeWindows = await windowManager.getAllWindows();
      expect(activeWindows).toHaveLength(0);
    });
  });

  describe('window management', () => {
    it('should switch focus to specified window', async () => {
      await windowManager.switchToWindow(1);
      expect(mockChrome.windows.update).toHaveBeenCalledWith(1, {
        focused: true,
        state: 'normal'
      });
    });

    it('should get current window', async () => {
      (mockChrome.windows.getCurrent as jest.Mock).mockResolvedValue(mockWindow);
      const current = await windowManager.getCurrentWindow();
      expect(current).toEqual(mockWindow);
      expect(mockChrome.windows.getCurrent).toHaveBeenCalledWith({ populate: true });
    });

    it('should arrange windows in grid layout', async () => {
      const windows = [mockWindow, {...mockWindow, id: 2}];
      const mockDisplay = {
        id: '1',
        workArea: { width: 1920, height: 1080, left: 0, top: 0 }
      };

      (mockChrome.windows.getAll as jest.Mock).mockResolvedValue(windows);
      (mockChrome.system.display.getInfo as jest.Mock).mockResolvedValue([mockDisplay]);

      await windowManager.arrangeWindows();

      expect(mockChrome.windows.update).toHaveBeenCalledTimes(2);
      expect(mockChrome.windows.update).toHaveBeenCalledWith(1, {
        left: 0,
        top: 0,
        width: 960,
        height: 1080,
        state: 'normal'
      });
      expect(mockChrome.windows.update).toHaveBeenCalledWith(2, {
        left: 960,
        top: 0,
        width: 960,
        height: 1080,
        state: 'normal'
      });
    });
  });
});