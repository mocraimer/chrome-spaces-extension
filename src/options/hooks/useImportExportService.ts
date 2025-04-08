import { useEffect, useState } from 'react';
import { SpaceImportExportService } from '../../background/services/SpaceImportExportService';
import { StateManager } from '../../background/services/StateManager';
import { WindowManager } from '../../background/services/WindowManager';
import { TabManager } from '../../background/services/TabManager';
import { StorageManager } from '../../background/services/StorageManager';

export const useImportExportService = () => {
  const [service, setService] = useState<SpaceImportExportService | null>(null);

  useEffect(() => {
    const initService = async () => {
      try {
        const windowManager = new WindowManager();
        const tabManager = new TabManager();
        const storageManager = new StorageManager();
        
        const stateManager = new StateManager(
          windowManager,
          tabManager,
          storageManager
        );
        
        await stateManager.initialize();
        const importExportService = new SpaceImportExportService(stateManager);
        setService(importExportService);
      } catch (error) {
        console.error('Failed to initialize import/export service:', error);
      }
    };

    initService();
  }, []);

  return service;
};