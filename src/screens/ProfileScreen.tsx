// ProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, query, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Camera, Stars, TrendingUp, Thermometer, Flag, Activity, Heart, Wind, Droplets, UploadCloud, Footprints, RefreshCw, CheckCircle, X, Dumbbell, Timer, PlusCircle, Target, ChevronDown } from 'lucide-react';
import { useGlobalSteps } from '../context/StepContext';
import DataScreen from './DataScreen';

const VITAL_ADDONS = ['Glucose', 'Cholesterol', 'Ketones', 'Uric Acid', 'Lactate', 'Hemoglobin', 'Hematocrit'];
const STRENGTH_LIST = ['Bench Press', 'Squat', 'Deadlift'];
const SPEED_LIST = ['100m', '400m', '1 mile'];

const ProfileScreen: React.FC = () => {
  const { 
    steps, setSteps, setIsInitialLoadDone, 
    syncWithGoogleFit, isSyncing, lastSynced, setLastSynced 
  } = useGlobalSteps();  
  
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;
  const isMe = userId === currentUserId;

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingWorkouts, setSavingWorkouts] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const [followersList, setFollowersList] = useState<{uid: string, name: string}[]>([]);
  const [followingList, setFollowingList] = useState<{uid: string, name: string}[]>([]);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'followers' | 'following'}>({ isOpen: false, type: 'followers' });

  // Fitness Tracker States
  const [showWorkoutModal, setShowWorkoutModal] = useState(false);
  const [workoutForm, setWorkoutForm] = useState({
    type: 'strength', // 'strength' | 'speed' | 'custom'
    name: STRENGTH_LIST[0],
    value: '',
    customVarName: ''
  });
  
  // Dynamic Workout Tracking Fields
  const [trackedExercises, setTrackedExercises] = useState<{name: string, type: string, unit?: string}[]>([]);
  const [exerciseInputs, setExerciseInputs] = useState<Record<string, string>>({});

  // Extra Vitals States
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [vitalForm, setVitalForm] = useState({
    type: 'addon', // 'addon' | 'custom'
    name: VITAL_ADDONS[0],
    value: '',
    customVarName: ''
  });

  // Dynamic Vital Tracking Fields
  const [dynamicVitals, setDynamicVitals] = useState<{key: string, label: string, isCustom: boolean, unit?: string}[]>([]);
  const [dynamicVitalsInputs, setDynamicVitalsInputs] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    name: '', goal: '', gems: '', age: '', height: '', weight: '',
    bmi: '', bpSyst: '', bpDias: '', hr: '', spo2: '', rr: '', temp: ''
  });

  const loadUserData = useCallback(async () => {
    if (!userId) return;
    
    setLoading(true);
    setProfileImage(null);
    setFollowerCount(0);
    setFollowingCount(0);
    setFollowersList([]);
    setFollowingList([]);
    setDynamicVitals([]);
    setDynamicVitalsInputs({});
    setTrackedExercises([]);
    setExerciseInputs({});
    setFormData({
      name: '', goal: '', gems: '0', age: '', height: '', weight: '',
      bmi: '', bpSyst: '', bpDias: '', hr: '', spo2: '', rr: '', temp: ''
    });

    try {
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const imageRef = doc(db, 'users', userId, 'profile', 'image_data');

      const [userRootDoc, followersSnap, followingSnap, profileDoc, imageDoc, followingStatus] = await Promise.all([
        getDoc(userRootRef),
        getDocs(query(collection(db, 'users', userId, 'followers'))),
        getDocs(query(collection(db, 'users', userId, 'following'))),
        getDoc(profileRef),
        getDoc(imageRef),
        isMe || !currentUserId ? Promise.resolve(null) : getDoc(doc(db, 'users', currentUserId, 'following', userId))
      ]);

      let fetchedName = '';
      let fetchedGoal = '';
      let fetchedGems = '0';

      if (userRootDoc.exists()) {
        const rootData = userRootDoc.data();
        fetchedGems = rootData.gems !== undefined ? rootData.gems.toString() : '0';
        fetchedName = rootData.display_name || fetchedName;
        
        if (isMe) {
          const lastUpdate = rootData.last_step_update?.toDate().toDateString();
          const today = new Date().toDateString();
          
          if (lastUpdate === today) {
            setSteps(rootData.daily_steps || 0); 
          } else {
            setSteps(0); 
          }

          if (rootData.last_google_sync) {
            setLastSynced(rootData.last_google_sync.toDate());
          }

          setIsInitialLoadDone(true);
        }
      }

      if (profileDoc.exists()) {
        const profData = profileDoc.data();
        fetchedName = profData.name || fetchedName;
        fetchedGoal = profData.goal || '';

        // Parse Dynamic Vitals Addons
        const loadedDynamicVitals: typeof dynamicVitals = [];
        const newDynamicVitalsInputs: Record<string, string> = {};

        VITAL_ADDONS.forEach(addon => {
          const key = addon.replace(/\s+(.)/g, (_m, g1) => g1.toUpperCase()).replace(/^[A-Z]/, m => m.toLowerCase());
          if (profData[key] && Array.isArray(profData[key]) && profData[key].length > 0) {
            loadedDynamicVitals.push({ key, label: addon, isCustom: false });
            newDynamicVitalsInputs[key] = '';
          }
        });

        // Parse Custom Vitals 
        if (profData.customVitals && Array.isArray(profData.customVitals)) {
          const latestCustomVitals = new Map();
          profData.customVitals.forEach((cv: any) => {
            latestCustomVitals.set(cv.name, { ...cv });
          });
          latestCustomVitals.forEach((cv, name) => {
            loadedDynamicVitals.push({ key: name, label: name, isCustom: true, unit: cv.unit });
            newDynamicVitalsInputs[name] = '';
          });
        }
        setDynamicVitals(loadedDynamicVitals);
        setDynamicVitalsInputs(newDynamicVitalsInputs);

        // Parse Tracked Exercises
        const loadedExercises: typeof trackedExercises = [];
        const newExerciseInputs: Record<string, string> = {};
        
        if (profData.workouts && Array.isArray(profData.workouts)) {
          const latestWorkouts = new Map();
          profData.workouts.forEach((w: any) => {
            latestWorkouts.set(w.name, { ...w });
          });
          latestWorkouts.forEach((w, name) => {
            loadedExercises.push({ 
              name: w.name, 
              type: w.type, 
              unit: w.customVarName || (w.type === 'strength' ? 'kg' : w.type === 'speed' ? 'min' : '') 
            });
            newExerciseInputs[name] = '';
          });
        }
        setTrackedExercises(loadedExercises);
        setExerciseInputs(newExerciseInputs);
      }

      setFormData({
        name: fetchedName,
        goal: fetchedGoal,
        gems: fetchedGems,
        age: '',    
        height: '', 
        weight: '', 
        bmi: '',
        bpSyst: '', 
        bpDias: '', 
        hr: '',     
        spo2: '',   
        rr: '',     
        temp: ''    
      });

      if (imageDoc.exists()) setProfileImage(imageDoc.data().imageId);

      const fwerData = followersSnap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' }));
      const fwingData = followingSnap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' }));
      
      setFollowersList(fwerData);
      setFollowingList(fwingData);
      
      setFollowerCount(followersSnap.size);
      setFollowingCount(followingSnap.size);
      setIsFollowing(followingStatus?.exists() || false);
    } catch (err) {
      console.error("Error loading profile:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, isMe, currentUserId, setSteps, setIsInitialLoadDone, setLastSynced]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  useEffect(() => {
    const h = parseFloat(formData.height);
    const w = parseFloat(formData.weight);
    if (h > 0 && w > 0) {
      const bmiVal = w / ((h / 100) ** 2);
      setFormData(prev => ({ ...prev, bmi: bmiVal.toFixed(1) }));
    }
  }, [formData.height, formData.weight]);

  const handleToggleFollow = async () => {
    if (!currentUserId || isMe) return;
    const myName = auth.currentUser?.displayName || "User";
    const targetName = formData.name || "User";
    const batch = writeBatch(db);
    const followingRef = doc(db, 'users', currentUserId, 'following', userId!);
    const followersRef = doc(db, 'users', userId!, 'followers', currentUserId);

    if (isFollowing) {
      batch.delete(followingRef);
      batch.delete(followersRef);
      setFollowerCount(prev => prev - 1);
      setFollowersList(prev => prev.filter(u => u.uid !== currentUserId));
    } else {
      batch.set(followingRef, { timestamp: serverTimestamp(), name: targetName });
      batch.set(followersRef, { timestamp: serverTimestamp(), name: myName, uid: currentUserId });
      setFollowerCount(prev => prev + 1);
      setFollowersList(prev => [...prev, { uid: currentUserId, name: myName }]);
    }
    setIsFollowing(!isFollowing);
    await batch.commit();
  };

  const handlePickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveImageToFirestore(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.readAsDataURL(file);
  };

  const saveImageToFirestore = async (base64: string) => {
    setUploading(true);
    try {
      await setDoc(doc(db, 'users', userId!, 'profile', 'image_data'), {
        imageId: base64,
        lastUpdated: serverTimestamp()
      });
      setProfileImage(base64);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveVitals = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const now = new Date();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      
      const rootSnap = await getDoc(userRootRef);
      let currentGems = rootSnap.exists() ? (rootSnap.data().gems || 0) : 0;
      let lastVitalsUpdate = rootSnap.exists() ? rootSnap.data().last_vitals_update?.toDate() : null;

      const twelveHoursInMs = 12 * 60 * 60 * 1000;
      const isEligibleForGems = !lastVitalsUpdate || (now.getTime() - lastVitalsUpdate.getTime()) > twelveHoursInMs;
      
      const newGemTotal = currentGems + (isEligibleForGems ? 10 : 0);
      const updateData: any = { name: formData.name, goal: formData.goal };
      
      // Standard Vitals
      ['age', 'height', 'weight', 'bpSyst', 'bpDias', 'hr', 'spo2', 'rr', 'temp'].forEach(field => {
        const val = formData[field as keyof typeof formData];
        const trimmed = val.trim();
        if (trimmed !== '' && trimmed !== '0' && !isNaN(Number(trimmed))) {
          updateData[field] = arrayUnion({ value: trimmed, dateTime: now.toISOString() });
        }
      });

      // Dynamic Extra Vitals
      const customVitalLogs: any[] = [];
      dynamicVitals.forEach(vital => {
        const val = dynamicVitalsInputs[vital.key];
        const trimmed = val ? val.trim() : '';
        if (trimmed !== '' && trimmed !== '0' && !isNaN(Number(trimmed))) {
          const newLog = { value: Number(trimmed), dateTime: now.toISOString() };
          if (vital.isCustom) {
            customVitalLogs.push({ name: vital.label, unit: vital.unit, ...newLog });
          } else {
            updateData[vital.key] = arrayUnion(newLog);
          }
        }
      });

      if (customVitalLogs.length > 0) {
        updateData.customVitals = arrayUnion(...customVitalLogs);
      }

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });
      batch.update(userRootRef, { gems: newGemTotal, last_vitals_update: serverTimestamp() });
      await batch.commit();
      
      setRefreshTrigger(prev => prev + 1);
      alert(isEligibleForGems ? `Vitals updated! +10 gems (12 hour recharge)` : 'Vitals updated!');
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveExtraVital = async () => {
    if (!userId || !vitalForm.name || !vitalForm.value) return;
    setSaving(true);
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const newLog = {
        value: Number(vitalForm.value),
        dateTime: new Date().toISOString()
      };

      if (vitalForm.type === 'addon') {
        const key = vitalForm.name.replace(/\s+(.)/g, (_match, group1) => group1.toUpperCase()).replace(/^[A-Z]/, (match) => match.toLowerCase());
        await setDoc(profileRef, {
          [key]: arrayUnion(newLog)
        }, { merge: true });
      } else {
        await setDoc(profileRef, {
          customVitals: arrayUnion({
            name: vitalForm.name,
            unit: vitalForm.customVarName,
            ...newLog
          })
        }, { merge: true });
      }

      setRefreshTrigger(prev => prev + 1);
      setShowVitalModal(false);
      setVitalForm({ type: 'addon', name: VITAL_ADDONS[0], value: '', customVarName: '' });
    } catch (err) {
      console.error(err);
      alert('Failed to log vital.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkout = async () => {
    if (!userId || !workoutForm.name || !workoutForm.value) return;
    setSaving(true);
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const newWorkoutLog = {
        name: workoutForm.name,
        type: workoutForm.type,
        value: Number(workoutForm.value),
        customVarName: workoutForm.type === 'custom' ? workoutForm.customVarName : null,
        dateTime: new Date().toISOString()
      };

      await setDoc(profileRef, {
        workouts: arrayUnion(newWorkoutLog)
      }, { merge: true });

      setRefreshTrigger(prev => prev + 1);
      setShowWorkoutModal(false);
      setWorkoutForm({ type: 'strength', name: STRENGTH_LIST[0], value: '', customVarName: '' });
    } catch (err) {
      console.error("Error saving workout:", err);
      alert("Failed to log workout.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveWorkoutsList = async () => {
    if (!userId) return;
    setSavingWorkouts(true);
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const now = new Date().toISOString();
      const newLogs: any[] = [];

      trackedExercises.forEach(ex => {
        const val = exerciseInputs[ex.name];
        if (val && val.trim() !== '' && !isNaN(Number(val))) {
          newLogs.push({
            name: ex.name,
            type: ex.type,
            value: Number(val),
            customVarName: ex.unit || null,
            dateTime: now
          });
        }
      });

      if (newLogs.length > 0) {
        await setDoc(profileRef, {
          workouts: arrayUnion(...newLogs)
        }, { merge: true });

        setRefreshTrigger(prev => prev + 1);
        alert('Workouts updated successfully!');
      } else {
        alert('No new values to update.');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to save workouts.');
    } finally {
      setSavingWorkouts(false);
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
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen pb-20 relative">
      <div className="flex flex-col items-center pt-8">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden bg-slate-200 border-4 border-white shadow-lg flex items-center justify-center">
            {profileImage ? (
              <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <User size={64} className="text-slate-400" />
            )}
            {uploading && <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-full"><Activity className="animate-spin text-white" /></div>}
          </div>
          {isMe && (
            <label className="absolute bottom-0 right-0 bg-blue-600 p-2 rounded-full text-white cursor-pointer hover:bg-blue-700 shadow-md transition-colors">
              <Camera size={18} />
              <input type="file" className="hidden" accept="image/*" onChange={handlePickImage} />
            </label>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 mt-4">
          <Badge icon={<Stars size={16} className="fill-current"/>} color="bg-indigo-100 text-indigo-700 border border-indigo-200" label={`${formData.gems} Gems`}/>
          {followerCount > 10 && <Badge icon={<Stars size={16}/>} color="bg-amber-100 text-amber-600" label="Social" />}
          {profileImage && <Badge icon={<Camera size={16}/>} color="bg-blue-100 text-blue-600" label="Photogenic" />}
          {followingCount > 0 && <Badge icon={<TrendingUp size={16}/>} color="bg-green-100 text-green-600" label="Networker" />}
        </div>
      </div>

      {isMe && (
        <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-orange-50 p-3 rounded-2xl">
                <Footprints className="text-orange-500" size={24} />
              </div>
              <div>
                <h4 className="text-xl font-black text-slate-800">{steps.toLocaleString()}</h4>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-tight">Today's Steps</p>
              </div>
            </div>

            <button 
              onClick={syncWithGoogleFit}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all shadow-sm ${
                isSyncing 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                  : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100 active:scale-95'
              }`}
            >
              {isSyncing ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <RefreshCw size={16} />
              )}
              {isSyncing ? 'Syncing...' : 'Sync Fit'}
            </button>
          </div>

          {lastSynced && (
            <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              <CheckCircle size={12} className="text-emerald-500" />
              Last synced with Google Fit: {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 border-y border-slate-200 py-4 bg-white rounded-xl">
        <div className="bg-blue-50 hover:bg-blue-100 transition-colors rounded-lg cursor-pointer">
          <StatItem label="Followers" count={followerCount} onClick={() => setModalConfig({ isOpen: true, type: 'followers' })} />
        </div>
        <div className="bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-lg cursor-pointer">
          <StatItem label="Following" count={followingCount} onClick={() => setModalConfig({ isOpen: true, type: 'following' })} />
        </div>
      </div>

      {!isMe && (
        <button 
          onClick={handleToggleFollow}
          className={`w-full py-3 rounded-xl font-bold transition-all ${isFollowing ? 'bg-slate-200 text-slate-700' : 'bg-indigo-600 text-white shadow-lg'}`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
      )}

      <div className="space-y-4">
        {/* SECTION: BASIC INFORMATION */}
        <CollapsibleSection title="Basic Information" icon={<User size={20}/>}>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} disabled={!isMe} />
              <InputField label="Goal" value={formData.goal} onChange={(v: string) => setFormData({...formData, goal: v})} disabled={!isMe} icon={<Flag size={18}/>} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <InputField label="Age" type="number" value={formData.age} onChange={(v: string) => setFormData({...formData, age: v})} disabled={!isMe} />
              <InputField label="Height (cm)" type="number" value={formData.height} onChange={(v: string) => setFormData({...formData, height: v})} disabled={!isMe} />
              <InputField label="Weight (kg)" type="number" value={formData.weight} onChange={(v: string) => setFormData({...formData, weight: v})} disabled={!isMe} />
              <InputField label="BMI" value={formData.bmi} onChange={() => {}} disabled={true} />
            </div>
          </div>
        </CollapsibleSection>

        {/* SECTION: VITAL SIGNS */}
        {isMe && (
          <CollapsibleSection 
            title="Vital Signs" 
            icon={<Activity size={20}/>} 
            defaultOpen={false}
            badge={isMe && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowVitalModal(true); }} 
                className="ml-2 flex items-center gap-1 text-[10px] font-bold bg-red-500 text-white px-2 py-1 rounded-full hover:bg-red-600 transition-colors"
              >
                <PlusCircle size={12} /> ADD EXTRA
              </button>
            )}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-red-50/30 p-4 rounded-2xl border border-red-50 mt-2">
              <InputField label="Blood Pressure (Systolic)" value={formData.bpSyst} onChange={(v: string) => setFormData({...formData, bpSyst: v})} disabled={!isMe} icon={<Heart size={18}/>} />
              <InputField label="Blood Pressure (Diastolic)" value={formData.bpDias} onChange={(v: string) => setFormData({...formData, bpDias: v})} disabled={!isMe} icon={<Heart size={18}/>} />
              <InputField label="Heart Rate (BPM)" type="number" value={formData.hr} onChange={(v: string) => setFormData({...formData, hr: v})} disabled={!isMe} icon={<Activity size={18}/>} />
              <InputField label="SpO2 (%)" type="number" value={formData.spo2} onChange={(v: string) => setFormData({...formData, spo2: v})} disabled={!isMe} icon={<Droplets size={18}/>} />
              <InputField label="Resp Rate" type="number" value={formData.rr} onChange={(v: string) => setFormData({...formData, rr: v})} disabled={!isMe} icon={<Wind size={18}/>} />
              <InputField label="Temp (°C)" type="number" value={formData.temp} onChange={(v: string) => setFormData({...formData, temp: v})} disabled={!isMe} icon={<Thermometer size={18}/>} />
              
              {/* Dynamic Extra Vitals Rendered Here */}
              {dynamicVitals.map((vital, idx) => (
                <InputField 
                  key={`vital-${vital.key}-${idx}`}
                  label={`${vital.label} ${vital.unit ? `(${vital.unit})` : ''}`} 
                  type="number" 
                  value={dynamicVitalsInputs[vital.key] || ''} 
                  onChange={(v: string) => setDynamicVitalsInputs(prev => ({...prev, [vital.key]: v}))} 
                  disabled={!isMe} 
                  icon={<Activity size={18}/>} 
                />
              ))}
            </div>
            <button 
              onClick={handleSaveVitals}
              disabled={saving}
              className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 mt-4 hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" /> : <UploadCloud />} Update Vitals
            </button>
          </CollapsibleSection>
        )}

        {/* SECTION: FITNESS TRACKER */}
        {isMe && (
          <CollapsibleSection 
            title="Fitness Tracker" 
            icon={<Dumbbell size={20}/>}
            defaultOpen={false} // This retracts it on load
            badge={(
              <button 
                onClick={(e) => { e.stopPropagation(); setShowWorkoutModal(true); }} 
                className="ml-2 flex items-center gap-1 text-[10px] font-bold bg-emerald-500 text-white px-2 py-1 rounded-full hover:bg-emerald-600 transition-colors"
              >
                <PlusCircle size={12} /> ADD LOG
              </button>
            )}
          >
          <div className="mt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-emerald-50/30 p-4 rounded-2xl border border-emerald-50">
              {trackedExercises.length > 0 ? (
                trackedExercises.map((ex, idx) => (
                  <InputField
                    key={`exercise-${ex.name}-${idx}`}
                    label={`${ex.name} ${ex.unit ? `(${ex.unit})` : ''}`}
                    type="number"
                    value={exerciseInputs[ex.name] || ''}
                    onChange={(v: string) => setExerciseInputs(prev => ({...prev, [ex.name]: v}))}
                    disabled={!isMe}
                    icon={ex.type === 'strength' ? <Dumbbell size={18}/> : ex.type === 'speed' ? <Timer size={18}/> : <Target size={18}/>}
                  />
                ))
              ) : (
                <div className="col-span-full text-center p-4 text-slate-400 text-xs font-bold uppercase tracking-widest bg-white border border-slate-100 border-dashed rounded-xl">
                  No exercises tracked yet. Add one!
                </div>
              )}
            </div>

            {isMe && trackedExercises.length > 0 && (
              <button 
                onClick={handleSaveWorkoutsList}
                disabled={savingWorkouts}
                className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 mt-4 hover:bg-emerald-700 transition-all disabled:opacity-50"
              >
                {savingWorkouts ? <RefreshCw className="animate-spin" /> : <UploadCloud />} Update Workouts
              </button>
            )}
          </div>
        </CollapsibleSection>
      )}
      </div>

      <section>
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-indigo-500" /> Health Analytics
        </h3>
        <DataScreen userId={userId!} refreshTrigger={refreshTrigger} />
      </section>

      {/* MODAL FOR ADDING EXTRA / CUSTOM VITALS */}
      {showVitalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowVitalModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <Activity size={20} className="text-red-500" /> Log Extra Vital
              </h3>
              <button onClick={() => setShowVitalModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Vital Type</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium text-slate-700"
                  value={vitalForm.type}
                  onChange={e => {
                    const t = e.target.value as any;
                    setVitalForm({...vitalForm, type: t, name: t === 'addon' ? VITAL_ADDONS[0] : '', customVarName: ''});
                  }}
                >
                  <option value="addon">Standard Add-On</option>
                  <option value="custom">Custom Vital</option>
                </select>
              </div>

              {vitalForm.type === 'addon' ? (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Vital Name</label>
                  <select 
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-medium text-slate-700"
                    value={vitalForm.name}
                    onChange={e => setVitalForm({...vitalForm, name: e.target.value})}
                  >
                    {VITAL_ADDONS.map(item => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              ) : (
                <InputField 
                  label="Custom Vital Name (e.g., Cortisol)" 
                  value={vitalForm.name} 
                  onChange={(v: string) => setVitalForm({...vitalForm, name: v})} 
                />
              )}

              {vitalForm.type === 'custom' && (
                <InputField 
                  label="Custom Variable Unit (e.g., mcg/dL)" 
                  value={vitalForm.customVarName} 
                  onChange={(v: string) => setVitalForm({...vitalForm, customVarName: v})} 
                />
              )}

              <InputField 
                label="Value" 
                type="number" 
                value={vitalForm.value} 
                onChange={(v: string) => setVitalForm({...vitalForm, value: v})} 
              />
            </div>

            <button 
              onClick={handleSaveExtraVital}
              disabled={saving}
              className="mt-8 bg-red-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-red-100 flex items-center justify-center gap-3 hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" /> : <CheckCircle />} Save Entry
            </button>
          </div>
        </div>
      )}

      {/* MODAL FOR FITNESS TRACKER LOGS */}
      {showWorkoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowWorkoutModal(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-slate-800 text-lg flex items-center gap-2">
                <Dumbbell size={20} className="text-emerald-500" /> Log Workout
              </h3>
              <button onClick={() => setShowWorkoutModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Log Type</label>
                <select 
                  className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700"
                  value={workoutForm.type}
                  onChange={e => {
                    const t = e.target.value as any;
                    const defaultName = t === 'strength' ? STRENGTH_LIST[0] : t === 'speed' ? SPEED_LIST[0] : '';
                    setWorkoutForm({...workoutForm, type: t, name: defaultName, customVarName: ''});
                  }}
                >
                  <option value="strength">Strength (Lifting)</option>
                  <option value="speed">Speed (Timed)</option>
                  <option value="custom">Custom Exercise</option>
                </select>
              </div>

              {workoutForm.type !== 'custom' ? (
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1 mb-1 block">Exercise Name</label>
                  <select 
                    className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-medium text-slate-700"
                    value={workoutForm.name}
                    onChange={e => setWorkoutForm({...workoutForm, name: e.target.value})}
                  >
                    {(workoutForm.type === 'strength' ? STRENGTH_LIST : SPEED_LIST).map(item => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <InputField 
                  label="Exercise Name (e.g., Pullups)" 
                  value={workoutForm.name} 
                  onChange={(v: string) => setWorkoutForm({...workoutForm, name: v})} 
                />
              )}

              {workoutForm.type === 'custom' && (
                <InputField 
                  label="Unit Label (e.g., reps, sets, km)" 
                  value={workoutForm.customVarName} 
                  onChange={(v: string) => setWorkoutForm({...workoutForm, customVarName: v})} 
                />
              )}

              <InputField 
                label={workoutForm.type === 'strength' ? "Weight (kg)" : workoutForm.type === 'speed' ? "Time (min)" : "Value"} 
                type="number" 
                value={workoutForm.value} 
                onChange={(v: string) => setWorkoutForm({...workoutForm, value: v})} 
              />
            </div>

            <button 
              onClick={handleSaveWorkout}
              disabled={saving}
              className="mt-8 bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-emerald-100 flex items-center justify-center gap-3 hover:bg-emerald-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw className="animate-spin" /> : <CheckCircle />} Save Log
            </button>
          </div>
        </div>
      )}

      {/* FOLLOWERS / FOLLOWING MODAL */}
      {modalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}>
          <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h3 className="font-black text-slate-800 text-lg uppercase tracking-tight">{modalConfig.type}</h3>
              <button onClick={() => setModalConfig({ ...modalConfig, isOpen: false })} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
            </div>
            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {(modalConfig.type === 'followers' ? followersList : followingList).map(u => (
                <button 
                  key={u.uid} 
                  onClick={() => {
                    setModalConfig({ ...modalConfig, isOpen: false });
                    navigate(`/profile/${u.uid}`);
                  }}
                  className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-all group"
                >
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
                    <User size={20} />
                  </div>
                  <span className="font-bold text-slate-700">{u.name}</span>
                </button>
              ))}
              {(modalConfig.type === 'followers' ? followersList : followingList).length === 0 && (
                <p className="text-center py-8 text-slate-400 text-sm font-medium">No {modalConfig.type} found.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// HELPER COMPONENTS
const Badge: React.FC<{icon: React.ReactNode, label: string, color: string}> = ({ icon, label, color }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm ${color}`}>
    {icon} {label}
  </div>
);

const StatItem: React.FC<{label: string, count: number, onClick?: () => void}> = ({ label, count, onClick }) => (
  <div className="flex flex-col items-center p-3" onClick={onClick}>
    <span className="text-2xl font-black text-slate-800 leading-none">{count}</span>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</span>
  </div>
);

const InputField: React.FC<{label: string, value: string, onChange: (v: string) => void, type?: string, disabled?: boolean, icon?: React.ReactNode}> = ({ label, value, onChange, type = 'text', disabled = false, icon }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <div className="relative flex items-center">
      {icon && <div className="absolute left-4 text-slate-300">{icon}</div>}
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        className={`w-full p-4 ${icon ? 'pl-11' : 'pl-4'} bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400`}
      />
    </div>
  </div>
);

const CollapsibleSection: React.FC<{ title: string, icon: React.ReactNode, children: React.ReactNode, defaultOpen?: boolean, badge?: React.ReactNode }> = ({ title, icon, children, defaultOpen = true, badge }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-indigo-500">{icon}</div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h3>
          {badge}
        </div>
        <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && <div className="p-5 pt-0">{children}</div>}
    </div>
  );
};

export default ProfileScreen;