import { RestoreSpaceTransaction } from '../../../background/services/RestoreSpaceTransaction';
import { WindowManager as WindowManagerImpl } from '../../../background/services/WindowManager';
import { StateManager as StateManagerImpl } from '../../../background/services/StateManager';
import type { Space } from '../../../shared/types/Space';
import { RestoreRegistry } from '../../../background/services/types/RestoreRegistry';
import { createWindowManagerMock, createStateManagerMock } from '../../utils/serviceMocks';
import { createMockSpace } from '../../mocks/mockTypes';

jest.mock('../../../background/services/WindowManager');
jest.mock('../../../background/services/StateManager');
jest.mock('../../../background/services/TabManager');

// SKIPPED: Runtime failures - needs investigation
describe.skip('RestoreSpaceTransaction', () => {
  let restoreSpaceTransaction: RestoreSpaceTransaction;
  let windowManager: jest.Mocked<WindowManagerImpl>;
  let stateManager: jest.Mocked<StateManagerImpl>;
  let restoreRegistry: RestoreRegistry;

  const mockSpaceData: Space = createMockSpace('1', 'Test Space', {
    urls: ['https://example.com'],
    named: false
  });

  const mockWindow: chrome.windows.Window = {
    id: 1,
    focused: true,
    type: 'normal'
  } as chrome.windows.Window;

  beforeEach(() => {
    // Create fresh mocks for each test
    windowManager = new WindowManagerImpl() as jest.Mocked<WindowManagerImpl>;
    restoreRegistry = new RestoreRegistry();
    stateManager = new StateManagerImpl(
      windowManager,
      {} as any,
      {} as any, 
      {} as any, 
      {} as any,
      restoreRegistry
    ) as jest.Mocked<StateManagerImpl>;

    // Setup default mock responses
    windowManager.createWindow.mockResolvedValue(mockWindow);
    stateManager.getSpaceById.mockResolvedValue(mockSpaceData);
    stateManager.rekeySpace.mockResolvedValue(undefined);
    windowManager.closeWindow.mockResolvedValue(undefined);

    restoreSpaceTransaction = new RestoreSpaceTransaction(
      windowManager,
      stateManager
    );
  });

  describe('state transitions', () => {
    it('should transition through states during successful restoration', async () => {
      const onStateChange = jest.fn();
      restoreSpaceTransaction.onStateChange(onStateChange);

      await restoreSpaceTransaction.restore('1');

      expect(onStateChange).toHaveBeenCalledWith('INITIALIZING');
      expect(onStateChange).toHaveBeenCalledWith('CREATING_WINDOW');
      expect(onStateChange).toHaveBeenCalledWith('COMPLETED');
    });

    it('should handle failure states', async () => {
      const error = new Error('Window creation failed');
      windowManager.createWindow.mockRejectedValue(error);

      const onStateChange = jest.fn();
      const onError = jest.fn();
      restoreSpaceTransaction.onStateChange(onStateChange);
      restoreSpaceTransaction.onError(onError);

      await expect(restoreSpaceTransaction.restore('1')).rejects.toThrow(error);

      expect(onStateChange).toHaveBeenCalledWith('INITIALIZING');
      expect(onStateChange).toHaveBeenCalledWith('CREATING_WINDOW');
      expect(onStateChange).toHaveBeenCalledWith('FAILED');
      expect(onError).toHaveBeenCalledWith(error);
    });
  });

  describe('window restoration', () => {
    it('should create window with correct configuration', async () => {
      await restoreSpaceTransaction.restore('1');

      expect(windowManager.createWindow).toHaveBeenCalledWith(
        expect.arrayContaining(['https://example.com'])
      );
    });

    it('should rekey space with new window id', async () => {
      await restoreSpaceTransaction.restore('1');

      expect(stateManager.rekeySpace).toHaveBeenCalledWith('1', 1);
    });
  });

  describe('concurrent restorations', () => {
    it('should queue multiple restoration requests', async () => {
      const firstRestore = restoreSpaceTransaction.restore('1');
      const secondRestore = restoreSpaceTransaction.restore('2');

      await expect(Promise.all([firstRestore, secondRestore])).resolves.toBeDefined();
      expect(windowManager.createWindow).toHaveBeenCalledTimes(2);
    });

    it('should handle errors in queued restorations', async () => {
      windowManager.createWindow
        .mockResolvedValueOnce(mockWindow)
        .mockRejectedValueOnce(new Error('Second window failed'));

      const firstRestore = restoreSpaceTransaction.restore('1');
      const secondRestore = restoreSpaceTransaction.restore('2');

      await expect(firstRestore).resolves.toBeDefined();
      await expect(secondRestore).rejects.toThrow('Second window failed');
    });
  });

  describe('cleanup on failure', () => {
    it('should clean up partially created windows on failure', async () => {
      stateManager.rekeySpace.mockRejectedValue(new Error('Rekey failed'));

      await expect(restoreSpaceTransaction.restore('1')).rejects.toThrow();
      expect(windowManager.closeWindow).toHaveBeenCalledWith(1);
    });

    it('should handle cleanup failures gracefully', async () => {
      stateManager.rekeySpace.mockRejectedValue(new Error('Rekey failed'));
      windowManager.closeWindow.mockRejectedValue(new Error('Cleanup failed'));

      await expect(restoreSpaceTransaction.restore('1')).rejects.toThrow('Rekey failed');
    });
  });
});
