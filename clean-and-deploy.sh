#!/bin/bash
set -e

echo "🧹 Clean Everything and Deploy Fresh"
echo "====================================="

cd ~/antislash-talk

echo ""
echo "⚠️  Ce script va:"
echo "   1. Arrêter TOUS les services Docker"
echo "   2. Supprimer TOUS les volumes (base de données, storage)"
echo "   3. Supprimer TOUS les containers"
echo "   4. Supprimer les fichiers de configuration (.env, htpasswd)"
echo "   5. Relancer un déploiement COMPLET from scratch"
echo ""
echo "❌ TOUTES LES DONNÉES SERONT PERDUES (utilisateurs, enregistrements, etc.)"
echo ""
read -p "Êtes-vous SÛR de vouloir continuer ? (tapez 'OUI' en majuscules) : " CONFIRM

if [ "$CONFIRM" != "OUI" ]; then
    echo "❌ Annulé"
    exit 0
fi

echo ""
echo "🛑 Étape 1/6 : Arrêt de tous les services..."
docker compose -f docker-compose.monorepo.yml down -v --remove-orphans 2>/dev/null || true
docker compose -f docker-compose.yml down -v --remove-orphans 2>/dev/null || true

echo ""
echo "🗑️  Étape 2/6 : Suppression de tous les volumes..."
docker volume rm antislash-talk_db-data 2>/dev/null || true
docker volume rm antislash-talk_storage-data 2>/dev/null || true
docker volume prune -f

echo ""
echo "🧹 Étape 3/6 : Suppression des containers orphelins..."
docker container prune -f

echo ""
echo "📁 Étape 4/6 : Suppression des fichiers de configuration..."
rm -f .env.monorepo
rm -f .env
rm -f apps/web/.env
rm -f studio.htpasswd
rm -f jwt-keys.env
rm -f generate-jwt-keys.mjs
rm -f package.json.backup

echo ""
echo "🐳 Étape 5/6 : Nettoyage Docker complet..."
docker system prune -f

echo ""
echo "✅ Nettoyage terminé !"
echo ""
echo "🚀 Étape 6/6 : Lancement du déploiement complet..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Lancer le script de déploiement
./deploy-vps-final.sh
