#!/usr/bin/env node

// 🎙️ Antislash Talk - Local Deployment Script
// Deploy the entire stack locally with Docker

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

console.log('🎙️  Antislash Talk - Local Deployment\n');

// Check if .env.monorepo exists
const envFile = join(rootDir, '.env.monorepo');
if (!existsSync(envFile)) {
  console.error('❌ .env.monorepo not found!');
  console.log('   Run: pnpm setup first');
  process.exit(1);
}

// Check if Docker is running
try {
  execSync('docker info', { stdio: 'ignore' });
} catch {
  console.error('❌ Docker is not running!');
  console.log('   Please start Docker Desktop and try again');
  process.exit(1);
}

console.log('🐳 Starting Docker services...\n');

try {
  // Start all services
  execSync(
    'docker-compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d --build',
    { cwd: rootDir, stdio: 'inherit' }
  );

  console.log('\n⏳ Waiting for services to be healthy...\n');
  
  // Wait for services to be ready
  let attempts = 0;
  const maxAttempts = 30;
  
  while (attempts < maxAttempts) {
    try {
      execSync('docker-compose -f docker-compose.monorepo.yml ps --format json', {
        cwd: rootDir,
        stdio: 'pipe',
      });
      
      // Check if key services are healthy
      const healthCheck = execSync(
        'docker-compose -f docker-compose.monorepo.yml ps --filter "health=healthy" --format json',
        { cwd: rootDir, encoding: 'utf-8' }
      );
      
      if (healthCheck.includes('antislash-talk-db')) {
        console.log('✅ Database is healthy');
        break;
      }
    } catch {
      // Continue waiting
    }
    
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  if (attempts === maxAttempts) {
    console.warn('⚠️  Services may still be starting up...');
  }

  console.log('\n🎉 Deployment complete!\n');
  console.log('🌐 Access your services:');
  console.log('   ┌─────────────────────────────────────────┐');
  console.log('   │ 🌐 Web App:          http://localhost:3000    │');
  console.log('   │ 🎨 Supabase Studio:  http://localhost:54323   │');
  console.log('   │ 📧 Email Testing:    http://localhost:54324   │');
  console.log('   │ 🔧 API Gateway:      http://localhost:54321   │');
  console.log('   └─────────────────────────────────────────┘\n');
  console.log('📊 View logs: docker-compose -f docker-compose.monorepo.yml logs -f');
  console.log('🛑 Stop all:  docker-compose -f docker-compose.monorepo.yml down\n');

} catch (error) {
  console.error('\n❌ Deployment failed!');
  console.error(error.message);
  process.exit(1);
}

