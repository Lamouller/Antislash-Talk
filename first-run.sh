#!/bin/bash
# 🎙️ Antislash Talk - Premier démarrage
# Script pour configurer et démarrer le monorepo pour la première fois

set -e

echo "╔════════════════════════════════════════════╗"
echo "║   🎙️  Antislash Talk v2.0 Monorepo       ║"
echo "║   Premier démarrage automatique           ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js non trouvé. Installez Node.js 18+ depuis nodejs.org"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Vérifier/Installer pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installation de pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm --version)"

# Vérifier Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker non trouvé. Installez Docker Desktop depuis docker.com"
    exit 1
fi
echo "✅ Docker $(docker --version)"

# Créer .env.monorepo si absent
if [ ! -f .env.monorepo ]; then
    echo ""
    echo "🔧 Création de .env.monorepo..."
    cp env.monorepo.example .env.monorepo
    
    # Générer des mots de passe aléatoires
    if command -v openssl &> /dev/null; then
        POSTGRES_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
        JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-48)
        
        sed -i.bak "s/your-super-secret-and-long-postgres-password/$POSTGRES_PASS/g" .env.monorepo
        sed -i.bak "s/your-super-secret-jwt-token-with-at-least-32-characters-long/$JWT_SECRET/g" .env.monorepo
        rm -f .env.monorepo.bak
        
        echo "✅ Mots de passe générés automatiquement"
    else
        echo "⚠️  OpenSSL non trouvé, utilisez les valeurs par défaut (à changer!)"
    fi
fi

# Installer les dépendances
echo ""
echo "📦 Installation des dépendances (peut prendre 2-3 minutes)..."
pnpm install

# Rendre les scripts exécutables
chmod +x packages/scripts/*.mjs 2>/dev/null || true

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   ✅ Configuration terminée !              ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "🚀 Démarrage de la stack Docker..."
echo "   (Cela peut prendre 30-60 secondes...)"
echo ""

# Démarrer Docker Compose
docker-compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d

echo ""
echo "⏳ Attente du démarrage des services..."
sleep 15

# Vérifier l'état
echo ""
echo "📊 État des services:"
docker-compose -f docker-compose.monorepo.yml ps

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║   🎉 Antislash Talk est en ligne !        ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "🌐 Accédez à vos services:"
echo "   ┌─────────────────────────────────────────┐"
echo "   │ Application:      http://localhost:3000    │"
echo "   │ Supabase Studio:  http://localhost:54323   │"
echo "   │ Email Testing:    http://localhost:54324   │"
echo "   │ API Gateway:      http://localhost:54321   │"
echo "   └─────────────────────────────────────────┘"
echo ""
echo "📚 Documentation:"
echo "   • Guide complet:     README.MONOREPO.md"
echo "   • Démarrage rapide:  QUICK_START.md"
echo "   • Récapitulatif:     MONOREPO_SUMMARY.md"
echo ""
echo "🛠️  Commandes utiles:"
echo "   • Voir logs:         pnpm docker:logs"
echo "   • Arrêter:           pnpm docker:down"
echo "   • Redémarrer:        pnpm docker:rebuild"
echo "   • Dev (web only):    pnpm dev"
echo ""
echo "💡 Ouvrez maintenant http://localhost:3000 dans votre navigateur !"
echo ""
