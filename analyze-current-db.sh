#!/bin/bash

echo "=== ANALYSE COMPLÈTE DE LA BASE DE DONNÉES ==="
echo ""

echo "1. SCHÉMAS EXISTANTS :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY schema_name;"

echo ""
echo "2. TABLES PAR SCHÉMA :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename;"

echo ""
echo "3. RÔLES ET PERMISSIONS :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication, rolbypassrls
FROM pg_roles 
WHERE rolname NOT LIKE 'pg_%'
ORDER BY rolname;"

echo ""
echo "4. ÉTAT RLS PAR TABLE :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname IN ('auth', 'storage', 'public')
ORDER BY schemaname, tablename;"

echo ""
echo "5. POLICIES RLS :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schemaname, tablename, policyname, cmd, permissive 
FROM pg_policies 
WHERE schemaname IN ('auth', 'storage', 'public')
ORDER BY schemaname, tablename, policyname;"

echo ""
echo "6. TYPES DANS AUTH :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT n.nspname, t.typname, t.typtype
FROM pg_type t 
JOIN pg_namespace n ON n.oid = t.typnamespace 
WHERE n.nspname = 'auth' AND t.typtype IN ('e', 'c')
ORDER BY t.typname;"

echo ""
echo "7. CONTENU DES TABLES PRINCIPALES :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'storage.buckets', COUNT(*) FROM storage.buckets
UNION ALL
SELECT 'storage.objects', COUNT(*) FROM storage.objects
UNION ALL
SELECT 'public.profiles', COUNT(*) FROM public.profiles
UNION ALL
SELECT 'public.meetings', COUNT(*) FROM public.meetings;"

echo ""
echo "8. EXTENSIONS INSTALLÉES :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT extname, extnamespace::regnamespace 
FROM pg_extension 
WHERE extname NOT IN ('plpgsql')
ORDER BY extname;"

echo ""
echo "9. CONFIGURATION ACTUELLE :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT name, setting 
FROM pg_settings 
WHERE name IN ('password_encryption', 'shared_preload_libraries');"

echo ""
echo "10. ERREURS RÉCENTES DANS LES LOGS :"
docker logs antislash-talk-db 2>&1 | grep -E "ERROR|FATAL" | tail -10
