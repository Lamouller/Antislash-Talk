#!/bin/bash
# Script d'initialisation de la base de données avec JWT_SECRET
set -e

echo "🔧 Initialisation de la base de données..."

# Attendre que PostgreSQL soit prêt
until pg_isready -U postgres; do
  echo "⏳ Attente de PostgreSQL..."
  sleep 1
done

echo "✅ PostgreSQL est prêt"

# Lire le JWT_SECRET depuis l'environnement ou utiliser une valeur par défaut
JWT_SECRET="${JWT_SECRET:-your-super-secret-jwt-token-with-at-least-32-characters-long}"

echo "🔐 Configuration du JWT_SECRET..."

# Exécuter le script d'initialisation avec le JWT_SECRET
PGPASSWORD="${POSTGRES_PASSWORD:-your-super-secret-and-long-postgres-password}" psql -U postgres -d postgres -v jwt_secret="$JWT_SECRET" <<'EOF'
-- Définir le JWT_SECRET pour la session
SET app.jwt_secret = :'jwt_secret';

-- Exécuter le script d'initialisation complète
\i /docker-entrypoint-initdb.d/init-complete.sql
EOF

echo "✅ Initialisation terminée avec succès"


