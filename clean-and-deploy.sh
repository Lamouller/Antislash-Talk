#!/bin/bash

# Script de nettoyage complet et redéploiement
# Usage: ./clean-and-deploy.sh

set -e

echo "🧹 NETTOYAGE COMPLET ET REDÉPLOIEMENT"
echo "====================================="
echo ""
echo "⚠️  ATTENTION : Ce script va supprimer TOUTES les données Docker !"
echo "   - Tous les containers"
echo "   - Tous les volumes (base de données comprise)"
echo "   - Toutes les images"
echo "   - Tous les réseaux"
echo ""
read -p "Continuer ? (oui/non) : " CONFIRM

if [ "$CONFIRM" != "oui" ]; then
    echo "❌ Annulé par l'utilisateur"
    exit 0
fi

echo ""
echo "📋 Étape 1/5 : Arrêt de tous les containers..."
docker compose -f docker-compose.monorepo.yml down -v --remove-orphans 2>/dev/null || true

echo ""
echo "📋 Étape 2/5 : Suppression de tous les containers..."
docker ps -aq | xargs -r docker rm -f 2>/dev/null || true

echo ""
echo "📋 Étape 3/5 : Suppression de tous les volumes..."
docker volume ls -q | xargs -r docker volume rm -f 2>/dev/null || true

echo ""
echo "📋 Étape 4/5 : Suppression de toutes les images..."
docker images -q | xargs -r docker rmi -f 2>/dev/null || true

echo ""
echo "📋 Étape 5/5 : Nettoyage complet du système Docker..."
docker system prune -af --volumes 2>/dev/null || true

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "📥 Mise à jour du dépôt Git..."
git fetch origin
git reset --hard origin/main
git pull origin main

echo ""
echo "🚀 Lancement du déploiement propre..."
echo ""

# Rendre le script exécutable
chmod +x deploy-vps-final.sh

# Lancer le déploiement
./deploy-vps-final.sh

echo ""
echo "🎉 Déploiement terminé !"

