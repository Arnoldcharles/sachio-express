declare module 'firebase/app' {
  export type FirebaseApp = { name?: string; [key: string]: unknown };
  export type FirebaseOptions = Record<string, unknown>;

  export function initializeApp(options: FirebaseOptions): FirebaseApp;
  export function getApps(): FirebaseApp[];
}

declare module 'firebase/auth' {
  import type { FirebaseApp } from 'firebase/app';

  export type Auth = any;
  export type User = { uid: string; email: string | null; [key: string]: unknown };

  export function getAuth(app?: FirebaseApp): Auth;
  export function initializeAuth(app: FirebaseApp, config: any): Auth;
  export function getReactNativePersistence(persistence: unknown): any;

  export function signInWithEmailAndPassword(
    auth: Auth,
    email: string,
    password: string,
  ): Promise<{ user: User }>;
  export function createUserWithEmailAndPassword(
    auth: Auth,
    email: string,
    password: string,
  ): Promise<{ user: User }>;
  export function signOut(auth: Auth): Promise<void>;
  export function sendEmailVerification(user: User): Promise<void>;
  export function sendPasswordResetEmail(auth: Auth, email: string): Promise<void>;
  export function signInWithCustomToken(auth: Auth, token: string): Promise<{ user: User }>;
  export function signInWithCredential(auth: Auth, credential: any): Promise<{ user: User }>;
  export const GoogleAuthProvider: {
    credential: (idToken?: string | null, accessToken?: string | null) => any;
  };
}

declare module 'firebase/firestore' {
  import type { FirebaseApp } from 'firebase/app';

  export type Firestore = any;
  export type DocumentReference<T = any> = any;
  export type DocumentSnapshot<T = any> = any;
  export type Query<T = any> = any;
  export type QuerySnapshot<T = any> = any;

  export function getFirestore(app?: FirebaseApp): Firestore;
  export function doc(firestore: Firestore, path: string, ...pathSegments: string[]): DocumentReference;
  export function setDoc(reference: DocumentReference, data: any, options?: any): Promise<void>;
  export function getDoc(reference: DocumentReference): Promise<DocumentSnapshot>;
  export function collection(firestore: Firestore, path: string, ...pathSegments: string[]): any;
  export function addDoc(collectionRef: any, data: any): Promise<DocumentReference>;
  export function updateDoc(reference: DocumentReference, data: any): Promise<void>;
  export function deleteDoc(reference: DocumentReference): Promise<void>;
  export function query(ref: any, ...constraints: any[]): Query;
  export function where(field: string, op: any, value: any): any;
  export function orderBy(field: string, direction?: any): any;
  export function limit(n: number): any;
  export function onSnapshot(
    reference: any,
    callback: (snapshot: QuerySnapshot | DocumentSnapshot) => any,
    error?: (error: any) => void,
  ): () => void;
  export function getDocs(query: Query): Promise<QuerySnapshot>;
  export function serverTimestamp(): any;
}

declare module 'firebase/storage' {
  import type { FirebaseApp } from 'firebase/app';

  export type FirebaseStorage = any;

  export function getStorage(app?: FirebaseApp): FirebaseStorage;
  export function ref(storage: FirebaseStorage, path: string): any;
  export function uploadBytes(reference: any, data: any, metadata?: any): Promise<any>;
  export function getDownloadURL(reference: any): Promise<string>;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<void>;
    [key: string]: any;
  };

  export default AsyncStorage;
}
