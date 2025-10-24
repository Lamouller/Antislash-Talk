#!/bin/bash
# Script pour appliquer toutes les migrations Supabase dans l'ordre
set -e

echo "🔄 Application des migrations Supabase..."

# Attendre que la base de données soit prête
echo "⏳ Attente de la disponibilité de PostgreSQL..."
until docker exec antislash-talk-db pg_isready -U postgres > /dev/null 2>&1; do
  sleep 1
done
echo "✅ PostgreSQL est prêt"

# Attendre 2 secondes supplémentaires pour s'assurer que tout est initialisé
sleep 2

# Appliquer toutes les migrations dans l'ordre
echo "📦 Application des migrations..."
for migration in packages/supabase/migrations/*.sql; do
  filename=$(basename "$migration")
  echo "  → Applying: $filename"
  
  # Vérifier si la migration a déjà été appliquée
  applied=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc \
    "SELECT EXISTS(SELECT 1 FROM public.schema_migrations WHERE version = '${filename%.sql}');" 2>/dev/null || echo "f")
  
  if [ "$applied" = "t" ]; then
    echo "    ✓ Déjà appliquée, ignorée"
    continue
  fi
  
  # Appliquer la migration
  if docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" > /dev/null 2>&1; then
    # Enregistrer la migration comme appliquée
    docker exec antislash-talk-db psql -U postgres -d postgres -c \
      "INSERT INTO public.schema_migrations (version) VALUES ('${filename%.sql}') ON CONFLICT DO NOTHING;" > /dev/null 2>&1 || true
    echo "    ✅ Appliquée avec succès"
  else
    echo "    ⚠️  Erreur lors de l'application (peut être normale si dépendances manquantes)"
  fi
done

echo ""
echo "✅ Migrations terminées !"


