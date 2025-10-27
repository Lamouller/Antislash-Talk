#!/bin/bash

# Script de correction rapide pour l'erreur de syntaxe des policies
set -e

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info "Correction de la syntaxe des policies RLS..."

# Créer un script SQL corrigé
cat > /tmp/fix-policies.sql << 'EOF'
-- Correction des policies RLS
DO $$
BEGIN
    -- Policies pour auth.users
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        DROP POLICY IF EXISTS "Users can view own profile" ON auth.users;
        CREATE POLICY "Users can view own profile" 
        ON auth.users FOR SELECT 
        USING (auth.uid() = id);
        RAISE NOTICE 'Policy créée pour auth.users';
    END IF;
    
    -- Policies pour storage.buckets
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'buckets') THEN
        DROP POLICY IF EXISTS "Authenticated users can view buckets" ON storage.buckets;
        CREATE POLICY "Authenticated users can view buckets" 
        ON storage.buckets FOR SELECT 
        TO authenticated
        USING (true);
        RAISE NOTICE 'Policy créée pour storage.buckets';
    END IF;
    
    -- Policies pour storage.objects
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        DROP POLICY IF EXISTS "Users can upload to recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can view own recordings" ON storage.objects;
        DROP POLICY IF EXISTS "Users can delete own recordings" ON storage.objects;
        
        CREATE POLICY "Users can upload to recordings" 
        ON storage.objects FOR INSERT 
        TO authenticated
        WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY "Users can view own recordings" 
        ON storage.objects FOR SELECT 
        TO authenticated
        USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

        CREATE POLICY "Users can delete own recordings" 
        ON storage.objects FOR DELETE 
        TO authenticated
        USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
        
        RAISE NOTICE 'Policies créées pour storage.objects';
    END IF;
END
$$;
EOF

# Exécuter le script SQL
if docker exec -i antislash-talk-db psql -U postgres -d postgres < /tmp/fix-policies.sql; then
    print_success "Policies RLS corrigées avec succès"
else
    print_info "Les tables n'existent peut-être pas encore, ce qui est normal au début du déploiement"
fi

# Nettoyer
rm -f /tmp/fix-policies.sql

print_info "Vous pouvez maintenant continuer le déploiement"
