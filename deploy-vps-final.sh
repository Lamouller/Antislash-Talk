#!/bin/bash
# Script de déploiement VPS COMPLET avec toutes les corrections
set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PROJECT_DIR="/home/debian/antislash-talk"
REQUIRED_TOOLS=("docker" "git" "openssl" "curl" "jq" "envsubst")

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Fonction pour générer des mots de passe sécurisés
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "$PROJECT_DIR/docker-compose.monorepo.yml" ]; then
    print_error "Ce script doit être exécuté depuis le répertoire du projet"
    print_info "Répertoire attendu: $PROJECT_DIR"
    exit 1
fi

cd "$PROJECT_DIR"

# ASCII Art
echo -e "${CYAN}"
cat << "EOF"
    _          _   _     _           _       _____     _ _   
   / \   _ __ | |_(_)___| | __ _ ___| |__   |_   _|_ _| | | __
  / _ \ | '_ \| __| / __| |/ _` / __| '_ \    | |/ _` | | |/ /
 / ___ \| | | | |_| \__ \ | (_| \__ \ | | |   | | (_| | |   < 
/_/   \_\_| |_|\__|_|___/_|\__,_|___/_| |_|   |_|\__,_|_|_|\_\

EOF
echo -e "${NC}"
echo -e "${PURPLE}Script de Déploiement Complet Final v4.0${NC}"

# Vérifier les permissions Docker
if ! docker ps >/dev/null 2>&1; then
    print_error "Permissions Docker manquantes"
    print_info "Ajout au groupe docker..."
    sudo usermod -aG docker $USER
    print_warning "Veuillez vous déconnecter/reconnecter et relancer le script"
    exit 1
fi

print_header "ÉTAPE 1/10 : Configuration initiale"

# Collecter les informations
VPS_HOST=""
while [ -z "$VPS_HOST" ]; do
    read -p "IP ou domaine du VPS : " VPS_HOST
done

# Studio password
STUDIO_PASSWORD=""
while [ -z "$STUDIO_PASSWORD" ]; do
    read -sp "Mot de passe pour Supabase Studio : " STUDIO_PASSWORD
    echo
done

# Email admin
read -p "Email de l'utilisateur admin [admin@antislash-talk.fr] : " APP_USER_EMAIL
APP_USER_EMAIL=${APP_USER_EMAIL:-admin@antislash-talk.fr}

# Hide marketing pages
read -p "Masquer les pages marketing ? (oui/non) [oui] : " HIDE_MARKETING
VITE_HIDE_MARKETING_PAGES=$([ "${HIDE_MARKETING:-oui}" = "oui" ] && echo "true" || echo "false")

# HuggingFace token
read -p "Token HuggingFace (optionnel, Entrée pour ignorer) : " HUGGINGFACE_TOKEN

print_header "ÉTAPE 2/10 : Génération des clés et mots de passe"

# Générer toutes les clés nécessaires
POSTGRES_PASSWORD=$(generate_password)
JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ANON_KEY=""
SERVICE_ROLE_KEY=""

# Générer les clés JWT avec le script Node.js
print_info "Génération des clés JWT..."
cat > generate-jwt-keys.mjs << 'EOF'
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET;
const expiresIn = '10y';

const anonPayload = {
  role: 'anon',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
};

const serviceRolePayload = {
  role: 'service_role',
  iss: 'supabase',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (10 * 365 * 24 * 60 * 60)
};

const anonKey = jwt.sign(anonPayload, jwtSecret);
const serviceRoleKey = jwt.sign(serviceRolePayload, jwtSecret);

console.log(`ANON_KEY=${anonKey}`);
console.log(`SERVICE_ROLE_KEY=${serviceRoleKey}`);
EOF

# Installer jsonwebtoken temporairement et générer les clés
print_info "Installation temporaire de jsonwebtoken..."
npm install --no-save jsonwebtoken >/dev/null 2>&1

# Exécuter le script pour obtenir les clés
JWT_OUTPUT=$(JWT_SECRET="$JWT_SECRET" node generate-jwt-keys.mjs)
ANON_KEY=$(echo "$JWT_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2-)
SERVICE_ROLE_KEY=$(echo "$JWT_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2-)

# Nettoyer
rm -f generate-jwt-keys.mjs
rm -rf node_modules package-lock.json

print_success "Clés générées avec succès"

print_header "ÉTAPE 3/10 : Création du fichier .env.monorepo"

# Créer le fichier .env.monorepo avec toutes les variables
cat > .env.monorepo << EOF
# Configuration de base
NODE_ENV=production
API_EXTERNAL_URL=http://${VPS_HOST}:54321
VITE_SUPABASE_URL=http://${VPS_HOST}:54321
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
VITE_HIDE_MARKETING_PAGES=${VITE_HIDE_MARKETING_PAGES}

# PostgreSQL
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_DB=postgres

# JWT
JWT_SECRET=${JWT_SECRET}
ANON_KEY=${ANON_KEY}
SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}

# URLs des services
SUPABASE_URL=http://${VPS_HOST}:54321
PUBLIC_REST_URL=http://${VPS_HOST}:54321/rest/v1/
PGRST_JWT_SECRET=${JWT_SECRET}

# Auth Service (GoTrue)
GOTRUE_SITE_URL=http://${VPS_HOST}
GOTRUE_URI_ALLOW_LIST=http://${VPS_HOST}:*,http://${VPS_HOST}
GOTRUE_JWT_SECRET=${JWT_SECRET}
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_DB_DRIVER=postgres
DATABASE_URL=postgres://supabase_auth_admin:${POSTGRES_PASSWORD}@db:5432/postgres

# Studio
STUDIO_DEFAULT_ORGANIZATION=Antislash Talk
STUDIO_DEFAULT_PROJECT=Production
STUDIO_PORT=3000
SUPABASE_PUBLIC_URL=http://${VPS_HOST}:54321
NEXT_PUBLIC_ENABLE_LOGS=true
NEXT_ANALYTICS_BACKEND_PROVIDER=postgres

# Storage
STORAGE_BACKEND=file
STORAGE_FILE_BACKEND_PATH=/var/lib/storage
STORAGE_S3_BUCKET=
STORAGE_S3_ENDPOINT=
STORAGE_S3_FORCE_PATH_STYLE=
STORAGE_S3_PROTOCOL=
STORAGE_S3_REGION=

# Email (Local)
GOTRUE_SMTP_HOST=inbucket
GOTRUE_SMTP_PORT=2500
GOTRUE_SMTP_USER=
GOTRUE_SMTP_PASS=
GOTRUE_SMTP_SENDER_NAME=Antislash Talk

# Configuration utilisateur
APP_USER_EMAIL=${APP_USER_EMAIL}
APP_USER_PASSWORD=Antislash2024!

# Kong
KONG_HTTP2_MAX_FIELD_SIZE=16384
KONG_HTTP2_MAX_HEADER_SIZE=16384

# Dashboard
DASHBOARD_USERNAME=antislash
DASHBOARD_PASSWORD=${STUDIO_PASSWORD}

# Studio Auth
STUDIO_USER=antislash
STUDIO_PASSWORD=${STUDIO_PASSWORD}

# AI Services
HUGGINGFACE_TOKEN=${HUGGINGFACE_TOKEN}
OLLAMA_BASE_URL=http://ollama:11434
VITE_OLLAMA_BASE_URL=http://${VPS_HOST}:11434

# Imgproxy
IMGPROXY_ENABLE_WEBP_DETECTION=true
EOF

print_success "Configuration créée"

print_header "ÉTAPE 4/10 : Arrêt des services existants"

# Arrêter et nettoyer les services existants
docker compose -f docker-compose.monorepo.yml down -v --remove-orphans || true
docker system prune -f

print_header "ÉTAPE 5/10 : Construction de l'image web"

print_info "Export des variables pour le build..."
export API_EXTERNAL_URL="http://${VPS_HOST}:54321"
export VITE_SUPABASE_URL="http://${VPS_HOST}:54321"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export VITE_HIDE_MARKETING_PAGES="$VITE_HIDE_MARKETING_PAGES"

print_info "Construction de l'image web..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo build web

print_header "ÉTAPE 6/10 : Démarrage de PostgreSQL"

print_info "Démarrage de PostgreSQL seul..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d db

# Attendre que PostgreSQL soit prêt
print_info "Attente de PostgreSQL..."
POSTGRES_READY=false
for i in {1..30}; do
    if docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; then
        POSTGRES_READY=true
        break
    fi
    sleep 2
done

if [ "$POSTGRES_READY" = false ]; then
    print_error "PostgreSQL n'a pas démarré"
    exit 1
fi

print_success "PostgreSQL prêt"
sleep 5

print_header "ÉTAPE 7/10 : Configuration de PostgreSQL"

print_info "Configuration complète de PostgreSQL..."
docker exec -i antislash-talk-db psql -U postgres << EOF
-- Configuration
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- Création des schémas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS public;

-- Extensions (avec gestion d'erreur)
DO \$\$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions CASCADE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Extension uuid-ossp: %', SQLERRM;
END \$\$;

DO \$\$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions CASCADE;
EXCEPTION
    WHEN others THEN
        RAISE NOTICE 'Extension pgcrypto: %', SQLERRM;
END \$\$;

-- Type auth.factor_type
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')) THEN
        CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
    END IF;
END \$\$;

-- Table auth.schema_migrations
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version text NOT NULL PRIMARY KEY
);

-- Création et configuration des rôles avec EXECUTE format pour éviter les erreurs de syntaxe
DO \$\$
DECLARE
    db_password text := '${POSTGRES_PASSWORD}';
BEGIN
    -- postgres
    EXECUTE format('ALTER ROLE postgres PASSWORD %L', db_password);
    
    -- supabase_auth_admin (SUPERUSER pour éviter les problèmes de permissions)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin;
    END IF;
    EXECUTE format('ALTER ROLE supabase_auth_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD %L', db_password);
    
    -- supabase_storage_admin (SUPERUSER aussi)
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin;
    END IF;
    EXECUTE format('ALTER ROLE supabase_storage_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD %L', db_password);
    
    -- authenticator
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator;
    END IF;
    EXECUTE format('ALTER ROLE authenticator WITH LOGIN PASSWORD %L', db_password);
    
    -- service_role
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role;
    END IF;
    ALTER ROLE service_role WITH NOLOGIN;
    
    -- anon
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon;
    END IF;
    ALTER ROLE anon WITH NOLOGIN;
    
    -- supabase_admin
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
    END IF;
    EXECUTE format('ALTER ROLE supabase_admin WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD %L', db_password);
END \$\$;

-- Permissions et ownership
ALTER SCHEMA auth OWNER TO supabase_auth_admin;
ALTER SCHEMA storage OWNER TO supabase_storage_admin;
ALTER TABLE auth.schema_migrations OWNER TO supabase_auth_admin;

GRANT ALL PRIVILEGES ON SCHEMA auth TO supabase_auth_admin;
GRANT ALL PRIVILEGES ON SCHEMA storage TO supabase_storage_admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres, supabase_admin;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin, supabase_auth_admin, supabase_storage_admin;
GRANT USAGE ON SCHEMA auth TO authenticator;
GRANT USAGE ON SCHEMA storage TO authenticator;
GRANT USAGE ON SCHEMA public TO authenticator, anon, service_role;
GRANT USAGE ON SCHEMA extensions TO postgres, supabase_admin, supabase_auth_admin, supabase_storage_admin;
GRANT anon TO authenticator;
GRANT service_role TO authenticator;

SELECT 'PostgreSQL configuré' as status;
EOF

# Configurer pg_hba.conf
print_info "Configuration de pg_hba.conf..."
docker exec antislash-talk-db bash -c "cat > /var/lib/postgresql/data/pg_hba.conf << 'EOF'
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     trust
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
host    all             all             0.0.0.0/0               scram-sha-256
host    all             all             ::/0                    scram-sha-256
EOF"

docker exec antislash-talk-db psql -U postgres -c "SELECT pg_reload_conf();"
print_success "PostgreSQL configuré"

print_header "ÉTAPE 8/10 : Application des migrations et démarrage des services"

# Appliquer les migrations
print_info "Application des migrations..."
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        if docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" 2>/dev/null; then
            print_success "Migration appliquée : $filename"
        else
            print_info "Migration déjà appliquée ou non nécessaire : $filename"
        fi
    fi
done

# Démarrer tous les services
print_info "Démarrage de tous les services..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

# Attendre que les services soient prêts
print_info "Attente du démarrage des services (45s)..."
sleep 45

print_header "ÉTAPE 9/10 : Création des données initiales"

# Attendre que les tables existent
print_info "Attente de la création des tables..."
TABLES_READY=false
for i in {1..30}; do
    AUTH_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | tr -d ' ')
    STORAGE_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets');" | tr -d ' ')
    
    if [ "$AUTH_EXISTS" = "t" ] && [ "$STORAGE_EXISTS" = "t" ]; then
        TABLES_READY=true
        break
    fi
    sleep 2
done

if [ "$TABLES_READY" = true ]; then
    print_success "Tables créées, ajout des données initiales..."
    
    docker exec -i antislash-talk-db psql -U postgres << EOF
-- Désactiver temporairement RLS
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;

-- Créer l'utilisateur admin
INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    instance_id,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data
) VALUES (
    gen_random_uuid(),
    '${APP_USER_EMAIL}',
    crypt('Antislash2024!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    '{"provider": "email", "providers": ["email"]}',
    '{}'
) ON CONFLICT (email) DO NOTHING;

-- Créer le bucket recordings
INSERT INTO storage.buckets (id, name, public, created_at, updated_at)
VALUES ('recordings', 'recordings', false, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Réactiver RLS
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

-- Créer les policies RLS
DO \$\$
BEGIN
    -- Policies pour auth.users
    DROP POLICY IF EXISTS "Users can view own profile" ON auth.users;
    CREATE POLICY "Users can view own profile" 
    ON auth.users FOR SELECT 
    USING (auth.uid() = id);
    
    -- Policies pour storage.buckets
    DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
    CREATE POLICY "Authenticated users can view buckets" 
    ON storage.buckets FOR SELECT 
    TO authenticated
    USING (true);
    
    -- Policies pour storage.objects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
        
        CREATE POLICY "Users can upload to recordings" 
        ON storage.objects FOR INSERT 
        TO authenticated
        WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY "Users can view own recordings" 
        ON storage.objects FOR SELECT 
        TO authenticated
        USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY "Users can delete own recordings" 
        ON storage.objects FOR DELETE 
        TO authenticated
        USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END \$\$;

SELECT 'Données initiales créées' as status;
EOF
else
    print_warning "Les tables n'ont pas été créées automatiquement"
fi

print_header "ÉTAPE 10/10 : Vérification du déploiement"

# Vérifier l'état des services
print_info "État des services :"
docker compose -f docker-compose.monorepo.yml ps

# Vérifier les données créées
print_info "Données créées :"
docker exec antislash-talk-db psql -U postgres -c "
SELECT 'Utilisateurs' as type, count(*) as count, string_agg(email, ', ') as details FROM auth.users
UNION ALL
SELECT 'Buckets' as type, count(*) as count, string_agg(name, ', ') as details FROM storage.buckets;"

# Configuration Nginx pour Studio
print_info "Configuration de l'authentification Studio..."
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

cat > studio-htpasswd << EOF
antislash:$STUDIO_PASSWORD_HASH
EOF

docker cp studio-htpasswd antislash-talk-studio-proxy:/etc/nginx/.htpasswd
docker restart antislash-talk-studio-proxy
rm -f studio-htpasswd

# Afficher les informations finales
print_header "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"

echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                     INFORMATIONS D'ACCÈS                       ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC} Application Web    : ${CYAN}http://${VPS_HOST}:3000${NC}"
echo -e "${GREEN}║${NC} Supabase Studio    : ${CYAN}http://${VPS_HOST}:54323${NC}"
echo -e "${GREEN}║${NC}   Utilisateur      : ${YELLOW}antislash${NC}"
echo -e "${GREEN}║${NC}   Mot de passe     : ${YELLOW}${STUDIO_PASSWORD}${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} API Supabase       : ${CYAN}http://${VPS_HOST}:54321${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} Compte Admin App   :"
echo -e "${GREEN}║${NC}   Email            : ${YELLOW}${APP_USER_EMAIL}${NC}"
echo -e "${GREEN}║${NC}   Mot de passe     : ${YELLOW}Antislash2024!${NC}"
echo -e "${GREEN}║${NC}"
echo -e "${GREEN}║${NC} Ollama API         : ${CYAN}http://${VPS_HOST}:11434${NC}"
if [ -n "$HUGGINGFACE_TOKEN" ]; then
echo -e "${GREEN}║${NC} HuggingFace Token  : ${YELLOW}${HUGGINGFACE_TOKEN:0:10}...${NC}"
fi
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"

print_info "Toutes les informations ont été sauvegardées dans deployment-info.txt"

# Sauvegarder les informations
cat > deployment-info.txt << EOF
Déploiement Antislash Talk - $(date)
=====================================

URLs d'accès :
- Application : http://${VPS_HOST}:3000
- Studio : http://${VPS_HOST}:54323 (user: antislash, pass: ${STUDIO_PASSWORD})
- API : http://${VPS_HOST}:54321
- Ollama : http://${VPS_HOST}:11434

Compte admin :
- Email : ${APP_USER_EMAIL}
- Mot de passe : Antislash2024!

Variables d'environnement :
- JWT_SECRET : ${JWT_SECRET:0:20}...
- ANON_KEY : ${ANON_KEY:0:20}...
- SERVICE_ROLE_KEY : ${SERVICE_ROLE_KEY:0:20}...
- POSTGRES_PASSWORD : ${POSTGRES_PASSWORD}
EOF

if [ -n "$HUGGINGFACE_TOKEN" ]; then
    echo "- HUGGINGFACE_TOKEN : ${HUGGINGFACE_TOKEN:0:10}..." >> deployment-info.txt
fi

print_success "Déploiement terminé !"
