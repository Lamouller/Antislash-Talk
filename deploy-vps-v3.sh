#!/bin/bash

# 🎙️ Antislash Talk - Script de Déploiement VPS v3.0
# Installation propre et complète sans erreurs

set -e  # Arrêter en cas d'erreur

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonctions utilitaires
print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}    $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Banner
clear
echo -e "${BLUE}"
echo "    _          _   _     _           _       _____     _ _    "
echo "   / \   _ __ | |_(_)___| | __ _ ___| |__   |_   _|_ _| | | __"
echo "  / _ \ | '_ \| __| / __| |/ _\` / __| '_ \    | |/ _\` | | |/ /"
echo " / ___ \| | | | |_| \__ \ | (_| \__ \ | | |   | | (_| | |   < "
echo "/_/   \_\_| |_|\__|_|___/_|\__,_|___/_| |_|   |_|\__,_|_|_|\_\\"
echo -e "${NC}"
echo -e "${GREEN}Script de Déploiement Propre v3.0${NC}\n"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "docker-compose.monorepo.yml" ]; then
    print_error "Fichier docker-compose.monorepo.yml non trouvé"
    print_info "Assurez-vous d'être dans le répertoire ~/antislash-talk"
    exit 1
fi

print_success "Répertoire du projet détecté"

# ============================================
# ÉTAPE 1: Nettoyage complet
# ============================================
print_header "ÉTAPE 1/10 : Nettoyage complet de l'environnement"

print_info "Arrêt de tous les containers..."
docker compose -f docker-compose.monorepo.yml down -v 2>/dev/null || true

print_info "Suppression des images et volumes orphelins..."
docker system prune -af --volumes 2>/dev/null || true

print_info "Suppression des anciens fichiers de configuration..."
rm -f .env.monorepo studio.htpasswd deployment-info.txt

print_success "Environnement nettoyé"

# ============================================
# ÉTAPE 2: Vérification des prérequis
# ============================================
print_header "ÉTAPE 2/10 : Vérification des prérequis"

# Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker n'est pas installé"
    exit 1
fi
print_success "Docker installé"

# Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js n'est pas installé"
    exit 1
fi
print_success "Node.js installé"

# Git
if ! command -v git &> /dev/null; then
    print_error "Git n'est pas installé"
    exit 1
fi
print_success "Git installé"

# ============================================
# ÉTAPE 3: Mise à jour du code
# ============================================
print_header "ÉTAPE 3/10 : Mise à jour du code depuis GitHub"

git fetch origin main
git reset --hard origin/main
print_success "Code mis à jour depuis GitHub"

# ============================================
# ÉTAPE 4: Configuration interactive
# ============================================
print_header "ÉTAPE 4/10 : Configuration du déploiement"

# Détection de l'IP
print_info "Détection de l'adresse IPv4..."
VPS_HOST=$(curl -4 -s --max-time 5 ifconfig.me 2>/dev/null || echo "")

if [ -n "$VPS_HOST" ]; then
    print_success "IP détectée : $VPS_HOST"
    read -p "Utiliser cette IP ? [O/n] : " USE_DETECTED
    if [[ "$USE_DETECTED" =~ ^[Nn]$ ]]; then
        read -p "Entrez l'IP ou domaine : " VPS_HOST
    fi
else
    read -p "Entrez l'IP ou domaine du serveur : " VPS_HOST
fi

# Email utilisateur
echo ""
read -p "Email du premier utilisateur (défaut: admin@antislash-talk.fr) : " APP_USER_EMAIL
APP_USER_EMAIL=${APP_USER_EMAIL:-"admin@antislash-talk.fr"}

# Mot de passe utilisateur
read -p "Mot de passe utilisateur (laisser vide pour générer) : " APP_USER_PASSWORD
if [ -z "$APP_USER_PASSWORD" ]; then
    APP_USER_PASSWORD=$(openssl rand -base64 12 | tr -d "=+/" | cut -c1-12)
    print_info "Mot de passe généré : $APP_USER_PASSWORD"
fi

