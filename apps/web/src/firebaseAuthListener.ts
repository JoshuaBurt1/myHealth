import { onAuthStateChanged } from 'firebase/auth';
import { enableNetwork, disableNetwork } from 'firebase/firestore';
import { auth, db } from './firebase';

let initialized = false;

export const initFirebaseAuthListener = () => {
  if (initialized) return;
  initialized = true;

  onAuthStateChanged(auth, async (user) => {
    try {
      if (user) {
        await enableNetwork(db);
        console.log("[Firestore] Network ENABLED");
      } else {
        await disableNetwork(db);
        console.log("[Firestore] Network DISABLED");
      }
    } catch (err) {
      console.error("Firestore network toggle error:", err);
    }
  });
};