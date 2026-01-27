#!/bin/bash

# 📱 Script de build APK Android pour Antislash Talk
# Usage: ./build-android.sh [debug|release]

set -e

BUILD_TYPE="${1:-debug}"

echo "🚀 Building Antislash Talk for Android..."
echo "📦 Build type: $BUILD_TYPE"
echo ""

# 1. Build de l'app web
echo "📦 Step 1/3: Building web app..."
pnpm build

# 2. Sync avec Capacitor
echo "🔄 Step 2/3: Syncing with Capacitor..."
npx cap sync android

# 3. Build APK
echo "🏗️ Step 3/3: Building APK..."
cd android

if [ "$BUILD_TYPE" = "release" ]; then
    echo "🔒 Building RELEASE APK..."
    ./gradlew assembleRelease
    echo ""
    echo "✅ Done! APK location:"
    echo "   📁 android/app/build/outputs/apk/release/app-release-unsigned.apk"
else
    echo "🐛 Building DEBUG APK..."
    ./gradlew assembleDebug
    echo ""
    echo "✅ Done! APK location:"
    echo "   📁 android/app/build/outputs/apk/debug/app-debug.apk"
fi

cd ..

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo "📲 To install on device:"
echo "   adb install android/app/build/outputs/apk/$BUILD_TYPE/app-$BUILD_TYPE.apk"
