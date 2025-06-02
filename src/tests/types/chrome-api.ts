// Chrome API type definitions for testing
export interface ChromeWindow {
  id: number;
  tabs: chrome.tabs.Tab[];
  focused: boolean;
  type: 'normal' | 'popup' | 'panel' | 'app' | 'devtools';
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
  alwaysOnTop: boolean;
}

export interface ChromeTab {
  id?: number;
  index: number;
  windowId: number;
  url?: string;
  title?: string;
  active: boolean;
  pinned: boolean;
}

export interface ChromePort {
  name: string;
  onMessage: {
    addListener: (callback: (message: any) => void) => void;
    removeListener: (callback: (message: any) => void) => void;
  };
  onDisconnect: {
    addListener: (callback: () => void) => void;
    removeListener: (callback: () => void) => void;
  };
  postMessage: (message: any) => void;
  disconnect: () => void;
}

export interface ChromeEvent<T extends Function> {
  addListener: (callback: T) => void;
  removeListener: (callback: T) => void;
  hasListener: (callback: T) => boolean;
  hasListeners: () => boolean;
  getRules: () => Promise<any[]>;
  addRules: (rules: any[]) => Promise<any[]>;
  removeRules: (ruleIds?: string[]) => Promise<void>;
}

export interface CreateWindowOptions {
  url?: string | string[];
  tabId?: number;
  left?: number;
  top?: number;
  width?: number;
  height?: number;
  focused?: boolean;
  incognito?: boolean;
  type?: ChromeWindow['type'];
  state?: ChromeWindow['state'];
}

export interface ConnectInfo {
  name?: string;
  includeTlsChannelId?: boolean;
}