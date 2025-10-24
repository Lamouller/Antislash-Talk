#!/usr/bin/env node

// 🎙️ Antislash Talk - Setup Script
// One-click setup for the monorepo

import { execSync } from 'child_process';
import { existsSync, copyFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

console.log('🎙️  Antislash Talk - Monorepo Setup\n');

// Step 1: Check prerequisites
console.log('📋 Step 1/5: Checking prerequisites...');
try {
  execSync('node --version', { stdio: 'ignore' });
  console.log('   ✅ Node.js installed');
} catch {
  console.error('   ❌ Node.js not found. Please install Node.js 18+');
  process.exit(1);
}

try {
  execSync('pnpm --version', { stdio: 'ignore' });
  console.log('   ✅ pnpm installed');
} catch {
  console.log('   ⚠️  pnpm not found. Installing...');
  execSync('npm install -g pnpm', { stdio: 'inherit' });
  console.log('   ✅ pnpm installed');
}

try {
  execSync('docker --version', { stdio: 'ignore' });
  console.log('   ✅ Docker installed');
} catch {
  console.error('   ❌ Docker not found. Please install Docker Desktop');
  process.exit(1);
}

// Step 2: Copy environment file
console.log('\n🔧 Step 2/5: Setting up environment...');
const envFile = join(rootDir, '.env.monorepo');
const envExample = join(rootDir, '.env.monorepo.example');

if (!existsSync(envFile)) {
  copyFileSync(envExample, envFile);
  console.log('   ✅ Created .env.monorepo from example');
  console.log('   ⚠️  Please update .env.monorepo with your credentials');
} else {
  console.log('   ✅ .env.monorepo already exists');
}

// Step 3: Install dependencies
console.log('\n📦 Step 3/5: Installing dependencies...');
try {
  execSync('pnpm install', { cwd: rootDir, stdio: 'inherit' });
  console.log('   ✅ Dependencies installed');
} catch (error) {
  console.error('   ❌ Failed to install dependencies');
  process.exit(1);
}

// Step 4: Build packages
console.log('\n🏗️  Step 4/5: Building packages...');
try {
  // No need to build TypeScript-only packages in development
  console.log('   ✅ Packages ready for development');
} catch (error) {
  console.error('   ❌ Failed to build packages');
  process.exit(1);
}

// Step 5: Create quick start scripts
console.log('\n📝 Step 5/5: Creating quick start scripts...');

const startScript = `#!/bin/bash
# Start Antislash Talk locally

echo "🎙️  Starting Antislash Talk..."
echo ""
echo "Starting Docker services..."
docker-compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 10

echo ""
echo "✅ Antislash Talk is running!"
echo ""
echo "🌐 Web App:        http://localhost:3000"
echo "🎨 Supabase Studio: http://localhost:54323"
echo "📧 Inbucket (Email): http://localhost:54324"
echo "🔧 API Gateway:    http://localhost:54321"
echo ""
echo "To stop: pnpm docker:down"
`;

const stopScript = `#!/bin/bash
# Stop Antislash Talk

echo "🛑 Stopping Antislash Talk..."
docker-compose -f docker-compose.monorepo.yml down
echo "✅ Stopped"
`;

writeFileSync(join(rootDir, 'start-local.sh'), startScript, { mode: 0o755 });
writeFileSync(join(rootDir, 'stop-local.sh'), stopScript, { mode: 0o755 });
console.log('   ✅ Created start-local.sh and stop-local.sh');

// Done!
console.log('\n🎉 Setup complete!\n');
console.log('📚 Next steps:');
console.log('   1. Update .env.monorepo with your configuration');
console.log('   2. Run: ./start-local.sh (or pnpm deploy:local)');
console.log('   3. Visit: http://localhost:3000');
console.log('\n💡 For development:');
console.log('   - Web only: pnpm dev');
console.log('   - Full stack: pnpm deploy:local');
console.log('\n📖 Documentation: See README.md for more details\n');

