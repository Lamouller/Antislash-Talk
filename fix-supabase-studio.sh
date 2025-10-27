#!/bin/bash

# 🔧 Script de correction complète de Supabase Studio
# Corrige les erreurs 500 et les problèmes de communication entre services

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BLUE='\033[0;34m'
NC='\033[0m'

clear
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       Correction de Supabase Studio (Erreurs 500)       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f ".env.monorepo" ]; then
    echo -e "${RED}❌ Fichier .env.monorepo non trouvé${NC}"
    echo "Exécutez ce script depuis le répertoire ~/antislash-talk"
    exit 1
fi

echo -e "${GREEN}✅ Répertoire du projet détecté${NC}\n"

# Charger les variables d'environnement
source .env.monorepo

echo -e "${CYAN}🔍 Diagnostic des services...${NC}\n"

# 1. Vérifier que tous les services tournent
echo -e "${YELLOW}1. Vérification des containers Docker${NC}"
REQUIRED_SERVICES=("db" "kong" "meta" "studio" "rest" "auth")
ALL_RUNNING=true

for service in "${REQUIRED_SERVICES[@]}"; do
    if docker ps --format '{{.Names}}' | grep -q "antislash-talk-$service"; then
        echo -e "  ${GREEN}✓${NC} antislash-talk-$service"
    else
        echo -e "  ${RED}✗${NC} antislash-talk-$service ${RED}(non démarré)${NC}"
        ALL_RUNNING=false
    fi
done
echo ""

if [ "$ALL_RUNNING" = false ]; then
    echo -e "${YELLOW}Démarrage des services manquants...${NC}"
    docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d
    sleep 10
fi

# 2. Vérifier PostgreSQL
echo -e "${YELLOW}2. Vérification de PostgreSQL${NC}"
if docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL est accessible"
else
    echo -e "  ${RED}✗${NC} PostgreSQL n'est pas accessible"
    exit 1
fi
echo ""

# 3. Vérifier les permissions PostgreSQL
echo -e "${YELLOW}3. Configuration des permissions PostgreSQL${NC}"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL' > /dev/null 2>&1
-- Créer les rôles s'ils n'existent pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
        CREATE ROLE supabase_admin WITH LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
        CREATE ROLE authenticator WITH LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
    END IF;
END
$$;

-- Accorder les permissions
GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin;
GRANT USAGE ON SCHEMA auth, public, storage TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth, public, storage TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth, public, storage TO supabase_admin;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA auth, public, storage TO supabase_admin;

-- Permissions pour authenticator
GRANT anon, service_role TO authenticator;
GRANT USAGE ON SCHEMA auth, public, storage TO authenticator;

-- Permissions par défaut futures
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO supabase_admin;
SQL

echo -e "  ${GREEN}✓${NC} Permissions PostgreSQL configurées"
echo ""

# 4. Vérifier les clés JWT
echo -e "${YELLOW}4. Vérification des clés JWT${NC}"
if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ] || [ -z "$JWT_SECRET" ]; then
    echo -e "  ${RED}✗${NC} Clés JWT manquantes dans .env.monorepo"
    echo -e "${YELLOW}Génération de nouvelles clés...${NC}"
    
    JWT_SECRET=$(openssl rand -base64 45 | tr -d "=+/" | cut -c1-45)
    KEYS_OUTPUT=$(node generate-supabase-keys.js "$JWT_SECRET")
    ANON_KEY=$(echo "$KEYS_OUTPUT" | grep "ANON_KEY=" | cut -d'=' -f2)
    SERVICE_ROLE_KEY=$(echo "$KEYS_OUTPUT" | grep "SERVICE_ROLE_KEY=" | cut -d'=' -f2)
    
    # Mettre à jour .env.monorepo
    sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|" .env.monorepo
    sed -i.bak "s|^ANON_KEY=.*|ANON_KEY=$ANON_KEY|" .env.monorepo
    sed -i.bak "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY|" .env.monorepo
    
    source .env.monorepo
    echo -e "  ${GREEN}✓${NC} Nouvelles clés JWT générées"
else
    echo -e "  ${GREEN}✓${NC} Clés JWT présentes"
fi
echo ""

# 5. Mettre à jour Kong avec les bonnes clés
echo -e "${YELLOW}5. Mise à jour des clés dans Kong${NC}"
KONG_FILE="packages/supabase/kong.yml"

