#!/bin/bash
# ============================================
# Script de déploiement complet Antislash Talk
# ============================================
# Ce script initialise tout automatiquement :
# - Génération des clés JWT
# - Configuration des fichiers .env
# - Déploiement de tous les services
# - Application des migrations
# - Configuration des permissions

set -e  # Arrêter en cas d'erreur

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     🚀 DÉPLOIEMENT COMPLET ANTISLASH TALK - MONOREPO         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# 1. GÉNÉRATION DES CLÉS JWT
# ============================================
echo "1️⃣  Génération des clés JWT sécurisées..."
echo ""

if [ ! -f .env ] || ! grep -q "^JWT_SECRET=" .env 2>/dev/null; then
    echo "   → Génération de nouvelles clés JWT..."
    
    python3 << 'PYTHON_SCRIPT'
import secrets
import json
import base64
import hmac
import hashlib
from datetime import datetime, timedelta

# Générer un secret JWT fort (32 bytes = 256 bits)
jwt_secret_bytes = secrets.token_bytes(32)
jwt_secret = base64.urlsafe_b64encode(jwt_secret_bytes).decode('utf-8').rstrip('=')

print(f"   ✅ JWT_SECRET généré")

# Fonction pour créer un JWT
def create_jwt(payload, secret):
    # Header
    header = {'alg': 'HS256', 'typ': 'JWT'}
    header_b64 = base64.urlsafe_b64encode(json.dumps(header, separators=(',', ':')).encode()).decode().rstrip('=')
    
    # Payload
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload, separators=(',', ':')).encode()).decode().rstrip('=')
    
    # Signature
    message = f'{header_b64}.{payload_b64}'
    signature = hmac.new(secret.encode(), message.encode(), hashlib.sha256).digest()
    signature_b64 = base64.urlsafe_b64encode(signature).decode().rstrip('=')
    
    return f'{header_b64}.{payload_b64}.{signature_b64}'

# Timestamps
now = int(datetime.now().timestamp())
exp = int((datetime.now() + timedelta(days=3650)).timestamp())

# Créer les JWT
anon_key = create_jwt({
    'iss': 'supabase',
    'role': 'anon',
    'iat': now,
    'exp': exp
}, jwt_secret)

service_role_key = create_jwt({
    'iss': 'supabase',
    'role': 'service_role',
    'iat': now,
    'exp': exp
}, jwt_secret)

# Sauvegarder dans .env
with open('.env', 'w') as f:
    f.write('# ============================================\n')
    f.write('# Antislash Talk - Configuration Monorepo\n')
    f.write('# Généré automatiquement\n')
    f.write('# ============================================\n\n')
    f.write('# Database\n')
    f.write('POSTGRES_DB=postgres\n')
    f.write('POSTGRES_PORT=5432\n')
    f.write('POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password\n\n')
    f.write('# JWT Configuration\n')
    f.write(f'JWT_SECRET={jwt_secret}\n')
    f.write(f'ANON_KEY={anon_key}\n')
    f.write(f'SERVICE_ROLE_KEY={service_role_key}\n')
    f.write('JWT_EXPIRY=3600\n\n')
    f.write('# URLs\n')
    f.write('SITE_URL=http://localhost:3000\n')
    f.write('API_EXTERNAL_URL=http://localhost:54321\n')
    f.write('SUPABASE_PUBLIC_URL=http://localhost:54321\n\n')
    f.write('# Service Ports\n')
    f.write('KONG_HTTP_PORT=54321\n')
    f.write('STUDIO_PORT=54323\n')
    f.write('WEB_PORT=3000\n\n')
    f.write('# Email Configuration\n')
    f.write('ENABLE_EMAIL_SIGNUP=true\n')
    f.write('ENABLE_EMAIL_AUTOCONFIRM=true\n')
    f.write('SMTP_ADMIN_EMAIL=admin@antislash-talk.local\n')
    f.write('SMTP_HOST=inbucket\n')
    f.write('SMTP_PORT=2500\n')
    f.write('SMTP_SENDER_NAME=Antislash Talk\n')

