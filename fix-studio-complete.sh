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
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

cd ~/antislash-talk || cd /root/antislash-talk || exit 1

print_header "🔧 FIX COMPLET SUPABASE STUDIO"

# Charger les variables
if [ -f .env.monorepo ]; then
    set -a
    source .env.monorepo
    set +a
    print_success "Variables chargées"
else
    print_error "Fichier .env.monorepo introuvable"
    exit 1
fi

print_header "1️⃣  Correction du SUPABASE_PUBLIC_URL"

DOMAIN=$(echo "$VITE_SUPABASE_URL" | sed 's|https://||' | sed 's|:8443||')
CORRECT_PUBLIC_URL="https://${DOMAIN}:8443"

print_info "Domaine: $DOMAIN"
print_info "URL correcte: $CORRECT_PUBLIC_URL"

if grep -q "^SUPABASE_PUBLIC_URL=" .env.monorepo; then
    CURRENT_URL=$(grep "^SUPABASE_PUBLIC_URL=" .env.monorepo | cut -d'=' -f2)
    if [ "$CURRENT_URL" != "$CORRECT_PUBLIC_URL" ]; then
        print_warning "SUPABASE_PUBLIC_URL incorrect: $CURRENT_URL"
        sed -i "s|SUPABASE_PUBLIC_URL=.*|SUPABASE_PUBLIC_URL=${CORRECT_PUBLIC_URL}|g" .env.monorepo
        print_success "SUPABASE_PUBLIC_URL corrigé"
    else
        print_success "SUPABASE_PUBLIC_URL déjà correct"
    fi
else
    echo "SUPABASE_PUBLIC_URL=${CORRECT_PUBLIC_URL}" >> .env.monorepo
    print_success "SUPABASE_PUBLIC_URL ajouté"
fi

print_header "2️⃣  Activation de pgcrypto dans PostgreSQL"

print_info "Vérification de l'état de la DB..."

# Attendre que la DB soit prête
until docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT 1" > /dev/null 2>&1; do
    print_info "Attente de la DB..."
    sleep 1
done

print_success "DB accessible"

print_info "Installation de pgcrypto..."

# Créer pgcrypto dans plusieurs schemas pour être sûr
docker exec -i antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Créer dans le schema public
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Créer dans le schema extensions
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

-- Ajouter extensions au search_path
ALTER DATABASE postgres SET search_path TO public, extensions;

-- Vérifier
SELECT extname, extversion, nspname 
FROM pg_extension e 
JOIN pg_namespace n ON e.extnamespace = n.oid 
WHERE extname = 'pgcrypto';
SQL

print_success "pgcrypto installé"

print_header "3️⃣  Création du .htpasswd pour Studio"

if [ -z "$STUDIO_PASSWORD" ]; then
    print_warning "STUDIO_PASSWORD non défini, utilisation de 'admin123'"
    STUDIO_PASSWORD="admin123"
fi

print_info "Création de .htpasswd avec user: admin"

# Créer .htpasswd localement
HTPASSWD_LINE=$(docker run --rm httpd:alpine htpasswd -nb admin "$STUDIO_PASSWORD")

# L'injecter dans le container studio-proxy
docker exec antislash-talk-studio-proxy sh -c "echo '$HTPASSWD_LINE' > /etc/nginx/.htpasswd"

# Vérifier
if docker exec antislash-talk-studio-proxy test -f /etc/nginx/.htpasswd; then
    print_success ".htpasswd créé avec succès"
    docker exec antislash-talk-studio-proxy cat /etc/nginx/.htpasswd
else
    print_error "Échec de la création de .htpasswd"
fi

print_header "4️⃣  Vérification de la config Nginx de studio-proxy"

print_info "Configuration actuelle de studio-proxy..."

# Vérifier s'il y a une config qui référence .htpasswd
if docker exec antislash-talk-studio-proxy grep -r "auth_basic" /etc/nginx/ 2>/dev/null; then
    print_success "auth_basic trouvé dans la config"
else
    print_warning "Pas de auth_basic dans la config Nginx"
    print_info "Ajout de la protection par mot de passe..."
    
    # Créer une nouvelle config avec auth_basic
    docker exec antislash-talk-studio-proxy sh -c 'cat > /etc/nginx/conf.d/default.conf << "EOF"
server {
    listen 80;
    server_name _;

    # Protection par mot de passe
    auth_basic "Supabase Studio";
    auth_basic_user_file /etc/nginx/.htpasswd;

    location / {
        proxy_pass http://studio:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF'
    
    # Recharger nginx dans le container
    docker exec antislash-talk-studio-proxy nginx -s reload 2>/dev/null || print_warning "Impossible de recharger nginx"
    print_success "Config studio-proxy mise à jour"
fi

print_header "5️⃣  Redémarrage de Studio et son proxy"

print_info "Arrêt de Studio et studio-proxy..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo stop studio studio-proxy

sleep 2

print_info "Démarrage avec les nouvelles variables..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d studio studio-proxy

sleep 5

print_header "6️⃣  Tests"

print_info "Test d'accès à Studio..."
if curl -k -s -o /dev/null -w "%{http_code}" https://${DOMAIN}:8444/ | grep -q "200\|401"; then
    print_success "Studio accessible (401 = auth requise, normal)"
else
    print_warning "Studio potentiellement inaccessible"
fi

print_info "Test de création d'un user de test dans la DB..."
docker exec -i antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Supprimer le user de test s'il existe
DELETE FROM auth.users WHERE email = 'test-studio@example.com';

-- Créer un nouveau user de test
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
    'test-studio@example.com',
    crypt('TestPassword123!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    false,
    ''
);

-- Vérifier
SELECT email, created_at, email_confirmed_at FROM auth.users WHERE email = 'test-studio@example.com';
SQL

if [ $? -eq 0 ]; then
    print_success "Création de user directe dans la DB fonctionne !"
else
    print_error "Échec de la création de user dans la DB"
fi

print_header "7️⃣  Variables d'environnement de Studio"

print_info "Variables chargées dans Studio:"
docker exec antislash-talk-studio env | grep -E "SUPABASE_PUBLIC_URL|STUDIO_PG_META_URL|POSTGRES" | sort

print_header "✅ FIX TERMINÉ"

echo ""
print_success "Actions effectuées:"
echo "  ✓ SUPABASE_PUBLIC_URL corrigé"
echo "  ✓ pgcrypto installé dans la DB"
echo "  ✓ .htpasswd créé pour Studio"
echo "  ✓ Studio redémarré"
echo ""
print_info "Accès à Studio:"
echo "  URL:      https://${DOMAIN}:8444/"
echo "  User:     admin"
echo "  Password: ${STUDIO_PASSWORD}"
echo ""
print_warning "Si vous ne pouvez toujours pas créer de users:"
echo "1. Vérifiez les logs: docker compose -f docker-compose.monorepo.yml logs studio"
echo "2. Ouvrez la console navigateur (F12) et regardez les erreurs"
echo "3. Essayez de créer un user directement dans l'app web au lieu de Studio"

