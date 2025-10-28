#!/bin/bash
set -e

echo "🔧 Fix Build and Environment Variables"
echo "========================================"

cd ~/antislash-talk

# 1. Nettoyer le cache pnpm dans le container
echo ""
echo "📦 Nettoyage du cache pnpm..."
docker compose -f docker-compose.monorepo.yml exec -T web sh -c "rm -rf /root/.pnpm-store /root/.local/share/pnpm/store /app/node_modules/.pnpm 2>/dev/null || true" || true

# 2. Arrêter et supprimer complètement l'image
echo ""
echo "🗑️  Suppression de l'ancienne image..."
docker compose -f docker-compose.monorepo.yml stop web
docker compose -f docker-compose.monorepo.yml rm -f web
docker rmi antislash-talk-web 2>/dev/null || true

# 3. Extraire les variables nécessaires
echo ""
echo "📝 Extraction des variables..."
ANON_KEY=$(grep "^ANON_KEY=" .env.monorepo | cut -d= -f2)
VPS_HOST=$(grep "^VPS_HOST=" .env.monorepo | cut -d= -f2 || echo "37.59.118.101")

echo "ANON_KEY: ${ANON_KEY:0:20}..."
echo "VPS_HOST: $VPS_HOST"

# 4. Build avec toutes les variables en argument ET résolution npm alternative
echo ""
echo "🔨 Build du frontend avec variables explicites..."
docker compose --env-file .env.monorepo -f docker-compose.monorepo.yml build \
  --no-cache \
  --build-arg VITE_SUPABASE_URL="https://${VPS_HOST}:8443" \
  --build-arg VITE_SUPABASE_ANON_KEY="${ANON_KEY}" \
  --build-arg VITE_HIDE_MARKETING_PAGES="true" \
  --build-arg VITE_OLLAMA_URL="https://${VPS_HOST}:8445" \
  --build-arg NPM_CONFIG_REGISTRY="https://registry.npmjs.org/" \
  web

# 5. Redémarrer
echo ""
echo "🚀 Redémarrage du container..."
docker compose --env-file .env.monorepo -f docker-compose.monorepo.yml up -d web

# 6. Attendre que le container soit prêt
echo ""
echo "⏳ Attente du démarrage..."
sleep 5

# 7. Vérifier que les variables sont dans le build
echo ""
echo "🔍 Vérification des variables dans le code compilé..."
echo ""
echo "Recherche de 8443 (SUPABASE_URL):"
docker exec antislash-talk-web grep -o "8443" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -3 || echo "❌ Non trouvé"

echo ""
echo "Recherche de 8445 (OLLAMA_URL):"
docker exec antislash-talk-web grep -o "8445" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -3 || echo "❌ Non trouvé"

echo ""
echo "✅ Script terminé !"
echo ""
echo "Si les URLs ne sont toujours pas trouvées, le problème vient du Dockerfile ou de docker-compose"
