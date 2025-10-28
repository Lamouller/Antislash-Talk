#!/bin/bash
# Script pour installer un modèle Ollama

set -e

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_info "Installation d'un modèle Ollama..."

# Vérifier si Ollama tourne
if ! docker ps | grep -q antislash-talk-ollama; then
    print_error "Container Ollama non trouvé. Démarrage..."
    docker compose -f docker-compose.monorepo.yml --env-file .env.monorepo up -d ollama
    print_info "Attente du démarrage d'Ollama (30s)..."
    sleep 30
fi

# Liste des modèles disponibles
echo ""
echo "Modèles recommandés :"
echo "1. llama3.2:3b      - Modèle léger et rapide (2GB)"
echo "2. mistral:7b       - Plus puissant mais plus lent (4GB)"
echo "3. phi3:mini        - Très léger, bon pour les tests (2GB)"
echo "4. gemma2:2b        - Compact et efficace (1.6GB)"
echo ""

# Vérifier les modèles déjà installés
print_info "Modèles actuellement installés :"
docker exec antislash-talk-ollama ollama list 2>/dev/null || echo "Aucun modèle installé"
echo ""

# Demander quel modèle installer
read -p "Quel modèle voulez-vous installer ? (1-4, ou tapez le nom complet) [1] : " CHOICE

case "$CHOICE" in
    1|"")
        MODEL="llama3.2:3b"
        ;;
    2)
        MODEL="mistral:7b"
        ;;
    3)
        MODEL="phi3:mini"
        ;;
    4)
        MODEL="gemma2:2b"
        ;;
    *)
        MODEL="$CHOICE"
        ;;
esac

print_info "Installation du modèle : $MODEL"
print_info "Cela peut prendre plusieurs minutes selon votre connexion..."
echo ""

# Installer le modèle
if docker exec -it antislash-talk-ollama ollama pull "$MODEL"; then
    print_success "Modèle $MODEL installé avec succès !"
else
    print_error "Erreur lors de l'installation du modèle"
    exit 1
fi

# Tester le modèle
print_info "Test du modèle..."
if docker exec antislash-talk-ollama ollama run "$MODEL" "Say hello in one sentence" --verbose=false 2>/dev/null; then
    print_success "Le modèle fonctionne correctement !"
else
    print_error "Erreur lors du test du modèle"
fi

# Afficher tous les modèles installés
echo ""
print_info "Modèles installés :"
docker exec antislash-talk-ollama ollama list

print_success "Installation terminée !"
echo ""
echo "Le modèle $MODEL est maintenant disponible pour Antislash Talk."
echo "Vous pouvez maintenant utiliser les fonctions de génération de titre et résumé."
