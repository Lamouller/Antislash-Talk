#!/bin/bash
# Script pour diagnostiquer le problème Ollama

echo "🔍 Diagnostic Ollama..."
echo ""

echo "1️⃣ État du container Ollama:"
docker ps -a | grep ollama

echo ""
echo "2️⃣ Logs Ollama (dernières 30 lignes):"
docker logs antislash-talk-ollama --tail 30 2>&1 || echo "Container pas trouvé ou pas démarré"

echo ""
echo "3️⃣ Tentative de démarrage d'Ollama:"
docker compose -f ~/antislash-talk/docker-compose.monorepo.yml up -d ollama

echo ""
echo "4️⃣ Vérification après démarrage:"
docker ps | grep ollama

echo ""
echo "5️⃣ Test de l'API Ollama:"
sleep 5
curl -f http://localhost:11434/api/tags 2>&1 || echo "API pas accessible"

echo ""
echo "✅ Diagnostic terminé"

