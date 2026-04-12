import { onAuthStateChanged } from 'firebase/auth';
import { auth} from './firebase';

let initialized = false;

export const initFirebaseAuthListener = () => {
  if (initialized) return;
  initialized = true;

  onAuthStateChanged(auth, async (user) => {
    try {
      if (user) {
        console.log("[Auth] User logged in:", user.uid);
      } else {
        console.log("[Auth] No user - Public Browsing Mode");
      }
    } catch (err) {
      console.error("Auth listener error:", err);
    }
  });
};