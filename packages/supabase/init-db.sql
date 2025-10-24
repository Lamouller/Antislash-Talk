-- ============================================
-- Antislash Talk - PostgreSQL Initialization
-- ============================================
-- Ce script crée tous les utilisateurs et schémas requis par Supabase
-- Il s'exécute automatiquement au premier démarrage de PostgreSQL

-- Créer les schémas nécessaires
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE SCHEMA IF NOT EXISTS _realtime;
CREATE SCHEMA IF NOT EXISTS realtime;
CREATE SCHEMA IF NOT EXISTS graphql_public;

-- ============================================
-- UTILISATEURS SUPABASE
-- ============================================

-- 1. supabase_auth_admin (pour GoTrue)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
    GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_auth_admin;
    GRANT ALL ON SCHEMA auth, public TO supabase_auth_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth, public GRANT ALL ON TABLES TO supabase_auth_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA auth, public GRANT ALL ON SEQUENCES TO supabase_auth_admin;
  END IF;
END
$$;

-- 2. supabase_storage_admin (pour Storage API)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_storage_admin') THEN
    CREATE ROLE supabase_storage_admin LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
    GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_storage_admin;
    GRANT ALL ON SCHEMA storage, public TO supabase_storage_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA storage, public GRANT ALL ON TABLES TO supabase_storage_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA storage, public GRANT ALL ON SEQUENCES TO supabase_storage_admin;
  END IF;
END
$$;

-- 3. supabase_admin (pour Realtime)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
    GRANT ALL PRIVILEGES ON DATABASE postgres TO supabase_admin;
    GRANT ALL ON SCHEMA _realtime, realtime, public TO supabase_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA _realtime, realtime, public GRANT ALL ON TABLES TO supabase_admin;
    ALTER DEFAULT PRIVILEGES IN SCHEMA _realtime, realtime, public GRANT ALL ON SEQUENCES TO supabase_admin;
  END IF;
END
$$;

-- 4. authenticator (pour PostgREST)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'your-super-secret-and-long-postgres-password';
    GRANT ALL PRIVILEGES ON DATABASE postgres TO authenticator;
  END IF;
END
$$;

-- ============================================
-- RÔLES JWT (pour authentification)
-- ============================================

-- 5. anon (utilisateur anonyme)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
    GRANT USAGE ON SCHEMA public, storage, graphql_public TO anon;
  END IF;
END
$$;

-- 6. authenticated (utilisateur authentifié)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
    GRANT USAGE ON SCHEMA public, storage, graphql_public TO authenticated;
  END IF;
END
$$;

-- 7. service_role (rôle service pour Edge Functions)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT ALL ON SCHEMA public, storage, graphql_public TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
  END IF;
END
$$;

-- ============================================
-- PERMISSIONS
-- ============================================

-- Autoriser authenticator à utiliser les rôles JWT
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;

-- Permissions sur le schéma public
GRANT ALL ON SCHEMA public TO postgres WITH GRANT OPTION;
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ============================================
-- EXTENSIONS
-- ============================================

-- Installer les extensions après avoir créé tous les rôles
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" SCHEMA extensions;

-- ============================================
-- TABLE DE TRACKING DES MIGRATIONS
-- ============================================

-- Créer une table pour tracker les migrations appliquées
CREATE TABLE IF NOT EXISTS public.schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.schema_migrations OWNER TO postgres;
GRANT SELECT ON public.schema_migrations TO anon, authenticated, service_role;

-- ============================================
-- CONFIRMATION
-- ============================================

\echo '✅ PostgreSQL initialization completed successfully'
\echo '📋 Created users:'
\echo '   - supabase_auth_admin (for GoTrue)'
\echo '   - supabase_storage_admin (for Storage API)'
\echo '   - supabase_admin (for Realtime)'
\echo '   - authenticator (for PostgREST)'
\echo '   - anon, authenticated, service_role (JWT roles)'
\echo '📊 Created schema_migrations table for tracking'

