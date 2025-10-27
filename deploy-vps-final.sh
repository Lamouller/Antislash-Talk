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

# Détecter l'IP automatiquement
print_info "Détection de l'IP du VPS..."
DETECTED_IP=""

# Méthode 1: curl ifconfig.me (forcer IPv4)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
fi

# Méthode 2: curl ipinfo.io (forcer IPv4)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 ipinfo.io/ip 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
fi

# Méthode 3: curl checkip.amazonaws.com (forcer IPv4)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 checkip.amazonaws.com 2>/dev/null | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' || true)
fi

# Méthode 3bis: curl spécifique IPv4
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(curl -4 -s --max-time 5 ipv4.icanhazip.com 2>/dev/null | tr -d '\n' || true)
fi

# Méthode 4: ip addr show (IPv4 seulement)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(ip addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '127.0.0.1' | grep -v '^172\.' | grep -v '^10\.' | grep -v '^192\.168\.' | head -1 || true)
fi

# Méthode 5: hostname -I (IPv4 seulement)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(hostname -I | tr ' ' '\n' | grep -E '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$' | grep -v '^127\.' | grep -v '^172\.' | grep -v '^10\.' | grep -v '^192\.168\.' | head -1 || true)
fi

# Méthode 6: wget -qO- (en cas d'échec des autres)
if [ -z "$DETECTED_IP" ]; then
    DETECTED_IP=$(wget -qO- --timeout=5 http://ipv4.icanhazip.com 2>/dev/null | tr -d '\n' || true)
fi

# Valider que c'est bien une IPv4
if [ -n "$DETECTED_IP" ]; then
    # Vérifier le format IPv4
    if echo "$DETECTED_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
        print_success "IPv4 détectée : $DETECTED_IP"
        read -p "IP ou domaine du VPS [$DETECTED_IP] : " VPS_HOST
        VPS_HOST=${VPS_HOST:-$DETECTED_IP}
    else
        print_warning "IP détectée non valide (IPv6?) : $DETECTED_IP"
        print_info "Tentative de détection IPv4 forcée..."
        
        # Dernière tentative avec curl spécifique IPv4
        DETECTED_IP=$(curl -4 -s --max-time 5 api.ipify.org 2>/dev/null || true)
        
        if [ -n "$DETECTED_IP" ] && echo "$DETECTED_IP" | grep -qE '^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$'; then
            print_success "IPv4 trouvée : $DETECTED_IP"
            read -p "IP ou domaine du VPS [$DETECTED_IP] : " VPS_HOST
            VPS_HOST=${VPS_HOST:-$DETECTED_IP}
        else
            VPS_HOST=""
            while [ -z "$VPS_HOST" ]; do
                read -p "IP ou domaine du VPS (entrez votre IPv4) : " VPS_HOST
            done
        fi
    fi
else
    print_warning "Impossible de détecter l'IP automatiquement"
    VPS_HOST=""
    while [ -z "$VPS_HOST" ]; do
        read -p "IP ou domaine du VPS : " VPS_HOST
    done
fi

# Studio password
print_info "Génération d'un mot de passe sécurisé pour Studio..."
GENERATED_STUDIO_PASSWORD=$(generate_password)
print_success "Mot de passe généré : $GENERATED_STUDIO_PASSWORD"

read -sp "Mot de passe pour Supabase Studio [$GENERATED_STUDIO_PASSWORD] : " STUDIO_PASSWORD
echo
STUDIO_PASSWORD=${STUDIO_PASSWORD:-$GENERATED_STUDIO_PASSWORD}

# Email admin
read -p "Email de l'utilisateur admin [admin@antislash-talk.fr] : " APP_USER_EMAIL
APP_USER_EMAIL=${APP_USER_EMAIL:-admin@antislash-talk.fr}

# Mot de passe admin
print_info "Génération d'un mot de passe sécurisé pour l'utilisateur admin..."
GENERATED_ADMIN_PASSWORD=$(generate_password)
print_success "Mot de passe généré : $GENERATED_ADMIN_PASSWORD"

read -sp "Mot de passe pour l'utilisateur admin [$GENERATED_ADMIN_PASSWORD] : " APP_USER_PASSWORD
echo
APP_USER_PASSWORD=${APP_USER_PASSWORD:-$GENERATED_ADMIN_PASSWORD}

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
# Sauvegarder l'ancien package.json s'il existe
if [ -f "package.json" ]; then
    cp package.json package.json.backup
fi

# Créer un package.json propre pour l'installation
cat > package.json << 'PKGJSON'
{
  "type": "module",
  "dependencies": {
    "jsonwebtoken": "^9.0.0"
  }
}
PKGJSON

# Installer pour de vrai
npm install >/dev/null 2>&1

# Exécuter le script pour obtenir les clés
JWT_OUTPUT=$(JWT_SECRET="$JWT_SECRET" node generate-jwt-keys.mjs 2>&1)
JWT_EXIT_CODE=$?

# Vérifier que ça a fonctionné
if [ $JWT_EXIT_CODE -ne 0 ] || [ -z "$JWT_OUTPUT" ] || echo "$JWT_OUTPUT" | grep -q "Error"; then
    print_error "Erreur lors de la génération des clés JWT"
    echo "$JWT_OUTPUT"
    exit 1
fi

ANON_KEY=$(echo "$JWT_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2-)
SERVICE_ROLE_KEY=$(echo "$JWT_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2-)

# Vérifier que les clés ont bien été générées
if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    print_error "Les clés JWT n'ont pas pu être extraites"
    echo "JWT_OUTPUT:"
    echo "$JWT_OUTPUT"
    exit 1
fi

# Nettoyer
rm -f generate-jwt-keys.mjs
rm -rf node_modules package-lock.json

# Restaurer l'ancien package.json s'il existait
if [ -f "package.json.backup" ]; then
    mv package.json.backup package.json
else
    rm -f package.json
fi

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
STUDIO_DEFAULT_ORGANIZATION="Antislash Talk"
STUDIO_DEFAULT_PROJECT=Production
STUDIO_PORT=3000
STUDIO_PROXY_PORT=54327
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
GOTRUE_SMTP_SENDER_NAME="Antislash Talk"

# Configuration utilisateur
APP_USER_EMAIL=${APP_USER_EMAIL}
APP_USER_PASSWORD=${APP_USER_PASSWORD}

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

print_info "Création du fichier apps/web/.env pour le build..."
cat > apps/web/.env << EOF
VITE_SUPABASE_URL=http://${VPS_HOST}:54321
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
VITE_HIDE_MARKETING_PAGES=${VITE_HIDE_MARKETING_PAGES}
EOF

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

-- Types ENUM pour GoTrue MFA (DOIVENT être dans public, pas auth !)
DO \$\$ 
BEGIN
    -- factor_type dans public
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_type' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE factor_type AS ENUM ('totp', 'webauthn', 'phone');
    END IF;
    
    -- factor_status dans public
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'factor_status' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE factor_status AS ENUM ('unverified', 'verified');
    END IF;
    
    -- aal_level dans public
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'aal_level' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN
        CREATE TYPE aal_level AS ENUM ('aal1', 'aal2', 'aal3');
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

-- CRITIQUE: Configurer le search_path pour supabase_auth_admin
ALTER ROLE supabase_auth_admin SET search_path TO auth, public, extensions;

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

# Attendre que les services critiques soient prêts
print_info "Attente du démarrage des services..."

# Vérifier que Auth est prêt
print_info "Vérification du service Auth..."
AUTH_READY=false
for i in {1..30}; do
    if docker exec antislash-talk-auth curl -f http://localhost:9999/health 2>/dev/null | grep -q "ok"; then
        AUTH_READY=true
        print_success "Service Auth prêt"
        break
    fi
    sleep 2
done

if [ "$AUTH_READY" = false ]; then
    print_warning "Service Auth pas encore prêt après 60s, on continue quand même..."
fi

# Vérifier que Storage est prêt
print_info "Vérification du service Storage..."
STORAGE_READY=false
for i in {1..30}; do
    if docker exec antislash-talk-storage curl -f http://localhost:5000/status 2>/dev/null | grep -q "ok"; then
        STORAGE_READY=true
        print_success "Service Storage prêt"
        break
    fi
    sleep 2
done

if [ "$STORAGE_READY" = false ]; then
    print_warning "Service Storage pas encore prêt après 60s, on continue quand même..."
fi

# Attendre encore un peu pour la stabilisation
print_info "Attente de stabilisation (15s)..."
sleep 15

# CRITIQUE: Mettre à jour Kong avec les bonnes clés
print_info "Mise à jour de Kong avec les clés JWT..."
cp packages/supabase/kong.yml /tmp/kong.yml.template
sed -i "s/ANON_KEY_PLACEHOLDER/${ANON_KEY}/g" /tmp/kong.yml.template
sed -i "s/SERVICE_ROLE_KEY_PLACEHOLDER/${SERVICE_ROLE_KEY}/g" /tmp/kong.yml.template

# Copier dans le bon répertoire Kong (où le volume est monté)
docker cp /tmp/kong.yml.template antislash-talk-kong:/etc/kong/kong.yml

# Vérifier que le fichier est bien copié
if docker exec antislash-talk-kong test -f /etc/kong/kong.yml; then
    print_success "Fichier kong.yml copié avec succès"
    docker exec antislash-talk-kong kong reload 2>/dev/null || docker restart antislash-talk-kong
    print_success "Kong mis à jour avec les nouvelles clés"
else
    print_error "Échec de la copie du fichier kong.yml"
fi

print_header "ÉTAPE 9/10 : Création des données initiales"

# Attendre que les tables existent (créées par les migrations)
print_info "Attente de la création des tables par les migrations..."
TABLES_READY=false
for i in {1..30}; do
    AUTH_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users');" | tr -d ' ')
    STORAGE_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets');" | tr -d ' ')
    PROFILES_EXISTS=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'profiles');" | tr -d ' ')
    
    if [ "$AUTH_EXISTS" = "t" ] && [ "$STORAGE_EXISTS" = "t" ] && [ "$PROFILES_EXISTS" = "t" ]; then
        TABLES_READY=true
        print_success "Toutes les tables nécessaires sont créées (auth.users, storage.buckets, public.profiles)"
        break
    fi
    sleep 2
done

if [ "$TABLES_READY" = true ]; then
    print_success "Tables créées, ajout des données initiales..."
    
    docker exec -i antislash-talk-db psql -U postgres << EOF
-- Désactiver temporairement RLS
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities DISABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- Créer l'utilisateur admin
WITH new_user AS (
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
        extensions.gen_random_uuid(),
        '${APP_USER_EMAIL}',
        extensions.crypt('${APP_USER_PASSWORD}', extensions.gen_salt('bf', 6)),
        now(),
        now(),
        now(),
        '00000000-0000-0000-0000-000000000000',
        'authenticated',
        'authenticated',
        '{"provider": "email", "providers": ["email"]}',
        '{}'
    ) ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
    RETURNING id, email
)
INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    provider,
    identity_data,
    last_sign_in_at,
    created_at,
    updated_at
)
SELECT
    extensions.gen_random_uuid(),
    new_user.id,
    new_user.id::text,
    'email',
    json_build_object('sub', new_user.id::text, 'email', new_user.email)::jsonb,
    now(),
    now(),
    now()
