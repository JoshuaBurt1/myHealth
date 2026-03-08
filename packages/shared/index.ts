// packages/shared/index.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY || process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN || process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID || process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET || process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID || process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID || process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID || process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// SHARED LOGIC: The "Overlap Fixer" for your Heart Rate Chart
export const syncHealthMetric = async (userId: string, metricType: 'heart_rate' | 'steps', value: number) => {
  const todayId = new Date().toISOString().split('T')[0];
  const timestamp = new Date().toISOString();

  // Update the primary daily total
  await setDoc(doc(db, 'users', userId), {
    [`daily_${metricType}`]: value,
    last_update: serverTimestamp()
  }, { merge: true });

  // Update the history for your Recharts components
  // Using a specific timestamp ID prevents the "vertical line" overlap
  await setDoc(doc(db, 'users', userId, `${metricType}_history`, timestamp), {
    value,
    timestamp: serverTimestamp()
  });
};