if [ -f "$KONG_FILE" ]; then
    # Backup
    cp "$KONG_FILE" "$KONG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    
    # Remplacer les clés (supporte les anciennes et nouvelles clés)
    sed -i.tmp "s|key: eyJhbGci[^[:space:]]*|key: $ANON_KEY|g" "$KONG_FILE"
    
    # S'assurer que SERVICE_ROLE_KEY est aussi mis à jour
    # Chercher et remplacer toutes les anciennes clés service_role
    awk -v newkey="$SERVICE_ROLE_KEY" '
    /username: service_role/ {print; getline; print "      key: " newkey; next}
    /key: eyJhbGci.*service_role/ {print "      key: " newkey; next}
    {print}
    ' "$KONG_FILE" > "$KONG_FILE.new" && mv "$KONG_FILE.new" "$KONG_FILE"
    
    rm -f "$KONG_FILE.tmp"
    echo -e "  ${GREEN}✓${NC} Kong mis à jour avec les nouvelles clés"
else
    echo -e "  ${YELLOW}⚠${NC} Fichier kong.yml non trouvé"
fi
echo ""

# 6. Redémarrer les services dans le bon ordre
echo -e "${YELLOW}6. Redémarrage des services${NC}"
echo -e "  ${CYAN}→${NC} Arrêt des services..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo stop kong meta studio rest auth > /dev/null 2>&1

sleep 2

echo -e "  ${CYAN}→${NC} Démarrage de Kong..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d kong
sleep 5

echo -e "  ${CYAN}→${NC} Démarrage de Rest..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d rest
sleep 3

echo -e "  ${CYAN}→${NC} Démarrage de Auth..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d auth
sleep 3

echo -e "  ${CYAN}→${NC} Démarrage de Meta..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d meta
sleep 5

echo -e "  ${CYAN}→${NC} Démarrage de Studio..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d studio
sleep 5

echo -e "  ${GREEN}✓${NC} Tous les services redémarrés"
echo ""

# 7. Tests de connectivité
echo -e "${YELLOW}7. Tests de connectivité${NC}"

# Test Meta
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/health 2>/dev/null | grep -q "200"; then
    echo -e "  ${GREEN}✓${NC} Meta répond correctement"
else
    echo -e "  ${YELLOW}⚠${NC} Meta ne répond pas encore (normal, peut prendre 30s)"
fi

# Test Kong
if curl -s -o /dev/null -w "%{http_code}" http://localhost:54321/rest/v1/ 2>/dev/null | grep -q "200\|404"; then
    echo -e "  ${GREEN}✓${NC} Kong répond correctement"
else
    echo -e "  ${YELLOW}⚠${NC} Kong ne répond pas encore"
fi

# Test Studio
if curl -s -o /dev/null -w "%{http_code}" http://localhost:54323 2>/dev/null | grep -q "200"; then
    echo -e "  ${GREEN}✓${NC} Studio répond correctement"
else
    echo -e "  ${YELLOW}⚠${NC} Studio ne répond pas encore"
fi
echo ""

# 8. Afficher les logs récents
echo -e "${YELLOW}8. Logs récents des services (erreurs uniquement)${NC}"
echo -e "${CYAN}Logs Meta:${NC}"
docker logs antislash-talk-meta --tail 5 2>&1 | grep -i "error" || echo "  Pas d'erreur"

echo -e "\n${CYAN}Logs Studio:${NC}"
docker logs antislash-talk-studio --tail 5 2>&1 | grep -i "error" || echo "  Pas d'erreur"

echo -e "\n${CYAN}Logs Kong:${NC}"
docker logs antislash-talk-kong --tail 5 2>&1 | grep -i "error" || echo "  Pas d'erreur"
echo ""

# 9. Résumé de la configuration
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${CYAN}📋 Configuration actuelle :${NC}"
echo -e "  JWT Secret: ${JWT_SECRET:0:20}..."
echo -e "  ANON Key: ${ANON_KEY:0:30}..."
echo -e "  SERVICE_ROLE Key: ${SERVICE_ROLE_KEY:0:30}..."
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 Correction terminée ! 🎉                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}⏰ Attendez 30-60 secondes que tous les services se stabilisent${NC}"
echo -e "${CYAN}Puis essayez d'accéder au Studio :${NC}"
echo -e "${YELLOW}👉 http://VOTRE_IP:54323${NC}"
echo ""
echo -e "${CYAN}Si le problème persiste, consultez les logs complets :${NC}"
echo "  docker logs antislash-talk-studio -f"
echo "  docker logs antislash-talk-meta -f"
echo "  docker logs antislash-talk-kong -f"
echo ""
echo -e "${YELLOW}Pour voir l'état de tous les services :${NC}"
echo "  docker compose -f docker-compose.monorepo.yml ps"
echo ""

