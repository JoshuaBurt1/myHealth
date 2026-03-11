import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const getEnvVar = (key: string) => {
  const viteKey = `VITE_FIREBASE_${key}`;
  const expoKey = `EXPO_PUBLIC_FIREBASE_${key}`;

  // 1. Check for Mobile (Process/Expo) first
  // This is safer for Hermes/Native environments
  if (typeof process !== 'undefined' && process.env && process.env[expoKey]) {
    return process.env[expoKey];
  }

  // 2. Fallback to Vite (Web)
  // We use an indirect check to help some parsers skip this if they don't support it,
  // but Vite is still smart enough to replace the values during build.
  try {
    // @ts-ignore
    const env = import.meta.env;
    if (env) {
      return env[viteKey];
    }
  } catch (e) {
    // Fail silently on native if import.meta is totally absent
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

export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);
