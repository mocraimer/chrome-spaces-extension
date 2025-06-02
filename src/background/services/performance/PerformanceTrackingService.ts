// Use browser's built-in performance API
import { PerformanceMetric, PerformanceReport } from '../../../tests/performance/utils/performanceUtils';

export const MetricCategories = {
  WINDOW: 'window',
  STATE: 'state',
  UI: 'ui'
} as const;

export type MetricCategory = typeof MetricCategories[keyof typeof MetricCategories];

export interface DetailedMetric extends PerformanceMetric {
  category: MetricCategory;
  context?: Record<string, any>;
  stack?: string;
}

export class PerformanceTrackingService {
  private static instance: PerformanceTrackingService;
  private metrics: DetailedMetric[] = [];
  private listeners: ((metric: DetailedMetric) => void)[] = [];
  private isEnabled = false; //process.env.NODE_ENV === 'development' || process.env.ENABLE_PERFORMANCE_TRACKING === 'true';

  private constructor() {}

  static getInstance(): PerformanceTrackingService {
    if (!PerformanceTrackingService.instance) {
      PerformanceTrackingService.instance = new PerformanceTrackingService();
    }
    return PerformanceTrackingService.instance;
  }

  /**
   * Creates a performance tracking decorator
   */
  static track(category: MetricCategory, threshold: number = 100): MethodDecorator {
    return function (
      target: Object,
      propertyKey: string | symbol,
      descriptor: TypedPropertyDescriptor<any>
    ): TypedPropertyDescriptor<any> {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const tracker = PerformanceTrackingService.getInstance();
        const start = performance.now();
        
        try {
          const result = await originalMethod.apply(this, args);
          const duration = performance.now() - start;
          
          tracker.recordMetric({
            name: `${target.constructor.name}.${String(propertyKey)}`,
            duration,
            threshold,
            passed: duration <= threshold,
            timestamp: Date.now(),
            category,
            context: {
              args: args.map(arg =>
                arg instanceof Error ? arg.message :
                typeof arg === 'object' ? JSON.stringify(arg) :
                String(arg)
              ),
              result: typeof result === 'object' ? JSON.stringify(result) : String(result)
            },
            stack: new Error().stack
          });
          
          return result;
        } catch (error) {
          const duration = performance.now() - start;
          tracker.recordMetric({
            name: `${target.constructor.name}.${String(propertyKey)}`,
            duration,
            threshold,
            passed: false,
            timestamp: Date.now(),
            category,
            context: {
              args: args.map(arg =>
                arg instanceof Error ? arg.message :
                typeof arg === 'object' ? JSON.stringify(arg) :
                String(arg)
              ),
              error: error instanceof Error ? error.message : String(error)
            },
            stack: error instanceof Error ? error.stack : new Error().stack
          });
          throw error;
        }
      };

      return descriptor;
    };
  }

  /**
   * Records a performance metric
   */
  public recordMetric(metric: DetailedMetric): void {
    if (!this.isEnabled) return;
    
    this.metrics.push(metric);
    this.notifyListeners(metric);

    // Alert on performance regression
    if (!metric.passed) {
      console.warn(
        `Performance regression detected in ${metric.name}:`,
        `${metric.duration.toFixed(2)}ms (threshold: ${metric.threshold}ms)`,
        metric.context
      );
    }
  }

  /**
   * Subscribes to real-time metric updates
   */
  public subscribe(listener: (metric: DetailedMetric) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Generates a detailed performance report
   */
  public generateReport(): PerformanceReport & {
    detailedMetrics: DetailedMetric[];
    categoryBreakdown: Record<MetricCategory, number>;
  } {
    const totalTests = this.metrics.length;
    const passedTests = this.metrics.filter((m) => m.passed).length;

    const categoryBreakdown = this.metrics.reduce((acc, metric) => {
      acc[metric.category] = (acc[metric.category] || 0) + 1;
      return acc;
    }, Object.values(MetricCategories).reduce((obj, val) => ({ ...obj, [val]: 0 }), {}) as Record<MetricCategory, number>);

    return {
      metrics: this.metrics,
      detailedMetrics: this.metrics,
      categoryBreakdown,
      summary: {
        totalTests,
        passedTests,
        failedTests: totalTests - passedTests,
      },
    };
  }

  private notifyListeners(metric: DetailedMetric): void {
    this.listeners.forEach(listener => {
      try {
        listener(metric);
      } catch (error) {
        console.error('Error in performance metric listener:', error);
      }
    });
  }

  /**
   * Clears all recorded metrics
   */
  public clear(): void {
    this.metrics = [];
  }
}