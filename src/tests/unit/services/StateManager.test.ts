import { WindowManager } from '../../../background/services/WindowManager';
import { TabManager } from '../../../background/services/TabManager';
import { StorageManager } from '../../../background/services/StorageManager';
import { StateManager } from '../../../background/services/StateManager';
import { DEFAULT_SPACE_NAME, SPACE_NAME_MAX_LENGTH } from '../../../shared/constants';

// Mock dependencies
jest.mock('../../../background/services/WindowManager');
jest.mock('../../../background/services/TabManager');
jest.mock('../../../background/services/StorageManager');

describe('StateManager', () => {
  let stateManager: StateManager;
  let windowManager: jest.Mocked<WindowManager>;
  let tabManager: jest.Mocked<TabManager>;
  let storageManager: jest.Mocked<StorageManager>;

  beforeEach(() => {
    windowManager = new WindowManager() as jest.Mocked<WindowManager>;
    tabManager = new TabManager() as jest.Mocked<TabManager>;
    storageManager = new StorageManager() as jest.Mocked<StorageManager>;

    stateManager = new StateManager(windowManager, tabManager, storageManager);
  });

  describe('setSpaceName', () => {
    const mockSpace = {
      id: '1',
      name: 'Original Space',
      urls: ['https://example.com'],
      lastModified: 123456789
    };

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({ '1': mockSpace });
      storageManager.saveSpaces.mockResolvedValue();
    });

    it('should update space name successfully', async () => {
      const newName = 'New Space Name';
      await stateManager.setSpaceName('1', newName);

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            ...mockSpace,
            name: newName,
            lastModified: expect.any(Number)
          })
        })
      );
    });

    it('should throw error for empty name', async () => {
      await expect(stateManager.setSpaceName('1', '')).rejects.toThrow('Space name cannot be empty');
      await expect(stateManager.setSpaceName('1', '   ')).rejects.toThrow('Space name cannot be empty');
    });

    it('should throw error for name exceeding max length', async () => {
      const longName = 'a'.repeat(SPACE_NAME_MAX_LENGTH + 1);
      await expect(stateManager.setSpaceName('1', longName))
        .rejects.toThrow(`Space name cannot exceed ${SPACE_NAME_MAX_LENGTH} characters`);
    });

    it('should throw error for non-existent space', async () => {
      storageManager.loadSpaces.mockResolvedValue({});
      await expect(stateManager.setSpaceName('1', 'New Name'))
        .rejects.toThrow('Space not found');
    });

    it('should trim and normalize whitespace in name', async () => {
      await stateManager.setSpaceName('1', '  New   Space  Name  ');

      expect(storageManager.saveSpaces).toHaveBeenCalledWith(
        expect.objectContaining({
          '1': expect.objectContaining({
            name: 'New Space Name'
          })
        })
      );
    });
  });

  describe('getSpaceName', () => {
    const mockSpace = {
      id: '1',
      name: 'Test Space',
      urls: ['https://example.com'],
      lastModified: 123456789
    };

    beforeEach(() => {
      storageManager.loadSpaces.mockResolvedValue({});
      storageManager.loadClosedSpaces.mockResolvedValue({});
    });

    it('should return space name for active space', async () => {
      storageManager.loadSpaces.mockResolvedValue({ '1': mockSpace });
      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });

    it('should return space name for closed space', async () => {
      storageManager.loadClosedSpaces.mockResolvedValue({ '1': mockSpace });
      const name = await stateManager.getSpaceName('1');
      expect(name).toBe('Test Space');
    });

    it('should return default name for non-existent space', async () => {
      const name = await stateManager.getSpaceName('999');
      expect(name).toBe(`${DEFAULT_SPACE_NAME} 999`);
    });
  });
});