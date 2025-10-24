#!/bin/bash
set -e

echo "🔄 Synchronisation de /src/ vers /apps/web/src/..."
rsync -av --delete src/ apps/web/src/
echo "✅ Fichiers synchronisés"

echo ""
echo "🏗️  Reconstruction de l'application web..."
docker-compose -f docker-compose.monorepo.yml build web

echo ""
echo "🚀 Redémarrage du conteneur..."
docker-compose -f docker-compose.monorepo.yml up -d web

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║           ✅ APPLICATION MISE À JOUR AVEC SUCCÈS          ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 Votre application: http://localhost:3000"
echo ""


