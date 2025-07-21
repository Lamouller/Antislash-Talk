#!/usr/bin/env node

/**
 * 🔑 Antislash Talk Enterprise License Key Generator
 * Usage: node scripts/generate-license-key.mjs [command] [options]
 */

import crypto from 'crypto';

// License configuration
const LICENSE_TYPES = {
  TRIAL: 'TR',          // 14-day trial, up to 5 users
  STARTER: 'ST',        // Up to 10 users
  PROFESSIONAL: 'PR',   // Up to 50 users  
  ENTERPRISE: 'EN',     // Unlimited users
  ACADEMIC: 'AC',       // Educational discount
};

const FEATURES = {
  TRIAL: { maxUsers: 5, expiryDays: 14, cloudAI: true, analytics: true },
  STARTER: { maxUsers: 10, cloudAI: true, analytics: true, support: 'standard' },
  PROFESSIONAL: { maxUsers: 50, cloudAI: true, analytics: true, support: 'priority', whiteLabel: true },
  ENTERPRISE: { maxUsers: -1, cloudAI: true, analytics: true, support: 'premium', whiteLabel: true, customIntegrations: true },
  ACADEMIC: { maxUsers: 25, cloudAI: true, analytics: true, support: 'standard' },
};

/**
 * Generate secure license key
 */
function generateLicenseKey(type = 'PROFESSIONAL', options = {}) {
  if (!LICENSE_TYPES[type]) {
    throw new Error(`Invalid license type: ${type}`);
  }

  const typeCode = LICENSE_TYPES[type];
  const randomPart = crypto.randomBytes(16).toString('hex').toUpperCase();
  const secretSalt = process.env.LICENSE_SECRET || 'antislash-talk-secret-2024';
  
  const baseKey = `AST-v1-${typeCode}-${randomPart}`;
  const checksum = crypto.createHash('sha256').update(baseKey + secretSalt).digest('hex').slice(0, 8).toUpperCase();
  
  const licenseKey = `${baseKey}-${checksum}`;
  const features = FEATURES[type];
  
  const expiryDate = features.expiryDays ? 
    new Date(Date.now() + features.expiryDays * 24 * 60 * 60 * 1000) : null;

  return {
    licenseKey,
    type,
    features,
    metadata: {
      generatedAt: new Date().toISOString(),
      expiryDate: expiryDate?.toISOString() || null,
      organizationId: options.organizationId || null,
      customerEmail: options.customerEmail || null,
      maxUsers: features.maxUsers === -1 ? 'Unlimited' : features.maxUsers,
    }
  };
}

/**
 * CLI Interface
 */
const args = process.argv.slice(2);
const command = args[0] || 'generate';

if (command === 'generate') {
  const type = args[1] || 'PROFESSIONAL';
  const orgFlag = args.find(arg => arg.startsWith('--org='));
  const emailFlag = args.find(arg => arg.startsWith('--email='));
  
  const organizationId = orgFlag ? orgFlag.split('=')[1] : null;
  const customerEmail = emailFlag ? emailFlag.split('=')[1] : null;

  try {
    const license = generateLicenseKey(type, { organizationId, customerEmail });
    
    console.log('\n🎉 Enterprise License Generated!\n');
    console.log('📋 License Details:');
    console.log(`   Type: ${license.type}`);
    console.log(`   Key: ${license.licenseKey}`);
    console.log(`   Max Users: ${license.metadata.maxUsers}`);
    console.log(`   Expiry: ${license.metadata.expiryDate || 'Never'}`);
    
    if (organizationId) console.log(`   Organization: ${organizationId}`);
    if (customerEmail) console.log(`   Customer: ${customerEmail}`);
    
    console.log('\n🚀 Activation Instructions:');
    console.log(`   1. Set: VITE_ENTERPRISE_LICENSE_KEY="${license.licenseKey}"`);
    console.log('   2. Or add to .env file');
    console.log('   3. Or enter in Settings → License');
    console.log('   4. Restart application\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
} else if (command === 'help') {
  console.log(`
🔑 Antislash Talk License Generator

Commands:
  generate [TYPE] [OPTIONS]  Generate new license key
  help                       Show this help

License Types:
  TRIAL          14-day trial, 5 users
  STARTER        10 users, standard support  
  PROFESSIONAL   50 users, priority support (default)
  ENTERPRISE     Unlimited users, premium support
  ACADEMIC       25 users, educational discount

Options:
  --org=NAME     Organization name
  --email=EMAIL  Customer email

Examples:
  node scripts/generate-license-key.mjs generate ENTERPRISE --org="Acme Corp"
  node scripts/generate-license-key.mjs generate TRIAL --email="test@example.com"
`);
} else {
  console.error('❌ Unknown command:', command);
  console.log('Run "node scripts/generate-license-key.mjs help" for usage');
}
