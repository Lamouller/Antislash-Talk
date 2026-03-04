// CORS restreint aux domaines autorisés
// Note: Pour un contrôle dynamique, utiliser une fonction qui vérifie req.headers.get('origin')
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://riquelme-talk.antislash.studio', // Ou utiliser une fonction dynamique
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

// Pour un contrôle dynamique par fonction, utiliser :
// const origin = req.headers.get('origin') || ''
// const allowedOrigins = [
//   'https://riquelme-talk.antislash.studio',
//   'https://app.riquelme-talk.antislash.studio',
//   'https://api.riquelme-talk.antislash.studio',
//   'http://localhost:5173',
//   'http://localhost:3000',
//   'capacitor://localhost',
//   'http://localhost',
// ]
// const corsOrigin = allowedOrigins.includes(origin) ? origin : '' 