// packages/shared/index.ts
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

// Helper to safely grab env variables from Vite (Web) or Expo (Mobile)
const getEnvVar = (key: string) => {
  // @ts-ignore - Ignore check if import.meta.env doesn't exist in all environments
  return import.meta.env?.[`VITE_FIREBASE_${key}`] || process.env[`EXPO_PUBLIC_FIREBASE_${key}`];
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
// This fixes the "Service firestore is not available" error in HMR
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app);



// SHARED LOGIC: The "Overlap Fixer" for your Heart Rate Chart
export const syncHealthMetric = async (userId: string, metricType: 'heart_rate' | 'steps', value: number) => {
  if (!userId) {
    console.error("Sync failed: No userId provided.");
    return;
  }

  // Use a granular ID (ISO string) to ensure Recharts shows separate data points
  const timestampId = new Date().toISOString();

  try {
    // Update the primary daily total
    await setDoc(doc(db, 'users', userId), {
      [`daily_${metricType}`]: value,
      last_update: serverTimestamp()
    }, { merge: true });

    // Update the history for your Recharts components
    await setDoc(doc(db, 'users', userId, `${metricType}_history`, timestampId), {
      value,
      timestamp: serverTimestamp()
    });
    
    console.log(`Successfully synced ${metricType}: ${value}`);
  } catch (error) {
    console.error("Firestore sync error:", error);
  }
};