#!/bin/bash
# Script pour rebuilder le web avec les bonnes variables d'environnement

echo "🔧 Rebuild du service web avec les variables d'environnement..."

cd ~/antislash-talk

# 1. Extraire ANON_KEY de .env.monorepo
echo "📋 Extraction des variables..."
ANON_KEY=$(grep "^ANON_KEY=" .env.monorepo | cut -d= -f2)

if [ -z "$ANON_KEY" ]; then
    echo "❌ ANON_KEY introuvable dans .env.monorepo"
    exit 1
fi

echo "✅ ANON_KEY trouvé: ${ANON_KEY:0:20}..."

# 2. Créer apps/web/.env
echo "📝 Création de apps/web/.env..."
cat > apps/web/.env << EOF
VITE_SUPABASE_URL=https://37.59.118.101:8443
VITE_SUPABASE_ANON_KEY=${ANON_KEY}
VITE_HIDE_MARKETING_PAGES=true
VITE_OLLAMA_URL=https://37.59.118.101:8445
EOF

echo "✅ apps/web/.env créé:"
cat apps/web/.env

# 3. Export des variables pour le build
echo ""
echo "📤 Export des variables d'environnement..."
export VITE_SUPABASE_URL="https://37.59.118.101:8443"
export VITE_SUPABASE_ANON_KEY="${ANON_KEY}"
export VITE_HIDE_MARKETING_PAGES="true"
export VITE_OLLAMA_URL="https://37.59.118.101:8445"

echo "✅ Variables exportées"

# 4. Arrêter le container web
echo ""
echo "⏸️  Arrêt du container web..."
docker compose -f docker-compose.monorepo.yml stop web

# 5. Rebuild avec les args
echo ""
echo "🔨 Rebuild de l'image web (cela peut prendre 5-10 minutes)..."
docker compose -f docker-compose.monorepo.yml build \
  --build-arg VITE_SUPABASE_URL="https://37.59.118.101:8443" \
  --build-arg VITE_SUPABASE_ANON_KEY="${ANON_KEY}" \
  --build-arg VITE_HIDE_MARKETING_PAGES="true" \
  --build-arg VITE_OLLAMA_URL="https://37.59.118.101:8445" \
  web

if [ $? -ne 0 ]; then
    echo "❌ Erreur lors du build"
    exit 1
fi

# 6. Redémarrer le container
echo ""
echo "🚀 Redémarrage du container web..."
docker compose -f docker-compose.monorepo.yml up -d web

# 7. Vérifier que le container tourne
echo ""
echo "✅ Vérification..."
docker ps | grep antislash-talk-web

echo ""
echo "✅ TERMINÉ !"
echo ""
echo "🌐 Ouvre l'app dans ton navigateur et fais Ctrl+Shift+R (ou Cmd+Shift+R)"
echo "   pour forcer le rechargement du cache."