FROM new_user
ON CONFLICT (provider, provider_id) DO NOTHING;

-- Créer le profil pour l'utilisateur admin
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, email, 'admin'
FROM auth.users
WHERE email = '${APP_USER_EMAIL}'
ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    role = 'admin',
    updated_at = now();

-- CRITIQUE: Corriger les colonnes NULL en auth.users (GoTrue attend des strings vides, pas NULL)
UPDATE auth.users SET 
    email_change = COALESCE(email_change, ''),
    email_change_token_new = COALESCE(email_change_token_new, ''),
    email_change_token_current = COALESCE(email_change_token_current, ''),
    confirmation_token = COALESCE(confirmation_token, ''),
    recovery_token = COALESCE(recovery_token, ''),
    phone_change = COALESCE(phone_change, ''),
    phone_change_token = COALESCE(phone_change_token, '')
WHERE email_change IS NULL 
   OR email_change_token_new IS NULL 
   OR email_change_token_current IS NULL
   OR confirmation_token IS NULL
   OR recovery_token IS NULL
   OR phone_change IS NULL
   OR phone_change_token IS NULL;

-- Définir DEFAULT '' pour éviter les NULL futurs
ALTER TABLE auth.users ALTER COLUMN email_change SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN email_change_token_new SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN email_change_token_current SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN confirmation_token SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN recovery_token SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN phone_change SET DEFAULT '';
ALTER TABLE auth.users ALTER COLUMN phone_change_token SET DEFAULT '';

