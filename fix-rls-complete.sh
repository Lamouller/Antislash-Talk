#!/bin/bash

echo "=== CORRECTION DÉFINITIVE DU PROBLÈME RLS ==="
echo ""
echo "Le problème : RLS est activé mais sans policies = tout est bloqué"
echo ""

# 1. Désactiver RLS temporairement pour créer les données
echo "1. Désactivation temporaire de RLS pour insertion..."
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQLEOF'
-- Désactiver RLS temporairement
ALTER TABLE storage.buckets DISABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users DISABLE ROW LEVEL SECURITY;

-- Créer les buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
    ('recordings', 'recordings', false),
    ('exports', 'exports', false),
    ('speakers', 'speakers', false)
ON CONFLICT (id) DO NOTHING;

-- Créer l'utilisateur avec le bon hash
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@antislash-talk.fr',
    '$2a$10$2wHVTKMkQZaEmCOk7VYrWOEJP9qL1Y.EKZV6iM7Q3lfq9TcPMNmzG',  -- Hash pour AntiSlash2024!
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"name":"Admin User"}'::jsonb,
    NOW(),
    NOW()
)
ON CONFLICT (email) WHERE is_sso_user = false DO NOTHING;

-- Vérifier
SELECT COUNT(*) as bucket_count FROM storage.buckets;
SELECT COUNT(*) as user_count FROM auth.users;
SQLEOF

echo ""
echo "2. Création des policies de base pour Auth..."
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQLEOF'
-- Policies pour auth.users (lecture seule pour les utilisateurs)
CREATE POLICY "Users can view own profile" 
ON auth.users FOR SELECT 
USING (auth.uid() = id);

-- Policies pour storage.buckets (lecture pour tous les authentifiés)
CREATE POLICY "Authenticated users can view buckets" 
ON storage.buckets FOR SELECT 
TO authenticated
USING (true);

-- Policies pour storage.objects
CREATE POLICY "Users can upload to their folder" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own files" 
ON storage.objects FOR SELECT 
TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own files" 
ON storage.objects FOR DELETE 
TO authenticated
USING (auth.uid()::text = (storage.foldername(name))[1]);
SQLEOF

echo ""
echo "3. Réactivation de RLS avec les policies..."
docker exec antislash-talk-db psql -U postgres -d postgres << 'SQLEOF'
-- Réactiver RLS maintenant qu'on a des policies
ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Vérifier que les données sont toujours là
SELECT 'Buckets créés:' as info, COUNT(*) as count FROM storage.buckets
UNION ALL
SELECT 'Utilisateurs créés:', COUNT(*) FROM auth.users;
SQLEOF

echo ""
echo "4. Redémarrage des services pour appliquer..."
docker restart antislash-talk-rest antislash-talk-auth antislash-talk-storage

echo ""
echo "✅ RLS corrigé ! Les données devraient maintenant apparaître dans Studio."
echo ""
echo "📝 Compte créé : admin@antislash-talk.fr / AntiSlash2024!"
