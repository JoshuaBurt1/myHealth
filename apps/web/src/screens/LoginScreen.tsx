// LoginScreen.tsx
// To active the functionality for the Correlate and Intervention Global modes to work (since this is not using Firestore Blaze plan)
// 1. Register a user that logs in with email: global@stats.com
// 2. Login with this user; which runs runGlobalAggregation 
// (only this user can read, average fields by 24 hr period, and write user data to the document myHealth_globalStats/globalStats)

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc, getDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { Download, LogIn } from 'lucide-react';
import * as Maps from '../componentsProfile/profileConstants';

const calculateAge = (dobString: string): number => {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const getPercentile = (sortedArr: number[], p: number) => {
  if (sortedArr.length === 0) return 0;
  const index = (p / 100) * (sortedArr.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sortedArr.length) return sortedArr[lower];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
};

const calculateSkewness = (vals: number[], mean: number, stdDev: number) => {
  if (vals.length < 3 || stdDev === 0) return 0;
  const n = vals.length;
  const m3 = vals.reduce((acc, val) => acc + Math.pow(val - mean, 3), 0) / n;
  return m3 / Math.pow(stdDev, 3);
};

const runGlobalAggregation = async () => {
  console.log("Starting Unified Aggregation (Global & Cohorts)...");
  
  // 1. Threshold Check (24-hour guard to save Firestore usage)
  const statusRef = doc(db, 'myHealth_globalStats', 'status');
  const statusSnap = await getDoc(statusRef);

  if (statusSnap.exists()) {
    const lastUpdated = statusSnap.data().lastUpdated?.toDate();
    const now = new Date();
    //86400000 ms = 1 day
    if (lastUpdated && (now.getTime() - lastUpdated.getTime()) < 2) {
      console.log("✅ Stats are fresh. Skipping.");
      return;
    }
  }

  // 2. Initialize keys and data structures
  const allMetricKeys = [
    ...Object.values({
      ...Maps.VITAL_KEY_MAP, ...Maps.BLOODTEST_KEY_MAP, ...Maps.DIET_KEY_MAP,
      ...Maps.MICRONUTRIENT_KEY_MAP, ...Maps.STRENGTH_KEY_MAP, ...Maps.SPEED_KEY_MAP,
      ...Maps.MOBILITY_KEY_MAP, ...Maps.PHYSIO_KEY_MAP, ...Maps.PLYO_KEY_MAP,
      ...Maps.ENDURANCE_KEY_MAP, ...Maps.YOGA_KEY_MAP
    }),
    'weight', 'height'
  ];

  // Global Stats (Date-based bucket)
  const globalGrouped: Record<string, Record<string, number[]>> = {};
  allMetricKeys.forEach(key => globalGrouped[key] = {});

  // Diet History Stats (MealName -> Date -> Calories bucket)
  const globalDietGrouped: Record<string, Record<string, number[]>> = {};

  // Cohort Stats (Sex -> Type -> Value -> Metric bucket)
  const cohortGrouped: any = { M: { 1: {}, 3: {}, 10: {} }, F: { 1: {}, 3: {}, 10: {} } };

  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    
    for (const userDoc of usersSnap.docs) {
      const profileSnap = await getDoc(doc(db, 'users', userDoc.id, 'profile', 'user_data'));
      
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        const sex = data.sex === 'Female' ? 'F' : 'M';
        const age = calculateAge(data.dob);

        // Process standard metrics
        allMetricKeys.forEach(key => {
          const entries = data[key];
          if (Array.isArray(entries) && entries.length > 0) {
            
            // A. myHealth_globalStats
            entries.forEach((entry: any) => {
              const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
              const dateStr = entry.dateTime?.split('T')[0];
              if (!isNaN(val) && dateStr) {
                if (!globalGrouped[key][dateStr]) globalGrouped[key][dateStr] = [];
                globalGrouped[key][dateStr].push(val);
              }
            });

            // B. myHealth_cohorts
            const lastFiveEntries = entries.slice(-5);
            const validValues = lastFiveEntries
              .map(e => (typeof e.value === 'string' ? parseFloat(e.value) : e.value))
              .filter(v => !isNaN(v));

            if (validValues.length > 0 && age > 0) {
              // Calculate the user's personal average for this metric
              const userAverage = validValues.reduce((a, b) => a + b, 0) / validValues.length;

              const brackets = [
                { type: 1, val: age },
                { type: 3, val: Math.floor(age / 3) * 3 },
                { type: 10, val: Math.floor(age / 10) * 10 }
              ];

              brackets.forEach(b => {
                if (!cohortGrouped[sex][b.type][b.val]) cohortGrouped[sex][b.type][b.val] = {};
                if (!cohortGrouped[sex][b.type][b.val][key]) cohortGrouped[sex][b.type][b.val][key] = [];  
                cohortGrouped[sex][b.type][b.val][key].push(userAverage);
              });
            }
          }
        });

        // Process diet_history for meals
        const dietHistory = data.diet_history;
        if (Array.isArray(dietHistory)) {
          dietHistory.forEach((entry: any) => {
            const mealName = entry.mealName;
            const dateStr = entry.dateTime?.split('T')[0];
            let calories = parseFloat(entry.macros?.calories);
            if (isNaN(calories)) {
              calories = 1;
            }

            if (mealName && dateStr && typeof calories === 'number' && !isNaN(calories)) {
              if (!globalDietGrouped[mealName]) globalDietGrouped[mealName] = {};
              if (!globalDietGrouped[mealName][dateStr]) globalDietGrouped[mealName][dateStr] = [];
              globalDietGrouped[mealName][dateStr].push(calories);
            }
          });
        }
      }
    }

    // 4. myHealth_globalStats
    const finalGlobalStats: any = { 
      lastUpdated: serverTimestamp(),
      diet_history: []
    };

    Object.keys(globalGrouped).forEach(key => {
      const dateBuckets = globalGrouped[key];
      const resultList: any[] = [];
      Object.keys(dateBuckets).forEach(date => {
        const vals = dateBuckets[date];
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        resultList.push({ value: parseFloat(mean.toFixed(2)), dateTime: `${date}T12:00:00Z` });
      });
      if (resultList.length > 0) {
        finalGlobalStats[key] = resultList.sort((a, b) => a.dateTime.localeCompare(b.dateTime));
      }
    });

    Object.keys(globalDietGrouped).forEach(mealName => {
      const dateBuckets = globalDietGrouped[mealName];
      
      Object.keys(dateBuckets).forEach(date => {
        const vals = dateBuckets[date];
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        
        finalGlobalStats.diet_history.push({
          mealName: mealName,
          dateTime: `${date}T12:00:00Z`,
          macros: {
            calories: parseFloat(mean.toFixed(2))
          }
        });
      });
    });

    finalGlobalStats.diet_history.sort((a: any, b: any) => a.dateTime.localeCompare(b.dateTime));

    await setDoc(doc(db, 'myHealth_globalStats', 'globalStats'), finalGlobalStats);

    // 5. myHealth_cohorts
    for (const sex of ['M', 'F']) {
      for (const type of [1, 3, 10]) {
        const bValues = Object.keys(cohortGrouped[sex][type]);
        for (const bVal of bValues) {
          const docId = `${sex}_t${type}_v${bVal}`;
          const finalCohortDoc: any = {
            metadata: { sex, bracketType: type, bracketValue: parseInt(bVal) },
            stats: {},
            lastUpdated: serverTimestamp()
          };

          const cohortMetrics = cohortGrouped[sex][type][bVal];
          Object.keys(cohortMetrics).forEach(key => {
            const vals = cohortMetrics[key].sort((a: number, b: number) => a - b);
            const n = vals.length;
            const mean = vals.reduce((a: number, b: number) => a + b, 0) / n;
            const stdDev = Math.sqrt(vals.reduce((a: number, b: number) => a + Math.pow(b - mean, 2), 0) / n);

            finalCohortDoc.stats[key] = {
              mean: parseFloat(mean.toFixed(2)),
              stdDev: parseFloat(stdDev.toFixed(2)),
              median: parseFloat(getPercentile(vals, 50).toFixed(2)),
              q1: parseFloat(getPercentile(vals, 25).toFixed(2)),
              q3: parseFloat(getPercentile(vals, 75).toFixed(2)),
              min: vals[0],
              max: vals[n - 1],
              sampleSize: n,
              skewness: parseFloat(calculateSkewness(vals, mean, stdDev).toFixed(3))
            };
          });
          await setDoc(doc(db, 'myHealth_cohorts', docId), finalCohortDoc);
        }
      }
    }

    await setDoc(statusRef, { lastUpdated: serverTimestamp() });
    console.log("✅ Unified Aggregation Successful.");
  } catch (err) {
    console.error("❌ Aggregation Error:", err);
  }
};

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
      
      // Check if this is the special trigger account or just a normal login
      if (email === "global@stats.com") {
        await runGlobalAggregation();
        return; 
      }

      await updateLoginTimestamps(userCredential.user.uid);
      // Silent check for global update on every login
      runGlobalAggregation(); 

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