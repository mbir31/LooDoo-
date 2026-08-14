import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigData from '../../firebase-applet-config.json';

const metaEnv = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: firebaseConfigData?.apiKey || metaEnv.VITE_FIREBASE_API_KEY || 'AIzaSyDummyKeyForVercelPreview000',
  authDomain: firebaseConfigData?.authDomain || metaEnv.VITE_FIREBASE_AUTH_DOMAIN || 'loodoo-app.firebaseapp.com',
  projectId: firebaseConfigData?.projectId || metaEnv.VITE_FIREBASE_PROJECT_ID || 'loodoo-app',
  storageBucket: firebaseConfigData?.storageBucket || metaEnv.VITE_FIREBASE_STORAGE_BUCKET || 'loodoo-app.appspot.com',
  messagingSenderId: firebaseConfigData?.messagingSenderId || metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: firebaseConfigData?.appId || metaEnv.VITE_FIREBASE_APP_ID || '1:1234567890:web:abcdef123456',
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// If custom firestoreDatabaseId is provided in config, use it
export const db = firebaseConfigData?.firestoreDatabaseId && firebaseConfigData.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigData.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export default app;
