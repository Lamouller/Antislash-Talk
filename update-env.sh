#!/bin/bash
# Extraire les nouvelles clés
JWT_SECRET=$(grep "JWT_SECRET=" new-jwt-keys.txt | cut -d'=' -f2)
ANON_KEY=$(grep "ANON_KEY=" new-jwt-keys.txt | cut -d'=' -f2)
SERVICE_ROLE_KEY=$(grep "SERVICE_ROLE_KEY=" new-jwt-keys.txt | cut -d'=' -f2)

# Mettre à jour .env.monorepo
cat > .env.monorepo << ENVFILE
# 🎙️ Antislash Talk Monorepo - Configuration générée automatiquement
# Date: $(date)

# Database
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password

# JWT Configuration - NOUVELLES CLÉS GÉNÉRÉES
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=3600

# API Keys - NOUVELLES CLÉS GÉNÉRÉES
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# URLs
SITE_URL=http://localhost:3000
API_EXTERNAL_URL=http://localhost:54321
SUPABASE_PUBLIC_URL=http://localhost:54321

# Service Ports
KONG_HTTP_PORT=54321
STUDIO_PORT=54323
WEB_PORT=3000

# Email Configuration
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true
SMTP_ADMIN_EMAIL=admin@antislash-talk.local
SMTP_HOST=inbucket
SMTP_PORT=2500
SMTP_SENDER_NAME=Antislash Talk
ENVFILE

echo "✅ Fichier .env.monorepo mis à jour avec les nouvelles clés"
echo ""
echo "🔑 JWT_SECRET: ${JWT_SECRET:0:30}..."
echo "🔑 ANON_KEY: ${ANON_KEY:0:50}..."
echo "🔑 SERVICE_ROLE_KEY: ${SERVICE_ROLE_KEY:0:50}..."
