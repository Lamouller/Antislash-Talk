#!/bin/bash

echo "=== DIAGNOSTIC AUTH/STORAGE ==="
echo ""

echo "1. Vérification des rôles PostgreSQL et leurs mots de passe :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolcanlogin, rolreplication 
FROM pg_roles 
WHERE rolname IN ('supabase_auth_admin', 'supabase_storage_admin', 'supabase_admin', 'authenticator', 'postgres');
"

echo ""
echo "2. Vérification des schémas :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('auth', 'storage', 'extensions');
"

echo ""
echo "3. Vérification du type auth.factor_type :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "
SELECT n.nspname, t.typname 
FROM pg_type t 
JOIN pg_namespace n ON n.oid = t.typnamespace 
WHERE n.nspname = 'auth' AND t.typname = 'factor_type';
"

echo ""
echo "4. Test de connexion avec supabase_auth_admin :"
POSTGRES_PASSWORD=$(grep "POSTGRES_PASSWORD=" .env.monorepo | cut -d'=' -f2)
docker exec antislash-talk-db psql -U supabase_auth_admin -d postgres -c "SELECT current_user, version();" 2>&1 | head -5

echo ""
echo "5. Test de connexion avec supabase_storage_admin :"
docker exec antislash-talk-db psql -U supabase_storage_admin -d postgres -c "SELECT current_user, version();" 2>&1 | head -5

echo ""
echo "6. Logs Auth (dernières erreurs) :"
docker logs antislash-talk-auth 2>&1 | grep -E "error|Error|fatal|Fatal|FATAL" | tail -10

echo ""
echo "7. Logs Storage (dernières erreurs) :"
docker logs antislash-talk-storage 2>&1 | grep -E "error|Error|fatal|Fatal|permission denied" | tail -10

echo ""
echo "8. État des services :"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "auth|storage|db"

echo ""
echo "9. Vérification de l'encryption des mots de passe :"
docker exec antislash-talk-db psql -U postgres -d postgres -c "SHOW password_encryption;"

echo ""
echo "10. Contenu de pg_hba.conf :"
docker exec antislash-talk-db cat /var/lib/postgresql/data/pg_hba.conf | grep -v "^#" | grep -v "^$"
