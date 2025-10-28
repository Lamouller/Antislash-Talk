#!/bin/bash
set -e

echo "🔧 Fix Unhealthy Database"
echo "=========================="

cd ~/antislash-talk

# 1. Vérifier les logs de la DB
echo ""
echo "📋 Logs de la base de données (50 dernières lignes):"
docker logs antislash-talk-db --tail 50 2>&1 || echo "Container pas démarré"

# 2. Arrêter tous les services
echo ""
echo "🛑 Arrêt de tous les services..."
docker compose -f docker-compose.monorepo.yml down

# 3. Supprimer TOUS les volumes
echo ""
echo "🗑️  Suppression de TOUS les volumes..."
docker volume rm antislash-talk_db-data 2>/dev/null || true
docker volume rm antislash-talk_storage-data 2>/dev/null || true

# 4. Nettoyer les containers orphelins
echo ""
echo "🧹 Nettoyage des containers..."
docker system prune -f

# 5. Vérifier docker-compose.monorepo.yml
echo ""
echo "📝 Vérification de docker-compose.monorepo.yml..."
if ! docker compose -f docker-compose.monorepo.yml config > /dev/null 2>&1; then
    echo "❌ Erreur de syntaxe dans docker-compose.monorepo.yml"
    docker compose -f docker-compose.monorepo.yml config
    exit 1
fi

# 6. Démarrer UNIQUEMENT la base de données
echo ""
echo "🚀 Démarrage de la base de données seule..."
docker compose -f docker-compose.monorepo.yml up -d db

# 7. Attendre et surveiller les logs
echo ""
echo "⏳ Surveillance des logs de démarrage..."
for i in {1..60}; do
    echo "   Tentative $i/60..."
    
    # Vérifier si le container tourne
    if ! docker ps | grep -q antislash-talk-db; then
        echo "   ❌ Container arrêté, consultation des logs:"
        docker logs antislash-talk-db --tail 20
        
        if docker logs antislash-talk-db 2>&1 | grep -q "FATAL"; then
            echo ""
            echo "   🔍 Erreur FATAL détectée dans les logs"
            docker logs antislash-talk-db --tail 30
            exit 1
        fi
    fi
    
    # Vérifier la santé
    if docker exec antislash-talk-db pg_isready -U postgres 2>/dev/null; then
        echo ""
        echo "✅ Base de données prête!"
        
        # Tester une connexion complète
        if docker exec antislash-talk-db psql -U postgres -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
            echo "✅ Connexion PostgreSQL OK"
            break
        else
            echo "⚠️  pg_isready OK mais psql échoue"
        fi
    fi
    
    sleep 2
done

# 8. Afficher l'état final
echo ""
echo "📊 État de la base de données:"
docker ps | grep db || echo "❌ DB container non trouvé"
echo ""
docker inspect antislash-talk-db --format='Health: {{.State.Health.Status}}' 2>/dev/null || echo "❌ Impossible de vérifier la santé"

# 9. Si la DB est OK, démarrer les autres services
if docker exec antislash-talk-db pg_isready -U postgres >/dev/null 2>&1; then
    echo ""
    echo "🚀 Démarrage des autres services..."
    docker compose -f docker-compose.monorepo.yml up -d
    
    echo ""
    echo "✅ Tous les services démarrés !"
    docker compose -f docker-compose.monorepo.yml ps
else
    echo ""
    echo "❌ La base de données n'est pas saine"
    echo ""
    echo "📋 Logs complets:"
    docker logs antislash-talk-db
    exit 1
fi
