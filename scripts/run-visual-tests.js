#!/usr/bin/env node

/**
 * Visual Testing Test Runner
 *
 * This script orchestrates the execution of visual regression tests for the
 * Chrome Spaces extension popup UI. It provides:
 *
 * - Pre-test environment validation
 * - Extension building if needed
 * - Test execution with proper configuration
 * - Post-test result analysis and reporting
 * - Baseline management utilities
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configuration
const CONFIG = {
  buildDir: path.resolve(__dirname, '../build'),
  testResultsDir: path.resolve(__dirname, '../test-results-visual'),
  visualBaselinesDir: path.resolve(__dirname, '../visual-baselines'),
  playwrightConfigPath: path.resolve(__dirname, '../playwright.visual.config.ts'),
  maxRetries: 3,
  timeout: 90000
};

// Colors for console output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  reset: '\x1b[0m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`  ${title}`, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
  console.log('');
}

/**
 * Parse command line arguments
 */
function parseArguments() {
  const args = process.argv.slice(2);
  const options = {
    updateBaselines: false,
    specificTest: null,
    debug: false,
    headless: true,
    workers: 1,
    retries: 1
  };

  args.forEach((arg, index) => {
    switch (arg) {
      case '--update-baselines':
      case '-u':
        options.updateBaselines = true;
        break;
      case '--test':
      case '-t':
        options.specificTest = args[index + 1];
        break;
      case '--debug':
      case '-d':
        options.debug = true;
        options.headless = false;
        break;
      case '--headed':
        options.headless = false;
        break;
      case '--workers':
      case '-w':
        options.workers = parseInt(args[index + 1]) || 1;
        break;
      case '--retries':
      case '-r':
        options.retries = parseInt(args[index + 1]) || 1;
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  });

  return options;
}

/**
 * Show help information
 */
function showHelp() {
  log('Visual Testing Suite for Chrome Spaces Extension', 'cyan');
  console.log('');
  log('Usage: npm run test:visual [options]', 'white');
  console.log('');
  log('Options:', 'yellow');
  log('  --update-baselines, -u    Update baseline screenshots', 'white');
  log('  --test <name>, -t         Run specific test file', 'white');
  log('  --debug, -d               Run in debug mode (headed browser)', 'white');
  log('  --headed                  Run with browser UI visible', 'white');
  log('  --workers <num>, -w       Number of parallel workers', 'white');
  log('  --retries <num>, -r       Number of retries for failed tests', 'white');
  log('  --help, -h                Show this help message', 'white');
  console.log('');
  log('Examples:', 'yellow');
  log('  npm run test:visual                    # Run all visual tests', 'white');
  log('  npm run test:visual -- --debug        # Run in debug mode', 'white');
  log('  npm run test:visual -- -u             # Update baselines', 'white');
  log('  npm run test:visual -- -t space-states # Run specific test', 'white');
}

/**
 * Validate environment and prerequisites
 */
async function validateEnvironment() {
  logSection('Environment Validation');

  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 16) {
    log(`❌ Node.js 16+ required. Current: ${nodeVersion}`, 'red');
    process.exit(1);
  }
  log(`✅ Node.js version: ${nodeVersion}`, 'green');

  // Check if extension is built
  if (!fs.existsSync(CONFIG.buildDir)) {
    log('⚠️  Extension build directory not found', 'yellow');
    await buildExtension();
  } else {
    log('✅ Extension build directory exists', 'green');
  }

  // Validate essential files
  const requiredFiles = [
    path.join(CONFIG.buildDir, 'manifest.json'),
    path.join(CONFIG.buildDir, 'src/popup/index.html'),
    CONFIG.playwrightConfigPath
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file)) {
      log(`❌ Required file missing: ${file}`, 'red');
      process.exit(1);
    }
  }
  log('✅ All required files present', 'green');

  // Check Playwright installation
  try {
    execSync('npx playwright --version', { stdio: 'pipe' });
    log('✅ Playwright is installed', 'green');
  } catch (error) {
    log('❌ Playwright not found. Run: npm install', 'red');
    process.exit(1);
  }

  // Check browser installation
  try {
    execSync('npx playwright install chromium', { stdio: 'pipe' });
    log('✅ Chromium browser ready', 'green');
  } catch (error) {
    log('⚠️  Installing Chromium browser...', 'yellow');
    execSync('npx playwright install chromium', { stdio: 'inherit' });
  }
}

/**
 * Build extension if needed
 */
async function buildExtension() {
  logSection('Building Extension');

  try {
    log('🔨 Building Chrome Spaces extension...', 'yellow');
    execSync('npm run build', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    log('✅ Extension built successfully', 'green');
  } catch (error) {
    log('❌ Extension build failed', 'red');
    console.error(error.toString());
    process.exit(1);
  }
}

/**
 * Setup test environment
 */
async function setupTestEnvironment(options) {
  logSection('Test Environment Setup');

  // Create necessary directories
  const directories = [
    CONFIG.testResultsDir,
    CONFIG.visualBaselinesDir,
    path.resolve(__dirname, '../playwright-report-visual')
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      log(`📁 Created directory: ${path.relative(process.cwd(), dir)}`, 'green');
    }
  });

  // Clean previous results if not updating baselines
  if (!options.updateBaselines) {
    log('🧹 Cleaning previous test results...', 'yellow');
    const resultsFiles = fs.readdirSync(CONFIG.testResultsDir, { withFileTypes: true });
    resultsFiles.forEach(file => {
      if (file.isFile() && file.name.endsWith('.png')) {
        fs.unlinkSync(path.join(CONFIG.testResultsDir, file.name));
      }
    });
  }

  log('✅ Test environment ready', 'green');
}

