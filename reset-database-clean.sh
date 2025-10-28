#!/bin/bash
set -e

echo "🔄 Reset Database to Clean State"
echo "=================================="

cd ~/antislash-talk

echo ""
echo "⚠️  Ce script va:"
echo "   1. Sauvegarder vos utilisateurs actuels"
echo "   2. Réinitialiser complètement la base de données"
echo "   3. Recréer les tables avec les bonnes migrations"
echo "   4. Restaurer vos utilisateurs"
echo ""
read -p "Continuer? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Annulé"
    exit 1
fi

# 1. Sauvegarder les utilisateurs
echo ""
echo "💾 Sauvegarde des utilisateurs..."
docker exec antislash-talk-db psql -U postgres -d postgres -c "\COPY (SELECT id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data FROM auth.users) TO '/tmp/users_backup.csv' CSV HEADER;"

# 2. Arrêter les services
echo ""
echo "🛑 Arrêt des services..."
docker compose -f docker-compose.monorepo.yml stop db

# 3. Supprimer le volume de la base de données
echo ""
echo "🗑️  Suppression du volume de la base..."
docker volume rm antislash-talk_db-data 2>/dev/null || true

# 4. Redémarrer la base de données
echo ""
echo "🚀 Redémarrage de la base de données..."
docker compose -f docker-compose.monorepo.yml up -d db

# 5. Attendre que la base soit prête
echo ""
echo "⏳ Attente de la base de données..."
for i in {1..30}; do
    if docker exec antislash-talk-db pg_isready -U postgres >/dev/null 2>&1; then
        echo "✅ Base de données prête"
        break
    fi
    echo "   Tentative $i/30..."
    sleep 2
done

# 6. Appliquer TOUTES les migrations
echo ""
echo "📦 Application des migrations..."
for migration in packages/supabase/migrations/*.sql; do
    if [ -f "$migration" ]; then
        echo "   Applying $(basename $migration)..."
        docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration" || echo "   ⚠️  Warning: $(basename $migration) failed (may be normal)"
    fi
done

# 7. Extraire les variables depuis .env.monorepo
echo ""
echo "📝 Configuration de la base..."
POSTGRES_PASSWORD=$(grep "^POSTGRES_PASSWORD=" .env.monorepo | cut -d= -f2)
JWT_SECRET=$(grep "^JWT_SECRET=" .env.monorepo | cut -d= -f2)
ANON_KEY=$(grep "^ANON_KEY=" .env.monorepo | cut -d= -f2)
SERVICE_ROLE_KEY=$(grep "^SERVICE_ROLE_KEY=" .env.monorepo | cut -d= -f2)

# 8. Configuration PostgreSQL de base
docker exec antislash-talk-db psql -U postgres -d postgres << SQL
-- Créer les extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Créer les rôles s'ils n'existent pas
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN NOINHERIT;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
    END IF;
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
        CREATE ROLE supabase_storage_admin NOLOGIN NOINHERIT;
    END IF;
END
\$\$;

-- Donner tous les droits
GRANT ALL ON DATABASE postgres TO postgres, authenticated, service_role;
GRANT ALL ON SCHEMA public, auth, storage TO postgres, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public, auth, storage TO postgres, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public, auth, storage TO postgres, authenticated, service_role;

-- Politiques RLS ultra-permissives pour storage.objects
ALTER TABLE IF EXISTS storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON storage.objects;
CREATE POLICY "service_role_all" ON storage.objects
FOR ALL TO service_role, postgres, supabase_storage_admin
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all" ON storage.objects;
CREATE POLICY "authenticated_all" ON storage.objects
FOR ALL TO authenticated
USING (true) WITH CHECK (true);

-- Même chose pour storage.buckets
ALTER TABLE IF EXISTS storage.buckets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_buckets" ON storage.buckets;
CREATE POLICY "service_role_all_buckets" ON storage.buckets
FOR ALL TO service_role, postgres, supabase_storage_admin
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_buckets" ON storage.buckets;
CREATE POLICY "authenticated_all_buckets" ON storage.buckets
FOR ALL TO authenticated
USING (true) WITH CHECK (true);
SQL

# 9. Restaurer les utilisateurs si la sauvegarde existe
if docker exec antislash-talk-db test -f /tmp/users_backup.csv; then
    echo ""
    echo "📥 Restauration des utilisateurs..."
    docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Désactiver temporairement les triggers
ALTER TABLE auth.users DISABLE TRIGGER ALL;

-- Restaurer les utilisateurs
\COPY auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data) FROM '/tmp/users_backup.csv' CSV HEADER;

-- Réactiver les triggers
ALTER TABLE auth.users ENABLE TRIGGER ALL;

-- Créer les profils correspondants
INSERT INTO public.profiles (id, email, display_name, created_at, updated_at, preferred_llm)
SELECT 
    id,
    email,
    COALESCE(raw_user_meta_data->>'display_name', email),
    created_at,
    NOW(),
    'gpt-4'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();

SELECT COUNT(*) as "Utilisateurs restaurés" FROM auth.users;
SELECT COUNT(*) as "Profils créés" FROM public.profiles;
SQL
    docker exec antislash-talk-db rm /tmp/users_backup.csv
fi

# 10. Redémarrer tous les services
echo ""
echo "🔄 Redémarrage de tous les services..."
docker compose -f docker-compose.monorepo.yml restart

echo ""
echo "✅ Reset terminé !"
echo ""
echo "📊 État de la base:"
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
SELECT 
    (SELECT COUNT(*) FROM auth.users) as users,
    (SELECT COUNT(*) FROM public.profiles) as profiles,
    (SELECT COUNT(*) FROM storage.buckets) as buckets;
SQL

echo ""
echo "🎉 Base de données réinitialisée avec succès !"
