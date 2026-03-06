import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

const StepContext = createContext<any>(null);

declare global {
  interface Window {
    google: any;
  }
}

export const StepProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [steps, setSteps] = useState(0);
  const [isInitialLoadDone, setIsInitialLoadDone] = useState(false);
  const [isPermissionGranted, setIsPermissionGranted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  const requestPermission = useCallback(async () => {
    if (isPermissionGranted) return;
    try {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const response = await (DeviceMotionEvent as any).requestPermission();
        if (response === 'granted') setIsPermissionGranted(true);
      } else {
        setIsPermissionGranted(true); 
      }
    } catch (err) {
      console.error("Motion Permission Error:", err);
    }
  }, [isPermissionGranted]);

  const fetchOfficialSteps = async (token: string) => {
    setIsSyncing(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const end = now.getTime();

    try {
      const res = await fetch("https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          aggregateBy: [{ dataTypeName: "com.google.step_count.delta" }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis: start,
          endTimeMillis: end
        })
      });

      const data = await res.json();
    
      const officialSteps = data.bucket[0]?.dataset[0]?.point[0]?.value[0]?.intVal || 0;   

      if (officialSteps >= 0) {
        setSteps(officialSteps);
        setLastSynced(new Date());
        
        const user = auth.currentUser;
        if (user) {
            const todayId = new Date().toISOString().split('T')[0];
            
            // 1. Update main user doc
            await setDoc(doc(db, 'users', user.uid), {
            daily_steps: officialSteps,
            last_step_update: serverTimestamp(),
            last_google_sync: serverTimestamp()
            }, { merge: true });

            // 2. Create/Update historical record for the graph
            await setDoc(doc(db, 'users', user.uid, 'step_history', todayId), {
            steps: officialSteps,
            timestamp: serverTimestamp()
            }, { merge: true });
        }
      }
    } catch (err) {
      console.error("Google Fit Fetch Error:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncWithGoogleFit = useCallback(() => {
    if (!window.google) {
      alert("Google Identity Services not loaded yet. Make sure the script is in your index.html");
      return;
    }

    const client = window.google.accounts.oauth2.initTokenClient({
      // IMPORTANT: Replace this with your actual Google Cloud Client ID
      client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com', 
      scope: 'https://www.googleapis.com/auth/fitness.activity.read',
      callback: async (tokenResponse: any) => {
        if (tokenResponse && tokenResponse.access_token) {
          await fetchOfficialSteps(tokenResponse.access_token);
        }
      },
    });
    client.requestAccessToken();
  }, []);

  useEffect(() => {
    const sync = async () => {
      const user = auth.currentUser;
      if (user && isInitialLoadDone && steps > 0 && steps % 20 === 0) {
        await setDoc(doc(db, 'users', user.uid), {
          daily_steps: steps,
          last_step_update: serverTimestamp()
        }, { merge: true });
      }
    };
    sync();
  }, [steps, isInitialLoadDone]);

  useEffect(() => {
    if (!isPermissionGranted) return;

    let lastStepTime = 0;
    const threshold = 10.8; 
    const stepDelay = 250; 

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      
      const mag = Math.sqrt((acc.x || 0)**2 + (acc.y || 0)**2 + (acc.z || 0)**2);
      const now = Date.now();

      if (mag > threshold && (now - lastStepTime) > stepDelay) {
        setSteps(prev => prev + 1);
        lastStepTime = now;
      }
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => window.removeEventListener('devicemotion', handleMotion);
  }, [isPermissionGranted]);

  return (
    <StepContext.Provider value={{ 
      steps, 
      setSteps, 
      isInitialLoadDone, 
      setIsInitialLoadDone, 
      requestPermission, 
      isPermissionGranted,
      syncWithGoogleFit,
      isSyncing,
      lastSynced,
      setLastSynced
    }}>
      {children}
    </StepContext.Provider>
  );
};

export const useGlobalSteps = () => useContext(StepContext);