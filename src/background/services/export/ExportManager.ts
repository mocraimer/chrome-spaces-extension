import { Space, SpaceState } from '../../../shared/types/Space';
import { SpaceExportData, ExportOptions } from '../../../shared/types/ImportExport';

export class ExportManager {
  private readonly VERSION = '1.0.0';
  
  constructor(private readonly stateManager: { getState: () => SpaceState }) {}

  public async exportSpaces(options: ExportOptions = {}): Promise<SpaceExportData> {
    const state = this.stateManager.getState();
    const timestamp = Date.now();

    const exportData: SpaceExportData = {
      version: this.VERSION,
      timestamp,
      spaces: {
        active: {},
        closed: {}
      },
      metadata: {
        exportedBy: 'Chrome Spaces Extension',
        description: options.description
      }
    };

    if (options.includeActive !== false) {
      exportData.spaces.active = this.filterValidSpaces(state.spaces);
    }

    if (options.includeClosed !== false) {
      exportData.spaces.closed = this.filterValidSpaces(state.closedSpaces);
    }

    return exportData;
  }

  public async generateExportBlob(data: SpaceExportData): Promise<Blob> {
    const jsonString = JSON.stringify(data, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }

  public async downloadExport(blob: Blob, filename: string = 'spaces-export.json'): Promise<void> {
    const url = URL.createObjectURL(blob);
    
    try {
      const downloadOptions = {
        url,
        filename,
        saveAs: true
      };

      await new Promise<void>((resolve, reject) => {
        chrome.downloads.download(downloadOptions, (downloadId) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  private filterValidSpaces(spaces: Record<string, Space>): Record<string, Space> {
    return Object.entries(spaces).reduce((acc, [id, space]) => {
      if (this.isValidSpace(space)) {
        acc[id] = this.sanitizeSpace(space);
      }
      return acc;
    }, {} as Record<string, Space>);
  }

  private isValidSpace(space: Space): boolean {
    return (
      typeof space === 'object' &&
      typeof space.id === 'string' &&
      typeof space.name === 'string' &&
      Array.isArray(space.urls) &&
      space.urls.every(url => typeof url === 'string')
    );
  }

  private sanitizeSpace(space: Space): Space {
    return {
      id: space.id,
      name: space.name,
      urls: space.urls.filter(url => url.trim().length > 0),
      lastModified: space.lastModified,
      named: space.named,
      version: space.version || 1
    };
  }
}