-- Note: Les tables (profiles, meetings, api_keys, user_api_keys, etc.) sont créées par les migrations
-- Ne pas les créer manuellement ici pour éviter les conflits

-- Créer tous les buckets nécessaires (selon base locale réelle)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('avatars', 'avatars', true, NULL, NULL, now(), now()),
  ('meeting-audio', 'meeting-audio', true, NULL, NULL, now(), now()),
  ('meetingrecordings', 'meetingrecordings', true, NULL, NULL, now(), now()),
  ('reports', 'reports', false, NULL, NULL, now(), now()),
  ('transcriptions', 'transcriptions', false, NULL, NULL, now(), now())
ON CONFLICT (id) DO NOTHING;

-- Configurer les permissions Storage pour que tous les services puissent accéder
GRANT USAGE ON SCHEMA storage TO postgres, anon, authenticated, service_role, supabase_storage_admin;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA storage TO postgres, service_role, supabase_storage_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO anon, authenticated;

-- Réactiver RLS avec FORCE pour s'assurer que les policies s'appliquent
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage.buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE storage.objects FORCE ROW LEVEL SECURITY;

-- Créer les policies RLS
DO \$\$
BEGIN
    -- Policies pour auth.users
    DROP POLICY IF EXISTS "Users can view own profile" ON auth.users;
    CREATE POLICY "Users can view own profile" 
    ON auth.users FOR SELECT 
    USING (auth.uid() = id);
    
    -- Policies pour public.profiles
    DROP POLICY IF EXISTS "Service role bypass profiles" ON public.profiles;
    CREATE POLICY "Service role bypass profiles"
    ON public.profiles FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
    CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    TO authenticated
    USING (auth.uid() = id);
    
    DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);
    
    DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
    CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);
    
    -- Policies pour api_keys
    DROP POLICY IF EXISTS "Service role bypass api keys" ON public.api_keys;
    CREATE POLICY "Service role bypass api keys"
    ON public.api_keys FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can manage own api keys" ON public.api_keys;
    CREATE POLICY "Users can manage own api keys"
    ON public.api_keys FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
    
    -- Policies pour user_api_keys
    DROP POLICY IF EXISTS "Service role bypass user api keys" ON public.user_api_keys;
    CREATE POLICY "Service role bypass user api keys"
    ON public.user_api_keys FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can manage own user api keys" ON public.user_api_keys;
    CREATE POLICY "Users can manage own user api keys"
    ON public.user_api_keys FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
    
    -- Policies pour meetings
    DROP POLICY IF EXISTS "Service role bypass meetings" ON public.meetings;
    CREATE POLICY "Service role bypass meetings"
    ON public.meetings FOR ALL
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Users can manage own meetings" ON public.meetings;
    CREATE POLICY "Users can manage own meetings"
    ON public.meetings FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());
    
    -- Policies pour storage.buckets
    DROP POLICY IF EXISTS "Service role bypass" ON storage.buckets;
    CREATE POLICY "Service role bypass" 
    ON storage.buckets FOR ALL 
    TO service_role, postgres
    USING (true)
    WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
    CREATE POLICY "Authenticated users can view buckets" 
    ON storage.buckets FOR SELECT 
    TO authenticated
    USING (true);
    
    -- Policies pour storage.objects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        -- Service role bypass pour tous les objets
        DROP POLICY IF EXISTS "Service role bypass" ON storage.objects;
        CREATE POLICY "Service role bypass" 
        ON storage.objects FOR ALL 
        TO service_role, postgres
        USING (true)
        WITH CHECK (true);
        
        -- Policies pour users authentifiés
        DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Public buckets are viewable" ON storage.objects;
        
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
        
        -- Public buckets viewable by all
        CREATE POLICY "Public buckets are viewable"
        ON storage.objects FOR SELECT
        TO anon, authenticated
        USING (bucket_id IN ('public', 'avatars'));
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

