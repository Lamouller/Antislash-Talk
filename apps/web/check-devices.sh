#!/bin/bash

# 🔍 Vérifier les appareils Android connectés
# Usage: ./check-devices.sh

ANDROID_SDK="$HOME/Library/Android/sdk"
ADB="$ANDROID_SDK/platform-tools/adb"

echo "🔍 Appareils Android connectés :"
echo ""

if [ ! -f "$ADB" ]; then
    echo "❌ ADB not found. Install Android Studio first."
    exit 1
fi

"$ADB" devices -l

echo ""
DEVICE_COUNT=$("$ADB" devices | grep -v "List of devices" | grep "device$" | wc -l | tr -d ' ')

if [ "$DEVICE_COUNT" -eq "0" ]; then
    echo "❌ Aucun appareil connecté"
    echo ""
    echo "📋 Checklist :"
    echo "  1. ☐ Téléphone connecté en USB ?"
    echo "  2. ☐ Débogage USB activé ?"
    echo "  3. ☐ Popup 'Autoriser le débogage USB' acceptée ?"
else
    echo "✅ $DEVICE_COUNT appareil(s) connecté(s)"
    echo ""
    
    for device in $("$ADB" devices | grep "device$" | awk '{print $1}'); do
        if [[ $device == emulator* ]]; then
            echo "📱 Émulateur : $device"
        else
            MODEL=$("$ADB" -s "$device" shell getprop ro.product.model | tr -d '\r')
            ANDROID=$("$ADB" -s "$device" shell getprop ro.build.version.release | tr -d '\r')
            echo "📱 Téléphone physique : $device"
            echo "   Modèle: $MODEL"
            echo "   Android: $ANDROID"
        fi
        echo ""
    done
fi
