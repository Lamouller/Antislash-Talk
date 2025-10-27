#!/bin/bash

# 🔧 Script pour appliquer les migrations sur un déploiement existant
# Utilisez ce script si Supabase Studio affiche "project does not exist"

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
echo "║       Application des Migrations Supabase               ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo -e "${NC}\n"

# Vérifier qu'on est dans le bon répertoire
if [ ! -f "docker-compose.monorepo.yml" ]; then
    echo -e "${RED}❌ Fichier docker-compose.monorepo.yml non trouvé${NC}"
    echo "Exécutez ce script depuis le répertoire ~/antislash-talk"
    exit 1
fi

echo -e "${GREEN}✅ Répertoire du projet détecté${NC}\n"

# Vérifier que PostgreSQL tourne
echo -e "${CYAN}🔍 Vérification de PostgreSQL...${NC}"
if ! docker ps | grep -q antislash-talk-db; then
    echo -e "${RED}❌ Le container antislash-talk-db n'est pas en cours d'exécution${NC}"
    echo "Démarrez d'abord les services avec:"
    echo "  docker compose -f docker-compose.monorepo.yml up -d"
    exit 1
fi

echo -e "${GREEN}✅ PostgreSQL est en cours d'exécution${NC}\n"

# Attendre que PostgreSQL soit prêt
echo -e "${CYAN}⏳ Attente de la disponibilité de PostgreSQL...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0

until docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; do
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}❌ PostgreSQL n'est pas disponible après ${MAX_RETRIES}s${NC}"
        exit 1
    fi
    sleep 1
    echo -ne "${CYAN}.${NC}"
done
echo ""
echo -e "${GREEN}✅ PostgreSQL est prêt${NC}\n"

# Attendre un peu plus pour s'assurer que tout est initialisé
sleep 2

# Créer la table de tracking des migrations si elle n'existe pas
echo -e "${CYAN}📋 Préparation du système de migrations...${NC}"
docker exec antislash-talk-db psql -U postgres -d postgres -c \
    "CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
    );" > /dev/null 2>&1
echo -e "${GREEN}✅ Table de tracking créée${NC}\n"

# Compter les migrations
TOTAL_MIGRATIONS=$(ls -1 packages/supabase/migrations/*.sql 2>/dev/null | wc -l)
echo -e "${BLUE}📦 ${TOTAL_MIGRATIONS} migrations trouvées${NC}\n"

MIGRATION_COUNT=0
MIGRATION_SUCCESS=0
MIGRATION_SKIPPED=0
MIGRATION_ERROR=0

echo -e "${CYAN}🚀 Application des migrations...${NC}\n"

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
            MIGRATION_ERROR=$((MIGRATION_ERROR + 1))
            echo -e "${YELLOW}  ⚠ $filename${NC} (erreur, peut être normale si dépendances manquantes)"
        fi
    fi
done

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}📊 Résumé :${NC}"
echo -e "  • Total de migrations : ${TOTAL_MIGRATIONS}"
echo -e "  • ${GREEN}Appliquées avec succès : ${MIGRATION_SUCCESS}${NC}"
echo -e "  • ${CYAN}Déjà appliquées (ignorées) : ${MIGRATION_SKIPPED}${NC}"
if [ $MIGRATION_ERROR -gt 0 ]; then
    echo -e "  • ${YELLOW}Erreurs : ${MIGRATION_ERROR}${NC}"
fi
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"

# Redémarrer les services qui dépendent de la DB
echo -e "${CYAN}🔄 Redémarrage des services pour appliquer les changements...${NC}"
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart meta > /dev/null 2>&1
sleep 2
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart studio > /dev/null 2>&1
sleep 2
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo restart kong > /dev/null 2>&1
sleep 3

echo -e "${GREEN}✅ Services redémarrés${NC}\n"

# Vérification
echo -e "${CYAN}🔍 Vérification de la base de données...${NC}"
TABLE_COUNT=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc \
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

echo -e "${GREEN}✅ ${TABLE_COUNT} tables trouvées dans la base de données${NC}\n"

# Afficher quelques tables importantes
echo -e "${CYAN}📋 Tables principales créées :${NC}"
docker exec antislash-talk-db psql -U postgres -d postgres -c \
    "SELECT table_name FROM information_schema.tables 
     WHERE table_schema = 'public' 
     AND table_name IN ('meetings', 'profiles', 'transcriptions', 'participants')
     ORDER BY table_name;" 2>/dev/null || true

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║              🎉 Migrations terminées ! 🎉                  ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}Attendez 10-15 secondes puis essayez d'accéder au Studio :${NC}"
echo -e "${YELLOW}👉 http://VOTRE_IP:54323${NC}"
echo ""
echo -e "${CYAN}Le message \"project does not exist\" devrait avoir disparu !${NC}"
echo ""
echo -e "${YELLOW}Si le problème persiste, vérifiez les logs :${NC}"
echo "  docker logs antislash-talk-studio"
echo "  docker logs antislash-talk-meta"
echo "  docker logs antislash-talk-db"
echo ""

