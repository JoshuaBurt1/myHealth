// ProfileScreen.tsx
// This is used to hide the current steps and sync button in web version (viewable in mobile web view only)
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, serverTimestamp, arrayUnion, onSnapshot, writeBatch, deleteField, increment } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Camera, Stars, TrendingUp, Flag, Activity, UploadCloud, Footprints, RefreshCw, Dumbbell, Timer, PlusCircle } from 'lucide-react';
import { Badge, InputField, CollapsibleSection } from '../profileComponents/ProfileUI';
import { VitalModal, WorkoutModal, FollowModal } from '../profileComponents/ProfileModals';
import { useImageUpload } from '../profileComponents/useImageUpload';
import PrivacyWrapper from '../profileComponents/PrivacyWrapper';
import FollowButton from '../profileComponents/FollowButton';
import DataScreen from '../profileComponents/DataScreen';

const VITAL_KEY_MAP: Record<string, string> = {
  'Blood Pressure (Systolic)': 'bpSyst',
  'Blood Pressure (Diastolic)': 'bpDias',
  'Heart Rate (BPM)': 'hr',
  'SpO2 (%)': 'spo2',
  'Resp Rate': 'rr',
  'Temp (°C)': 'temp',
  'Glucose': 'glucose',
  'Cholesterol': 'cholesterol',
  'Ketones': 'ketones',
  'Uric Acid': 'uricAcid',
  'Lactate': 'lactate',
  'Hemoglobin': 'hemoglobin',
  'Hematocrit': 'hematocrit'
};
const STRENGTH_KEY_MAP: Record<string, string> = {
  'Bench Press': 'benchPress',
  'Squat': 'squat',
  'Deadlift': 'deadlift'
};
const SPEED_KEY_MAP: Record<string, string> = {
  '100m': 'speed100m',
  '400m': 'speed400m',
  '1 mile': 'speed1Mile',
  'Steps' : 'steps'
};
const VITAL_ADDONS = Object.keys(VITAL_KEY_MAP);
const STRENGTH_LIST = Object.keys(STRENGTH_KEY_MAP);
const SPEED_LIST = Object.keys(SPEED_KEY_MAP);

