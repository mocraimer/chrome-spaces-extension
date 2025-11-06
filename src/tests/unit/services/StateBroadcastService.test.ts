import { StateBroadcastService } from '../../../background/services/StateBroadcastService';
import { QueuedStateUpdate } from '../../../background/services/StateUpdateQueue';

describe('StateBroadcastService', () => {
  let service: StateBroadcastService;
  let mockPort: chrome.runtime.Port;
  let mockSender: chrome.runtime.MessageSender;

  beforeEach(() => {
    // Set up mock port
    mockPort = {
      name: 'state-sync',
      onDisconnect: {
        addListener: jest.fn()
      },
      onMessage: {
        addListener: jest.fn()
      },
      postMessage: jest.fn()
    } as unknown as chrome.runtime.Port;

    // Set up mock sender
    mockSender = {
      tab: {
        windowId: 1
      }
    } as chrome.runtime.MessageSender;

    mockPort.sender = mockSender;

    // Mock chrome.runtime.onConnect
    global.chrome = {
      ...global.chrome,
      runtime: {
        onConnect: {
          addListener: jest.fn()
        }
      }
    } as any;

    service = new StateBroadcastService();
  });

  describe('connection management', () => {
    it('handles new window connections', () => {
      // Get the connection handler
      const connectHandler = (global.chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];
      
      // Simulate connection
      connectHandler(mockPort);

      expect(service.connectionCount).toBe(1);
    });

    it('ignores connections with wrong name', () => {
      const wrongPort = {
        ...mockPort,
        name: 'wrong-name'
      };

      // Get the connection handler
      const connectHandler = (global.chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];
      
      // Simulate connection
      connectHandler(wrongPort);

      expect(service.connectionCount).toBe(0);
    });

    it('handles window disconnection', () => {
      // Get the connection handler
      const connectHandler = (global.chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];
      
      // Simulate connection
      connectHandler(mockPort);

      // Get disconnect handler
      const disconnectHandler = (mockPort.onDisconnect.addListener as jest.Mock).mock.calls[0][0];
      
      // Simulate disconnect
      disconnectHandler();

      expect(service.connectionCount).toBe(0);
    });
  });

  describe('state broadcasting', () => {
    const mockUpdate: QueuedStateUpdate = {
      id: 'test-1',
      type: 'TEST_ACTION',
      payload: { test: true },
      timestamp: Date.now()
    };

    beforeEach(() => {
      // Set up connected windows
      const connectHandler = (global.chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];

      // Connect window 1
      connectHandler(mockPort);

      // Connect window 2
      const mockPort2 = {
        ...mockPort,
        sender: {
          tab: {
            windowId: 2
          }
        }
      };
      connectHandler(mockPort2);
    });

    it('broadcasts updates to all connected windows', () => {
      jest.useFakeTimers();

      service.broadcast(mockUpdate);

      // Advance timers to allow debounce to complete
      jest.advanceTimersByTime(150);

      expect(mockPort.postMessage).toHaveBeenCalledWith(mockUpdate);

      jest.useRealTimers();
    });

    it('handles state updates from specific windows', () => {
      // Get message handler
      const messageHandler = (mockPort.onMessage.addListener as jest.Mock).mock.calls[0][0];
      
      // Simulate message from window 1
      messageHandler(mockUpdate);

      // Should only send to window 2 (not back to sender)
      expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
      expect(mockPort.postMessage).toHaveBeenCalledWith(mockUpdate);
    });
  });

  describe('error handling', () => {
    it('handles failed message sending', () => {
      jest.useFakeTimers();

      // Set up a port that throws on postMessage
      const errorPort = {
        ...mockPort,
        sender: {
          tab: {
            windowId: 1
          }
        },
        onDisconnect: {
          addListener: jest.fn()
        },
        onMessage: {
          addListener: jest.fn()
        },
        postMessage: jest.fn().mockImplementation(() => {
          throw new Error('Failed to send');
        })
      } as unknown as chrome.runtime.Port;

      // Connect the error port
      const connectHandler = (global.chrome.runtime.onConnect.addListener as jest.Mock).mock.calls[0][0];
      connectHandler(errorPort);

      // Verify connection is established
      expect(service.connectionCount).toBe(1);

      // Attempt broadcast
      service.broadcast({
        id: 'test-1',
        type: 'TEST_ACTION',
        payload: { test: true },
        timestamp: Date.now()
      });

      // Advance timers to allow debounce and error handling to complete
      jest.advanceTimersByTime(150);

      // Port should be removed after error
      expect(service.connectionCount).toBe(0);

      jest.useRealTimers();
    });
  });
});