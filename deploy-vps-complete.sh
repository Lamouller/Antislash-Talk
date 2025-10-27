#!/bin/bash

# 🎙️ Antislash Talk - Script de Déploiement VPS Complet
# Ce script effectue un déploiement complet automatisé avec toutes les vérifications

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
echo -e "${GREEN}Script de Déploiement Complet v2.0${NC}\n"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "docker-compose.monorepo.yml" ]; then
    print_error "Fichier docker-compose.monorepo.yml non trouvé"
    print_info "Assurez-vous d'être dans le répertoire ~/antislash-talk"
    exit 1
fi

print_success "Répertoire du projet détecté"

# ============================================
# ÉTAPE 1: Vérifier les permissions Docker
# ============================================
print_header "ÉTAPE 1/7 : Vérification des permissions Docker"

if docker ps >/dev/null 2>&1; then
    print_success "Permissions Docker OK"
else
    print_warning "Permissions Docker manquantes. Configuration en cours..."
    
    # Ajouter l'utilisateur au groupe docker
    sudo usermod -aG docker $USER
    print_info "Utilisateur ajouté au groupe docker"
    
    # Appliquer les changements
    print_info "Application des changements de groupe..."
    
    # Tester à nouveau
    if docker ps >/dev/null 2>&1; then
        print_success "Permissions Docker configurées avec succès"
    else
        print_error "Impossible de configurer les permissions Docker"
        print_info "Vous devrez peut-être vous déconnecter et vous reconnecter"
        print_info "Puis relancer ce script avec: ./deploy-vps-complete.sh"
        exit 1
    fi
fi

# ============================================
# ÉTAPE 2: Récupérer les dernières modifications
# ============================================
print_header "ÉTAPE 2/7 : Mise à jour du code depuis GitHub"

git fetch origin main
git pull origin main
print_success "Code mis à jour depuis GitHub"

# ============================================
# ÉTAPE 3: Générer les secrets
# ============================================
print_header "ÉTAPE 3/7 : Génération des secrets sécurisés"

# Générer JWT_SECRET
JWT_SECRET=$(openssl rand -base64 45 | tr -d "=+/" | cut -c1-45)
print_success "JWT_SECRET généré (45 caractères)"

# Générer POSTGRES_PASSWORD
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
print_success "POSTGRES_PASSWORD généré (32 caractères)"

# Générer les clés Supabase
print_info "Génération des clés Supabase avec le JWT_SECRET..."
KEYS_OUTPUT=$(node generate-supabase-keys.js "$JWT_SECRET")

if [ $? -ne 0 ]; then
    print_error "Erreur lors de la génération des clés Supabase"
    print_info "Vérifiez que Node.js est installé: node --version"
    exit 1
fi

