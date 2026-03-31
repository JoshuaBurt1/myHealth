export const getEnvVar = (key: string): string | undefined => {
  const expoKey = `EXPO_PUBLIC_FIREBASE_${key}`;
  const viteKey = `VITE_FIREBASE_${key}`;

  // For Expo/Native, we strictly use process.env
  if (typeof process !== 'undefined' && process.env) {
    return process.env[expoKey] || process.env[viteKey];
  }

  return undefined;
};