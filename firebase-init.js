import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getDatabase, ref, set, update, get, remove,
  onValue, onDisconnect, serverTimestamp, child,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db  = getDatabase(app);

export {
  ref, set, update, get, remove, onValue, onDisconnect, serverTimestamp, child,
  signInAnonymously, onAuthStateChanged,
};

let readyResolve;
export const authReady = new Promise((res) => (readyResolve = res));
let currentUser = null;
onAuthStateChanged(auth, (user) => { currentUser = user; readyResolve(user); });
export const getCurrentUser = () => currentUser;

export async function ensureSignedIn() {
  if (auth.currentUser) return auth.currentUser;
  const cred = await signInAnonymously(auth);
  return cred.user;
}
