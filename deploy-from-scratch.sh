#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     🚀 DÉPLOIEMENT COMPLET DEPUIS ZÉRO - ANTISLASH TALK      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# 1. Arrêter et supprimer TOUT
echo "🗑️  Étape 1/8: Suppression complète de l'environnement existant..."
docker-compose -f docker-compose.monorepo.yml down -v --remove-orphans
echo "✅ Environnement nettoyé"
echo ""

# 2. Vérifier les clés JWT
echo "🔐 Étape 2/8: Vérification des clés JWT..."
if ! grep -q "^JWT_SECRET=" .env.monorepo || [ -z "$(grep "^JWT_SECRET=" .env.monorepo | cut -d'=' -f2)" ]; then
    echo "⚠️  JWT_SECRET manquant, génération..."
    JWT_SECRET=$(openssl rand -base64 32 | tr -d '=\n')
    sed -i.bak "s/^JWT_SECRET=.*/JWT_SECRET=$JWT_SECRET/" .env.monorepo || echo "JWT_SECRET=$JWT_SECRET" >> .env.monorepo
fi
cp .env.monorepo .env
echo "✅ Clés JWT prêtes"
echo ""

# 3. Démarrer la base de données seule
echo "🗄️  Étape 3/8: Démarrage de PostgreSQL..."
docker-compose -f docker-compose.monorepo.yml up -d db
echo "⏳ Attente de la disponibilité de PostgreSQL (30s)..."
sleep 30
until docker exec antislash-talk-db pg_isready -U postgres -d postgres > /dev/null 2>&1; do
  echo "   Attente..."
  sleep 2
done
echo "✅ PostgreSQL prêt"
echo ""

# 4. Appliquer le schéma Auth officiel de Supabase
echo "🔧 Étape 4/8: Application du schéma Auth complet de Supabase..."
docker exec antislash-talk-db psql -U postgres -d postgres <<'EOSQL'
-- Créer le schéma auth s'il n'existe pas
CREATE SCHEMA IF NOT EXISTS auth;

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pgjwt;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Créer les types ENUM
DO $$ BEGIN
    CREATE TYPE auth.factor_type AS ENUM ('totp', 'webauthn', 'phone');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE auth.factor_status AS ENUM ('unverified', 'verified');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE auth.aal_level AS ENUM ('aal1', 'aal2', 'aal3');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE auth.code_challenge_method AS ENUM ('s256', 'plain');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Créer les tables auth si elles n'existent pas
CREATE TABLE IF NOT EXISTS auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamptz,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL,
    CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text NOT NULL,
    code_challenge_method auth.code_challenge_method NOT NULL,
    code_challenge text NOT NULL,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamptz,
    updated_at timestamptz,
    authentication_method text NOT NULL,
    CONSTRAINT flow_state_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.identities (
    id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    email text,
    CONSTRAINT identities_pkey PRIMARY KEY (id, provider)
);

CREATE TABLE IF NOT EXISTS auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT instances_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL,
    CONSTRAINT amr_id_pk PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamptz NOT NULL,
    verified_at timestamptz,
    ip_address inet NOT NULL,
    otp_code text,
    CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamptz NOT NULL,
    updated_at timestamptz NOT NULL,
    secret text,
    phone text,
    CONSTRAINT mfa_factors_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    instance_id uuid,
    id bigserial NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamptz,
    updated_at timestamptz,
    parent character varying(255),
    session_id uuid,
    CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT saml_providers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    from_ip_address inet,
    created_at timestamptz,
    updated_at timestamptz,
    flow_state_id uuid,
    CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.schema_migrations (
    version character varying(255) NOT NULL,
    CONSTRAINT schema_migrations_pkey PRIMARY KEY (version)
);

CREATE TABLE IF NOT EXISTS auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamptz,
    updated_at timestamptz,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamptz,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    CONSTRAINT sessions_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT sso_domains_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamptz,
    updated_at timestamptz,
    CONSTRAINT sso_providers_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamptz,
    invited_at timestamptz,
    confirmation_token character varying(255),
    confirmation_sent_at timestamptz,
    recovery_token character varying(255),
    recovery_sent_at timestamptz,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamptz,
    last_sign_in_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamptz,
    updated_at timestamptz,
    phone text,
    phone_confirmed_at timestamptz,
    phone_change text DEFAULT ''::text,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamptz,
    confirmed_at timestamptz,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamptz,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamptz,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamptz,
    CONSTRAINT users_pkey PRIMARY KEY (id)
);

\echo '✅ Schéma Auth créé'
EOSQL
echo "✅ Schéma Auth complet appliqué"
echo ""

# 5. Démarrer tous les services Supabase
echo "🚀 Étape 5/8: Démarrage de tous les services Supabase..."
docker-compose -f docker-compose.monorepo.yml up -d auth rest storage realtime meta kong studio
echo "⏳ Attente que les services soient prêts (20s)..."
sleep 20
echo "✅ Services Supabase démarrés"
echo ""

# 6. Appliquer les migrations de l'application
echo "📦 Étape 6/8: Application des migrations de l'application..."
bash packages/supabase/apply-migrations.sh
echo "✅ Migrations appliquées"
echo ""

