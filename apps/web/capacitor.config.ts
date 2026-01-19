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
    // Configuration iOS spécifique
    contentInset: 'automatic',
    backgroundColor: '#ffffff',
    allowsLinkPreview: false
  },
  plugins: {
    // Configuration des plugins si nécessaire
  }
};

export default config;