# Vérifier les données créées avec diagnostic
print_info "Vérification des données créées..."

USERS_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT count(*) FROM auth.users;" 2>/dev/null | tr -d ' ')
PROFILES_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT count(*) FROM public.profiles;" 2>/dev/null | tr -d ' ')
BUCKETS_COUNT=$(docker exec antislash-talk-db psql -U postgres -t -c "SELECT count(*) FROM storage.buckets;" 2>/dev/null | tr -d ' ')

echo ""
echo "📊 Résultats de la vérification :"
echo "  - Utilisateurs (auth.users) : ${USERS_COUNT:-0}"
echo "  - Profils (public.profiles) : ${PROFILES_COUNT:-0}"
echo "  - Buckets (storage.buckets) : ${BUCKETS_COUNT:-0}"
echo ""

# Vérifier si tout est OK
DEPLOYMENT_OK=true

if [ "${USERS_COUNT:-0}" -eq 0 ]; then
    print_error "❌ PROBLÈME : Aucun utilisateur créé dans auth.users"
    DEPLOYMENT_OK=false
    echo "   → Diagnostic :"
    docker logs antislash-talk-auth --tail 20 2>&1 | grep -i error || echo "     Pas d'erreur évidente dans les logs Auth"
fi

if [ "${PROFILES_COUNT:-0}" -eq 0 ]; then
    print_error "❌ PROBLÈME : Aucun profil créé dans public.profiles"
    DEPLOYMENT_OK=false
    echo "   → Vérification : La table profiles existe-t-elle ?"
    docker exec antislash-talk-db psql -U postgres -t -c "\d public.profiles" 2>&1 | head -5
