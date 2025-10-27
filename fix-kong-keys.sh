#!/bin/bash

# 🔧 Script de correction des clés Kong
# Ce script met à jour kong.yml avec les vraies clés JWT générées

set -e

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}🔧 Correction des clés Kong pour Supabase Studio${NC}\n"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f ".env.monorepo" ]; then
    echo -e "${RED}❌ Fichier .env.monorepo non trouvé${NC}"
    echo "Exécutez ce script depuis le répertoire ~/antislash-talk"
    exit 1
fi

# Charger les clés depuis .env.monorepo
source .env.monorepo

if [ -z "$ANON_KEY" ] || [ -z "$SERVICE_ROLE_KEY" ]; then
    echo -e "${RED}❌ Les clés ANON_KEY ou SERVICE_ROLE_KEY ne sont pas définies dans .env.monorepo${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Clés chargées depuis .env.monorepo${NC}"
echo -e "${CYAN}ANON_KEY:${NC} ${ANON_KEY:0:30}..."
echo -e "${CYAN}SERVICE_ROLE_KEY:${NC} ${SERVICE_ROLE_KEY:0:30}..."
echo ""

# Backup du fichier kong.yml original
KONG_FILE="packages/supabase/kong.yml"

if [ ! -f "$KONG_FILE" ]; then
    echo -e "${RED}❌ Fichier $KONG_FILE non trouvé${NC}"
    exit 1
fi

echo -e "${YELLOW}📦 Sauvegarde de $KONG_FILE...${NC}"
cp "$KONG_FILE" "$KONG_FILE.backup.$(date +%Y%m%d_%H%M%S)"

# Remplacer les clés dans kong.yml
echo -e "${YELLOW}🔄 Mise à jour des clés dans kong.yml...${NC}"

# Utiliser sed pour remplacer les clés
sed -i.tmp "s|key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.*|key: $ANON_KEY|g" "$KONG_FILE"
sed -i.tmp "s|key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.*|key: $SERVICE_ROLE_KEY|g" "$KONG_FILE"

# Nettoyer les fichiers temporaires
rm -f "$KONG_FILE.tmp"

echo -e "${GREEN}✅ Clés mises à jour dans kong.yml${NC}\n"

# Redémarrer les services nécessaires
echo -e "${YELLOW}🔄 Redémarrage des services Supabase...${NC}"

docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart kong
sleep 3
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart meta
sleep 2
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart studio
sleep 2

echo ""
echo -e "${GREEN}✅ Services redémarrés avec succès !${NC}\n"

# Vérifier l'état des services
echo -e "${CYAN}📊 État des services :${NC}"
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo ps | grep -E "(kong|meta|studio|auth|rest)"

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 Correction terminée ! 🎉                   ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Attendez 10-15 secondes puis essayez d'accéder au Studio :${NC}"
echo -e "${YELLOW}👉 http://VOTRE_IP:54323${NC}"
echo ""
echo -e "${CYAN}Si le problème persiste, vérifiez les logs :${NC}"
echo "docker logs antislash-talk-studio"
echo "docker logs antislash-talk-kong"
echo ""