# Mot de passe Studio
read -p "Mot de passe Studio Supabase (laisser vide pour générer) : " STUDIO_PASSWORD
if [ -z "$STUDIO_PASSWORD" ]; then
    STUDIO_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-16)
    print_info "Mot de passe Studio généré : $STUDIO_PASSWORD"
fi

# Pages marketing
read -p "Cacher les pages marketing ? [o/N] : " HIDE_MARKETING
VITE_HIDE_MARKETING_PAGES="false"
if [[ "$HIDE_MARKETING" =~ ^[Oo]$ ]]; then
    VITE_HIDE_MARKETING_PAGES="true"
fi

# ============================================
# ÉTAPE 5: Génération des secrets
# ============================================
print_header "ÉTAPE 5/10 : Génération des secrets"

JWT_SECRET=$(openssl rand -base64 45 | tr -d "=+/" | cut -c1-45)
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
print_success "Secrets générés"

# Générer les clés Supabase
KEYS_OUTPUT=$(node generate-supabase-keys.js "$JWT_SECRET")
ANON_KEY=$(echo "$KEYS_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2)
SERVICE_ROLE_KEY=$(echo "$KEYS_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2)
print_success "Clés Supabase générées"

# ============================================
# ÉTAPE 6: Création du fichier .env.monorepo
# ============================================
print_header "ÉTAPE 6/10 : Création de la configuration"

cat > .env.monorepo << EOF
# Généré automatiquement le $(date)

# PostgreSQL
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# JWT
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=3600

# Supabase Keys
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# URLs
SITE_URL=http://$VPS_HOST:3000
API_EXTERNAL_URL=http://$VPS_HOST:54321
SUPABASE_PUBLIC_URL=http://$VPS_HOST:54321

# Variables Vite
VITE_SUPABASE_URL=http://$VPS_HOST:54321
VITE_SUPABASE_ANON_KEY=$ANON_KEY
VITE_HIDE_MARKETING_PAGES=$VITE_HIDE_MARKETING_PAGES

# Email
SMTP_HOST=inbucket
SMTP_PORT=2500
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true

# Studio
STUDIO_DEFAULT_ORGANIZATION="Antislash Talk"
STUDIO_DEFAULT_PROJECT="Antislash Talk Project"
EOF

print_success "Configuration créée"

# Créer le fichier .htpasswd pour Studio
HASHED_PASSWORD=$(openssl passwd -apr1 "$STUDIO_PASSWORD")
echo "admin:$HASHED_PASSWORD" > studio.htpasswd
print_success "Authentification Studio configurée"

# ============================================
# ÉTAPE 7: Création du script d'initialisation SQL
# ============================================
print_header "ÉTAPE 7/10 : Création du script d'initialisation PostgreSQL"

# Créer le répertoire pour les scripts d'init
mkdir -p init-db

# Script d'initialisation complet
cat > init-db/00-init-complete.sql << EOF
-- Script d'initialisation complet pour Antislash Talk
-- Ce script doit être exécuté APRÈS que PostgreSQL soit démarré

\set ON_ERROR_STOP on

-- 1. Configuration de base
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- 2. Création des schémas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS public;

-- 3. Création des extensions dans le bon schéma
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pgjwt SCHEMA extensions;

-- 4. Création des types ENUM requis par Auth
DO \$\$ 
BEGIN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
EXCEPTION
    WHEN duplicate_object THEN null;
END \$\$;

-- 5. Création des rôles avec les bons privilèges
DO \$\$
BEGIN
    -- Rôles avec login
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin;
    END IF;
    ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin;
    END IF;
    ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
    END IF;
    ALTER ROLE supabase_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER CREATEDB CREATEROLE REPLICATION;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator;
    END IF;
    ALTER ROLE authenticator WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' NOINHERIT;

    -- Rôles sans login
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
END
\$\$;

-- 6. Accorder les privilèges de base
GRANT anon, authenticated, service_role TO authenticator;
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin, supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA auth TO supabase_auth_admin, supabase_admin;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA public TO supabase_auth_admin, supabase_storage_admin, supabase_admin;
GRANT ALL ON SCHEMA extensions TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA auth, storage, public TO anon, authenticated, service_role;

-- 7. Permissions par défaut pour les objets futurs
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON SEQUENCES TO supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON FUNCTIONS TO supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON TABLES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON SEQUENCES TO supabase_storage_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT ALL ON FUNCTIONS TO supabase_storage_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- 8. Table pour tracker les migrations Auth
CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version VARCHAR(255) PRIMARY KEY
);

-- 9. Configuration finale
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
SELECT pg_reload_conf();

-- Afficher un résumé
SELECT 'Initialisation PostgreSQL terminée' as status;
EOF

# Script pour créer les données après que Auth/Storage aient créé leurs tables
cat > init-db/99-create-initial-data.sql << EOF
-- Script pour créer les données initiales
-- À exécuter APRÈS que Auth et Storage aient créé leurs tables

\set ON_ERROR_STOP on

-- 1. Créer les buckets Storage (si la table existe)
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        -- Désactiver RLS temporairement
        ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
        ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
        
        -- Créer les buckets
        INSERT INTO storage.buckets (id, name, public) VALUES 
            ('recordings', 'recordings', false),
            ('exports', 'exports', false),
            ('speakers', 'speakers', false)
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Buckets créés avec succès';
    ELSE
        RAISE NOTICE 'Table storage.buckets n''existe pas encore';
    END IF;
END
\$\$;

-- 2. Créer l'utilisateur initial (si la table existe)
DO \$\$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        -- Désactiver RLS temporairement
        ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;
        
        -- Créer l'utilisateur
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            gen_random_uuid(),
            'authenticated',
            'authenticated',
            '$APP_USER_EMAIL',
            crypt('$APP_USER_PASSWORD', gen_salt('bf')),
            NOW(), NOW(), NOW()
        ) ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;
        
        -- Réactiver RLS
        ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;
        
        RAISE NOTICE 'Utilisateur créé avec succès';
    ELSE
        RAISE NOTICE 'Table auth.users n''existe pas encore';
    END IF;