/**
 * Execute visual tests with Playwright
 */
async function runVisualTests(options) {
  logSection('Running Visual Tests');

  const playwrightArgs = [
    'test',
    `--config=${CONFIG.playwrightConfigPath}`,
    `--workers=${options.workers}`,
    `--retries=${options.retries}`
  ];

  // Add specific test if provided
  if (options.specificTest) {
    playwrightArgs.push(`--grep=${options.specificTest}`);
  }

  // Add headed mode if requested
  if (!options.headless) {
    playwrightArgs.push('--headed');
  }

  // Add debug mode
  if (options.debug) {
    playwrightArgs.push('--debug');
    playwrightArgs.push('--timeout=0'); // No timeout in debug mode
  }

  // Add update snapshots flag
  if (options.updateBaselines) {
    playwrightArgs.push('--update-snapshots');
  }

  log(`🎭 Running: npx playwright ${playwrightArgs.join(' ')}`, 'blue');

  return new Promise((resolve, reject) => {
    const testProcess = spawn('npx', ['playwright', ...playwrightArgs], {
      stdio: 'inherit',
      cwd: path.resolve(__dirname, '..')
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ Visual tests completed successfully', 'green');
        resolve(code);
      } else {
        log(`❌ Visual tests failed with exit code: ${code}`, 'red');
        resolve(code); // Don't reject, we'll handle results analysis
      }
    });

    testProcess.on('error', (error) => {
      log(`❌ Test process error: ${error.message}`, 'red');
      reject(error);
    });
  });
}

/**
 * Analyze test results and generate report
 */
async function analyzeResults() {
  logSection('Test Results Analysis');

  try {
    // Look for test results
    const reportPath = path.join(__dirname, '../playwright-report-visual');
    const resultsPath = CONFIG.testResultsDir;

    if (fs.existsSync(reportPath)) {
      log(`📊 HTML report available at: ${reportPath}/index.html`, 'green');
    }

    // Count screenshots
    if (fs.existsSync(resultsPath)) {
      const files = fs.readdirSync(resultsPath);
      const screenshots = files.filter(f => f.endsWith('.png'));
      const actualFiles = screenshots.filter(f => f.includes('-actual'));
      const diffFiles = screenshots.filter(f => f.includes('-diff'));

      log(`📸 Screenshots captured: ${actualFiles.length}`, 'blue');

      if (diffFiles.length > 0) {
        log(`⚠️  Visual differences found: ${diffFiles.length}`, 'yellow');
        log('   Review diff images in test results directory', 'yellow');
      } else if (actualFiles.length > 0) {
        log('✅ All visual tests passed - no differences detected', 'green');
      }
    }

    // Check for summary file
    const summaryPath = path.join(resultsPath, 'VISUAL_TEST_SUMMARY.md');
    if (fs.existsSync(summaryPath)) {
      log(`📋 Test summary: ${summaryPath}`, 'green');
    }

  } catch (error) {
    log(`⚠️  Could not analyze results: ${error.message}`, 'yellow');
  }
}

/**
 * Main execution function
 */
async function main() {
  const startTime = Date.now();

  try {
    // Parse arguments
    const options = parseArguments();

    log('🎭 Chrome Spaces Visual Testing Suite', 'magenta');
    log(`Platform: ${os.platform()} ${os.arch()}`, 'blue');
    log(`Node: ${process.version}`, 'blue');
    console.log('');

    if (options.debug) {
      log('🐛 Debug mode enabled', 'yellow');
    }

    if (options.updateBaselines) {
      log('📸 Baseline update mode enabled', 'yellow');
    }

    // Execute test pipeline
    await validateEnvironment();
    await setupTestEnvironment(options);
    const exitCode = await runVisualTests(options);
    await analyzeResults();

    // Summary
    logSection('Test Summary');
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log(`⏱️  Total execution time: ${duration} seconds`, 'blue');

    if (exitCode === 0) {
      log('🎉 Visual testing completed successfully!', 'green');
      process.exit(0);
    } else {
      log('⚠️  Some visual tests failed. Check results above.', 'yellow');
      process.exit(exitCode);
    }

  } catch (error) {
    logSection('Error');
    log(`❌ Visual testing failed: ${error.message}`, 'red');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`💥 Uncaught exception: ${error.message}`, 'red');
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  log(`💥 Unhandled rejection: ${error}`, 'red');
  process.exit(1);
});

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { main, parseArguments, validateEnvironment, runVisualTests };