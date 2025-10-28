#!/bin/bash
set -e

echo "🔧 Fix studio.htpasswd file"
echo "============================="

cd ~/antislash-talk

# 1. Arrêter le container studio
echo ""
echo "🛑 Arrêt du container studio..."
docker compose -f docker-compose.monorepo.yml stop studio 2>/dev/null || true

# 2. Supprimer le fichier/dossier problématique
echo ""
echo "🗑️  Nettoyage du fichier htpasswd..."
rm -rf studio.htpasswd 2>/dev/null || true

# 3. Extraire le mot de passe depuis .env.monorepo
STUDIO_PASSWORD=$(grep "^STUDIO_PASSWORD=" .env.monorepo | cut -d= -f2)

if [ -z "$STUDIO_PASSWORD" ]; then
    echo "⚠️  STUDIO_PASSWORD non trouvé, génération d'un nouveau..."
    STUDIO_PASSWORD=$(openssl rand -base64 16 | tr -d "=+/" | cut -c1-12)
    echo "STUDIO_PASSWORD=${STUDIO_PASSWORD}" >> .env.monorepo
fi

# 4. Créer le fichier htpasswd avec le bon mot de passe
echo ""
echo "📝 Création du fichier htpasswd..."
echo "   Username: antislash"
echo "   Password: ${STUDIO_PASSWORD}"

# Créer le fichier avec htpasswd ou openssl
if command -v htpasswd &> /dev/null; then
    htpasswd -bc studio.htpasswd antislash "${STUDIO_PASSWORD}"
else
    # Utiliser openssl comme fallback
    echo "antislash:$(openssl passwd -apr1 ${STUDIO_PASSWORD})" > studio.htpasswd
fi

# 5. Vérifier que le fichier existe
if [ ! -f "studio.htpasswd" ]; then
    echo "❌ Erreur: Impossible de créer studio.htpasswd"
    exit 1
fi

echo "✅ Fichier studio.htpasswd créé"
ls -lh studio.htpasswd

# 6. Redémarrer le container studio
echo ""
echo "🚀 Redémarrage du container studio..."
docker compose -f docker-compose.monorepo.yml up -d studio

echo ""
echo "✅ Correction terminée !"
echo ""
echo "📋 Identifiants Supabase Studio:"
echo "   URL: https://$(grep '^VPS_HOST=' .env.monorepo | cut -d= -f2 || echo 'localhost'):8444"
echo "   Username: antislash"
echo "   Password: ${STUDIO_PASSWORD}"
