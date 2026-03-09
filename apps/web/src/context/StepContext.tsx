import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

// Define the interface so your IDE stops complaining about 'any'
interface StepContextType {
  steps: number;
  setSteps: (steps: number) => void;
  isInitialLoadDone: boolean;
  setIsInitialLoadDone: (done: boolean) => void;
  syncWithGoogleFit: () => void;
  isSyncing: boolean;
  lastSynced: Date | null;
  setLastSynced: (date: Date | null) => void;
}

const StepContext = createContext<StepContextType | null>(null);

export const StepProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState(0);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const syncWithGoogleFit = () => {
    // Placeholder for your sync logic
    console.log("Sync triggered");
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'AUTH_SUCCESS',
            uid: user.uid
          }));
        }

        const docRef = doc(db, 'users', user.uid);
        const unsubscribeSnapshot = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setSteps(data.daily_steps || 0);
            setIsInitialLoadDone(true); // Mark load as done once data arrives
          }
        });

        return () => unsubscribeSnapshot();
      } else {
        setSteps(0);
        setIsInitialLoadDone(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  return (
    <StepContext.Provider value={{ 
      steps, 
      setSteps, 
      isInitialLoadDone, 
      setIsInitialLoadDone,
      syncWithGoogleFit,
      isSyncing,
      lastSynced,
      setLastSynced
    }}>
      {children}
    </StepContext.Provider>
  );
};

export const useGlobalSteps = () => {
  const context = useContext(StepContext);
  if (!context) throw new Error("useGlobalSteps must be used within a StepProvider");
  return context;
};