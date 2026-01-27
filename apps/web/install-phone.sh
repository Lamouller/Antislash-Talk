#!/bin/bash

# 📱 Script pour installer l'APK sur un téléphone Android physique
# Usage: ./install-phone.sh

set -e

ANDROID_SDK="$HOME/Library/Android/sdk"
ADB="$ANDROID_SDK/platform-tools/adb"

echo "📱 Installation sur téléphone Android physique..."
echo ""

# Vérifier qu'ADB existe
if [ ! -f "$ADB" ]; then
    echo "❌ ADB not found at $ADB"
    echo "Please install Android Studio and SDK first"
    exit 1
fi

# Vérifier les appareils connectés
echo "🔍 Vérification des appareils connectés..."
"$ADB" devices

DEVICE_COUNT=$("$ADB" devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')

if [ "$DEVICE_COUNT" -eq "0" ]; then
    echo ""
    echo "❌ Aucun appareil détecté !"
    echo ""
    echo "📋 Checklist :"
    echo "  1. Téléphone connecté en USB ?"
    echo "  2. Débogage USB activé ?"
    echo "  3. Popup 'Autoriser le débogage USB' acceptée ?"
    echo ""
    exit 1
fi

# Si plusieurs appareils, demander lequel utiliser
if [ "$DEVICE_COUNT" -gt "1" ]; then
    echo ""
    echo "⚠️  Plusieurs appareils détectés. Sélectionnez lequel utiliser :"
    "$ADB" devices -l
    echo ""
    echo "💡 Utilisez : adb -s DEVICE_ID install ..."
    exit 1
fi

# Vérifier que l'APK existe
APK_PATH="android/app/build/outputs/apk/debug/app-debug.apk"
if [ ! -f "$APK_PATH" ]; then
    echo ""
    echo "❌ APK not found at $APK_PATH"
    echo ""
    echo "🔨 Build the APK first with:"
    echo "   ./build-android.sh debug"
    echo ""
    exit 1
fi

# Afficher les infos de l'appareil
DEVICE_MODEL=$("$ADB" shell getprop ro.product.model | tr -d '\r')
ANDROID_VERSION=$("$ADB" shell getprop ro.build.version.release | tr -d '\r')

echo ""
echo "📱 Appareil détecté :"
echo "   Modèle: $DEVICE_MODEL"
echo "   Android: $ANDROID_VERSION"
echo ""

# Désinstaller l'ancienne version si elle existe
echo "🗑️  Désinstallation de l'ancienne version (si présente)..."
"$ADB" uninstall com.antislash.talk 2>/dev/null || echo "   Aucune version précédente trouvée"

# Installer l'APK
echo ""
echo "📦 Installation de l'APK..."
"$ADB" install -r "$APK_PATH"

echo ""
echo "✅ Installation réussie !"
echo ""
echo "🎉 L'app 'Antislash Talk' est maintenant installée sur votre téléphone !"
echo ""
echo "🐛 Pour débugger :"
echo "   Chrome → chrome://inspect#devices → Cliquer 'Inspect'"
echo ""
