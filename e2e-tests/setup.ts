import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

async function globalSetup() {
  console.log('Setting up e2e tests...');

  // Check if build directory exists
  const buildDir = path.resolve(__dirname, '..', 'build');
  const projectRoot = path.resolve(__dirname, '..');

  if (!existsSync(buildDir)) {
    console.log('Build directory not found, building extension...');
    execSync('npm run dev', { stdio: 'inherit', cwd: projectRoot });
  }

  // Verify essential extension files exist
  const requiredFiles = [
    path.join(buildDir, 'manifest.json'),
    path.join(buildDir, 'background.js'),
    path.join(buildDir, 'popup.html'),
    path.join(buildDir, 'popup.js')
  ];

  for (const file of requiredFiles) {
    if (!existsSync(file)) {
      throw new Error(`Required extension file missing: ${file}`);
    }
  }

  console.log('✅ Extension build verification complete');
  console.log(`📁 Build directory: ${buildDir}`);
  console.log(`📄 Required files: ${requiredFiles.map(f => path.basename(f)).join(', ')}`);
}

export default globalSetup;