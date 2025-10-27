#!/bin/bash

# Script de réparation simplifié
set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

cd /home/debian/antislash-talk

print_info "Réparation rapide des services..."

# 1. Arrêter tout sauf PostgreSQL
print_info "Arrêt des services..."
docker compose -f docker-compose.monorepo.yml stop auth storage rest realtime

# 2. Attendre un peu
sleep 5

# 3. Redémarrer avec force-recreate
print_info "Redémarrage des services..."
docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d --force-recreate auth storage rest realtime

# 4. Attendre le démarrage
print_info "Attente du démarrage (40s)..."
sleep 40

# 5. Vérifier l'état
print_info "État des services :"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(auth|storage|rest|realtime)"

# 6. Vérifier les tables
print_info "Vérification des tables..."
docker exec antislash-talk-db psql -U postgres -c "
SELECT 
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') 
    THEN 'auth.users existe ✅' 
    ELSE 'auth.users manquante ❌' 
    END as auth_status,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') 
    THEN 'storage.buckets existe ✅' 
    ELSE 'storage.buckets manquante ❌' 
    END as storage_status;"

print_success "Réparation terminée !"
print_info "Si les services redémarrent encore, vérifiez les logs :"
print_info "docker logs antislash-talk-auth"
print_info "docker logs antislash-talk-storage"
