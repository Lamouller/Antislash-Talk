import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.antislash.talk',
  appName: 'Antislash Talk',
  webDir: 'dist',
  server: {
    // Charger l'app depuis le VPS (mode production)
    url: 'https://app.riquelme-talk.antislash.studio',
    // Pour le dev local, commente la ligne ci-dessus et décommente celle-ci :
    // url: 'http://192.168.1.X:5173',
    // cleartext: true
  },
  ios: {
    // Configuration iOS spécifique pour Dynamic Island et Safe Areas
    contentInset: 'automatic',
    // Couleur de fond qui correspond au gradient de l'app (slate-50)
    backgroundColor: '#f8fafc',
    allowsLinkPreview: false,
    // Permet le rendu edge-to-edge sous la status bar
    preferredContentMode: 'mobile',
    // Scroll behavior
    scrollEnabled: true,
  },
  android: {
    // Configuration Android pour encoches et cutouts
    backgroundColor: '#ffffff',
    // Permet le rendu edge-to-edge
    allowMixedContent: true,
    // WebView settings
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    // Status Bar Configuration
    StatusBar: {
      // iOS: Style de la status bar (dark content sur fond clair)
      style: 'DARK',
      // Android: Couleur de la status bar
      backgroundColor: '#ffffff',
      // Overlay WebView sous la status bar
      overlaysWebView: true,
    },
    // Keyboard configuration pour éviter les problèmes de layout
    Keyboard: {
      resize: 'body',
      style: 'DARK',
      resizeOnFullScreen: true,
    },
    // Splash Screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  }
};

export default config;
