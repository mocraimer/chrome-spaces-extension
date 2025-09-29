#!/usr/bin/env node

/**
 * Comprehensive Stability Test Runner for Chrome Spaces Extension
 *
 * This script runs all stability tests in the correct order and generates
 * a comprehensive report of the extension's stability and performance.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Test suites in order of execution priority
const TEST_SUITES = [
  {
    name: 'Comprehensive Stability Tests',
    file: 'comprehensive-stability.test.ts',
    description: 'Core stability tests for window restoration, space renaming, and load handling',
    priority: 1,
    timeout: 600000 // 10 minutes
  },
  {
    name: 'Space Name Persistence Tests',
    file: 'space-name-persistence.test.ts',
    description: 'Enhanced space naming persistence across browser restarts and edge cases',
    priority: 2,
    timeout: 480000 // 8 minutes
  },
  {
    name: 'Space Restoration Tests (New API)',
    file: 'spaceRestoration.test.ts',
    description: 'Window restoration with new Chrome API patterns',
    priority: 3,
    timeout: 420000 // 7 minutes
  },
  {
    name: 'Session Restore & Crash Recovery',
    file: 'session-restore.test.ts',
    description: 'Browser crash simulation and session recovery tests',
    priority: 4,
    timeout: 540000 // 9 minutes
  },
  {
    name: 'Performance Benchmarks',
    file: 'performance-benchmarks.test.ts',
    description: 'Performance baselines and regression detection',
    priority: 5,
    timeout: 720000 // 12 minutes
  },
  {
    name: 'Error Recovery & Edge Cases',
    file: 'error-recovery-edge-cases.test.ts',
    description: 'Error handling and edge case robustness tests',
    priority: 6,
    timeout: 600000 // 10 minutes
  }
];

// Test execution configuration
const CONFIG = {
  workers: process.env.CI ? 1 : 2,
  retries: process.env.CI ? 2 : 1,
  timeout: 60000,
  reporter: 'list',
  outputDir: 'test-results',
  video: 'retain-on-failure',
  screenshot: 'only-on-failure'
};

class StabilityTestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
    this.outputDir = path.join(__dirname, 'stability-test-results');
    this.ensureOutputDir();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async runAllTests() {
    console.log('🚀 Starting Chrome Spaces Extension Stability Test Suite\n');
    console.log('📋 Test Suites to Execute:');
    TEST_SUITES.forEach(suite => {
      console.log(`  ${suite.priority}. ${suite.name} - ${suite.description}`);
    });
    console.log('');

    // Ensure extension is built
    await this.ensureExtensionBuild();

    // Run each test suite
    for (const suite of TEST_SUITES) {
      const result = await this.runTestSuite(suite);
      this.results.push(result);

      // Break on critical failures
      if (!result.success && suite.priority <= 3) {
        console.log(`❌ Critical test suite failed: ${suite.name}`);
        console.log('🛑 Stopping execution due to critical failure\n');
        break;
      }
    }

    // Generate final report
    await this.generateReport();
  }

  async ensureExtensionBuild() {
    console.log('🔨 Ensuring extension is built...');

    const buildDir = path.join(__dirname, '..', 'build');
    const requiredFiles = [
      'manifest.json',
      'background.js',
      'popup.html',
      'popup.js'
    ];

    let needsBuild = false;

    if (!fs.existsSync(buildDir)) {
      needsBuild = true;
    } else {
      for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(buildDir, file))) {
          needsBuild = true;
          break;
        }
      }
    }

    if (needsBuild) {
      console.log('📦 Building extension...');
      await this.runCommand('npm', ['run', 'dev'], { cwd: path.join(__dirname, '..') });
      console.log('✅ Extension built successfully\n');
    } else {
      console.log('✅ Extension build found\n');
    }
  }

  async runTestSuite(suite) {
    console.log(`\n🧪 Running: ${suite.name}`);
    console.log(`📄 File: ${suite.file}`);
    console.log(`⏱️  Timeout: ${suite.timeout / 1000}s`);
    console.log('─'.repeat(80));

    const startTime = Date.now();

    try {
      const args = [
        'test',
        suite.file,
        '--config=playwright.config.ts',
        `--timeout=${suite.timeout}`,
        `--workers=${CONFIG.workers}`,
        `--retries=${CONFIG.retries}`,
        `--reporter=${CONFIG.reporter}`,
        `--output-dir=${this.outputDir}/${suite.name.replace(/\s+/g, '-').toLowerCase()}`,
        '--video=retain-on-failure',
        '--screenshot=only-on-failure'
      ];

      if (process.env.CI) {
        args.push('--forbid-only');
      }

      await this.runCommand('npx', ['playwright', ...args], {
        cwd: __dirname,
        timeout: suite.timeout + 30000 // Add buffer for Playwright overhead
      });

      const duration = Date.now() - startTime;
      console.log(`✅ ${suite.name} completed successfully in ${this.formatDuration(duration)}`);

      return {
        suite: suite.name,
        file: suite.file,
        success: true,
        duration,
        error: null
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.log(`❌ ${suite.name} failed after ${this.formatDuration(duration)}`);
      console.log(`Error: ${error.message}`);

      return {
        suite: suite.name,
        file: suite.file,
        success: false,
        duration,
        error: error.message
      };
    }
  }

  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        stdio: 'inherit',
        ...options
      });

      const timeout = options.timeout;
      let timeoutId;

      if (timeout) {
        timeoutId = setTimeout(() => {
          process.kill('SIGKILL');
          reject(new Error(`Command timed out after ${timeout}ms`));
        }, timeout);
      }

      process.on('close', (code) => {
        if (timeoutId) clearTimeout(timeoutId);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Command failed with exit code ${code}`));
        }
      });

      process.on('error', (error) => {
        if (timeoutId) clearTimeout(timeoutId);
        reject(error);
      });
    });
  }

  async generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const successCount = this.results.filter(r => r.success).length;
    const failureCount = this.results.filter(r => !r.success).length;

    console.log('\n' + '='.repeat(80));
    console.log('📊 CHROME SPACES EXTENSION STABILITY TEST REPORT');
    console.log('='.repeat(80));

    console.log(`\n📈 Summary:`);
    console.log(`  • Total Test Suites: ${this.results.length}`);
    console.log(`  • Successful: ${successCount}`);
    console.log(`  • Failed: ${failureCount}`);
    console.log(`  • Success Rate: ${((successCount / this.results.length) * 100).toFixed(1)}%`);
    console.log(`  • Total Duration: ${this.formatDuration(totalDuration)}`);

    console.log(`\n📋 Test Suite Results:`);
    this.results.forEach((result, index) => {
      const status = result.success ? '✅' : '❌';
      const duration = this.formatDuration(result.duration);
      console.log(`  ${index + 1}. ${status} ${result.suite} (${duration})`);
      if (!result.success) {
        console.log(`     Error: ${result.error}`);
      }
    });

    // Generate performance summary
    await this.generatePerformanceSummary();

    // Generate JSON report
    const jsonReport = {
      timestamp: new Date().toISOString(),
      summary: {
        totalSuites: this.results.length,
        successful: successCount,
        failed: failureCount,
        successRate: (successCount / this.results.length) * 100,
        totalDuration: totalDuration
      },
      results: this.results,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        ci: !!process.env.CI
      }
    };

    const reportPath = path.join(this.outputDir, 'stability-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2));

    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

    // Overall assessment
    console.log(`\n🎯 Stability Assessment:`);
    if (successCount === this.results.length) {
      console.log(`  🌟 EXCELLENT: All stability tests passed!`);
      console.log(`  🚀 The extension demonstrates robust stability across all scenarios.`);
    } else if (successRate >= 80) {
      console.log(`  ✅ GOOD: Most stability tests passed (${successRate.toFixed(1)}%).`);
      console.log(`  🔧 Review failed tests for potential improvements.`);
    } else if (successRate >= 60) {
      console.log(`  ⚠️  MODERATE: Some stability issues detected (${successRate.toFixed(1)}% success).`);
      console.log(`  🛠️  Significant improvements needed for production readiness.`);
    } else {
      console.log(`  ❌ POOR: Major stability issues detected (${successRate.toFixed(1)}% success).`);
      console.log(`  🚨 Critical stability fixes required before release.`);
    }

    console.log(`\n📁 Test artifacts saved in: ${this.outputDir}`);
    console.log('='.repeat(80));

    // Exit with appropriate code
    process.exit(failureCount > 0 ? 1 : 0);
  }

  async generatePerformanceSummary() {
    const performanceResult = this.results.find(r => r.file === 'performance-benchmarks.test.ts');

    if (performanceResult && performanceResult.success) {
      console.log(`\n⚡ Performance Summary:`);
      console.log(`  • Performance tests completed successfully`);
      console.log(`  • Benchmarks established for regression detection`);
      console.log(`  • See performance-benchmarks test output for detailed metrics`);
    } else if (performanceResult) {
      console.log(`\n⚡ Performance Summary:`);
      console.log(`  • Performance tests failed - review output for bottlenecks`);
    }
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      return `${remainingSeconds}s`;
    }
  }
}

// Run the stability tests
if (require.main === module) {
  const runner = new StabilityTestRunner();
  runner.runAllTests().catch(error => {
    console.error('Fatal error running stability tests:', error);
    process.exit(1);
  });
}

module.exports = StabilityTestRunner;