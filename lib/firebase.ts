import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  User,
} from 'firebase/auth';
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

const app = getApps()[0] ?? initializeApp(firebaseConfig);

// Try to enable React Native persistence when the optional RN auth entrypoint exists.
const rnAuthModuleId = 'firebase/auth/react-native';
type RNAuthModule = {
  initializeAuth: typeof import('firebase/auth').initializeAuth;
  getReactNativePersistence: (persistence: unknown) => any;
};

let auth = getAuth(app);
try {
  const rnAuth = require(rnAuthModuleId) as RNAuthModule;
  if (rnAuth?.initializeAuth && rnAuth?.getReactNativePersistence) {
    auth = rnAuth.initializeAuth(app, {
      persistence: rnAuth.getReactNativePersistence(ReactNativeAsyncStorage),
    });
  }
} catch {
  // If the RN entrypoint is not installed or fails to load, fall back to in-memory auth.
  auth = getAuth(app);
}
const db = getFirestore(app);
const storage = getStorage(app);

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

export async function ensureUserProfile(
  user: {
    uid: string;
    email?: string | null;
    displayName?: string | null;
    phoneNumber?: string | null;
  },
  profile: { name?: string | null; phone?: string | null } = {}
) {
  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data();
  }
  const name = profile.name ?? user.displayName ?? null;
  const phone = profile.phone ?? user.phoneNumber ?? null;
  const payload = {
    uid: user.uid,
    email: user.email,
    name,
    phone,
    createdAt: new Date().toISOString(),
  };
  await setDoc(userRef, payload);
  return payload;
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
