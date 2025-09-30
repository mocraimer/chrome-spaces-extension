#!/usr/bin/env node
/**
 * Script to update all test files to use new headless mode
 * Finds launchPersistentContext calls and updates them to use --headless=new
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all test files
const testFiles = glob.sync('e2e-tests/**/*.test.ts', { cwd: __dirname + '/..' });

console.log(`Found ${testFiles.length} test files to update`);

let updatedCount = 0;
let alreadyCorrect = 0;

for (const file of testFiles) {
  const filePath = path.join(__dirname, '..', file);
  let content = fs.readFileSync(filePath, 'utf8');
  let updated = false;

  // Skip files that already use --headless=new
  if (content.includes('--headless=new')) {
    alreadyCorrect++;
    continue;
  }

  // Skip files that don't have launchPersistentContext
  if (!content.includes('launchPersistentContext')) {
    continue;
  }

  // Pattern 1: Replace headless: true with headless: false
  if (content.match(/launchPersistentContext\([^{]*{[^}]*headless:\s*true/s)) {
    content = content.replace(
      /(launchPersistentContext\([^{]*{\s*)headless:\s*true/g,
      '$1headless: false  // Must be false when using --headless=new'
    );
    updated = true;
  }

  // Pattern 2: Add --headless=new to args arrays that don't have it
  // Find all args arrays within launchPersistentContext
  const argsRegex = /launchPersistentContext\([^{]*{[^}]*args:\s*\[([\s\S]*?)\]/g;
  let match;

  while ((match = argsRegex.exec(content)) !== null) {
    const argsContent = match[1];

    // Check if this args array already has --headless=new
    if (!argsContent.includes('--headless=new') && !argsContent.includes('headless=new')) {
      // Find the position right after the opening bracket
      const argsStart = match.index + match[0].indexOf('[') + 1;

      // Insert --headless=new as first argument
      content =
        content.slice(0, argsStart) +
        "\n        '--headless=new',  // CRITICAL: Use new headless mode for extension support" +
        content.slice(argsStart);

      updated = true;
      break; // Only update one at a time, then re-process the file
    }
  }

  if (updated) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedCount++;
    console.log(`✅ Updated: ${file}`);
  }
}

console.log(`\n📊 Summary:`);
console.log(`  Updated: ${updatedCount} files`);
console.log(`  Already correct: ${alreadyCorrect} files`);
console.log(`  Total processed: ${testFiles.length} files`);