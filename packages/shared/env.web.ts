/// <reference types="vite/client" />

export const getEnvVar = (key: string): string | undefined => {
  const viteKey = `VITE_FIREBASE_${key}`;
  
  // Using 'as any' bypasses the strict ImportMeta check for this shared file
  // while Vite handles the actual replacement during build.
  return (import.meta as any).env[viteKey];
};