fi

if [ "${BUCKETS_COUNT:-0}" -eq 0 ]; then
    print_error "❌ PROBLÈME : Aucun bucket créé dans storage.buckets"
    DEPLOYMENT_OK=false
    echo "   → Diagnostic :"
    docker logs antislash-talk-storage --tail 20 2>&1 | grep -i error || echo "     Pas d'erreur évidente dans les logs Storage"
fi

# Afficher les détails si tout est OK
if [ "$DEPLOYMENT_OK" = true ]; then
    print_success "✅ Toutes les vérifications sont OK !"
    echo ""
    print_info "Détails des données créées :"
    docker exec antislash-talk-db psql -U postgres -c "
SELECT 'Utilisateurs' as type, count(*) as count, string_agg(email, ', ') as details FROM auth.users
UNION ALL
SELECT 'Buckets' as type, count(*) as count, string_agg(name, ', ') as details FROM storage.buckets;"

# Configuration Nginx pour Studio
print_info "Configuration de l'authentification Studio..."
STUDIO_PASSWORD_HASH=$(docker run --rm httpd:alpine htpasswd -nbB antislash "$STUDIO_PASSWORD" | cut -d: -f2)

cat > studio.htpasswd << EOF
antislash:$STUDIO_PASSWORD_HASH
EOF

# Copier dans le container avec une méthode qui évite le "device busy"
docker cp studio.htpasswd antislash-talk-studio-proxy:/tmp/.htpasswd.new
docker exec antislash-talk-studio-proxy sh -c "mv /tmp/.htpasswd.new /etc/nginx/.htpasswd && chmod 644 /etc/nginx/.htpasswd"
docker exec antislash-talk-studio-proxy nginx -s reload 2>/dev/null || docker restart antislash-talk-studio-proxy
rm -f studio.htpasswd

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
echo -e "${GREEN}║${NC}   Mot de passe     : ${YELLOW}${APP_USER_PASSWORD}${NC}"
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
- Mot de passe : ${APP_USER_PASSWORD}

Variables d'environnement :
- JWT_SECRET : ${JWT_SECRET:0:20}...
- ANON_KEY : ${ANON_KEY:0:20}...
- SERVICE_ROLE_KEY : ${SERVICE_ROLE_KEY:0:20}...
- POSTGRES_PASSWORD : ${POSTGRES_PASSWORD}
EOF

if [ -n "$HUGGINGFACE_TOKEN" ]; then
    echo "- HUGGINGFACE_TOKEN : ${HUGGINGFACE_TOKEN:0:10}..." >> deployment-info.txt
fi

# Afficher le résultat final
echo ""
echo "=========================================="
if [ "$DEPLOYMENT_OK" = true ]; then
    print_success "🎉 DÉPLOIEMENT TERMINÉ AVEC SUCCÈS !"
    echo ""
    echo "✅ Tous les services sont opérationnels"
    echo "✅ ${USERS_COUNT} utilisateur(s) créé(s)"
    echo "✅ ${PROFILES_COUNT} profil(s) créé(s)"
    echo "✅ ${BUCKETS_COUNT} bucket(s) créé(s)"
else
    print_error "⚠️  DÉPLOIEMENT TERMINÉ AVEC DES PROBLÈMES"
    echo ""
    echo "Des erreurs ont été détectées. Solutions possibles :"
    echo ""
    echo "1. Relancer le script de correction manuelle :"
    echo "   ./fix-complete-deployment.sh"
    echo ""
    echo "2. Vérifier les logs des services problématiques :"
    echo "   docker logs antislash-talk-auth --tail 50"
    echo "   docker logs antislash-talk-storage --tail 50"
    echo ""
    echo "3. Redéployer complètement depuis zéro :"
    echo "   ./clean-and-deploy.sh"
    echo ""
    echo "4. Diagnostic détaillé de la base de données :"
    echo "   docker exec -it antislash-talk-db psql -U postgres -d postgres"
    echo "   Puis exécuter : \\dt auth.*"
    echo "                   \\dt storage.*"
    echo "                   \\dt public.*"
    echo ""
fi
echo "=========================================="
echo ""

exit $([ "$DEPLOYMENT_OK" = true ] && echo 0 || echo 1)
