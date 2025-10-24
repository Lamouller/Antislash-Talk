#!/usr/bin/env node

// Script pour générer les clés Supabase (ANON_KEY et SERVICE_ROLE_KEY)
// Ces clés doivent être signées avec le JWT_SECRET

const crypto = require('crypto');

// Fonction pour encoder en base64url
function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// Fonction pour créer un JWT
function createJWT(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Générer les clés
function generateKeys(jwtSecret) {
  const now = Math.floor(Date.now() / 1000);
  const oneYearFromNow = now + (365 * 24 * 60 * 60);
  
  // Payload pour ANON_KEY
  const anonPayload = {
    iss: 'supabase',
    role: 'anon',
    iat: now,
    exp: oneYearFromNow
  };
  
  // Payload pour SERVICE_ROLE_KEY
  const servicePayload = {
    iss: 'supabase',
    role: 'service_role',
    iat: now,
    exp: oneYearFromNow
  };
  
  const anonKey = createJWT(anonPayload, jwtSecret);
  const serviceRoleKey = createJWT(servicePayload, jwtSecret);
  
  return {
    ANON_KEY: anonKey,
    SERVICE_ROLE_KEY: serviceRoleKey
  };
}

// Si exécuté directement
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node generate-supabase-keys.js <JWT_SECRET>');
    console.log('');
    console.log('Génère les clés ANON_KEY et SERVICE_ROLE_KEY pour Supabase');
    console.log('basées sur le JWT_SECRET fourni.');
    process.exit(1);
  }
  
  const jwtSecret = args[0];
  
  if (jwtSecret.length < 32) {
    console.error('Erreur: JWT_SECRET doit faire au moins 32 caractères');
    process.exit(1);
  }
  
  const keys = generateKeys(jwtSecret);
  
  console.log('# Clés Supabase générées:');
  console.log(`ANON_KEY=${keys.ANON_KEY}`);
  console.log(`SERVICE_ROLE_KEY=${keys.SERVICE_ROLE_KEY}`);
}

module.exports = { generateKeys };
