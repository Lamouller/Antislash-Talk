#!/bin/bash
set -e

echo "🔧 Fix VPS_HOST in .env.monorepo"
echo "=================================="

cd ~/antislash-talk

# 1. Vérifier si VPS_HOST existe
echo ""
echo "📝 Vérification de .env.monorepo..."
if grep -q "^VPS_HOST=" .env.monorepo; then
    echo "✅ VPS_HOST existe déjà"
    grep "^VPS_HOST=" .env.monorepo
else
    echo "❌ VPS_HOST manquant, ajout..."
    echo "VPS_HOST=37.59.118.101" >> .env.monorepo
fi

# 2. S'assurer que API_EXTERNAL_URL utilise VPS_HOST
echo ""
echo "📝 Vérification de API_EXTERNAL_URL..."
if ! grep -q "^API_EXTERNAL_URL=https://" .env.monorepo; then
    echo "❌ API_EXTERNAL_URL incorrect, correction..."
    sed -i 's|^API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://37.59.118.101:8443|' .env.monorepo || \
    (grep -v "^API_EXTERNAL_URL=" .env.monorepo > .env.monorepo.tmp && \
     echo "API_EXTERNAL_URL=https://37.59.118.101:8443" >> .env.monorepo.tmp && \
     mv .env.monorepo.tmp .env.monorepo)
fi

# 3. Afficher toutes les variables importantes
echo ""
echo "📋 Variables dans .env.monorepo :"
echo "================================"
grep -E "^(VPS_HOST|API_EXTERNAL_URL|VITE_SUPABASE_URL|VITE_OLLAMA_URL|ANON_KEY)=" .env.monorepo

echo ""
echo "✅ Configuration mise à jour !"
echo ""
echo "🚀 Maintenant, relancez le build avec:"
echo "   ./fix-build-and-env.sh"
