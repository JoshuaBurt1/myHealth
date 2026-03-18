import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth } from '../firebase';
import { Download, LogIn } from 'lucide-react';
const LoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  // --- PWA Logic State ---
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  useEffect(() => {
    // 1. Check if already installed (Standalone Mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    // @ts-ignore - standalone is an iOS specific property on navigator
    const isIosStandalone = window.navigator.standalone === true;
    // If user is already using the app as a PWA, don't show the button
    if (isStandalone || isIosStandalone) {
      setShowInstallButton(false);
      return;
    }
    // 2. Android/Chrome/Desktop Install Prompt logic
    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the browser's default mini-infobar from appearing
      e.preventDefault();
      // Save the event so it can be triggered later by our button
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };
    // 3. iOS Detection (iOS doesn't support 'beforeinstallprompt')
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (isIOS && !isIosStandalone) {
      // We show the button because we'll provide manual instructions via alert
      setShowInstallButton(true);
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    // Hide button automatically once the app is installed
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    });
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  useEffect(() => {
    const handleNativeMessage = async (event: any) => {
      const { type, payload } = event.data;
      if (type === 'GOOGLE_LOGIN_SUCCESS') {
        try {
          // Create a Firebase credential from the token passed by the Native app
          const credential = GoogleAuthProvider.credential(payload);
          const userCredential = await signInWithCredential(auth, credential);
          notifyMobileApp(userCredential.user.uid);
          navigate(`/profile/${userCredential.user.uid}`);
        } catch (err) {
          setError('Firebase Authentication failed');
        }
      }
    };
    window.addEventListener('message', handleNativeMessage);
    return () => window.removeEventListener('message', handleNativeMessage);
  }, [navigate]);
  const handlePWAInstall = async () => {
    if (deferredPrompt) {
      // Logic for Chrome/Android
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }
      setDeferredPrompt(null);
    } else {
      // Logic for iOS (Manual instruction)
      alert("To install myHealth:\n1. Tap the 'Share' icon at the bottom of Safari.\n2. Scroll down and select 'Add to Home Screen' 📲");
    }
  };
  const notifyMobileApp = (uid: string) => {
    // Check if the native bridge exists
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'AUTH_SUCCESS',
        uid: uid
      }));
    } else {
      console.log("Not in a native shell, skipping mobile sync.");
    }
  };
  // Inside LoginScreen.tsx
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      notifyMobileApp(userCredential.user.uid);
      navigate(`/profile/${userCredential.user.uid}`);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };
  const handleGoogleLogin = async () => {
    setError('');
    if (window.ReactNativeWebView) {
      // 1. Tell Native to start the Google flow
      console.log("[Web] Triggering Native Google Sign-In");
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'TRIGGER_GOOGLE_LOGIN' }));
    } else {
      // 2. Standard Web fallback (e.g., Chrome on Desktop)
      try {
        const provider = new GoogleAuthProvider();
        // Only use Popup on Desktop/Full Browsers
        const userCredential = await signInWithPopup(auth, provider);
        navigate(`/profile/${userCredential.user.uid}`);
      } catch (err: any) {
        setError('Google Sign-In failed');
      }
    }
  };
  // Updated Listener inside your useEffect
  useEffect(() => {
    const handleNativeMessage = async (event: any) => {
      // In some environments, event.data is already an object; in others, it's a JSON string.
      let data;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch (e) { return; }
      if (data.type === 'GOOGLE_LOGIN_SUCCESS') {
        try {
          console.log("[Web] Received ID Token from Native, signing into Firebase...");
          const credential = GoogleAuthProvider.credential(data.payload);
          const userCredential = await signInWithCredential(auth, credential);
          notifyMobileApp(userCredential.user.uid);
          navigate(`/profile/${userCredential.user.uid}`);
        } catch (err: any) {
          console.error("Firebase Auth Error:", err);
          setError(`Native Auth Failed: ${err.message}`);
        }
      }
    };
    window.addEventListener('message', handleNativeMessage);
    return () => window.removeEventListener('message', handleNativeMessage);
  }, [navigate]);
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#F8F9FE] p-4">
      <div className="w-full max-w-100 flex flex-col items-center">
        {/* PWA Install Button - Pill Styled */}
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