END
\$\$;

-- 3. Créer les policies RLS de base
DO \$\$
BEGIN
    -- Policies pour auth.users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        CREATE POLICY IF NOT EXISTS "Users can view own profile" 
        ON auth.users FOR SELECT 
        USING (auth.uid() = id);
    END IF;
    
    -- Policies pour storage.buckets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        CREATE POLICY IF NOT EXISTS "Authenticated users can view buckets" 
        ON storage.buckets FOR SELECT 
        TO authenticated
        USING (true);
    END IF;
    
    -- Policies pour storage.objects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        CREATE POLICY IF NOT EXISTS "Users can upload to recordings" 
        ON storage.objects FOR INSERT 
        TO authenticated
        WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY IF NOT EXISTS "Users can view own recordings" 
        ON storage.objects FOR SELECT 
        TO authenticated
        USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY IF NOT EXISTS "Users can delete own recordings" 
        ON storage.objects FOR DELETE 
        TO authenticated
        USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
    END IF;
END
\$\$;

-- Afficher le résultat
SELECT 'Données initiales créées' as status;
EOF

print_success "Scripts d'initialisation créés"

# ============================================
# ÉTAPE 8: Démarrage séquentiel des services
# ============================================
print_header "ÉTAPE 8/10 : Démarrage des services"

# 8.1: Construire l'image web avec les bonnes variables
print_info "Construction de l'image web..."
export API_EXTERNAL_URL="http://$VPS_HOST:54321"
export VITE_SUPABASE_URL="http://$VPS_HOST:54321"
export VITE_SUPABASE_ANON_KEY="$ANON_KEY"
export VITE_HIDE_MARKETING_PAGES="$VITE_HIDE_MARKETING_PAGES"

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo build web

# 8.2: Démarrer PostgreSQL seul
print_info "Démarrage de PostgreSQL..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d db

# Attendre que PostgreSQL soit prêt
print_info "Attente de PostgreSQL..."
until docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
done
print_success "PostgreSQL prêt"

