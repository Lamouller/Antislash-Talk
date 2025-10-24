#!/bin/bash
# ============================================
# Démarrer TOUS les services (avec PyTorch et Ollama)
# ============================================

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║      🚀 DÉMARRAGE COMPLET - TOUS LES SERVICES                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

cd /Users/trystanlamouller/Github_Lamouller/Antislash-Talk

echo "📦 Démarrage de tous les services (Supabase + Web + PyTorch + Ollama)..."
echo ""

# Démarrer TOUS les services y compris ceux avec profils
docker-compose -f docker-compose.monorepo.yml --profile pytorch --profile ollama up -d

echo ""
echo "⏳ Attente du démarrage complet (30 secondes)..."
sleep 30

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                  ✅ TOUS LES SERVICES DÉMARRÉS                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

echo "📊 État des services:"
docker-compose -f docker-compose.monorepo.yml --profile pytorch --profile ollama ps | grep -E "NAME|antislash-talk"

echo ""
echo "🌐 URLs disponibles:"
echo "   • Web App:          http://localhost:3000"
echo "   • Supabase Studio:  http://localhost:54323"
echo "   • API Kong:         http://localhost:54321"
echo "   • PyTorch API:      http://localhost:8000"
echo "   • Ollama API:       http://localhost:11434"
echo ""
echo "🔐 Login: admin@antislash-talk.local / Admin123456!"
echo ""
echo "💡 Pour arrêter:"
echo "   docker-compose -f docker-compose.monorepo.yml --profile pytorch --profile ollama down"
echo ""


