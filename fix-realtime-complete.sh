#!/bin/bash
# Script pour corriger complètement Realtime en régénérant tous les JWT

set -e

echo "🔧 Régénération complète des JWT pour Realtime..."
echo ""

# Générer un nouveau JWT_SECRET (hex pur)
JWT_SECRET=$(openssl rand -hex 32)
echo "✅ JWT_SECRET généré: $JWT_SECRET"

# Fonction pour créer un JWT HS256
function create_jwt() {
    local payload=$1
    local secret=$2
    
    # Header (base64url)
    header='{"alg":"HS256","typ":"JWT"}'
    header_b64=$(echo -n "$header" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
    
    # Payload (base64url)
    payload_b64=$(echo -n "$payload" | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
    
    # Signature
    signature=$(echo -n "${header_b64}.${payload_b64}" | openssl dgst -sha256 -hmac "$secret" -binary | openssl base64 -e -A | tr '+/' '-_' | tr -d '=')
    
    echo "${header_b64}.${payload_b64}.${signature}"
}

# Générer ANON_KEY
now=$(date +%s)
exp=$((now + 31536000)) # 1 an
anon_payload='{"iss":"supabase","role":"anon","iat":'$now',"exp":'$exp'}'
ANON_KEY=$(create_jwt "$anon_payload" "$JWT_SECRET")
echo "✅ ANON_KEY généré"

# Générer SERVICE_ROLE_KEY
service_payload='{"iss":"supabase","role":"service_role","iat":'$now',"exp":'$exp'}'
SERVICE_ROLE_KEY=$(create_jwt "$service_payload" "$JWT_SECRET")
echo "✅ SERVICE_ROLE_KEY généré"

# Mettre à jour .env.monorepo
echo ""
echo "📝 Mise à jour de .env.monorepo..."
sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env.monorepo
sed -i.bak "s|^ANON_KEY=.*|ANON_KEY=$ANON_KEY|" .env.monorepo
sed -i.bak "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|" .env.monorepo
rm -f .env.monorepo.bak
echo "✅ .env.monorepo mis à jour"

# Mettre à jour le tenant Realtime dans la DB
echo ""
echo "📊 Mise à jour du tenant Realtime dans la base de données..."
docker exec antislash-talk-db psql -U postgres -d postgres -c "UPDATE _realtime.tenants SET jwt_secret = '$JWT_SECRET' WHERE external_id = 'realtime';"
echo "✅ Tenant mis à jour"

# Mettre à jour apps/web/.env
echo ""
echo "🌐 Mise à jour de apps/web/.env..."
cat > apps/web/.env << EOF
# Supabase Configuration
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF
echo "✅ apps/web/.env mis à jour"

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          ✅ TOUS LES JWT RÉGÉNÉRÉS AVEC SUCCÈS                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🔄 Redémarrez maintenant les services:"
echo "   docker-compose -f docker-compose.monorepo.yml restart realtime auth rest kong"
echo "   docker-compose -f docker-compose.monorepo.yml up -d --force-recreate web"
echo ""


