#!/bin/bash

echo "🔄 Attente de la fin du rebuild..."
echo ""

# Attendre que le rebuild soit terminé (vérifier toutes les 10 secondes)
while true; do
  if docker images | grep -q "antislash-talk-web.*seconds ago\|antislash-talk-web.*minute ago"; then
    echo "✅ Rebuild terminé!"
    break
  fi
  echo "⏳ Rebuild en cours... (vérification dans 10s)"
  sleep 10
done

echo ""
echo "🚀 Redémarrage du service web..."
docker-compose -f docker-compose.monorepo.yml up -d web

echo ""
echo "⏳ Attente que le service soit prêt (30s)..."
sleep 30

echo ""
echo "📊 Status final:"
docker ps --filter "name=web" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ TOUT EST PRÊT!"
echo ""
echo "🎯 Actions à faire:"
echo "   1. Ouvrir: http://localhost:3000/tabs/settings"
echo "   2. Faire: ⌘ + Shift + R (forcer le refresh)"
echo "   3. Scroll jusqu'à 'Recording Behavior'"
echo "   4. Activer le toggle '🚀 Live Streaming Transcription'"
echo "   5. Cliquer 'Save Settings'"
echo ""