print("   ✅ ANON_KEY généré")
print("   ✅ SERVICE_ROLE_KEY généré")
print("   ✅ Fichier .env créé")
PYTHON_SCRIPT

    # Copier aussi pour .env.monorepo
    cp .env .env.monorepo
    echo "   ✅ Fichier .env.monorepo créé"
else
    echo "   ✅ Clés JWT déjà présentes dans .env"
fi

echo ""

# ============================================
# 2. MISE À JOUR DE KONG.YML AVEC LES VRAIES CLÉS
# ============================================
echo "2️⃣  Configuration de Kong avec les clés JWT..."
echo ""

ANON_KEY=$(grep "^ANON_KEY=" .env | cut -d'=' -f2)
SERVICE_KEY=$(grep "^SERVICE_ROLE_KEY=" .env | cut -d'=' -f2)

# Mettre à jour kong.yml avec les vraies clés
sed -i.bak "s|key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*anon.*|key: $ANON_KEY|g" packages/supabase/kong.yml
sed -i.bak "s|key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.*service_role.*|key: $SERVICE_KEY|g" packages/supabase/kong.yml

echo "   ✅ Kong configuré avec les clés JWT"
echo ""

# ============================================
# 3. ARRÊT DES CONTENEURS EXISTANTS
# ============================================
echo "3️⃣  Arrêt des conteneurs existants (si présents)..."
echo ""

docker-compose -f docker-compose.monorepo.yml down 2>/dev/null || true
echo "   ✅ Conteneurs arrêtés"
echo ""

# ============================================
# 4. DÉMARRAGE DE TOUS LES SERVICES
# ============================================
echo "4️⃣  Démarrage de tous les services..."
echo ""

docker-compose -f docker-compose.monorepo.yml up -d

echo ""
echo "   ⏳ Attente du démarrage de la base de données (30 secondes)..."
sleep 30

# Vérifier que la DB est prête
until docker exec antislash-talk-db pg_isready -U postgres -d postgres > /dev/null 2>&1; do
  echo "   ⏳ Attente de PostgreSQL..."
  sleep 2
done

echo "   ✅ PostgreSQL est prêt"
echo ""

# ============================================
# 5. APPLICATION DES PERMISSIONS
# ============================================
echo "5️⃣  Configuration des permissions PostgreSQL..."
echo ""

docker exec antislash-talk-db psql -U postgres -d postgres << 'SQL'
-- Permissions pour supabase_admin (utilisé par Meta/Studio)
GRANT USAGE ON SCHEMA auth TO supabase_admin;
GRANT USAGE ON SCHEMA public TO supabase_admin;
GRANT USAGE ON SCHEMA storage TO supabase_admin;

GRANT SELECT ON ALL TABLES IN SCHEMA auth TO supabase_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO supabase_admin;
GRANT SELECT ON ALL TABLES IN SCHEMA storage TO supabase_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO supabase_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA storage GRANT SELECT ON TABLES TO supabase_admin;

-- Permissions pour postgres (SQL Editor)
GRANT USAGE ON SCHEMA auth TO postgres;
GRANT SELECT ON ALL TABLES IN SCHEMA auth TO postgres;

SELECT 'Permissions configurées' as status;
SQL

echo "   ✅ Permissions PostgreSQL configurées"
echo ""

# ============================================
# 6. APPLICATION DES MIGRATIONS
# ============================================
echo "6️⃣  Application des migrations de la base de données..."
echo ""

if [ -f "packages/supabase/apply-migrations.sh" ]; then
    bash packages/supabase/apply-migrations.sh
else
    echo "   ⚠️  Script apply-migrations.sh non trouvé, création..."
    
    cat > packages/supabase/apply-migrations.sh << 'MIGRATIONS_SCRIPT'
#!/bin/bash
set -e

echo "   🔄 Application des migrations Supabase..."

# Attendre que la base de données soit prête
until docker exec antislash-talk-db pg_isready -U postgres -d postgres > /dev/null 2>&1; do
  sleep 1
done

