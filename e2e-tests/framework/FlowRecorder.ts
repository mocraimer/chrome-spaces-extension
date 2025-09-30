/**
 * Flow Recorder
 *
 * Records user interaction flows and can replay them.
 * Useful for debugging failed tests and understanding what happened.
 */

import { Page } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface RecordedAction {
  /** Timestamp when action occurred */
  timestamp: number;
  /** Type of action performed */
  type: 'click' | 'type' | 'keypress' | 'navigate' | 'wait' | 'assertion' | 'custom';
  /** Target selector or description */
  target: string;
  /** Value or data associated with action */
  value?: string | number;
  /** Duration of action in ms */
  duration?: number;
  /** Screenshot filename if captured */
  screenshot?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

export interface RecordedSession {
  /** Session ID */
  id: string;
  /** Test name */
  testName: string;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** List of recorded actions */
  actions: RecordedAction[];
  /** Session metadata */
  metadata?: Record<string, any>;
  /** Whether the session passed or failed */
  result?: 'passed' | 'failed' | 'skipped';
  /** Error message if failed */
  error?: string;
}

/**
 * Records and replays user interaction flows
 */
export class FlowRecorder {
  private currentSession: RecordedSession | null = null;
  private recording: boolean = false;
  private sessionStartTime: number = 0;

  constructor(
    private page: Page,
    private options: {
      /** Directory to save recordings (default: 'test-results/recordings') */
      outputDir?: string;
      /** Whether to capture screenshots for each action (default: false) */
      captureScreenshots?: boolean;
      /** Whether to save automatically on session end (default: true) */
      autoSave?: boolean;
    } = {}
  ) {
    this.options = {
      outputDir: 'test-results/recordings',
      captureScreenshots: false,
      autoSave: true,
      ...options
    };
  }

  /**
   * Start recording a new session
   */
  async startRecording(testName: string, metadata?: Record<string, any>): Promise<void> {
    this.sessionStartTime = Date.now();
    this.currentSession = {
      id: this.generateSessionId(),
      testName,
      startTime: this.sessionStartTime,
      actions: [],
      metadata
    };
    this.recording = true;

    console.log(`[FlowRecorder] Started recording: ${testName} (ID: ${this.currentSession.id})`);
  }

  /**
   * Stop recording and save the session
   */
  async stopRecording(result: 'passed' | 'failed' | 'skipped' = 'passed', error?: string): Promise<RecordedSession | null> {
    if (!this.recording || !this.currentSession) {
      console.warn('[FlowRecorder] No active recording to stop');
      return null;
    }

    this.currentSession.endTime = Date.now();
    this.currentSession.result = result;
    if (error) {
      this.currentSession.error = error;
    }

    this.recording = false;

    console.log(
      `[FlowRecorder] Stopped recording: ${this.currentSession.testName} - ${result} (${this.currentSession.actions.length} actions)`
    );

    if (this.options.autoSave) {
      await this.saveSession(this.currentSession);
    }

    const session = this.currentSession;
    this.currentSession = null;

    return session;
  }

  /**
   * Record a user action
   */
  async recordAction(
    type: RecordedAction['type'],
    target: string,
    value?: string | number,
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.recording || !this.currentSession) {
      return;
    }

    const timestamp = Date.now() - this.sessionStartTime;
    const action: RecordedAction = {
      timestamp,
      type,
      target,
      value,
      metadata
    };

    // Capture screenshot if enabled
    if (this.options.captureScreenshots) {
      try {
        const screenshotPath = await this.captureScreenshot(this.currentSession.id, this.currentSession.actions.length);
        action.screenshot = screenshotPath;
      } catch (error) {
        console.warn('[FlowRecorder] Failed to capture screenshot:', error);
      }
    }

    this.currentSession.actions.push(action);
  }

  /**
   * Record a click action
   */
  async recordClick(selector: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordAction('click', selector, undefined, metadata);
  }

  /**
   * Record typing action
   */
  async recordType(selector: string, text: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordAction('type', selector, text, metadata);
  }

  /**
   * Record key press
   */
  async recordKeyPress(key: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordAction('keypress', key, undefined, metadata);
  }

  /**
   * Record navigation
   */
  async recordNavigate(direction: string, steps: number = 1, metadata?: Record<string, any>): Promise<void> {
    await this.recordAction('navigate', direction, steps, metadata);
  }

  /**
   * Record wait/delay
   */
  async recordWait(duration: number, reason?: string): Promise<void> {
    await this.recordAction('wait', reason || 'delay', duration);
  }

  /**
   * Record assertion
   */
  async recordAssertion(assertionType: string, target: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordAction('assertion', target, assertionType, metadata);
  }

  /**
   * Record custom action
   */
  async recordCustomAction(description: string, metadata?: Record<string, any>): Promise<void> {
    await this.recordAction('custom', description, undefined, metadata);
  }

  /**
   * Save session to file
   */
  async saveSession(session: RecordedSession): Promise<string> {
    const outputDir = this.options.outputDir || 'test-results/recordings';
    await this.ensureDirectory(outputDir);

    const filename = `${session.id}-${this.sanitizeFilename(session.testName)}.json`;
    const filepath = path.join(outputDir, filename);

    await fs.writeFile(filepath, JSON.stringify(session, null, 2), 'utf-8');

    console.log(`[FlowRecorder] Saved recording to: ${filepath}`);
    return filepath;
  }

  /**
   * Load a recorded session from file
   */
  async loadSession(filepath: string): Promise<RecordedSession> {
    const content = await fs.readFile(filepath, 'utf-8');
    return JSON.parse(content) as RecordedSession;
  }

  /**
   * Generate a human-readable flow description from a session
   */
  generateFlowDescription(session: RecordedSession): string {
    const lines: string[] = [];
    lines.push(`Test: ${session.testName}`);
    lines.push(`Session ID: ${session.id}`);
    lines.push(`Duration: ${this.formatDuration((session.endTime || Date.now()) - session.startTime)}`);
    lines.push(`Result: ${session.result || 'unknown'}`);
    if (session.error) {
      lines.push(`Error: ${session.error}`);
    }
    lines.push('');
    lines.push('Actions:');
    lines.push('');

    for (let i = 0; i < session.actions.length; i++) {
      const action = session.actions[i];
      const timeStr = this.formatDuration(action.timestamp);
      const stepNum = String(i + 1).padStart(3, ' ');

      let description = '';
      switch (action.type) {
        case 'click':
          description = `Click on ${action.target}`;
          break;
        case 'type':
          description = `Type "${action.value}" in ${action.target}`;
          break;
        case 'keypress':
          description = `Press key: ${action.target}`;
          break;
        case 'navigate':
          description = `Navigate ${action.target} (${action.value} steps)`;
          break;
        case 'wait':
          description = `Wait ${action.value}ms (${action.target})`;
          break;
        case 'assertion':
          description = `Assert ${action.value}: ${action.target}`;
          break;
        case 'custom':
          description = action.target;
          break;
      }

      lines.push(`${stepNum}. [${timeStr}] ${description}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate a replay script (pseudocode) from a session
   */
  generateReplayScript(session: RecordedSession, format: 'typescript' | 'plain' = 'typescript'): string {
    if (format === 'plain') {
      return this.generateFlowDescription(session);
    }

    const lines: string[] = [];
    lines.push(`// Recorded test: ${session.testName}`);
    lines.push(`// Session ID: ${session.id}`);
    lines.push(`// Duration: ${this.formatDuration((session.endTime || Date.now()) - session.startTime)}`);
    lines.push('');
    lines.push(`test('${session.testName} (replayed)', async ({ page, context }) => {`);
    lines.push('  const flow = new InteractionFlowBuilder(page, context);');
    lines.push('  await flow.initialize();');
    lines.push('');

    for (const action of session.actions) {
      let code = '  ';
      switch (action.type) {
        case 'click':
          code += `await flow.clickElement('${action.target}');`;
          break;
        case 'type':
          code += `await flow.typeWithRealisticDelay('${action.value}');`;
          break;
        case 'keypress':
          if (action.target === 'Enter') {
            code += 'await flow.pressEnter();';
          } else if (action.target === 'Escape') {
            code += 'await flow.pressEscape();';
          } else if (action.target === 'F2') {
            code += 'await flow.pressF2();';
          } else {
            code += `await flow.getSimulator().pressKey('${action.target}');`;
          }
          break;
        case 'navigate':
          if (action.target === 'down') {
            code += `await flow.navigateDown(${action.value || 1});`;
          } else if (action.target === 'up') {
            code += `await flow.navigateUp(${action.value || 1});`;
          }
          break;
        case 'wait':
          code += `await flow.wait(${action.value});`;
          break;
        case 'assertion':
          code += `// Assertion: ${action.value} - ${action.target}`;
          break;
        case 'custom':
          code += `// ${action.target}`;
          break;
      }

      lines.push(code);
    }

    lines.push('});');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Get statistics from a session
   */
  getSessionStatistics(session: RecordedSession): {
    totalActions: number;
    actionsByType: Record<string, number>;
    duration: number;
    averageActionDuration: number;
  } {
    const actionsByType: Record<string, number> = {};

    for (const action of session.actions) {
      actionsByType[action.type] = (actionsByType[action.type] || 0) + 1;
    }

    const duration = (session.endTime || Date.now()) - session.startTime;
    const averageActionDuration = session.actions.length > 0 ? duration / session.actions.length : 0;

    return {
      totalActions: session.actions.length,
      actionsByType,
      duration,
      averageActionDuration
    };
  }

  /**
   * Export session as test code
   */
  async exportAsTestCode(session: RecordedSession, outputPath: string): Promise<void> {
    const code = this.generateReplayScript(session, 'typescript');
    await fs.writeFile(outputPath, code, 'utf-8');
    console.log(`[FlowRecorder] Exported test code to: ${outputPath}`);
  }

  /**
   * Capture screenshot
   */
  private async captureScreenshot(sessionId: string, actionIndex: number): Promise<string> {
    const screenshotDir = path.join(this.options.outputDir || 'test-results/recordings', 'screenshots', sessionId);
    await this.ensureDirectory(screenshotDir);

    const filename = `action-${String(actionIndex).padStart(3, '0')}.png`;
    const filepath = path.join(screenshotDir, filename);

    await this.page.screenshot({ path: filepath });

    return filepath;
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectory(dir: string): Promise<void> {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${timestamp}-${random}`;
  }

  /**
   * Sanitize filename
   */
  private sanitizeFilename(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      return `${minutes}m ${seconds}s`;
    }
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.recording;
  }

  /**
   * Get current session
   */
  getCurrentSession(): RecordedSession | null {
    return this.currentSession;
  }
}