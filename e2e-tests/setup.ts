import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

async function globalSetup() {
  console.log('Setting up e2e tests...');
  
  // Check if build directory exists
  const buildDir = path.join(__dirname, '..', 'build');
  if (!existsSync(buildDir)) {
    console.log('Build directory not found, building extension...');
    execSync('npm run dev', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
  }
  
  console.log('Extension is ready for testing');
}

export default globalSetup;