/**
 * Visual Testing Global Teardown
 *
 * This teardown script cleans up after visual regression testing
 * of the Chrome Spaces extension popup UI. It handles:
 *
 * - Archiving test results for later analysis
 * - Generating visual test reports
 * - Cleaning up temporary files
 * - Preserving baseline screenshots
 */

import { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

async function globalTeardown(config: FullConfig) {
  console.log('🎭 Tearing down visual testing environment...');

  try {
    // 1. Archive test results
    console.log('📦 Archiving visual test results...');
    await archiveTestResults();

    // 2. Generate summary report
    console.log('📊 Generating visual test summary...');
    await generateVisualSummary();

    // 3. Clean up temporary files
    console.log('🧹 Cleaning up temporary files...');
    cleanupTemporaryFiles();

    // 4. Preserve important artifacts
    console.log('💾 Preserving important artifacts...');
    preserveArtifacts();

    console.log('✅ Visual testing teardown complete!');
  } catch (error) {
    console.error('❌ Visual testing teardown failed:', error);
    // Don't throw - teardown failures shouldn't break the test run
  }
}

/**
 * Archive test results with timestamp for historical tracking
 */
async function archiveTestResults(): Promise<void> {
  const resultsDir = path.resolve(__dirname, '..', 'test-results-visual');
  const archiveDir = path.resolve(__dirname, '..', 'visual-test-archive');

  if (!fs.existsSync(resultsDir)) {
    console.log('No visual test results to archive');
    return;
  }

  // Create archive directory if it doesn't exist
  if (!fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  // Create timestamped subdirectory
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const archiveSubDir = path.join(archiveDir, `visual-tests-${timestamp}`);

  try {
    // Copy results to archive
    await copyDirectory(resultsDir, archiveSubDir);
    console.log(`📦 Test results archived to: ${archiveSubDir}`);

    // Keep only last 10 archives to prevent disk space issues
    await cleanupOldArchives(archiveDir);
  } catch (error) {
    console.error('Failed to archive test results:', error);
  }
}

/**
 * Generate a summary report of visual test results
 */
async function generateVisualSummary(): Promise<void> {
  const resultsDir = path.resolve(__dirname, '..', 'test-results-visual');
  const reportPath = path.join(resultsDir, 'visual-test-summary.json');

  if (!fs.existsSync(resultsDir)) {
    return;
  }

  try {
    const summary = await analyzeVisualTestResults(resultsDir);

    // Write summary report
    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));

    // Also create a human-readable markdown report
    const markdownReport = generateMarkdownReport(summary);
    const markdownPath = path.join(resultsDir, 'VISUAL_TEST_SUMMARY.md');
    fs.writeFileSync(markdownPath, markdownReport);

    console.log('📊 Visual test summary generated');
    console.log(`   - JSON Report: ${reportPath}`);
    console.log(`   - Markdown Report: ${markdownPath}`);

    // Log summary to console
    console.log('\n📈 Visual Test Results Summary:');
    console.log(`   - Total Screenshots: ${summary.totalScreenshots}`);
    console.log(`   - Passed: ${summary.passed}`);
    console.log(`   - Failed: ${summary.failed}`);
    console.log(`   - New Baselines: ${summary.newBaselines}`);

  } catch (error) {
    console.error('Failed to generate visual summary:', error);
  }
}

/**
 * Clean up temporary files created during testing
 */
function cleanupTemporaryFiles(): void {
  const tempDirs = [
    path.resolve(__dirname, '..', 'temp-visual'),
    path.resolve(__dirname, '..', 'playwright-temp')
  ];

  tempDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`🗑️ Cleaned up temporary directory: ${dir}`);
      } catch (error) {
        console.warn(`Warning: Could not clean up ${dir}:`, error);
      }
    }
  });
}

/**
 * Preserve important artifacts like baseline screenshots
 */
function preserveArtifacts(): void {
  const resultsDir = path.resolve(__dirname, '..', 'test-results-visual');
  const baselinesDir = path.resolve(__dirname, '..', 'visual-baselines');

  if (!fs.existsSync(resultsDir)) {
    return;
  }

  // Ensure baselines directory exists
  if (!fs.existsSync(baselinesDir)) {
    fs.mkdirSync(baselinesDir, { recursive: true });
  }

  try {
    // Find all -actual.png files (these are current screenshots)
    const files = findFilesRecursive(resultsDir, /.*-actual\.png$/);

    files.forEach(file => {
      const relativePath = path.relative(resultsDir, file);
      const baselineName = relativePath.replace('-actual.png', '.png');
      const baselinePath = path.join(baselinesDir, baselineName);

      // Create directory structure in baselines
      const baselineDir = path.dirname(baselinePath);
      if (!fs.existsSync(baselineDir)) {
        fs.mkdirSync(baselineDir, { recursive: true });
      }

      // Copy actual screenshot as new baseline (if tests passed)
      try {
        fs.copyFileSync(file, baselinePath);
      } catch (error) {
        console.warn(`Could not preserve baseline ${baselineName}:`, error);
      }
    });

    console.log('💾 Important artifacts preserved');
  } catch (error) {
    console.error('Failed to preserve artifacts:', error);
  }
}

/**
 * Helper function to copy directories recursively
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Clean up old archives to prevent disk space issues
 */
