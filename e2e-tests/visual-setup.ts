/**
 * Visual Testing Global Setup
 *
 * This setup script prepares the environment for visual regression testing
 * of the Chrome Spaces extension popup UI. It ensures:
 *
 * - Extension is properly built and ready for testing
 * - Baseline screenshots directory exists
 * - Test environment is clean and consistent
 * - Required test data is prepared
 */

import { FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

async function globalSetup(config: FullConfig) {
  console.log('🎭 Setting up visual testing environment...');

  try {
    // 1. Ensure extension is built
    console.log('📦 Building extension for visual testing...');
    ensureExtensionBuilt();

    // 2. Setup test directories
    console.log('📁 Setting up test directories...');
    setupTestDirectories();

    // 3. Create baseline directory structure
    console.log('📸 Setting up screenshot directories...');
    setupScreenshotDirectories();

    // 4. Prepare test data
    console.log('🗃️ Preparing visual test data...');
    prepareTestData();

    // 5. Clean up any previous test artifacts
    console.log('🧹 Cleaning up previous test artifacts...');
    cleanupPreviousTests();

    console.log('✅ Visual testing environment setup complete!');
  } catch (error) {
    console.error('❌ Visual testing setup failed:', error);
    throw error;
  }
}

/**
 * Ensure the Chrome extension is built and ready for testing
 */
function ensureExtensionBuilt(): void {
  const buildDir = path.resolve(__dirname, '../build');
  const manifestPath = path.join(buildDir, 'manifest.json');

  // Check if build directory exists and has manifest
  if (!fs.existsSync(buildDir) || !fs.existsSync(manifestPath)) {
    console.log('🔨 Build directory not found, building extension...');

    try {
      // Build the extension
      execSync('npm run build', {
        cwd: path.resolve(__dirname, '..'),
        stdio: 'inherit'
      });
    } catch (buildError) {
      console.error('Failed to build extension:', buildError);
      throw new Error('Extension build failed. Visual tests cannot proceed without a built extension.');
    }
  }

  // Verify essential files exist
  const requiredFiles = [
    'manifest.json',
    'src/popup/index.html',
    'background.js'
  ];

  for (const file of requiredFiles) {
    const filePath = path.join(buildDir, file);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Required extension file missing: ${file}`);
    }
  }

  console.log('✅ Extension build verified');
}

/**
 * Setup test directories for visual testing
 */
function setupTestDirectories(): void {
  const testDirs = [
    'test-results-visual',
    'playwright-report-visual',
    'visual-baselines',
    'visual-diffs'
  ];

  testDirs.forEach(dir => {
    const dirPath = path.resolve(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }
  });
}

/**
 * Setup screenshot directory structure for organized visual testing
 */
function setupScreenshotDirectories(): void {
  const baseDir = path.resolve(__dirname, '..', 'test-results-visual');

  const screenshotStructure = [
    'chromium-visual/visual-ui-stability-spec-ts',
    'baselines',
    'current',
    'diffs'
  ];

  screenshotStructure.forEach(dir => {
    const dirPath = path.join(baseDir, dir);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });

  // Create .gitkeep files to ensure directories are tracked
  const gitkeepDirs = [
    path.join(baseDir, 'baselines'),
    path.join(baseDir, 'current'),
    path.join(baseDir, 'diffs')
  ];

  gitkeepDirs.forEach(dir => {
    const gitkeepPath = path.join(dir, '.gitkeep');
    if (!fs.existsSync(gitkeepPath)) {
      fs.writeFileSync(gitkeepPath, '# Visual testing directory\n');
    }
  });

  console.log('📸 Screenshot directories configured');
}

/**
 * Prepare test data for consistent visual testing
 */
function prepareTestData(): void {
  const testDataDir = path.resolve(__dirname, 'visual-test-data');

  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Create mock space configurations for testing
  const mockSpaceConfigs = {
    minimal: [
      {
        id: 'space-1',
        name: 'Example Space',
        customName: null,
        urls: ['https://example.com'],
        windowId: 1001,
        isActive: true
      }
    ],

    multiple: [
      {
        id: 'space-1',
        name: 'GitHub',
        customName: 'Development',
        urls: ['https://github.com', 'https://stackoverflow.com'],
        windowId: 1001,
        isActive: true
      },
      {
        id: 'space-2',
        name: 'Google',
        customName: null,
        urls: ['https://google.com'],
        windowId: 1002,
        isActive: true
      },
      {
        id: 'space-3',
        name: 'Closed Space',
        customName: 'Old Project',
        urls: ['https://example.com'],
        windowId: null,
        isActive: false,
        lastModified: Date.now() - 86400000 // 1 day ago
      }
    ],

    longNames: [
      {
        id: 'space-long',
        name: 'This is a very long space name that should test text overflow and ellipsis behavior in the popup UI',
        customName: null,
        urls: ['https://example.com'],
        windowId: 1001,
        isActive: true
      }
    ]
  };

  // Write test configurations
  fs.writeFileSync(
    path.join(testDataDir, 'mock-spaces.json'),
    JSON.stringify(mockSpaceConfigs, null, 2)
  );

  console.log('🗃️ Test data prepared');
}

/**
 * Clean up artifacts from previous test runs
 */
function cleanupPreviousTests(): void {
  const cleanupDirs = [
    'test-results-visual',
    'playwright-report-visual'
  ];

  cleanupDirs.forEach(dir => {
    const dirPath = path.resolve(__dirname, '..', dir);

    if (fs.existsSync(dirPath)) {
      // Remove old test results but keep directory structure
      const files = fs.readdirSync(dirPath, { withFileTypes: true });

      files.forEach(file => {
        if (file.isFile() && (file.name.endsWith('.png') || file.name.endsWith('.html'))) {
          fs.unlinkSync(path.join(dirPath, file.name));
        }
      });
    }
  });

  console.log('🧹 Previous test artifacts cleaned');
}

/**
 * Validate system requirements for visual testing
 */
function validateSystemRequirements(): void {
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion < 16) {
    throw new Error(`Node.js 16+ required for visual testing. Current version: ${nodeVersion}`);
  }

  // Check if required packages are available
  const requiredPackages = ['@playwright/test'];

  requiredPackages.forEach(pkg => {
    try {
      require.resolve(pkg);
    } catch (error) {
      throw new Error(`Required package not found: ${pkg}`);
    }
  });

  console.log('✅ System requirements validated');
}

export default globalSetup;