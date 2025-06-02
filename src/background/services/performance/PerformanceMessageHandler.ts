import { PerformanceTrackingService, DetailedMetric } from './PerformanceTrackingService';

interface DevToolsConnection {
  tabId: number;
  port: chrome.runtime.Port;
}

export class PerformanceMessageHandler {
  private static instance: PerformanceMessageHandler;
  private connections: Map<number, DevToolsConnection> = new Map();
  private perfService: PerformanceTrackingService;

  private constructor() {
    this.perfService = PerformanceTrackingService.getInstance();
    this.setupMetricSubscription();
    this.setupConnectionListeners();
  }

  static getInstance(): PerformanceMessageHandler {
    if (!PerformanceMessageHandler.instance) {
      PerformanceMessageHandler.instance = new PerformanceMessageHandler();
    }
    return PerformanceMessageHandler.instance;
  }

  private setupMetricSubscription(): void {
    // Subscribe to performance metrics and broadcast to connected devtools
    this.perfService.subscribe((metric: DetailedMetric) => {
      this.broadcastMetric(metric);
    });
  }

  private setupConnectionListeners(): void {
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'devtools-performance') {
        return;
      }

      port.onMessage.addListener((message) => {
        if (message.type === 'init') {
          this.handleDevToolsConnection(message.tabId, port);
        } else if (message.type === 'getPerformanceMetrics') {
          this.sendInitialMetrics(port);
        }
      });

      port.onDisconnect.addListener(() => {
        this.handleDevToolsDisconnection(port);
      });
    });
  }

  private handleDevToolsConnection(tabId: number, port: chrome.runtime.Port): void {
    this.connections.set(tabId, { tabId, port });
    
    // Send current metrics state
    this.sendInitialMetrics(port);
  }

  private handleDevToolsDisconnection(port: chrome.runtime.Port): void {
    // Find and remove the connection
    for (const [tabId, connection] of this.connections.entries()) {
      if (connection.port === port) {
        this.connections.delete(tabId);
        break;
      }
    }
  }

  private sendInitialMetrics(port: chrome.runtime.Port): void {
    const report = this.perfService.generateReport();
    port.postMessage({
      type: 'performanceReport',
      report
    });
  }

  private broadcastMetric(metric: DetailedMetric): void {
    // Send metric to all connected devtools instances
    for (const connection of this.connections.values()) {
      try {
        connection.port.postMessage({
          type: 'performanceMetric',
          metric
        });
      } catch (error) {
        console.error('Error broadcasting metric:', error);
        // Clean up failed connection
        this.connections.delete(connection.tabId);
      }
    }
  }
}