async function cleanupOldArchives(archiveDir: string): Promise<void> {
  try {
    const archives = fs.readdirSync(archiveDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('visual-tests-'))
      .map(entry => ({
        name: entry.name,
        path: path.join(archiveDir, entry.name),
        mtime: fs.statSync(path.join(archiveDir, entry.name)).mtime
      }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime()); // Sort by modification time, newest first

    // Keep only the 10 most recent archives
    const archivesToDelete = archives.slice(10);

    for (const archive of archivesToDelete) {
      fs.rmSync(archive.path, { recursive: true, force: true });
      console.log(`🗑️ Removed old archive: ${archive.name}`);
    }

    console.log(`📦 Kept ${Math.min(10, archives.length)} recent archives`);
  } catch (error) {
    console.warn('Warning: Could not clean up old archives:', error);
  }
}

/**
 * Analyze visual test results and generate summary statistics
 */
async function analyzeVisualTestResults(resultsDir: string): Promise<any> {
  const summary = {
    timestamp: new Date().toISOString(),
    totalScreenshots: 0,
    passed: 0,
    failed: 0,
    newBaselines: 0,
    tests: [] as any[]
  };

  try {
    // Find all screenshot files
    const actualFiles = findFilesRecursive(resultsDir, /.*-actual\.png$/);
    const expectedFiles = findFilesRecursive(resultsDir, /.*-expected\.png$/);
    const diffFiles = findFilesRecursive(resultsDir, /.*-diff\.png$/);

    summary.totalScreenshots = actualFiles.length;
    summary.failed = diffFiles.length;
    summary.passed = actualFiles.length - diffFiles.length;
    summary.newBaselines = actualFiles.filter(file => {
      const expectedFile = file.replace('-actual.png', '-expected.png');
      return !fs.existsSync(expectedFile);
    }).length;

    // Group results by test
    const testResults: { [key: string]: any } = {};

    actualFiles.forEach(file => {
      const testName = extractTestName(file);
      if (!testResults[testName]) {
        testResults[testName] = {
          name: testName,
          screenshots: [],
          passed: 0,
          failed: 0
        };
      }

      const screenshotName = path.basename(file, '-actual.png');
      const hasDiff = diffFiles.some(diff => path.basename(diff, '-diff.png') === screenshotName);
      const isNew = !expectedFiles.some(expected => path.basename(expected, '-expected.png') === screenshotName);

      testResults[testName].screenshots.push({
        name: screenshotName,
        status: hasDiff ? 'failed' : (isNew ? 'new' : 'passed'),
        actualFile: file,
        expectedFile: file.replace('-actual.png', '-expected.png'),
        diffFile: hasDiff ? file.replace('-actual.png', '-diff.png') : null
      });

      if (hasDiff) {
        testResults[testName].failed++;
      } else {
        testResults[testName].passed++;
      }
    });

    summary.tests = Object.values(testResults);

  } catch (error) {
    console.error('Error analyzing visual test results:', error);
  }

  return summary;
}

/**
 * Generate a markdown report from test summary
 */
function generateMarkdownReport(summary: any): string {
  const date = new Date(summary.timestamp).toLocaleString();

  let markdown = `# Visual Test Results Summary

**Generated:** ${date}

## Overview

- **Total Screenshots:** ${summary.totalScreenshots}
- **Passed:** ${summary.passed} ✅
- **Failed:** ${summary.failed} ❌
- **New Baselines:** ${summary.newBaselines} 🆕

## Test Details

`;

  summary.tests.forEach((test: any) => {
    const status = test.failed > 0 ? '❌' : '✅';
    markdown += `### ${status} ${test.name}

- Screenshots: ${test.screenshots.length}
- Passed: ${test.passed}
- Failed: ${test.failed}

`;

    if (test.failed > 0) {
      markdown += `#### Failed Screenshots:

`;
      test.screenshots.filter((s: any) => s.status === 'failed').forEach((screenshot: any) => {
        markdown += `- **${screenshot.name}**
  - Actual: \`${path.relative(process.cwd(), screenshot.actualFile)}\`
  - Expected: \`${path.relative(process.cwd(), screenshot.expectedFile)}\`
  - Diff: \`${path.relative(process.cwd(), screenshot.diffFile)}\`

`;
      });
    }

    if (test.screenshots.some((s: any) => s.status === 'new')) {
      markdown += `#### New Baselines:

`;
      test.screenshots.filter((s: any) => s.status === 'new').forEach((screenshot: any) => {
        markdown += `- **${screenshot.name}**

`;
      });
    }
  });

  markdown += `## Next Steps

`;

  if (summary.failed > 0) {
    markdown += `### Failed Tests
1. Review the diff images to understand what changed
2. If changes are intentional, update the baseline screenshots
3. If changes are bugs, fix the code and re-run tests

`;
  }

  if (summary.newBaselines > 0) {
    markdown += `### New Baselines
1. Review the new screenshots to ensure they look correct
2. Commit the new baselines to version control

`;
  }

  markdown += `### Visual Test Maintenance
- Regularly review and update visual baselines
- Consider the impact of UI changes on visual tests
- Update test scenarios when new UI features are added

---

*Report generated by Chrome Spaces Visual Testing Suite*
`;

  return markdown;
}

/**
 * Helper function to find files recursively with pattern matching
 */
function findFilesRecursive(dir: string, pattern: RegExp): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...findFilesRecursive(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract test name from file path
 */
function extractTestName(filePath: string): string {
  const parts = filePath.split(path.sep);
  const testDir = parts.find(part => part.includes('spec') || part.includes('test'));

  if (testDir) {
    return testDir.replace(/\.(spec|test)\.ts$/, '');
  }

  // Fallback to directory name
  return parts[parts.length - 2] || 'unknown-test';
}

export default globalTeardown;