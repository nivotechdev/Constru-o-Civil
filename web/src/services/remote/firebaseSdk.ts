// U68: only the pieces of Firebase Auth the app uses, so the bundle drops the rest (other providers, redirects, multi-
// factor…) — a smaller download before Google's window can open. Loaded on demand by remote/firebase.ts.
export { initializeApp, getApps } from '@firebase/app';
export {
  browserPopupRedirectResolver,
  getAuth,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  useDeviceLanguage
} from '@firebase/auth';