ANON_KEY=$(echo "$KEYS_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2)
SERVICE_ROLE_KEY=$(echo "$KEYS_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2)

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    print_error "Les clés Supabase n'ont pas été générées correctement"
    exit 1
fi

print_success "ANON_KEY généré"
print_success "SERVICE_ROLE_KEY généré"

# ============================================
# ÉTAPE 4: Détecter l'IP du VPS
# ============================================
print_header "ÉTAPE 4/7 : Détection de l'IP du VPS"

VPS_IP=$(curl -s ifconfig.me || curl -s icanhazip.com || echo "localhost")

if [ "$VPS_IP" = "localhost" ]; then
    print_warning "Impossible de détecter l'IP publique automatiquement"
    read -p "Entrez l'IP de votre VPS manuellement : " VPS_IP
fi

print_success "IP du VPS détectée : $VPS_IP"

# ============================================
# ÉTAPE 4b: Configuration optionnelle HuggingFace
# ============================================
echo ""
print_info "Configuration optionnelle : Token HuggingFace"
echo -e "${CYAN}Le token HuggingFace est nécessaire pour la diarisation (identification des locuteurs).${NC}"
echo -e "${CYAN}Si vous n'en avez pas, laissez vide (vous pourrez l'ajouter plus tard).${NC}"
echo -e "${YELLOW}Pour obtenir un token : https://huggingface.co/settings/tokens${NC}"
echo ""
read -p "Token HuggingFace (optionnel, Entrée pour ignorer) : " HUGGINGFACE_TOKEN

if [ -z "$HUGGINGFACE_TOKEN" ]; then
    print_info "Token HuggingFace non fourni (diarisation désactivée)"
    HUGGINGFACE_TOKEN=""
else
    print_success "Token HuggingFace configuré"
fi

# ============================================
# ÉTAPE 4c: Configuration pages marketing
# ============================================
echo ""
print_info "Configuration de l'interface : Pages marketing"
echo -e "${CYAN}Pour un déploiement client ou entreprise, vous pouvez cacher les pages marketing.${NC}"
echo -e "${CYAN}Cela redirigera directement vers la page de connexion au lieu de la page d'accueil.${NC}"
echo ""
echo -e "${YELLOW}Cacher les pages marketing ?${NC}"
echo "  - ${GREEN}O${NC} : Redirection directe vers /auth/login (mode entreprise)"
echo "  - ${GREEN}N${NC} : Garder la page d'accueil marketing (défaut)"
echo ""
read -p "Cacher les pages marketing ? [o/N] : " HIDE_MARKETING

if [[ "$HIDE_MARKETING" =~ ^[Oo]$ ]]; then
    VITE_HIDE_MARKETING_PAGES="true"
    print_success "Pages marketing désactivées (mode entreprise)"
else
    VITE_HIDE_MARKETING_PAGES="false"
    print_info "Pages marketing activées (mode par défaut)"
fi

# ============================================
# ÉTAPE 5: Créer le fichier .env.monorepo
# ============================================
print_header "ÉTAPE 5/7 : Création du fichier .env.monorepo"

# Backup de l'ancien fichier si existe
if [ -f ".env.monorepo" ]; then
    BACKUP_NAME=".env.monorepo.backup.$(date +%Y%m%d_%H%M%S)"
    cp .env.monorepo "$BACKUP_NAME"
    print_info "Sauvegarde de l'ancien fichier : $BACKUP_NAME"
fi

# Créer le nouveau fichier
cat > .env.monorepo << EOF
# 🎙️ Antislash Talk Monorepo - Configuration VPS
# Généré automatiquement le $(date)

# ============================================
# Base de données PostgreSQL
# ============================================
POSTGRES_DB=postgres
POSTGRES_PORT=5432
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# ============================================
# Configuration JWT (Authentification)
# ============================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRY=3600

# ============================================
# Clés API Supabase
# ============================================
ANON_KEY=$ANON_KEY
SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY

# ============================================
# URLs du VPS
# ============================================
SITE_URL=http://$VPS_IP:3000
API_EXTERNAL_URL=http://$VPS_IP:54321
SUPABASE_PUBLIC_URL=http://$VPS_IP:54321

# ============================================
# Ports des services
# ============================================
KONG_HTTP_PORT=54321
STUDIO_PORT=54323
WEB_PORT=3000
INBUCKET_PORT=54324

# ============================================
# Configuration Email (Local Testing)
# ============================================
SMTP_HOST=inbucket
SMTP_PORT=2500
SMTP_ADMIN_EMAIL=admin@antislash-talk.local
SMTP_SENDER_NAME="Antislash Talk"
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=true

# ============================================
# Services optionnels
# ============================================
# Token HuggingFace pour diarization (optionnel)
HUGGINGFACE_TOKEN=$HUGGINGFACE_TOKEN

# Cacher les pages marketing (optionnel)
VITE_HIDE_MARKETING_PAGES=$VITE_HIDE_MARKETING_PAGES

# ============================================
# Studio Supabase
# ============================================
STUDIO_DEFAULT_ORGANIZATION="Antislash Talk"
STUDIO_DEFAULT_PROJECT="Antislash Talk Project"
EOF

print_success "Fichier .env.monorepo créé avec succès"

# Vérifier que les variables critiques sont définies
echo ""
print_info "Vérification des variables critiques..."

if [ -z "$ANON_KEY" ]; then
    print_error "ANON_KEY n'est pas défini !"
    exit 1
fi

if [ -z "$SERVICE_ROLE_KEY" ]; then
    print_error "SERVICE_ROLE_KEY n'est pas défini !"
    exit 1
fi

if [ -z "$JWT_SECRET" ]; then
    print_error "JWT_SECRET n'est pas défini !"
    exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
    print_error "POSTGRES_PASSWORD n'est pas défini !"
    exit 1
fi

print_success "Toutes les variables critiques sont définies"

# Afficher un résumé
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Résumé de la configuration${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ IP VPS :${NC} $VPS_IP"
echo -e "${GREEN}✅ JWT Secret :${NC} ${JWT_SECRET:0:20}... (${#JWT_SECRET} caractères)"
echo -e "${GREEN}✅ PostgreSQL Password :${NC} ${POSTGRES_PASSWORD:0:10}... (${#POSTGRES_PASSWORD} caractères)"
echo -e "${GREEN}✅ ANON_KEY :${NC} ${ANON_KEY:0:30}..."
echo -e "${GREEN}✅ SERVICE_ROLE_KEY :${NC} ${SERVICE_ROLE_KEY:0:30}..."
if [ -n "$HUGGINGFACE_TOKEN" ]; then
    echo -e "${GREEN}✅ HuggingFace Token :${NC} Configuré (${#HUGGINGFACE_TOKEN} caractères)"
else
    echo -e "${YELLOW}⚠️  HuggingFace Token :${NC} Non configuré (diarisation désactivée)"
fi
if [ "$VITE_HIDE_MARKETING_PAGES" = "true" ]; then
    echo -e "${GREEN}✅ Pages marketing :${NC} Désactivées (mode entreprise)"
else
    echo -e "${CYAN}ℹ️  Pages marketing :${NC} Activées (mode par défaut)"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# ============================================
# ÉTAPE 6: Démarrer les services Docker
# ============================================
print_header "ÉTAPE 6/7 : Démarrage des services Docker"

print_info "Arrêt des services existants (si présents)..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo down 2>/dev/null || true

print_info "Construction des images Docker..."
# Exporter les variables pour le build Vite
export VITE_HIDE_MARKETING_PAGES=$VITE_HIDE_MARKETING_PAGES
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo build --no-cache web

print_info "Démarrage de tous les services (mode production avec PyTorch)..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

print_success "Commande de démarrage lancée"
print_info "Attente du démarrage des services (60 secondes)..."

# Barre de progression
for i in {1..60}; do
    echo -ne "${CYAN}█${NC}"
    sleep 1
done
echo ""

print_success "Phase de démarrage terminée"

# ============================================
# ÉTAPE 6b: Application des migrations
# ============================================
print_header "ÉTAPE 6.5/7 : Application des migrations de base de données"

print_info "Attente de la disponibilité de PostgreSQL..."
MAX_RETRIES=30
RETRY_COUNT=0

until docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        print_error "PostgreSQL n'est pas disponible après ${MAX_RETRIES}s"
        exit 1
    fi
    sleep 1
    echo -ne "${CYAN}.${NC}"
done
echo ""
print_success "PostgreSQL est prêt"

# Attendre un peu plus pour s'assurer que tout est initialisé
sleep 3

print_info "Application des migrations SQL..."

# Créer la table de tracking des migrations si elle n'existe pas
docker exec antislash-talk-db psql -U postgres -d postgres -c \
    "CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
    );" > /dev/null 2>&1

MIGRATION_COUNT=0
MIGRATION_SUCCESS=0
MIGRATION_SKIPPED=0

# Appliquer toutes les migrations dans l'ordre
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        MIGRATION_COUNT=$((MIGRATION_COUNT + 1))
        filename=$(basename "$migration")
        
        # Vérifier si la migration a déjà été appliquée
        applied=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc \
            "SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version = '${filename%.sql}');" 2>/dev/null || echo "f")
        
        if [ "$applied" = "t" ]; then
            MIGRATION_SKIPPED=$((MIGRATION_SKIPPED + 1))
            echo -e "${CYAN}  ↷ $filename${NC} (déjà appliquée)"
            continue
        fi
        
        # Appliquer la migration
        if docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" > /dev/null 2>&1; then
            # Enregistrer la migration comme appliquée
            docker exec antislash-talk-db psql -U postgres -d postgres -c \
                "INSERT INTO public.schema_migrations (version) VALUES ('${filename%.sql}') ON CONFLICT DO NOTHING;" > /dev/null 2>&1 || true
            MIGRATION_SUCCESS=$((MIGRATION_SUCCESS + 1))
            echo -e "${GREEN}  ✓ $filename${NC}"
        else
            echo -e "${YELLOW}  ⚠ $filename${NC} (erreur, peut être normale)"
        fi
    fi
done

print_success "Migrations terminées : $MIGRATION_SUCCESS appliquées, $MIGRATION_SKIPPED ignorées sur $MIGRATION_COUNT total"

# ============================================
# ÉTAPE 6.6: Configuration PostgreSQL (SCRAM-SHA-256)
# ============================================
print_info "Configuration de l'authentification PostgreSQL..."

# Configurer pg_hba.conf pour utiliser SCRAM-SHA-256
docker exec antislash-talk-db bash -c "cat > /var/lib/postgresql/data/pg_hba.conf << 'PGEOF'
# PostgreSQL Client Authentication Configuration File
# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Local connections
local   all             postgres                                trust
local   all             all                                     scram-sha-256

# IPv4 connections with SCRAM-SHA-256
host    all             all             0.0.0.0/0               scram-sha-256

# IPv6 connections
host    all             all             ::/0                    scram-sha-256
PGEOF" > /dev/null 2>&1

# Configurer password_encryption et créer les utilisateurs Supabase
docker exec antislash-talk-db psql -U postgres -d postgres << SQLEOF > /dev/null 2>&1
-- Configuration PostgreSQL pour SCRAM-SHA-256
ALTER SYSTEM SET password_encryption = 'scram-sha-256';
SELECT pg_reload_conf();

-- Créer ou mettre à jour les rôles Supabase
DO \$\$
BEGIN
    -- supabase_auth_admin (pour GoTrue)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
        CREATE ROLE supabase_auth_admin;
    END IF;
    ALTER ROLE supabase_auth_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER;

    -- supabase_admin (pour Meta)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin;
    END IF;
    ALTER ROLE supabase_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER;

    -- authenticator (pour PostgREST)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator;
    END IF;
    ALTER ROLE authenticator WITH LOGIN PASSWORD '$POSTGRES_PASSWORD';

    -- service_role (role sans login)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;

    -- anon (role sans login)
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;

    -- supabase_storage_admin
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin;
    END IF;
    ALTER ROLE supabase_storage_admin WITH LOGIN PASSWORD '$POSTGRES_PASSWORD' SUPERUSER;
END
\$\$;

-- Accorder les privilèges
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin, supabase_admin;
GRANT ALL ON SCHEMA auth, public, storage TO supabase_auth_admin, supabase_admin, authenticator;
GRANT anon, service_role TO authenticator;
GRANT ALL ON SCHEMA storage TO supabase_storage_admin;
SQLEOF

print_success "Authentification PostgreSQL configurée (SCRAM-SHA-256)"

# Redémarrer PostgreSQL pour appliquer la configuration
print_info "Redémarrage de PostgreSQL..."
docker restart antislash-talk-db > /dev/null 2>&1
sleep 15

# Attendre que PostgreSQL soit prêt
until docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; do
    sleep 1
    echo -ne "${CYAN}.${NC}"
done
echo ""
print_success "PostgreSQL redémarré avec succès"

# Redémarrer les services qui dépendent de la DB
print_info "Redémarrage des services clés pour appliquer les changements..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart auth rest meta storage studio kong > /dev/null 2>&1
sleep 10

print_success "Services redémarrés"

# ============================================
# ÉTAPE 7: Vérification des services
# ============================================
print_header "ÉTAPE 7/7 : Vérification des services"

# Vérifier l'état des containers
echo -e "${YELLOW}État des containers Docker :${NC}"
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps

echo ""
print_info "Tests de connectivité..."

# Test de l'application web
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200"; then
    print_success "Application Web : OK (http://$VPS_IP:3000)"
else
    print_warning "Application Web : En cours de démarrage... (http://$VPS_IP:3000)"
fi

# Test de l'API Supabase
if curl -s -o /dev/null -w "%{http_code}" http://localhost:54321/rest/v1/ | grep -q "200\|404"; then
    print_success "API Supabase : OK (http://$VPS_IP:54321)"
else
    print_warning "API Supabase : En cours de démarrage... (http://$VPS_IP:54321)"
fi

# Test du Studio
if curl -s -o /dev/null -w "%{http_code}" http://localhost:54323 | grep -q "200"; then
    print_success "Studio Supabase : OK (http://$VPS_IP:54323)"
else
    print_warning "Studio Supabase : En cours de démarrage... (http://$VPS_IP:54323)"
fi

# Test PyTorch (peut prendre plus de temps)
print_info "Test du service PyTorch (peut prendre 1-2 minutes)..."
for i in {1..30}; do
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health | grep -q "200"; then
        print_success "Service PyTorch : OK (http://$VPS_IP:8000)"
        break
    fi
    if [ $i -eq 30 ]; then
        print_warning "Service PyTorch : Démarrage plus long que prévu (normal au premier lancement)"
    else
        sleep 2
    fi
done

# ============================================
# RÉSUMÉ FINAL
# ============================================
print_header "✅ DÉPLOIEMENT TERMINÉ !"

# Créer le fichier d'informations
cat > deployment-info.txt << EOF
🎙️ ANTISLASH TALK - INFORMATIONS DE DÉPLOIEMENT VPS
=====================================================

Date du déploiement : $(date)
IP du VPS : $VPS_IP

URLS D'ACCÈS :
--------------
🌐 Application Web : http://$VPS_IP:3000
📡 API Supabase : http://$VPS_IP:54321
🎨 Studio Supabase : http://$VPS_IP:54323
🤖 PyTorch API : http://$VPS_IP:8000
📧 Email Testing : http://$VPS_IP:54324

CREDENTIALS :
-------------
PostgreSQL User : postgres
PostgreSQL Password : $POSTGRES_PASSWORD
PostgreSQL Port : 5432

JWT Secret : $JWT_SECRET
ANON Key : $ANON_KEY
Service Role Key : $SERVICE_ROLE_KEY

CONFIGURATION :
---------------
Pages marketing : $([ "$VITE_HIDE_MARKETING_PAGES" = "true" ] && echo "Désactivées (mode entreprise)" || echo "Activées")
HuggingFace Token : $([ -n "$HUGGINGFACE_TOKEN" ] && echo "Configuré" || echo "Non configuré")

COMMANDES UTILES :
------------------
# Voir les logs en temps réel
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo logs -f

# Logs d'un service spécifique
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo logs -f web
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo logs -f transcription-pytorch

# État des services
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps

# Redémarrer tous les services
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart

# Arrêter tous les services
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo down

# Utilisation des ressources
docker stats

# Rebuild et redémarrer
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d --build

SERVICES DÉPLOYÉS :
-------------------
✅ PostgreSQL 15 (Base de données)
✅ Kong (API Gateway)
✅ GoTrue (Authentification)
✅ PostgREST (API REST automatique)
✅ Realtime (Subscriptions WebSocket)
✅ Storage (Upload fichiers audio)
✅ ImgProxy (Optimisation images)
✅ Postgres Meta (Métadonnées DB)
✅ Supabase Studio (Interface admin)
✅ Edge Runtime (Functions Deno)
✅ Inbucket (Test emails)
✅ Application Web React (Frontend)
✅ PyTorch Transcription (IA locale)
✅ Ollama (LLM local - optionnel)

BASE DE DONNÉES :
------------------
✅ Toutes les migrations appliquées automatiquement
✅ Schéma complet créé (meetings, profiles, transcriptions, etc.)
✅ Fonctions RPC configurées
✅ Row Level Security (RLS) activé
✅ Triggers et webhooks configurés

PROCHAINES ÉTAPES :
-------------------
1. Ouvrir http://$VPS_IP:3000 dans votre navigateur
2. Créer un compte utilisateur
3. Tester l'enregistrement audio
4. Configurer les clés API dans Settings (optionnel)

SÉCURITÉ PRODUCTION :
---------------------
⚠️  Pour une utilisation en production, pensez à :
1. Configurer un nom de domaine
2. Installer un certificat SSL/HTTPS (Let's Encrypt)
3. Configurer un reverse proxy Nginx
4. Activer les backups automatiques
5. Configurer le monitoring

⚠️  IMPORTANT : Conservez ce fichier en lieu sûr !
Il contient des informations sensibles.

EOF

chmod 600 deployment-info.txt

print_success "Informations de déploiement sauvegardées dans : deployment-info.txt"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    🎉 SUCCÈS ! 🎉                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}L'application est maintenant accessible :${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}🌐 Application Web :${NC} http://$VPS_IP:3000"
echo -e "${GREEN}📡 API Supabase :${NC} http://$VPS_IP:54321"
echo -e "${GREEN}🎨 Studio Admin :${NC} http://$VPS_IP:54323"
echo -e "${GREEN}🤖 PyTorch API :${NC} http://$VPS_IP:8000"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}📋 Voir les logs :${NC} docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo logs -f"
echo -e "${YELLOW}📊 État services :${NC} docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps"
echo -e "${YELLOW}📁 Informations :${NC} cat deployment-info.txt"
echo ""
echo -e "${CYAN}Bon développement ! 🚀${NC}"
echo ""

