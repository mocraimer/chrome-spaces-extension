import { jest } from '@jest/globals';
import { StateManager } from '../../../background/services/StateManager';
import { BackgroundService } from '../../../background';
import {
  createWindowManagerMock,
  createTabManagerMock,
  createStorageManagerMock,
  createStateUpdateQueueMock,
  createStateBroadcastServiceMock,
  createPerformanceTrackingServiceMock,
} from '../../utils/serviceMocks';
import { IStateManager } from '@/shared/types/Services';

/**
 * @file This file contains integration tests for the auto-restore functionality
 * on browser startup. It verifies that the BackgroundService correctly
 * restores spaces that were open when the browser was last closed.
 */

describe('Browser Startup Auto-Restore Tests', () => {
  let stateManager: IStateManager;
  let backgroundService: BackgroundService;
  let storageManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock services
    const windowManager = createWindowManagerMock();
    const tabManager = createTabManagerMock();
    storageManager = createStorageManagerMock();
    const updateQueue = createStateUpdateQueueMock();
    const broadcastService = createStateBroadcastServiceMock();
    createPerformanceTrackingServiceMock();

    stateManager = new StateManager(
      windowManager,
      tabManager,
      storageManager,
      updateQueue,
      broadcastService
    );

    // Mock settings loading
    storageManager.loadSettings.mockResolvedValue({
      general: { autoRestore: true },
    });

    backgroundService = new BackgroundService(stateManager);

    // Mock chrome APIs
    global.chrome = {
      runtime: {
        onStartup: { addListener: jest.fn() },
        onInstalled: { addListener: jest.fn() },
        onMessage: { addListener: jest.fn() },
        onSuspend: { addListener: jest.fn() },
      },
      windows: {
        onCreated: { addListener: jest.fn() },
        onRemoved: { addListener: jest.fn() },
        onFocusChanged: { addListener: jest.fn() },
      },
      tabs: {
        onCreated: { addListener: jest.fn() },
        onUpdated: { addListener: jest.fn() },
      },
    } as any;
  });

  test('should auto-restore named spaces on browser startup', async () => {
    // Arrange
    const closedSpaces = {
      '1': { id: '1', name: 'Work', named: true, urls: ['https://a.com'] },
      '2': { id: '2', name: 'Space 2', named: false, urls: ['https://b.com'] },
      '3': { id: '3', name: 'Personal', named: true, urls: ['https://c.com'] },
    };
    storageManager.loadClosedSpaces.mockResolvedValue(closedSpaces);
    const restoreSpaceSpy = jest.spyOn(stateManager, 'restoreSpace');

    // Act: Simulate browser startup
    await backgroundService['handleStartup']();

    // Assert
    // Verify that only named spaces were restored
    expect(restoreSpaceSpy).toHaveBeenCalledTimes(2);
    expect(restoreSpaceSpy).toHaveBeenCalledWith('1');
    expect(restoreSpaceSpy).toHaveBeenCalledWith('3');
    expect(restoreSpaceSpy).not.toHaveBeenCalledWith('2');
  });

  test('should not restore spaces if auto-restore is disabled', async () => {
    // Arrange
    storageManager.loadSettings.mockResolvedValue({
      general: { autoRestore: false },
    });
    const restoreSpaceSpy = jest.spyOn(stateManager, 'restoreSpace');

    // Act
    await backgroundService['handleStartup']();

    // Assert
    expect(restoreSpaceSpy).not.toHaveBeenCalled();
  });

  test('should handle errors during space restoration gracefully', async () => {
    // Arrange
    const closedSpaces = {
      '1': { id: '1', name: 'Good Space', named: true, urls: ['https://a.com'] },
      '2': { id: '2', name: 'Bad Space', named: true, urls: ['https://b.com'] },
    };
    storageManager.loadClosedSpaces.mockResolvedValue(closedSpaces);
    const restoreSpaceSpy = jest
      .spyOn(stateManager, 'restoreSpace')
      .mockImplementation(async (spaceId) => {
        if (spaceId === '2') {
          throw new Error('Failed to restore');
        }
      });
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    // Act
    await backgroundService['handleStartup']();

    // Assert
    // Should attempt to restore both, even if one fails
    expect(restoreSpaceSpy).toHaveBeenCalledTimes(2);
    expect(restoreSpaceSpy).toHaveBeenCalledWith('1');
    expect(restoreSpaceSpy).toHaveBeenCalledWith('2');

    // Should log the error for the failed space
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error restoring spaces:',
      expect.any(Error)
    );
    consoleErrorSpy.mockRestore();
  });
}); 