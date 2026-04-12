// LoginScreen.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { Download, LogIn } from 'lucide-react';

const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // PWA Logic State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);

  useEffect(() => {
    // Check if already installed (Standalone Mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // @ts-ignore - standalone is an iOS specific property on navigator
    const isIosStandalone = window.navigator.standalone === true;
    // If user is already using the app as a PWA, don't show the button
    if (isStandalone || isIosStandalone) {
      setShowInstallButton(false);
      return;
    }
    
    // Android/Chrome/Desktop Install Prompt logic
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
  
    // iOS Detection (iOS doesn't support 'beforeinstallprompt')
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS && !isIosStandalone) {
      setShowInstallButton(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Helper function to track login and active alerts
  const updateLoginTimestamps = async (uid: string) => {
    // Update Root User Doc (last_login / previous_login)
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    const updatePayload: any = {
      last_login: serverTimestamp()
    };

    if (userSnap.exists() && userSnap.data().last_login) {
      updatePayload.previous_login = userSnap.data().last_login;
    }
    await setDoc(userRef, updatePayload, { merge: true });

    // Check profile/user_data for activeAlerts
    const profileRef = doc(db, 'users', uid, 'profile', 'user_data');
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      const profileData = profileSnap.data();
      const alerts = profileData.activeAlerts;
      const hasActiveAlerts = Array.isArray(alerts) && alerts.length > 0;

      if (hasActiveAlerts) {
        await setDoc(profileRef, {
          activeAlert_last: serverTimestamp()
        }, { merge: true });
      }
    }
  };

  useEffect(() => {
    const handleNativeMessage = async (event: any) => {
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) {
        console.error("[Web] Failed to parse message:", e);
        return;
      }

      if (!data || !data.type) return;

      if (data.type === 'GOOGLE_LOGIN_SUCCESS') {
        try {
          console.log("[Web] Token received, authenticating with Firebase...");
          const credential = GoogleAuthProvider.credential(data.payload);
          const userCredential = await signInWithCredential(auth, credential);

          await updateLoginTimestamps(userCredential.user.uid);
          
          notifyMobileApp(userCredential.user.uid);
          navigate(`/profile/${userCredential.user.uid}`);
        } catch (err: any) {
          console.error("Firebase Auth Error:", err);
          setError(`Login failed: ${err.message}`);
        }
      }
    };

    window.addEventListener('message', handleNativeMessage);
    document.addEventListener('message', handleNativeMessage as any);

    return () => {
      window.removeEventListener('message', handleNativeMessage);
      document.removeEventListener('message', handleNativeMessage as any);
    };
  }, [navigate]);

  const handlePWAInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
      setDeferredPrompt(null);
    } else {
      alert("To install myHealth:\n1. Tap the 'Share' icon at the bottom of Safari.\n2. Scroll down and select 'Add to Home Screen' 📲");
    }
  };

  const notifyMobileApp = (uid: string) => {
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AUTH_SUCCESS',
        uid: uid
      }));
    } else {
      console.log("Not in a native shell, skipping mobile sync.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);

      await updateLoginTimestamps(userCredential.user.uid);

      notifyMobileApp(userCredential.user.uid);
      navigate(`/profile/${userCredential.user.uid}`);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    if (window.ReactNativeWebView) {
      console.log("[Web] Triggering Native Google Sign-In");
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TRIGGER_GOOGLE_LOGIN' }));
    } else {
      try {
        const provider = new GoogleAuthProvider();
        const userCredential = await signInWithPopup(auth, provider);
        
        await updateLoginTimestamps(userCredential.user.uid);

        navigate(`/profile/${userCredential.user.uid}`);
      } catch (err: any) {
        setError('Google Sign-In failed');
      }
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FE] p-4">
      <div className="w-full max-w-100 flex flex-col items-center">
        {showInstallButton && (
          <button
            onClick={handlePWAInstall}
            className="mb-6 px-6 py-2 bg-white border border-indigo-100 text-indigo-600 rounded-full text-xs font-bold shadow-sm hover:bg-indigo-50 active:scale-95 transition-all flex items-center gap-2 animate-bounce"
          >
            <Download size={14} />
            INSTALL MYHEALTH APP
          </button>
        )}
        <div className="w-full bg-white p-8 md:p-10 rounded-[2.5rem] shadow-xl shadow-indigo-100/50 border border-slate-50 flex flex-col items-center">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Welcome Back</h1>
            <p className="text-slate-400 mt-2 text-sm font-medium">Sign in to your health portal</p>
          </div>
          {error && (
            <div className="w-full mb-6 p-3 text-xs text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="w-full space-y-4">
            <input
              type="email"
              placeholder="Email"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              type="password"
              placeholder="Password"
              className="w-full p-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="submit"
              className="w-full bg-[#3F51B5] text-white py-4 rounded-full font-bold shadow-lg shadow-indigo-200 hover:bg-[#303F9F] active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
            >
              <LogIn size={20} />
              Login
            </button>
          </form>
          <div className="mt-8">
            <Link to="/register" className="text-indigo-500 hover:text-indigo-700 text-sm font-semibold transition-colors">
              Don't have an account? <span className="underline decoration-indigo-200">Register Here</span>
            </Link>
          </div>
          <div className="w-full flex items-center gap-4 my-8">
            <div className="h-px flex-1 bg-slate-100"></div>
            <span className="text-[10px] uppercase tracking-widest text-slate-300 font-black">OR</span>
            <div className="h-px flex-1 bg-slate-100"></div>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 border border-slate-200 py-3 rounded-full hover:bg-slate-50 active:bg-slate-100 transition-all"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            <span className="text-slate-600 font-bold text-sm">Sign in with Google</span>
          </button>
        </div>
      </div>
    </div>
  );
};
export default LoginScreen;