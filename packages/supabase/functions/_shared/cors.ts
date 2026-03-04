// CORS headers that allow both production and local development
// Note: For dynamic control, check req.headers.get('origin')
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Allow all origins in self-hosted setup
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'true',
}

// For production with domain restrictions, use dynamic origin checking:
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || ''
  const allowedOrigins = [
    'https://riquelme-talk.antislash.studio',
    'https://app.riquelme-talk.antislash.studio',
    'https://api.riquelme-talk.antislash.studio',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://localhost:54321',
    'capacitor://localhost',
    'http://localhost',
  ]

  const allowOrigin = allowedOrigins.includes(origin) ? origin : '*'

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': allowOrigin !== '*' ? 'true' : 'false',
  }
} 