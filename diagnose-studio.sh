#!/bin/bash

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }

cd ~/antislash-talk || cd /root/antislash-talk || exit 1

print_header "1️⃣  Variables d'environnement de Studio"

echo "Variables dans .env.monorepo:"
grep -E "^SUPABASE_PUBLIC_URL=|^STUDIO_PG_META_URL=|^STUDIO_PASSWORD=" .env.monorepo

echo ""
echo "Variables dans le container studio:"
docker exec antislash-talk-studio env | grep -E "SUPABASE_PUBLIC_URL|STUDIO_PG_META_URL" || echo "Aucune variable trouvée"

print_header "2️⃣  Vérification de .htpasswd"

if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success ".htpasswd existe dans studio-proxy"
    echo "Contenu:"
    docker exec antislash-talk-studio-proxy cat /etc/nginx/.htpasswd
else
    print_error ".htpasswd n'existe PAS dans studio-proxy"
fi

print_header "3️⃣  Logs de Studio (dernières 50 lignes)"

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo logs --tail=50 studio

print_header "4️⃣  Vérification de pgcrypto"

echo "Extensions disponibles dans la DB:"
docker exec -i antislash-talk-db psql -U postgres -d postgres -c "SELECT extname, extversion FROM pg_extension WHERE extname = 'pgcrypto';"

echo ""
echo "Fonctions gen_salt disponibles:"
docker exec -i antislash-talk-db psql -U postgres -d postgres -c "SELECT n.nspname, p.proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE p.proname = 'gen_salt';"

print_header "5️⃣  Test de création d'un user dans la DB directement"

print_info "Test d'insertion directe dans auth.users..."
docker exec -i antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Tenter de créer un user de test
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_super_admin,
    confirmation_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'test-diagnostic@example.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    ''
) ON CONFLICT (email) DO NOTHING;

-- Vérifier si ça a marché
SELECT email, created_at FROM auth.users WHERE email = 'test-diagnostic@example.com';
SQL

print_header "6️⃣  Test d'accès à Studio"

DOMAIN=$(grep "^VITE_SUPABASE_URL=" .env.monorepo | cut -d'=' -f2 | sed 's|https://||' | sed 's|:8443||')

print_info "Test d'accès à Studio sur https://${DOMAIN}:8444/"
curl -k -s -o /dev/null -w "HTTP Status: %{http_code}\n" https://${DOMAIN}:8444/

print_header "7️⃣  Configuration Nginx de studio-proxy"

echo "Config Nginx dans studio-proxy:"
docker exec antislash-talk-studio-proxy cat /etc/nginx/conf.d/default.conf 2>/dev/null || docker exec antislash-talk-studio-proxy cat /etc/nginx/nginx.conf 2>/dev/null | head -50

print_header "✅ Diagnostic terminé"

echo ""
print_info "Problèmes courants:"
echo "  - Si .htpasswd manque → Studio inaccessible"
echo "  - Si SUPABASE_PUBLIC_URL est incorrect → Erreurs 400/403"
echo "  - Si pgcrypto manque → Erreur 'gen_salt does not exist'"
echo "  - Si le test d'insertion a échoué → Problème de DB"

