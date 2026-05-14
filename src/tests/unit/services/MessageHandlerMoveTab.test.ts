import { MessageHandler } from '../../../background/services/MessageHandler';
import { ActionTypes } from '../../../shared/constants';

describe('MessageHandler moveTabToNewSpace', () => {
  let stateManager: {
    createSpace: jest.Mock;
    synchronizeWindowsAndSpaces: jest.Mock;
  };
  let messageHandler: MessageHandler;

  beforeEach(() => {
    (chrome.commands.onCommand.addListener as jest.Mock).mockClear();

    (chrome.windows.create as jest.Mock).mockResolvedValue({ id: 42 });
    (chrome.tabs as any).move = jest.fn().mockResolvedValue({});
    (chrome.tabs.query as jest.Mock).mockResolvedValue([
      { id: 99, url: 'chrome://newtab/' },
    ]);
    (chrome.tabs.remove as jest.Mock).mockResolvedValue(undefined);
    (chrome.tabs as any).get = jest.fn().mockResolvedValue({
      id: 7,
      title: 'Misleading Tab Title',
      windowId: 1,
    });

    stateManager = {
      createSpace: jest.fn().mockResolvedValue(undefined),
      synchronizeWindowsAndSpaces: jest.fn().mockResolvedValue(undefined),
    };

    messageHandler = new MessageHandler(
      {} as any,
      {} as any,
      stateManager as any,
    );
  });

  it('creates the new space with the default unnamed space naming path', async () => {
    const sendResponse = jest.fn();

    await messageHandler.handleMessage(
      {
        action: ActionTypes.MOVE_TAB_TO_NEW_SPACE,
        tabId: 7,
      },
      {} as chrome.runtime.MessageSender,
      sendResponse
    );

    expect(chrome.tabs.get).not.toHaveBeenCalled();
    expect(stateManager.createSpace).toHaveBeenCalledWith(42);
    expect(stateManager.synchronizeWindowsAndSpaces).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({ success: true, windowId: 42 });
  });
});