# 8.3: Exécuter le script d'initialisation
print_info "Initialisation de la base de données..."
docker exec -i antislash-talk-db psql -U postgres -d postgres < init-db/00-init-complete.sql
print_success "Base de données initialisée"

# 8.4: Appliquer les migrations de l'application
print_info "Application des migrations de l'application..."
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        filename=$(basename "$migration")
        echo -ne "  → $filename..."
        if docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" 2>/dev/null; then
            echo -e " ${GREEN}✓${NC}"
        else
            echo -e " ${YELLOW}⚠${NC}"
        fi
    fi
done

# 8.5: Démarrer tous les autres services
print_info "Démarrage de tous les services..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

# 8.6: Attendre que les services soient prêts
print_info "Attente que les services démarrent (60 secondes)..."
sleep 60

# 8.7: Vérifier que Auth et Storage ont créé leurs tables
print_info "Vérification des tables Auth/Storage..."
AUTH_READY=false
STORAGE_READY=false

for i in {1..30}; do
    AUTH_TABLES=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users';" 2>/dev/null || echo "0")
    STORAGE_TABLES=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'buckets';" 2>/dev/null || echo "0")
    
    if [ "$AUTH_TABLES" = "1" ]; then
        AUTH_READY=true
    fi
    
    if [ "$STORAGE_TABLES" = "1" ]; then
        STORAGE_READY=true
    fi
    
    if [ "$AUTH_READY" = true ] && [ "$STORAGE_READY" = true ]; then
        print_success "Tables Auth et Storage créées"
        break
    fi
    
    sleep 2
done

# 8.8: Créer les données initiales
print_info "Création des données initiales..."
docker exec -i antislash-talk-db psql -U postgres -d postgres < init-db/99-create-initial-data.sql

# ============================================
# ÉTAPE 9: Vérification finale
# ============================================
print_header "ÉTAPE 9/10 : Vérification du déploiement"

# Vérifier les services
echo "État des services :"
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps

# Vérifier les données
echo ""
echo "Données créées :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT 'Users:' as type, COUNT(*) as count, string_agg(email, ', ') as details FROM auth.users
UNION ALL
SELECT 'Buckets:', COUNT(*), string_agg(name, ', ') FROM storage.buckets;"

# ============================================
# ÉTAPE 10: Sauvegarde des informations
# ============================================
print_header "ÉTAPE 10/10 : Sauvegarde des informations"

cat > deployment-info.txt << EOF
🎙️ ANTISLASH TALK - DÉPLOIEMENT VPS
=====================================

Date : $(date)
IP/Domaine : $VPS_HOST

URLS D'ACCÈS :
--------------
Application : http://$VPS_HOST:3000
Studio : http://$VPS_HOST:54323
API : http://$VPS_HOST:54321

IDENTIFIANTS :
--------------
Application :
  Email : $APP_USER_EMAIL
  Password : $APP_USER_PASSWORD

Studio Supabase :
  Username : admin
  Password : $STUDIO_PASSWORD

PostgreSQL :
  Password : $POSTGRES_PASSWORD

JWT Secret : $JWT_SECRET
EOF

chmod 600 deployment-info.txt

# Résumé final
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                  🎉 DÉPLOIEMENT RÉUSSI ! 🎉                ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📱 Application :${NC} http://$VPS_HOST:3000"
echo -e "${CYAN}🔧 Studio :${NC} http://$VPS_HOST:54323"
echo ""
echo -e "${CYAN}Connexion Application :${NC}"
echo -e "  Email : ${YELLOW}$APP_USER_EMAIL${NC}"
echo -e "  Password : ${YELLOW}$APP_USER_PASSWORD${NC}"
echo ""
echo -e "${CYAN}Connexion Studio :${NC}"
echo -e "  Username : ${YELLOW}admin${NC}"
echo -e "  Password : ${YELLOW}$STUDIO_PASSWORD${NC}"
echo ""
echo -e "${GREEN}Les informations complètes sont dans :${NC} deployment-info.txt"

# Nettoyer les fichiers temporaires
rm -rf init-db