# 7. Créer les buckets et le tenant Realtime
echo "🪣 Étape 7/8: Création des buckets et configuration Realtime..."
JWT_SECRET=$(grep "^JWT_SECRET=" .env | cut -d'=' -f2)
docker exec antislash-talk-db psql -U postgres -d postgres -v jwt_secret="$JWT_SECRET" <<'EOSQL'
-- Créer les buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types, created_at, updated_at)
VALUES 
  ('meetingrecordings', 'meetingrecordings', true, 524288000, 
   '{"audio/webm","audio/mp3","audio/wav","audio/mpeg","audio/ogg","audio/mp4"}', 
   NOW(), NOW()),
  ('meeting-audio', 'meeting-audio', true, 524288000, 
   '{"audio/webm","audio/mp3","audio/wav","audio/mpeg","audio/ogg","audio/mp4"}', 
   NOW(), NOW()),
  ('avatars', 'avatars', true, 5242880, 
   '{"image/jpeg","image/png","image/webp","image/gif","image/svg+xml"}', 
   NOW(), NOW()),
  ('transcriptions', 'transcriptions', false, 10485760, 
   '{"application/json","text/plain"}', 
   NOW(), NOW()),
  ('reports', 'reports', false, 52428800, 
   '{"application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","text/markdown"}', 
   NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Créer le tenant Realtime
DELETE FROM _realtime.tenants WHERE external_id = 'realtime';
INSERT INTO _realtime.tenants (
    id, name, external_id, jwt_secret,
    max_concurrent_users, max_events_per_second,
    max_bytes_per_second, max_channels_per_client,
    max_joins_per_second, inserted_at, updated_at
) VALUES (
    gen_random_uuid(), 'realtime', 'realtime', :'jwt_secret',
    200, 100, 100000, 100, 500, NOW(), NOW()
);

\echo '✅ Buckets et Realtime configurés'
EOSQL
echo "✅ Buckets et Realtime configurés"
echo ""

# 8. Créer l'utilisateur admin
echo "👤 Étape 8/8: Création de l'utilisateur admin..."
SERVICE_KEY=$(grep "^SERVICE_ROLE_KEY=" .env | cut -d'=' -f2)
sleep 3
USER_RESPONSE=$(curl -s -X POST 'http://localhost:54321/auth/v1/admin/users' \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@antislash-talk.local","password":"Admin123456!","email_confirm":true,"user_metadata":{"full_name":"Admin Test"}}')

if echo "$USER_RESPONSE" | grep -q '"id"'; then
    echo "✅ Utilisateur admin créé via API"
    USER_ID=$(echo "$USER_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    
    # Créer le profil
    docker exec antislash-talk-db psql -U postgres -d postgres <<EOSQL2
INSERT INTO public.profiles (id, preferred_transcription_provider, preferred_transcription_model, preferred_llm, preferred_llm_model, auto_transcribe_after_recording, preferred_language, created_at, updated_at)
VALUES ('$USER_ID', 'browser', 'Xenova/whisper-base', 'openai', 'gpt-4', false, 'fr', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOSQL2
    echo "✅ Profil utilisateur créé"
else
    echo "⚠️  Création via API échouée, création directe en DB..."
    docker exec antislash-talk-db psql -U postgres -d postgres <<'EOSQL3'
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated', 'authenticated',
    'admin@antislash-talk.local',
    crypt('Admin123456!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Admin Test"}'::jsonb,
    NOW(), NOW(), '', '', '', ''
)
ON CONFLICT (email) DO NOTHING
RETURNING id;
EOSQL3
    
    USER_ID=$(docker exec antislash-talk-db psql -U postgres -d postgres -t -A -c "SELECT id FROM auth.users WHERE email = 'admin@antislash-talk.local' LIMIT 1;")
    if [ ! -z "$USER_ID" ]; then
        docker exec antislash-talk-db psql -U postgres -d postgres <<EOSQL4
INSERT INTO public.profiles (id, preferred_transcription_provider, preferred_transcription_model, preferred_llm, preferred_llm_model, auto_transcribe_after_recording, preferred_language, created_at, updated_at)
VALUES ('$USER_ID', 'browser', 'Xenova/whisper-base', 'openai', 'gpt-4', false, 'fr', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOSQL4
        echo "✅ Utilisateur et profil créés en DB"
    fi
fi
echo ""

# 9. Redémarrer tous les services
echo "🔄 Redémarrage final de tous les services..."
docker-compose -f docker-compose.monorepo.yml restart auth rest storage realtime meta studio
sleep 5

# 10. Démarrer l'application web
echo "🌐 Démarrage de l'application web..."
docker-compose -f docker-compose.monorepo.yml up -d web
echo ""

# 11. Vérification finale
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ DÉPLOIEMENT COMPLET TERMINÉ !                 ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "📊 Vérification finale:"
docker exec antislash-talk-db psql -U postgres -d postgres -t -c "SELECT '  👤 Utilisateurs: ' || COUNT(*) FROM auth.users;"
docker exec antislash-talk-db psql -U postgres -d postgres -t -c "SELECT '  🪣 Buckets: ' || COUNT(*) FROM storage.buckets;"
docker exec antislash-talk-db psql -U postgres -d postgres -t -c "SELECT '  📊 Tables publiques: ' || COUNT(*) FROM pg_tables WHERE schemaname = 'public';"
echo ""
echo "🔐 Identifiants:"
echo "   Email:    admin@antislash-talk.local"
echo "   Password: Admin123456!"
echo ""
echo "🌐 URLs:"
echo "   • Application Web:     http://localhost:3000"
echo "   • Supabase Studio:     http://localhost:54323"
echo "   • API Kong:            http://localhost:54321"
echo ""
echo "🎯 TESTEZ MAINTENANT:"
echo "   1. Studio: http://localhost:54323"
echo "      → Authentication: 1 utilisateur"
echo "      → Storage: 5 buckets"
echo ""
echo "   2. Application: http://localhost:3000"
echo "      → Navigation privée"
echo "      → Connectez-vous avec les identifiants ci-dessus"
echo ""


