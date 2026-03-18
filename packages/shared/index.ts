import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const getEnvVar = (key: string) => {
  const expoKey = `EXPO_PUBLIC_FIREBASE_${key}`;
  const viteKey = `VITE_FIREBASE_${key}`;

  // This works natively in Expo and via 'define' in Vite
  if (typeof process !== 'undefined' && process.env) {
    return process.env[expoKey] || process.env[viteKey];
  }

  return undefined;
};

const firebaseConfig = {
  apiKey: getEnvVar('API_KEY'),
  authDomain: getEnvVar('AUTH_DOMAIN'),
  projectId: getEnvVar('PROJECT_ID'),
  storageBucket: getEnvVar('STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('MESSAGING_SENDER_ID'),
  appId: getEnvVar('APP_ID'),
  measurementId: getEnvVar('MEASUREMENT_ID')
};

export const googleWebClientId = getEnvVar('GOOGLE_WEB_CLIENT_ID');
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