const ProfileScreen: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [steps, setSteps] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  
  const { userId } = useParams<{ userId: string }>();
  const currentUserId = auth.currentUser?.uid;
  const isMe = userId === currentUserId;

  const [loading, setLoading] = useState(true);
  const { handlePickImage, isUploading: imageUploading } = useImageUpload(
    userId, 
    (base64) => setProfileImage(base64)
  );
  const [saving, setSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const [followersList, setFollowersList] = useState<{uid: string, name: string}[]>([]);
  const [followingList, setFollowingList] = useState<{uid: string, name: string}[]>([]);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'followers' | 'following'}>({ isOpen: false, type: 'followers' });

  const [showVitalModal, setShowVitalModal] = useState(false);
  const [vitalForm, setVitalForm] = useState<{
    type: 'addon' | 'custom';
    name: string;
    value: string;
    customVarName: string;
  }>({
    type: 'addon',
    name: '',
    value: '',
    customVarName: ''
  });

  const [dynamicVitals, setDynamicVitals] = useState<{key: string, label: string, isCustom: boolean, unit?: string}[]>([]);
  const [dynamicVitalsInputs, setDynamicVitalsInputs] = useState<Record<string, string>>({});

  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [workoutForm, setWorkoutForm] = useState<{
    type: 'strength' | 'speed' | 'custom';
    name: string;
    value: string;
    customVarName: string;
  }>({
    type: 'strength',
    name: '',
    value: '',
    customVarName: ''
  });
    
  const [trackedExercises, setTrackedExercises] = useState<{name: string, label: string, type: string, unit?: string}[]>([]);
  const [exerciseInputs, setExerciseInputs] = useState<Record<string, string>>({});

  const [hiddenOther, setHiddenOther] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '', goal: '', gems: '', age: '', height: '', weight: '', bmi: ''
  });

  const availableVitalAddons = VITAL_ADDONS.filter(addon => !dynamicVitals.some(v => v.label === addon));
  const availableStrengthList = STRENGTH_LIST.filter(item => !trackedExercises.some(ex => ex.name === item));
  const availableSpeedList = SPEED_LIST.filter(item => !trackedExercises.some(ex => ex.name === item));
  const sanitizeKey = (name: string) => `custom_${name.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;

  // --- 1. Listen for data coming BACK from Native App ---
  useEffect(() => {
    const handleNativeMessage = async (event: any) => {
      let data = event.data;
      try {
        if (typeof data === 'string') data = JSON.parse(data);
      } catch (e) { return; }

      if (data.type === 'HEALTH_CONNECT_RESULT') {
        const { payload } = data;
        setIsSyncing(false);
        setLastSynced(new Date());

        if (payload.error) {
          console.error("Sync Error:", payload.error);
          return;
        }

        // Update local UI
        setSteps(payload.today?.steps || 0);

        // --- FIRESTORE WRITE ---
        if (userId && (payload.today?.steps > 0 || payload.yesterday?.steps > 0 || payload.hr > 0)) {
          const profileDataRef = doc(db, 'users', userId, 'profile', 'user_data');
          const userRootRef = doc(db, 'users', userId);

          try {
            const profileSnap = await getDoc(profileDataRef);
            const profileData = profileSnap.exists() ? profileSnap.data() : {};
            
            const profileUpdates: any = {};
            let stepsArray = Array.isArray(profileData.steps) ? [...profileData.steps] : [];
            
            // Map holding previously rewarded totals (e.g. {"2026-03-12": 4500})
            let stepRewards = profileData.stepRewards || {}; 
            let totalNewGems = 0;

            // Helper to process a specific day
            const processDayData = (dayData: { date: string, steps: number } | undefined) => {
              if (!dayData || dayData.steps <= 0) return;

              // 1. Array Update: Ensure only one max entry per day
              const index = stepsArray.findIndex((entry: any) => 
                entry.dateTime && entry.dateTime.startsWith(dayData.date)
              );

              // Use current time for today, but artificially set yesterday to 23:59 so line charts display it correctly
              const isToday = dayData.date === payload.today?.date;
              const logTime = isToday ? new Date().toISOString() : `${dayData.date}T23:59:59.000Z`;

              if (index >= 0) {
                const existingSteps = parseInt(stepsArray[index].value, 10);
                if (dayData.steps > existingSteps) {
                  stepsArray[index].value = String(dayData.steps);
                  stepsArray[index].dateTime = logTime;
                }
              } else {
                stepsArray.push({ value: String(dayData.steps), dateTime: logTime });
              }

              // 2. Gems Calculation (1 gem = 100 steps)
              const alreadyRewarded = stepRewards[dayData.date] || 0;
              const unrewardedSteps = dayData.steps - alreadyRewarded;

              if (unrewardedSteps >= 100) {
                const earnedGems = Math.floor(unrewardedSteps / 100);
                totalNewGems += earnedGems;
                
                // Add the EXACT chunk we converted to gems to the total rewarded.
                // (e.g. If unrewarded=150 -> earnedGems=1 -> accounted=100. The remaining 50 wait for next sync)
                stepRewards[dayData.date] = alreadyRewarded + (earnedGems * 100);
              }
            };

            processDayData(payload.yesterday);
            processDayData(payload.today);

            // Reassign updated arrays/objects to payload
            profileUpdates.steps = stepsArray;
            profileUpdates.stepRewards = stepRewards;

            if (payload.hr > 0) {
              profileUpdates.hr = arrayUnion({ value: String(payload.hr), dateTime: new Date().toISOString() });
            }

            // Root Document payload
            const rootUpdates: any = {
              daily_steps: payload.today?.steps || 0,
              last_step_update: serverTimestamp()
            };

            // Increment gems securely on the server side
            if (totalNewGems > 0) {
              rootUpdates.gems = increment(totalNewGems);
            }

            // Commit Writes
            await setDoc(profileDataRef, profileUpdates, { merge: true });
            await setDoc(userRootRef, rootUpdates, { merge: true });

            if (totalNewGems > 0) {
              alert(`Sync successful! You earned ${totalNewGems} gems from your steps! 💎`);
            }
            
          } catch (err) {
            console.error("Firestore Write Error:", err);
          }
        }
      }
    };

    window.addEventListener('message', handleNativeMessage);
    document.addEventListener('message', handleNativeMessage);

    return () => {
      window.removeEventListener('message', handleNativeMessage);
      document.removeEventListener('message', handleNativeMessage);
    };
  }, [userId]);

  // --- 2. Send the command TO the Native App ---
  const syncWithGoogleFit = () => {
    setIsSyncing(true);
    
    // Check if we are inside the React Native WebView
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ 
        type: 'SYNC_HEALTH_CONNECT' 
      }));
    } else {
      setIsSyncing(false);
      alert("Health Connect sync is only available on the mobile app.");
    }
  };

  //load user data 
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const userRootRef = doc(db, 'users', userId);
    const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
    const imageRef = doc(db, 'users', userId, 'profile', 'image_data');
    const followersRef = query(collection(db, 'users', userId, 'followers'));
    const followingRef = query(collection(db, 'users', userId, 'following'));

    // 1. Listen to Root User Doc (Steps, Gems, Display Name)
    const unsubRoot = onSnapshot(userRootRef, (docSnap) => {
      if (docSnap.exists()) {
        const rootData = docSnap.data();
        setFormData(prev => ({ 
          ...prev, 
          name: rootData.display_name || prev.name,
          gems: rootData.gems !== undefined ? rootData.gems.toString() : '0' 
        }));
        if (rootData.daily_steps !== undefined) setSteps(rootData.daily_steps);
        if (rootData.last_step_update) setLastSynced(rootData.last_step_update.toDate());
      }
    });

    // 2. Listen to Profile Data (Vitals, Workouts, Bio info)
    const unsubProfile = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        const profData = docSnap.data();
        
        setFormData(prev => ({
          ...prev,
          name: profData.name || prev.name,
          goal: profData.goal || '',
          age: profData.age?.length > 0 ? profData.age[profData.age.length - 1].value : '',
          height: profData.height?.length > 0 ? profData.height[profData.height.length - 1].value : '',
          weight: profData.weight?.length > 0 ? profData.weight[profData.weight.length - 1].value : '',

        }));

        if (profData.hiddenOther) setHiddenOther(profData.hiddenOther);

        // Dynamic Vitals Parsing
        const loadedDynamicVitals: typeof dynamicVitals = [];
        const newDynamicVitalsInputs: Record<string, string> = {};
        const seenVitals = new Set<string>();

        if (Array.isArray(profData.customVitalsDefinitions)) {
          profData.customVitalsDefinitions.forEach((def: any) => {
            if (!seenVitals.has(def.key)) {
              loadedDynamicVitals.push({ key: def.key, label: def.name, isCustom: def.key.startsWith('custom_'), unit: def.unit });
              newDynamicVitalsInputs[def.key] = '';
              seenVitals.add(def.key);
            }
          });
        }

        VITAL_ADDONS.forEach(addon => {
          const key = VITAL_KEY_MAP[addon];
          if (profData[key] !== undefined && !seenVitals.has(key)) {
            loadedDynamicVitals.push({ key, label: addon, isCustom: false });
            newDynamicVitalsInputs[key] = '';
            seenVitals.add(key);
          }
        });

        setDynamicVitals(loadedDynamicVitals);
        setDynamicVitalsInputs(newDynamicVitalsInputs);

        // Tracked Exercises Parsing
        const loadedExercises: typeof trackedExercises = [];
        const newExerciseInputs: Record<string, string> = {};
        const seenExercises = new Set<string>();

        if (Array.isArray(profData.customWorkoutsDefinitions)) {
          profData.customWorkoutsDefinitions.forEach((def: any) => {
            if (!seenExercises.has(def.key)) {
              loadedExercises.push({ name: def.key, label: def.name, type: def.type, unit: def.unit });
              newExerciseInputs[def.key] = '';
              seenExercises.add(def.key);
            }
          });
        }

        [...Object.entries(STRENGTH_KEY_MAP), ...Object.entries(SPEED_KEY_MAP)].forEach(([label, key]) => {
          if (profData[key] !== undefined && !seenExercises.has(key)) {
            const isStrength = Object.values(STRENGTH_KEY_MAP).includes(key);
            loadedExercises.push({ name: key, label: label, type: isStrength ? 'strength' : 'speed', unit: isStrength ? 'kg' : 'min' });
            newExerciseInputs[key] = '';
            seenExercises.add(key);
          }
        });

        setTrackedExercises(loadedExercises);
        setExerciseInputs(newExerciseInputs);
      }
      setLoading(false); // Stop loading once main profile is fetched
    });

    // 3. Listen to Profile Image
    const unsubImage = onSnapshot(imageRef, (docSnap) => {
      if (docSnap.exists()) setProfileImage(docSnap.data().imageId);
    });

    // 4. Listen to Followers/Following Lists
    const unsubFollowers = onSnapshot(followersRef, (snap) => {
      setFollowersList(snap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' })));
      setFollowerCount(snap.size);
    });

    const unsubFollowing = onSnapshot(followingRef, (snap) => {
      setFollowingList(snap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' })));
      setFollowingCount(snap.size);
    });

    // 5. Follow Status
    let unsubStatus = () => {};
    if (!isMe && currentUserId) {
      unsubStatus = onSnapshot(doc(db, 'users', currentUserId, 'following', userId), (docSnap) => {
        setIsFollowing(docSnap.exists());
      });
    }

    // Cleanup all listeners on unmount
    return () => {
      unsubRoot();
      unsubProfile();
      unsubImage();
      unsubFollowers();
      unsubFollowing();
      unsubStatus();
    };
  }, [userId, isMe, currentUserId]);

  useEffect(() => {
    const h = parseFloat(formData.height);
    const w = parseFloat(formData.weight);
    if (h > 0 && w > 0) {
      const bmiVal = w / ((h / 100) ** 2);
      setFormData(prev => ({ ...prev, bmi: bmiVal.toFixed(1) }));
    }
  }, [formData.height, formData.weight]);

  const handleFollowUpdate = (delta: number, followingStatus: boolean) => {
    setFollowerCount(prev => Math.max(0, prev + delta));
    setIsFollowing(followingStatus);
    if (auth.currentUser) {
      const currentUserId = auth.currentUser.uid;
      const currentUserName = auth.currentUser.displayName || "You";
      if (delta > 0) {
        setFollowersList(prev => [...prev, { uid: currentUserId, name: currentUserName }]);
      } else {
        setFollowersList(prev => prev.filter(user => user.uid !== currentUserId));
      }
    }
    setRefreshTrigger(p => p + 1); 
  };

  const toggleVisibilityOther = async (fieldName: string) => {
    const isHidden = hiddenOther.includes(fieldName);
    const newList = isHidden ? hiddenOther.filter(n => n !== fieldName) : [...hiddenOther, fieldName];
    setHiddenOther(newList);

    try {
      const profileRef = doc(db, 'users', userId!, 'profile', 'user_data');
      await setDoc(profileRef, { hiddenOther: newList }, { merge: true });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error("Error toggling visibility", err);
    }
  };

  const handleDeleteField = async (fieldLabel: string, fieldKey: string, category: 'vital' | 'workout') => {
  if (!window.confirm(`Are you sure you want to delete "${fieldLabel}" and all its logs?`)) return;
  
  const profileRef = doc(db, 'users', userId!, 'profile', 'user_data');
    try {
      const docSnap = await getDoc(profileRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isWorkout = category === 'workout';
        
        // 1. Remove the data logs and the definition
        const definitionKey = isWorkout ? 'customWorkoutsDefinitions' : 'customVitalsDefinitions';
        const updatedDefinitions = (data[definitionKey] || []).filter((def: any) => def.key !== fieldKey);
        
        await setDoc(profileRef, { 
          [fieldKey]: deleteField(),
          [definitionKey]: updatedDefinitions
        }, { merge: true });

        // 2. Update Local State
        if (isWorkout) {
          setTrackedExercises(prev => prev.filter(e => e.name !== fieldKey));
        } else {
          setDynamicVitals(prev => prev.filter(v => v.key !== fieldKey));
        }
        
        setRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      console.error("Failed to delete field", err);
    }
  };

  const handleSaveItem = async (mode: 'vital' | 'workout') => {
    const isVital = mode === 'vital';
    const form = isVital ? vitalForm : workoutForm;
    if (!userId || !form.name) return;

    const displayName = form.name.trim();
    let targetKey: string;

    // 1. Determine the key (Standard Map or Sanitize Custom)
    if (isVital) {
      targetKey = VITAL_KEY_MAP[displayName] || sanitizeKey(displayName);
    } else {
      targetKey = STRENGTH_KEY_MAP[displayName] || SPEED_KEY_MAP[displayName] || sanitizeKey(displayName);
    }

    // 2. Duplicate Check
    const isDuplicate = isVital 
      ? dynamicVitals.some(v => v.key === targetKey)
      : trackedExercises.some(ex => ex.name === targetKey);

    if (isDuplicate) {
      alert(`This ${mode} is already being tracked.`);
      return;
    }

    setSaving(true);
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const isCustom = isVital ? form.type === 'custom' : (form.type !== 'strength' && form.type !== 'speed');
      const unit = form.customVarName || (form.type === 'strength' ? 'kg' : 'min');

      // 3. Update LOCAL UI STATE
      if (isVital) {
        setDynamicVitals(prev => [...prev, { key: targetKey, label: displayName, isCustom, unit }]);
        setDynamicVitalsInputs(prev => ({ ...prev, [targetKey]: '' }));
      } else {
        setTrackedExercises(prev => [...prev, { name: targetKey, label: displayName, type: form.type, unit }]);
        setExerciseInputs(prev => ({ ...prev, [targetKey]: '' }));
      }

      // 4. Construct FIRESTORE PAYLOAD
      const definition = { name: displayName, key: targetKey, unit, type: form.type };
      const payload = {
        [targetKey]: [], // Initialize the top-level array for logs
        [isVital ? 'customVitalsDefinitions' : 'customWorkoutsDefinitions']: arrayUnion(definition)
      };

      await setDoc(profileRef, payload, { merge: true });
      isVital ? setShowVitalModal(false) : setShowWorkoutModal(false);
    } catch (err) {
      console.error(err);
      alert(`Failed to add ${mode}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAllHealthData = async () => {
    if (!userId) return;
    setSaving(true);

    try {
      const now = new Date();
      const nowISO = now.toISOString();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');

      const rootSnap = await getDoc(userRootRef);
      const rootData = rootSnap.data() || {};
      
      const isEligible = !rootData.last_vitals_update || 
        (now.getTime() - rootData.last_vitals_update.toDate().getTime()) > 6 * 60 * 60 * 1000;

      const isValid = (v: any) => v && v.toString().trim() !== '' && v.toString().trim() !== '0' && !isNaN(Number(v));
      const updateData: any = { name: formData.name, goal: formData.goal };

      ['age', 'height', 'weight', 'bmi'].forEach(f => {
        if (isValid(formData[f as keyof typeof formData])) 
          updateData[f] = arrayUnion({ value: formData[f as keyof typeof formData], dateTime: nowISO });
      });

      dynamicVitals.forEach(v => {
        const val = dynamicVitalsInputs[v.key];
        if (isValid(val)) {
          updateData[v.key] = arrayUnion({ value: Number(val), dateTime: nowISO });
        }
      });

      // 3. Exercises
      trackedExercises.forEach(ex => {
        const val = exerciseInputs[ex.name];
        if (isValid(val)) {
          updateData[ex.name] = arrayUnion({ 
            value: Number(val), 
            dateTime: nowISO,
            unit: ex.unit || null 
          });
        }
      });

      const hasNewData = Object.keys(updateData).some(key => !['name', 'goal'].includes(key));
      
      if (!hasNewData) {
        alert('No new values to update.');
        setSaving(false);
        return;
      }

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });

      if (isEligible) {
        batch.update(userRootRef, { 
          gems: increment(10),
          last_vitals_update: serverTimestamp()
        });
      }
      
      await batch.commit();

      setRefreshTrigger(p => p + 1);
      alert(`Data updated!${isEligible ? ' +10 gems (6h recharge)' : ''}`);

    } catch (err) {
      console.error("Save Error:", err);
      alert('Failed to save data.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <RefreshCw className="animate-spin text-indigo-600 mb-2" size={32} />
        <p className="text-slate-500 font-medium text-sm">Loading Profile...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen pb-20 relative">
      
      {/* RESPONSIVE TWO-COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start mt-2">
        
        {/* LEFT COLUMN: Profile, Controls, Vitals, Exercises */}
        <div className="space-y-4">
          
          {/* COMPACT PROFILE HEADER */}
          <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row items-center sm:items-start gap-5">
            {/* Left/Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 md:w-28 md:h-28 rounded-full overflow-hidden bg-slate-200 border-4 border-white shadow-md flex items-center justify-center">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User size={48} className="text-slate-400" />
                )}
                {imageUploading && (
                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-full">
                    <Activity className="animate-spin text-white" />
                  </div>
                )}
              </div>
              {isMe && (
                <label className="absolute bottom-0 right-0 bg-blue-600 p-1.5 rounded-full text-white cursor-pointer hover:bg-blue-700 shadow-sm transition-colors">
                  {imageUploading ? <RefreshCw size={14} className="animate-spin" /> : <Camera size={14} />}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*" 
                    onChange={handlePickImage} 
                    disabled={imageUploading} 
                  />
                </label>
              )}
            </div>


            {/* Right/Stats & Badges */}
            <div className="flex-1 w-full flex flex-col justify-center">
              {/* Followers / Following Container on Top Right */}
              <div className="flex justify-center sm:justify-start gap-3 mb-3">
                <div 
                  className="bg-blue-50 hover:bg-blue-100 transition-colors rounded-xl px-4 py-2 cursor-pointer flex-1 sm:flex-none text-center"
                  onClick={() => setModalConfig({ isOpen: true, type: 'followers' })}
                >
                  <div className="text-xl font-black text-slate-800">{followerCount}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Followers</div>
                </div>
                <div 
                  className="bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-xl px-4 py-2 cursor-pointer flex-1 sm:flex-none text-center"
                  onClick={() => setModalConfig({ isOpen: true, type: 'following' })}
                >
                  <div className="text-xl font-black text-slate-800">{followingCount}</div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Following</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                <Badge icon={<Stars size={14} className="fill-current"/>} color="bg-indigo-100 text-indigo-700 border border-indigo-200" label={`${formData.gems} Gems`}/>
                {followerCount > 10 && <Badge icon={<Stars size={14}/>} color="bg-amber-100 text-amber-600" label="Social" />}
                {profileImage && <Badge icon={<Camera size={14}/>} color="bg-blue-100 text-blue-600" label="Photogenic" />}
                {followingCount > 0 && <Badge icon={<TrendingUp size={14}/>} color="bg-green-100 text-green-600" label="Networker" />}
              </div>
            </div>
          </div>

          {!isMe && (
            <FollowButton 
              targetUserId={userId!} 
              targetUserName={formData.name} 
              isFollowingInitial={isFollowing}
              onFollowChange={handleFollowUpdate}
            />
          )}

          <div className="space-y-4">
            {/* BASIC INFORMATION & STEPS */}
            <CollapsibleSection title="Basic Information" icon={<User size={18}/>}>
              <div className="space-y-3 mt-3">
                
                {/* Sync Fit merged into Basic Info */}
                {isMe && !!window.ReactNativeWebView && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-orange-50/60 p-3 rounded-2xl border border-orange-100 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-orange-100 p-2.5 rounded-xl">
                        <Footprints className="text-orange-500" size={20} />
                      </div>
                      <div>
                        <h4 className="text-lg font-black text-slate-800 leading-none mb-1">{steps.toLocaleString()}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Steps</p>
                      </div>
                    </div>

                    <div className="flex flex-col sm:items-end">
                      <button 
                        onClick={syncWithGoogleFit}
                        disabled={isSyncing}
                        className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                          isSyncing 
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                            : 'bg-white text-indigo-600 hover:bg-indigo-50 border border-indigo-100 active:scale-95'
                        }`}
                      >
                        <RefreshCw size={14} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? 'Syncing...' : 'Sync Fit'}
                      </button>
                      {lastSynced && (
                        <span className="mt-1 text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Synced: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <InputField label="Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} disabled={!isMe} />
                <InputField label="Goal" value={formData.goal} onChange={(v: string) => setFormData({...formData, goal: v})} disabled={!isMe} icon={<Flag size={16}/>} />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <PrivacyWrapper fieldKey="age" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                  <InputField label="Age" type="number" value={formData.age} onChange={(v: string) => setFormData({...formData, age: v})} disabled={!isMe} />
                </PrivacyWrapper>
                <PrivacyWrapper fieldKey="height" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                  <InputField label="Height (cm)" type="number" value={formData.height} onChange={(v: string) => setFormData({...formData, height: v})} disabled={!isMe} />
                </PrivacyWrapper>
                <PrivacyWrapper fieldKey="weight" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                  <InputField label="Weight (kg)" type="number" value={formData.weight} onChange={(v: string) => setFormData({...formData, weight: v})} disabled={!isMe} />
                </PrivacyWrapper>
                <PrivacyWrapper fieldKey="bmi" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                  <InputField label="BMI" value={formData.bmi} onChange={() => {}} disabled={true} />
                </PrivacyWrapper>
              </div>
            </div>
          </CollapsibleSection>

          {/* VITAL SIGNS */}
          {isMe && (
            <CollapsibleSection 
              title="Vital Signs" 
              icon={<Activity size={18}/>} 
              defaultOpen={false}
              badge={isMe && (
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (dynamicVitals.filter(v => v.isCustom).length >= 10) return alert('Maximum of 10 custom vitals allowed.');
                    setShowVitalModal(true); 
                    setVitalForm({ ...vitalForm, name: availableVitalAddons[0] || '', type: 'addon' });
                  }} 
                  className="ml-2 flex items-center gap-1 text-[9px] font-bold bg-red-500 text-white px-2 py-1 rounded-full hover:bg-red-600 transition-colors"
                >
                  <PlusCircle size={10} /> ADD VITAL
                </button>
              )}
            >
              <div className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-red-50/30 p-3 rounded-2xl border border-red-50">
                  {dynamicVitals.length > 0 ? (
                    dynamicVitals.map((vital, idx) => (
                      <PrivacyWrapper key={`vital-${vital.key}-${idx}`} fieldKey={vital.key} isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther} onDelete={() => handleDeleteField(vital.label, vital.key, 'vital')}>
                        <InputField label={`${vital.label} ${vital.unit ? `(${vital.unit})` : ''}`} type="number" value={dynamicVitalsInputs[vital.key] || ''} onChange={(v: string) => setDynamicVitalsInputs(prev => ({...prev, [vital.key]: v}))} disabled={!isMe} icon={<Activity size={16}/>} />
                      </PrivacyWrapper>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-slate-400 py-3 text-sm font-medium">No vital signs tracked yet.</div>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* FITNESS TRACKER */}
          {isMe && (
            <CollapsibleSection 
              title="Fitness Tracker" 
              icon={<Dumbbell size={18}/>}
              defaultOpen={false} 
              badge={(
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (trackedExercises.length >= 10) return alert('Maximum of 10 workouts allowed.');
                    setShowWorkoutModal(true);
                    setWorkoutForm({ ...workoutForm, name: availableStrengthList[0] || '', type: 'strength' });
                  }} 
                  className="ml-2 flex items-center gap-1 text-[9px] font-bold bg-emerald-500 text-white px-2 py-1 rounded-full hover:bg-emerald-600 transition-colors"
                >
                  <PlusCircle size={10} /> ADD EXERCISE
                </button>
              )}
            >
              <div className="mt-2">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-emerald-50/30 p-3 rounded-2xl border border-emerald-50">
                  {trackedExercises.length > 0 ? (
                    trackedExercises.map((ex, idx) => (
                      <PrivacyWrapper key={`exercise-${ex.name}-${idx}`} fieldKey={ex.name} isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther} onDelete={() => handleDeleteField(ex.label, ex.name, 'workout')}>
                        <InputField label={`${ex.label} ${ex.unit ? `(${ex.unit})` : ''}`} type="number" value={exerciseInputs[ex.name] || ''} onChange={(v: string) => setExerciseInputs(prev => ({...prev, [ex.name]: v}))} disabled={!isMe} icon={ex.type === 'speed' ? <Timer size={16}/> : <Dumbbell size={16}/>} />
                      </PrivacyWrapper>
                    ))
                  ) : (
                    <div className="col-span-full text-center text-slate-400 py-3 text-sm font-medium">No exercises tracked yet.</div>
                  )}
                </div>
              </div>
            </CollapsibleSection>
          )}

          {/* SAVE ALL UPDATES */}
          {isMe && (
            <button 
              onClick={handleSaveAllHealthData}
              disabled={saving}
              className={`w-full py-3.5 rounded-2xl font-black text-white shadow-md flex justify-center items-center gap-2 transition-all ${
                saving ? 'bg-indigo-400 cursor-not-allowed scale-95' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95'
              }`}
            >
              {saving ? <RefreshCw className="animate-spin" size={18}/> : <UploadCloud size={18}/>}
              {saving ? 'SAVING PROGRESS...' : 'SAVE ALL UPDATES'}
            </button>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Analytics/Charts */}
      <div className="lg:sticky lg:top-4 h-full">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
          <div className="p-3 border-b border-slate-50 bg-slate-50/50 shrink-0">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <TrendingUp size={14} /> Analytics
            </h3>
          </div>
          <div className="flex-1">
            <DataScreen userId={userId!} refreshTrigger={refreshTrigger} isMe={isMe} hiddenOther={hiddenOther} />
          </div>
        </div>
      </div>

    </div>

    {/* GLOBAL MODALS */}
    <FollowModal config={modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} followers={followersList} following={followingList} />
    
    <VitalModal 
      isOpen={showVitalModal} 
      onClose={() => setShowVitalModal(false)} 
      form={vitalForm} 
      setForm={setVitalForm as any} 
      addons={availableVitalAddons} 
      onSave={() => handleSaveItem('vital')} 
      saving={saving} 
    />

    <WorkoutModal 
      isOpen={showWorkoutModal} 
      onClose={() => setShowWorkoutModal(false)} 
      form={workoutForm} 
      setForm={setWorkoutForm as any} 
      strengthList={availableStrengthList} 
      speedList={availableSpeedList} 
      onSave={() => handleSaveItem('workout')} 
      saving={saving} 
    />
  </div>
);
};

export default ProfileScreen;