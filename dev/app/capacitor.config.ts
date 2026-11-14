import type { CapacitorConfig } from '@capacitor/cli';

// Colours come from the game's CSS tokens in ../src/base.css: --sky #7FD0E4, --sky-deep #5BB8D2.
const SKY = '#7FD0E4';

const config: CapacitorConfig = {
  // TODO(owner): replace with your own reverse-domain bundle id BEFORE running `cap add`.
  // It must match App Store Connect / Play Console and cannot be changed later without
  // publishing a new app. "com.example.*" will be rejected by both stores.
  appId: 'com.example.highandlow',
  appName: 'High & Low',
  webDir: 'www',
  backgroundColor: SKY,
  ios: {
    contentInset: 'never',      // the game pads itself with env(safe-area-inset-*)
    backgroundColor: SKY,
  },
  android: {
    backgroundColor: SKY,
    allowMixedContent: false,
    // vendor/supabase-*.js uses ES2021 syntax (||=, ??=), which needs Chrome/WebView 85+. Capacitor's default is 60.
    // Below this version Capacitor logs an error and the game would not start. Android WebView updates through Google Play.
    minWebViewVersion: 90,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      launchAutoHide: true,
      backgroundColor: SKY,
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',           // LIGHT = dark icons, for the light sky background
      backgroundColor: SKY,     // Android only
      overlaysWebContent: false,
    },
  },
};

export default config;
