// Bundle entry for the app build only (sync-web.sh runs esbuild on this file -> www/hlnative.js).
// Importing a Capacitor plugin package registers it, which is what puts it on window.Capacitor.Plugins.
// A page without a bundler never gets those entries, so this step is required.
import '@capacitor/core';
import '@capacitor-community/admob';
import '@capacitor/haptics';
import '@capacitor/app';
import '@capacitor/preferences';
import '@capacitor-community/keep-awake';
import '@capacitor/status-bar';
import '@capacitor/splash-screen';
import './hlnative.js';
