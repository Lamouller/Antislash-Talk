#!/bin/bash
# 🧪 Script de test pour add-domain.sh
# Vérifie que le script est accessible et fonctionnel

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_test() {
    echo -e "${CYAN}[TEST]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

TESTS_PASSED=0
TESTS_TOTAL=0

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  🧪 Test du script add-domain.sh"
echo "═══════════════════════════════════════════════════════"
echo ""

# Test 1: Script accessible sur GitHub
((TESTS_TOTAL++))
print_test "Vérification de l'accessibilité GitHub..."
if curl -sI https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/add-domain.sh | grep -q "200"; then
    print_success "Script accessible sur GitHub"
    ((TESTS_PASSED++))
else
    print_error "Script non accessible sur GitHub"
fi

# Test 2: Téléchargement du script
((TESTS_TOTAL++))
print_test "Téléchargement du script..."
if curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/add-domain.sh -o /tmp/test-add-domain.sh; then
    print_success "Script téléchargé"
    ((TESTS_PASSED++))
else
    print_error "Échec du téléchargement"
fi

# Test 3: Vérification de la syntaxe bash
((TESTS_TOTAL++))
print_test "Vérification de la syntaxe bash..."
if bash -n /tmp/test-add-domain.sh 2>/dev/null; then
    print_success "Syntaxe bash correcte"
    ((TESTS_PASSED++))
else
    print_error "Erreur de syntaxe bash"
fi

# Test 4: Vérification du shebang
((TESTS_TOTAL++))
print_test "Vérification du shebang..."
if head -1 /tmp/test-add-domain.sh | grep -q "#!/bin/bash"; then
    print_success "Shebang correct"
    ((TESTS_PASSED++))
else
    print_error "Shebang incorrect"
fi

# Test 5: Vérification des fonctions principales
((TESTS_TOTAL++))
print_test "Vérification des fonctions principales..."
if grep -q "detect_os" /tmp/test-add-domain.sh && \
   grep -q "print_header" /tmp/test-add-domain.sh && \
   grep -q "test_url" /tmp/test-add-domain.sh; then
    print_success "Fonctions principales présentes"
    ((TESTS_PASSED++))
else
    print_error "Fonctions principales manquantes"
fi

# Test 6: Vérification de la configuration Nginx
((TESTS_TOTAL++))
print_test "Vérification de la génération Nginx..."
if grep -q "ssl_certificate" /tmp/test-add-domain.sh && \
   grep -q "proxy_pass" /tmp/test-add-domain.sh; then
    print_success "Configuration Nginx présente"
    ((TESTS_PASSED++))
else
    print_error "Configuration Nginx manquante"
fi

# Test 7: Vérification du support Let's Encrypt
((TESTS_TOTAL++))
print_test "Vérification du support Let's Encrypt..."
if grep -q "certbot" /tmp/test-add-domain.sh && \
   grep -q "INSTALL_LETSENCRYPT" /tmp/test-add-domain.sh; then
    print_success "Support Let's Encrypt présent"
    ((TESTS_PASSED++))
else
    print_error "Support Let's Encrypt manquant"
fi

# Test 8: Vérification de la taille du script
((TESTS_TOTAL++))
print_test "Vérification de la taille du script..."
FILE_SIZE=$(wc -c < /tmp/test-add-domain.sh)
if [ $FILE_SIZE -gt 10000 ]; then
    print_success "Taille du script OK ($FILE_SIZE bytes)"
    ((TESTS_PASSED++))
else
    print_error "Script trop petit ($FILE_SIZE bytes)"
fi

# Test 9: Vérification du README
((TESTS_TOTAL++))
print_test "Vérification de la documentation README..."
if curl -sL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/README.md | grep -q "add-domain.sh"; then
    print_success "Documentation présente dans README"
    ((TESTS_PASSED++))
else
    print_error "Documentation manquante dans README"
fi

# Test 10: Vérification du QUICK_REFERENCE
((TESTS_TOTAL++))
print_test "Vérification du QUICK_REFERENCE..."
if curl -sL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/QUICK_REFERENCE.md | grep -q "Domain Management"; then
    print_success "QUICK_REFERENCE disponible"
    ((TESTS_PASSED++))
else
    print_error "QUICK_REFERENCE manquant"
fi

# Nettoyage
rm -f /tmp/test-add-domain.sh

# Résultats
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  📊 Résultats des tests"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Tests réussis : $TESTS_PASSED/$TESTS_TOTAL"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}🎉 Tous les tests sont passés !${NC}"
    echo ""
    echo "Vous pouvez utiliser le script en toute confiance :"
    echo ""
    echo -e "${CYAN}cd ~/antislash-talk && curl -sSL https://raw.githubusercontent.com/Lamouller/Antislash-Talk/main/add-domain.sh -o add-domain.sh && chmod +x add-domain.sh && ./add-domain.sh${NC}"
    echo ""
    exit 0
else
    echo -e "${YELLOW}⚠️  Certains tests ont échoué${NC}"
    echo "Tests échoués : $((TESTS_TOTAL - TESTS_PASSED))"
    exit 1
fi

