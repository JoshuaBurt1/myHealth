// packages/shared/index.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp, increment } from 'firebase/firestore';

// Helper to safely grab env variables from Vite (Web) or Expo (Mobile)
const getEnvVar = (key: string) => {
  const expoKey = `EXPO_PUBLIC_FIREBASE_${key}`;
  
  // Check for Expo environment first (Mobile)
  if (typeof process !== 'undefined' && process.env && process.env[expoKey]) {
    return process.env[expoKey];
  }

  // Use a string-based check for Vite to hide it from the Hermes compiler
  try {
    const meta = Function('return import.meta')();
    if (meta && meta.env) {
      return meta.env[`VITE_FIREBASE_${key}`];
    }
  } catch (e) {
    // Fail silently on mobile
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

// Singleton pattern: Check if an app already exists before initializing
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);

// SHARED LOGIC: The "Overlap Fixer" for your Heart Rate Chart
export const syncHealthMetric = async (userId: string, metricType: 'heart_rate' | 'steps', value: number) => {
  if (!userId) return;

  const timestampId = new Date().toISOString();

  try {
    const userRef = doc(db, 'users', userId);
    
    // 1. Increment the daily total instead of overwriting it
    await setDoc(userRef, {
      [`daily_${metricType}`]: increment(value),
      last_update: serverTimestamp()
    }, { merge: true });

    // 2. Log the specific window in history for Recharts
    await setDoc(doc(db, 'users', userId, `${metricType}_history`, timestampId), {
      value,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error("Firestore sync error:", error);
  }
};