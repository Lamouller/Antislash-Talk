const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Générer un secret JWT fort (64 caractères)
const jwtSecret = crypto.randomBytes(32).toString('base64');

// Générer les clés JWT
const anonKey = jwt.sign(
  {
    iss: 'supabase',
    role: 'anon',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 ans
  },
  jwtSecret
);

const serviceRoleKey = jwt.sign(
  {
    iss: 'supabase',
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60) // 10 ans
  },
  jwtSecret
);

console.log('🔐 NOUVELLES CLÉS JWT GÉNÉRÉES\n');
console.log('JWT_SECRET=' + jwtSecret);
console.log('ANON_KEY=' + anonKey);
console.log('SERVICE_ROLE_KEY=' + serviceRoleKey);
