import { initializeApp, getApps } from 'firebase/app';
import { initializeAuth, getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, sendEmailVerification, sendPasswordResetEmail, User } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Replace with your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA59q1Xf0JqGWzNxHh0ORiXUSN5v_hvcwI",
  authDomain: "sachio-mobile-toilets-ed86d.firebaseapp.com",
  projectId: "sachio-mobile-toilets-ed86d",
  storageBucket: "sachio-mobile-toilets-ed86d.appspot.com",
  messagingSenderId: "1052577492056",
  appId: "1:1052577492056:web:ab73160d1adf6186a4ae2d",
  measurementId: "G-WSZ8JN7WNZ",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

try {
  // Try to enable React Native persistence for auth. Use a dynamic require to avoid TypeScript issues
  // if the platform-specific module isn't available in the installed firebase typings.
  // This will enable persistence via AsyncStorage when supported.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rnAuth: any = require('firebase/auth/react-native');
  if (rnAuth && typeof rnAuth.getReactNativePersistence === 'function') {
    initializeAuth(app, { persistence: rnAuth.getReactNativePersistence(ReactNativeAsyncStorage) });
  } else {
    // Fallback: try a plain initializeAuth without RN persistence
    initializeAuth(app);
  }
} catch (e) {
  // If require fails (module not found) or initializeAuth throws, fall back to plain initializeAuth
  try {
    initializeAuth(app);
  } catch (err) {
    // ignore
  }
}

const auth = getAuth();
const db = getFirestore();
const storage = getStorage();

// Auth helpers
export async function signInEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signUpEmail(email: string, password: string, profile: { name?: string; phone?: string }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  // create a user document in firestore
  const userRef = doc(db, 'users', cred.user.uid);
  await setDoc(userRef, {
    uid: cred.user.uid,
    email: cred.user.email,
    name: profile.name || null,
    phone: profile.phone || null,
    createdAt: new Date().toISOString(),
  });
  // Optionally send email verification
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    // ignore
  }
  return cred.user;
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export async function sendPasswordReset(email: string) {
  return sendPasswordResetEmail(auth, email);
}

export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// Firestore helpers
export async function getUserProfile(uid: string) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export { auth, db, storage, firebaseConfig };

// NOTE: Phone auth (OTP) requires additional configuration:
// - On web: enabling reCAPTCHA verification and use signInWithPhoneNumber
// - On mobile (Expo): use Firebase Native SDK or a verified phone auth provider
// For now the OTP screen will stay as a verification UI and we use email flows as primary.
