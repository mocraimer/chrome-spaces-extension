import { performance } from 'perf_hooks';

export interface PerformanceMetric {
  name: string;
  duration: number;
  threshold: number;
  passed: boolean;
  timestamp: number;
}

export interface PerformanceReport {
  metrics: PerformanceMetric[];
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  /**
   * Measures the execution time of an async operation
   */
  async measureAsync(
    name: string,
    operation: () => Promise<void>,
    threshold: number
  ): Promise<PerformanceMetric> {
    const start = performance.now();
    await operation();
    const end = performance.now();
    const duration = end - start;

    const metric: PerformanceMetric = {
      name,
      duration,
      threshold,
      passed: duration <= threshold,
      timestamp: Date.now(),
    };

    this.metrics.push(metric);
    return metric;
  }

  /**
   * Generates a performance report
   */
  generateReport(): PerformanceReport {
    const totalTests = this.metrics.length;
    const passedTests = this.metrics.filter((m) => m.passed).length;

    return {
      metrics: this.metrics,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
      },
    };
  }

  /**
   * Clears all recorded metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

/**
 * Simulates tab data for testing
 */
export function generateMockTabs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Tab ${i + 1}`,
    url: `https://example.com/page${i + 1}`,
    active: i === 0,
    pinned: false,
    windowId: 1,
  }));
}

/**
 * Utility to wait for a specific duration
 */
export const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));