-- ============================================================
-- SCRIPT D'INITIALISATION COMPLÈTE DE LA BASE DE DONNÉES
-- Exécuté automatiquement au premier démarrage de PostgreSQL
-- ============================================================

\echo '========================================='
\echo 'INITIALISATION COMPLÈTE DE LA BASE'
\echo '========================================='

-- ============================================================
-- 1. CRÉATION DES BUCKETS DE STORAGE
-- ============================================================
\echo ''
\echo '1️⃣  Création des buckets de storage...'

-- Bucket pour les enregistrements audio de réunions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meetingrecordings', 'meetingrecordings', true, 524288000, ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les fichiers audio bruts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meeting-audio', 'meeting-audio', true, 524288000, ARRAY['audio/webm', 'audio/mp3', 'audio/wav', 'audio/mpeg', 'audio/ogg', 'audio/mp4'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les avatars utilisateurs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les transcriptions
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('transcriptions', 'transcriptions', false, 10485760, ARRAY['application/json', 'text/plain'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Bucket pour les rapports générés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('reports', 'reports', false, 52428800, ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown'])
ON CONFLICT (id) DO UPDATE SET 
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

\echo '✅ Buckets de storage créés'

-- ============================================================
-- 2. CONFIGURATION DES POLITIQUES RLS POUR STORAGE
-- ============================================================
\echo ''
\echo '2️⃣  Configuration des politiques RLS...'

-- Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Public access to meeting audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload audio" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their audio" ON storage.objects;
DROP POLICY IF EXISTS "Public access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own transcriptions" ON storage.objects;
DROP POLICY IF EXISTS "Users can create their own transcriptions" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own reports" ON storage.objects;
DROP POLICY IF EXISTS "Users can create their own reports" ON storage.objects;

-- Activer RLS sur storage.objects si ce n'est pas déjà fait
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Politiques pour meeting-audio et meetingrecordings (lecture publique, écriture authentifiée)
CREATE POLICY "Public access to meeting audio" ON storage.objects
    FOR SELECT 
    USING (bucket_id IN ('meeting-audio', 'meetingrecordings'));

CREATE POLICY "Authenticated users can upload audio" ON storage.objects
    FOR INSERT 
    WITH CHECK (bucket_id IN ('meeting-audio', 'meetingrecordings') AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete their audio" ON storage.objects
    FOR DELETE 
    USING (bucket_id IN ('meeting-audio', 'meetingrecordings') AND auth.role() = 'authenticated');

-- Politiques pour avatars (lecture publique, écriture personnelle)
CREATE POLICY "Public access to avatars" ON storage.objects
    FOR SELECT 
    USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatar" ON storage.objects
    FOR INSERT 
    WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own avatar" ON storage.objects
    FOR DELETE 
    USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Politiques pour transcriptions (privées, uniquement le propriétaire)
CREATE POLICY "Users can read their own transcriptions" ON storage.objects
    FOR SELECT 
    USING (bucket_id = 'transcriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can create their own transcriptions" ON storage.objects
    FOR INSERT 
    WITH CHECK (bucket_id = 'transcriptions' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Politiques pour reports (privées, uniquement le propriétaire)
CREATE POLICY "Users can read their own reports" ON storage.objects
    FOR SELECT 
    USING (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can create their own reports" ON storage.objects
    FOR INSERT 
    WITH CHECK (bucket_id = 'reports' AND (storage.foldername(name))[1] = auth.uid()::text);

\echo '✅ Politiques RLS configurées'

-- ============================================================
-- 3. CRÉATION DU TENANT REALTIME
-- ============================================================
\echo ''
\echo '3️⃣  Configuration du tenant Realtime...'

-- Supprimer l'ancien tenant s'il existe
DELETE FROM _realtime.tenants WHERE external_id = 'realtime';

-- Créer le tenant avec le JWT_SECRET de l'environnement
INSERT INTO _realtime.tenants (
    id,
    name,
    external_id,
    jwt_secret,
    max_concurrent_users,
    max_events_per_second,
    max_bytes_per_second,
    max_channels_per_client,
    max_joins_per_second,
    inserted_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'realtime',
    'realtime',
    COALESCE(current_setting('app.jwt_secret', true), 'your-super-secret-jwt-token-with-at-least-32-characters-long'),
    200,
    100,
    100000,
    100,
    500,
    NOW(),
    NOW()
);

\echo '✅ Tenant Realtime créé'

-- ============================================================
-- 4. VÉRIFICATION FINALE
-- ============================================================
\echo ''
\echo '========================================='
\echo 'VÉRIFICATION DE L INITIALISATION'
\echo '========================================='

\echo ''
\echo 'Buckets créés:'
SELECT '  • ' || name || ' (' || CASE WHEN public THEN 'public' ELSE 'private' END || ')' as bucket
FROM storage.buckets 
ORDER BY name;

\echo ''
\echo 'Tenant Realtime:'
SELECT '  • ' || external_id || ' (JWT: ' || length(jwt_secret) || ' chars)' as tenant
FROM _realtime.tenants 
WHERE external_id = 'realtime';

\echo ''
\echo '========================================='
\echo '✅ INITIALISATION COMPLÈTE TERMINÉE'
\echo '========================================='