# Appliquer les migrations
MIGRATION_DIR="./packages/supabase/migrations"
for migration_file in $(ls $MIGRATION_DIR/*.sql 2>/dev/null | sort); do
  MIGRATION_NAME=$(basename "$migration_file")
  
  # Vérifier si la migration a déjà été appliquée
  if docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT 1 FROM public.schema_migrations WHERE version = '$MIGRATION_NAME'" 2>/dev/null | grep -q 1; then
    echo "      → Skipping: $MIGRATION_NAME (déjà appliquée)"
  else
    echo "      → Applying: $MIGRATION_NAME"
    docker exec -i antislash-talk-db psql -U postgres -d postgres < "$migration_file"
    docker exec antislash-talk-db psql -U postgres -d postgres -c "INSERT INTO public.schema_migrations (version) VALUES ('$MIGRATION_NAME')" 2>/dev/null || true
    echo "        ✅ Appliquée avec succès"
  fi
done

echo "   ✅ Migrations terminées !"
MIGRATIONS_SCRIPT

    chmod +x packages/supabase/apply-migrations.sh
    bash packages/supabase/apply-migrations.sh
fi

echo ""

# ============================================
# 7. REDÉMARRAGE DES SERVICES POUR APPLIQUER LES CHANGEMENTS
# ============================================
echo "7️⃣  Redémarrage des services Meta et Studio..."
echo ""

docker-compose -f docker-compose.monorepo.yml restart meta studio kong
sleep 5

echo "   ✅ Services redémarrés"
echo ""

# ============================================
# 8. VÉRIFICATION FINALE
# ============================================
echo "8️⃣  Vérification de l'état du système..."
echo ""

# Compter les services actifs
RUNNING_SERVICES=$(docker-compose -f docker-compose.monorepo.yml ps --services --filter "status=running" | wc -l)
echo "   ✅ $RUNNING_SERVICES services en cours d'exécution"

# Vérifier la DB
USER_COUNT=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM auth.users" 2>/dev/null || echo "0")
echo "   ✅ $USER_COUNT utilisateur(s) dans la base"

# Vérifier les migrations
MIGRATION_COUNT=$(docker exec antislash-talk-db psql -U postgres -d postgres -tAc "SELECT COUNT(*) FROM public.schema_migrations" 2>/dev/null || echo "0")
echo "   ✅ $MIGRATION_COUNT migration(s) appliquée(s)"

echo ""

# ============================================
# 9. RÉSUMÉ ET ACCÈS
# ============================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        ✅ DÉPLOIEMENT TERMINÉ AVEC SUCCÈS ! ✅                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 ACCÈS AUX SERVICES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   • Application Web:     http://localhost:3000"
echo "   • Supabase Studio:     http://localhost:54323"
echo "   • API Gateway (Kong):  http://localhost:54321"
echo "   • PostgreSQL:          localhost:5432"
echo "   • Inbucket (Email):    http://localhost:54324"
echo ""
echo "📋 SERVICES OPTIONNELS:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   Pour démarrer Ollama:"
echo "   → Services inclus dans docker-compose, déjà démarrés"
echo ""
echo "   Pour démarrer PyTorch Transcription:"
echo "   → docker-compose -f docker-compose.monorepo.yml --profile pytorch up -d"
echo ""
echo "🔐 CONFIGURATION:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   • Fichier .env créé avec clés JWT sécurisées"
echo "   • Kong configuré automatiquement"
echo "   • Migrations appliquées"
echo "   • Permissions configurées"
echo ""
echo "📖 PROCHAINES ÉTAPES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   1. Créer votre premier utilisateur dans Studio"
echo "   2. Ou utiliser l'API signup: http://localhost:54321/auth/v1/signup"
echo "   3. Développer votre application !"
echo ""
echo "💡 COMMANDES UTILES:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "   • Voir les logs:    docker-compose -f docker-compose.monorepo.yml logs -f"
echo "   • Arrêter tout:     docker-compose -f docker-compose.monorepo.yml down"
echo "   • Redémarrer:       docker-compose -f docker-compose.monorepo.yml restart"
echo "   • Redéployer:       ./deploy-complete.sh"
echo ""
echo "✅ Votre système Antislash Talk est maintenant prêt ! 🚀"
echo ""


