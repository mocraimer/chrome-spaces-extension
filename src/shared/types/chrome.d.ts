export interface ChromeStorage {
  local: {
    get: (key: string | string[] | Record<string, any> | null) => Promise<any>;
    set: (items: Record<string, any>) => Promise<void>;
    remove: (key: string | string[]) => Promise<void>;
    clear: () => Promise<void>;
  };
}

declare global {
  interface Window {
    chrome: {
      storage: ChromeStorage;
      downloads: {
        download: (
          options: {
            url: string;
            filename?: string;
            saveAs?: boolean;
          },
          callback?: (downloadId?: number) => void
        ) => void;
      };
      runtime: {
        lastError?: {
          message: string;
        };
      };
    };
  }
  
  const chrome: Window['chrome'];
}

export {};