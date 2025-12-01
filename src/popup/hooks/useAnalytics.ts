import { useCallback, useEffect } from 'react';
import { usePreferences } from './usePreferences';

interface AnalyticsEvent {
  type: string;
  data?: Record<string, any>;
  timestamp: number;
}

interface AnalyticsOptions {
  debug?: boolean;
  bufferSize?: number;
  flushInterval?: number;
  onError?: (error: Error) => void;
}

const ANALYTICS_KEY = 'chrome-spaces-analytics';
const SESSION_START_KEY = 'analytics-session-start';

interface UserMetrics {
  spacesCreated: number;
  spacesDeleted: number;
  tabsMoved: number;
  searchesPerformed: number;
  sessionCount: number;
  totalUsageTime: number;
  lastUsed: number;
}

export function useAnalytics(options: AnalyticsOptions = {}) {
  const {
    debug = false,
    bufferSize = 50,
    flushInterval = 60000, // 1 minute
    onError
  } = options;

  const { preferences: _preferences } = usePreferences();
  const isEnabled = true; // We'll handle telemetry opt-in in a separate PR

  // Initialize session
  useEffect(() => {
    if (!isEnabled) return;

    const startSession = async () => {
      try {
        const sessionStart = Date.now();
        await chrome.storage.local.set({ [SESSION_START_KEY]: sessionStart });

        // Track session start
        logEvent('session_start', {
          timestamp: sessionStart,
          userAgent: navigator.userAgent,
          platformInfo: await chrome.runtime.getPlatformInfo()
        });
      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to start session');
        onError?.(err);
      }
    };

    startSession();

    return () => {
      if (isEnabled) {
        const endSession = async () => {
          const result = await chrome.storage.local.get(SESSION_START_KEY);
          const startTime = result[SESSION_START_KEY] as number;
          const duration = Date.now() - (startTime || Date.now());
          
          await logEvent('session_end', { duration });
        };
        
        endSession().catch(error => {
          const err = error instanceof Error ? error : new Error('Failed to end session');
          onError?.(err);
        });
      }
    };
  }, [isEnabled, onError]);

  // Log event with optional data
  const logEvent = useCallback(async (
    type: string,
    data?: Record<string, any>
  ) => {
    if (!isEnabled) return;

    try {
      const event: AnalyticsEvent = {
        type,
        data,
        timestamp: Date.now()
      };

      if (debug) {
        console.log('[Analytics]', event);
      }

      // Get current buffer
      const result = await chrome.storage.local.get(ANALYTICS_KEY);
      const buffer: AnalyticsEvent[] = result[ANALYTICS_KEY] || [];

      // Add new event
      buffer.push(event);

      // Keep buffer size in check
      const eventsToStore = buffer.slice(-bufferSize);

      // Store updated buffer
      await chrome.storage.local.set({
        [ANALYTICS_KEY]: eventsToStore
      });

      // Update metrics
      await updateMetrics(type, data);

    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to log event');
      onError?.(err);
    }
  }, [isEnabled, debug, bufferSize, onError]);

  // Update cumulative metrics
  const updateMetrics = useCallback(async (
    eventType: string,
    data?: Record<string, any>
  ) => {
    const result = await chrome.storage.local.get('userMetrics');
    const metrics: UserMetrics = result.userMetrics || {
      spacesCreated: 0,
      spacesDeleted: 0,
      tabsMoved: 0,
      searchesPerformed: 0,
      sessionCount: 0,
      totalUsageTime: 0,
      lastUsed: Date.now()
    };

    switch (eventType) {
      case 'space_created':
        metrics.spacesCreated++;
        break;
      case 'space_deleted':
        metrics.spacesDeleted++;
        break;
      case 'tab_moved':
        metrics.tabsMoved++;
        break;
      case 'search_performed':
        metrics.searchesPerformed++;
        break;
      case 'session_start':
        metrics.sessionCount++;
        break;
      case 'session_end':
        if (data?.duration && typeof data.duration === 'number') {
          metrics.totalUsageTime += data.duration;
        }
        break;
    }

    metrics.lastUsed = Date.now();

    await chrome.storage.local.set({ userMetrics: metrics });
  }, []);

  // Flush events periodically
  useEffect(() => {
    if (!isEnabled) return;

    const flushEvents = async () => {
      try {
        const result = await chrome.storage.local.get(ANALYTICS_KEY);
        const events: AnalyticsEvent[] = result[ANALYTICS_KEY] || [];

        if (events.length === 0) return;

        if (debug) {
          console.log('[Analytics] Flushing events:', events);
        }

        // In a real implementation, you would send these events to your analytics service
        // For now, we just clear them
        await chrome.storage.local.remove(ANALYTICS_KEY);

      } catch (error) {
        const err = error instanceof Error ? error : new Error('Failed to flush events');
        onError?.(err);
      }
    };

    const intervalId = setInterval(flushEvents, flushInterval);
    return () => clearInterval(intervalId);
  }, [isEnabled, debug, flushInterval, onError]);

  // Get user metrics
  const getMetrics = useCallback(async (): Promise<UserMetrics> => {
    const result = await chrome.storage.local.get('userMetrics');
    return result.userMetrics || {
      spacesCreated: 0,
      spacesDeleted: 0,
      tabsMoved: 0,
      searchesPerformed: 0,
      sessionCount: 0,
      totalUsageTime: 0,
      lastUsed: Date.now()
    };
  }, []);

  return {
    logEvent,
    getMetrics,
    isEnabled
  };
}
