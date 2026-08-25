// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
// This is the standard public "web app" config Firebase issues for browser
// clients. It is NOT a secret — it only identifies your project, the same
// way a URL does. Actual protection comes from Realtime Database / Storage
// Security Rules (see database.rules.json and storage.rules), never from
// hiding this object. Never put a service-account JSON or an Admin SDK key
// in frontend code — that is a real secret and belongs only on a server
// (e.g. inside a Cloud Function's config).
//
// Replace the values below with the config from:
// Firebase Console → Project settings → General → Your apps → SDK setup.
//
// NOTE on the values you sent: "authDomain" must be your project's
// "<project-id>.firebaseapp.com" hostname, not the Realtime Database URL.
// I've corrected that below so Auth (including anonymous sign-in) works —
// swap in your real project's authDomain if it differs.
// ============================================================================

export const firebaseConfig = {
  apiKey: "AIzaSyBxCJJLsZQtlwPyW3gWvl2dO25-eSpOYEg",
  authDomain: "ff-tournament-app-abcf0.firebaseapp.com",
  databaseURL: "https://ff-tournament-app-abcf0-default-rtdb.firebaseio.com",
  projectId: "ff-tournament-app-abcf0",
  storageBucket: "ff-tournament-app-abcf0.firebasestorage.app",
  messagingSenderId: "540293861745",
  appId: "1:540293861745:android:759ad297c26a066543e6d0",
};
