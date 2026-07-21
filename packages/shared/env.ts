// packages/shared/env.ts

export const getEnvVar = (key: string): string | undefined => {
  // We MUST use a static map for Expo/React Native. 
  // Metro will only replace exact string matches of 'process.env.EXPO_PUBLIC_...'
  const staticEnvMap: Record<string, string | undefined> = {
    GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_FIREBASE_GOOGLE_WEB_CLIENT_ID,
    API_KEY: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    AUTH_DOMAIN: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    PROJECT_ID: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    STORAGE_BUCKET: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    MESSAGING_SENDER_ID: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    APP_ID: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    MEASUREMENT_ID: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // Check the static map first (used by Mobile)
  if (staticEnvMap[key]) {
    return staticEnvMap[key];
  }

  // Fallback for Web/Vite (if applicable)
  const viteKey = `VITE_FIREBASE_${key}`;
  if (typeof process !== 'undefined' && process.env && process.env[viteKey]) {
    return process.env[viteKey];
  }

  return undefined;
};