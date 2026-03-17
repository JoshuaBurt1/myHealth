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
import { User, Camera, Stars, TrendingUp, Flag, Activity, UploadCloud, RefreshCw, Dumbbell, Calendar } from 'lucide-react';
import { Badge, InputField, CollapsibleSection, SexInputField, AgeInputField } from '../componentsProfile/ProfileUI';
import { ModalDOB, ModalFollow } from '../componentsProfile/ModalProfile';
import { ModalSchedule } from '../componentsProfile/ModalSchedule';
import { ModalVitals } from '../componentsProfile/ModalVitals';
import { ModalExercises } from '../componentsProfile/ModalExercises';
import { useImageUpload } from '../componentsProfile/useImageUpload';
import { HealthSyncSection } from '../componentsProfile/HealthSyncSection';
import PrivacyWrapper from '../componentsProfile/PrivacyWrapper';
import FollowButton from '../componentsProfile/FollowButton';
import DataScreen from '../componentsProfile/DataScreen';

import { 
  VITAL_KEY_MAP, STRENGTH_KEY_MAP, SPEED_KEY_MAP, 
  PHYSIO_KEY_MAP, YOGA_KEY_MAP, MOBILITY_KEY_MAP,
  getStandardUnit 
} from '../componentsProfile/profileConstants';

const ProfileScreen: React.FC = () => {
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

  const [showDOBModal, setShowDOBModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);

  const [dynamicVitals, setDynamicVitals] = useState<{key: string, label: string, isCustom: boolean, unit?: string}[]>([]);
  const [dynamicVitalsInputs, setDynamicVitalsInputs] = useState<Record<string, string>>({});
    
  const [trackedExercises, setTrackedExercises] = useState<{name: string, label: string, type: string, unit?: string}[]>([]);
  const [exerciseInputs, setExerciseInputs] = useState<Record<string, string>>({});

  const [hiddenOther, setHiddenOther] = useState<string[]>([]);

  const calculateAge = (dobString: string): string => {
    if (!dobString) return '';
    const today = new Date();
    const birthDate = new Date(dobString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age >= 0 ? age.toString() : '0';
  };

  const [formData, setFormData] = useState({
    name: '', goal: '', sex: '', dob: '', age: '', height: '', weight: '', bmi: '', gems: ''
  });

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
        const storedDob = profData.dob || '';
        
        setFormData(prev => ({
          ...prev,
          name: profData.name || prev.name,
          goal: profData.goal || '',
          sex: profData.sex || '',
          dob: storedDob,
          age: storedDob ? calculateAge(storedDob) : (profData.age?.length > 0 ? profData.age[profData.age.length - 1].value : ''),
          height: profData.height?.length > 0 ? profData.height[profData.height.length - 1].value : '',
          weight: profData.weight?.length > 0 ? profData.weight[profData.weight.length - 1].value : '',
        }));

        if (profData.hiddenOther) setHiddenOther(profData.hiddenOther);

        // Dynamic Vitals Parsing
        const loadedDynamicVitals: typeof dynamicVitals = [];
        const newDynamicVitalsInputs: Record<string, string> = {};
        const seenVitals = new Set<string>();

        // 1. Custom Definitions
        if (Array.isArray(profData.customVitalsDefinitions)) {
          profData.customVitalsDefinitions.forEach((def: any) => {
            if (!seenVitals.has(def.key)) {
              const isCustom = def.key.startsWith('custom_');
              const correctUnit = isCustom ? def.unit : getStandardUnit(def.key);
              loadedDynamicVitals.push({ key: def.key, label: def.name, isCustom, unit: correctUnit });
              newDynamicVitalsInputs[def.key] = '';
              seenVitals.add(def.key);
            }
          });
        }

        // 2. Standard Vitals (Replaces the VITAL_LIST.forEach loop)
        Object.entries(VITAL_KEY_MAP).forEach(([label, key]) => {
          if (profData[key] !== undefined && !seenVitals.has(key)) {
            loadedDynamicVitals.push({ 
              key, 
              label, 
              isCustom: false, 
              unit: getStandardUnit(key) 
            });
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

        // 1. Process Custom Definitions (including those that might be standard)
        if (Array.isArray(profData.customWorkoutsDefinitions)) {
          profData.customWorkoutsDefinitions.forEach((def: any) => {
            if (!seenExercises.has(def.key)) {
              const isCustom = def.key.startsWith('custom_');
              const correctUnit = isCustom ? def.unit : getStandardUnit(def.key);
              loadedExercises.push({ 
                name: def.key, 
                label: def.name, 
                type: def.type, 
                unit: correctUnit 
              });
              newExerciseInputs[def.key] = '';
              seenExercises.add(def.key);
            }
          });
        }

        // 2. Process all standard categories from profileConstants
        const allStandardMaps = [
          { map: STRENGTH_KEY_MAP, type: 'strength' },
          { map: SPEED_KEY_MAP, type: 'speed' },
          { map: PHYSIO_KEY_MAP, type: 'physio' },
          { map: YOGA_KEY_MAP, type: 'yoga' },
          { map: MOBILITY_KEY_MAP, type: 'mobility' }
        ];

        allStandardMaps.forEach(({ map, type }) => {
          Object.entries(map).forEach(([label, key]) => {
            // If the user has data for this key in Firestore and we haven't added it yet
            if (profData[key] !== undefined && !seenExercises.has(key)) {
              loadedExercises.push({ 
                name: key, 
                label: label, 
                type: type, 
                unit: getStandardUnit(key) 
              });
              newExerciseInputs[key] = '';
              seenExercises.add(key);
            }
          });
        });

        setTrackedExercises(loadedExercises);
        setExerciseInputs(newExerciseInputs);
      }
      setLoading(false); 
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
      const updateData: any = { name: formData.name, goal: formData.goal, sex: formData.sex, dob: formData.dob };

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

          {/* QUICK ACTIONS DASHBOARD */}
          {isMe && (
            <div className="bg-white p-4 md:p-5 rounded-3xl shadow-sm border border-slate-100">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Stars size={14} className="text-indigo-400"/> Quick Logs & Actions
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {/* Exercises Button */}
                <button 
                  onClick={() => setShowExerciseModal(true)} 
                  className="flex flex-col items-center justify-center p-3 sm:p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shadow-sm hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition-all group"
                >
                  <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Dumbbell className="text-indigo-600" size={20}/>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wider uppercase text-center">Exercises</span>
                </button>

                {/* Vitals Button */}
                <button 
                  onClick={() => setShowVitalModal(true)} 
                  className="flex flex-col items-center justify-center p-3 sm:p-4 bg-rose-50/50 rounded-2xl border border-rose-100 shadow-sm hover:bg-rose-50 hover:border-rose-300 hover:shadow-md transition-all group"
                >
                  <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Activity className="text-rose-500" size={20}/>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wider uppercase text-center">Vitals</span>
                </button>

                {/* Schedule Button */}
                <button 
                  onClick={() => setShowScheduleModal(true)} 
                  className="flex flex-col items-center justify-center p-3 sm:p-4 bg-blue-50/50 rounded-2xl border border-blue-100 shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform">
                    <Calendar className="text-blue-500" size={20}/>
                  </div>
                  <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wider uppercase text-center">Schedule</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {/* BASIC INFORMATION & STEPS */}
            <CollapsibleSection title="Basic Information" icon={<User size={18}/>}>
              <div className="space-y-3 mt-3">                
                {isMe && !!window.ReactNativeWebView && (
                  <HealthSyncSection 
                    userId={userId!} 
                    isMe={isMe} 
                    steps={steps} 
                    lastSynced={lastSynced} 
                    onSyncComplete={(newSteps, syncTime, earnedGems) => {
                      setSteps(newSteps);
                      setLastSynced(syncTime);
                      if (earnedGems > 0) {
                        setFormData(prev => ({
                          ...prev,
                          gems: (parseInt(prev.gems || '0', 10) + earnedGems).toString()
                        }));
                      }
                    }}
                  />
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <InputField label="Name" value={formData.name} onChange={(v: string) => setFormData({...formData, name: v})} disabled={!isMe} />
                  <InputField label="Goal" value={formData.goal} onChange={(v: string) => setFormData({...formData, goal: v})} disabled={!isMe} icon={<Flag size={16}/>} />
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {/* SEX FIELD */}
                  <PrivacyWrapper fieldKey="sex" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <SexInputField 
                      label="Sex" 
                      value={formData.sex} 
                      onChange={(v) => setFormData({ ...formData, sex: v })} 
                      disabled={!isMe} 
                    />
                  </PrivacyWrapper>

                  {/* AGE FIELD */}
                  <PrivacyWrapper fieldKey="age" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <AgeInputField 
                      label="Age" 
                      value={formData.age} 
                      isMe={isMe} 
                      onIconClick={() => setShowDOBModal(true)} 
                    />
                  </PrivacyWrapper>

                  {/* HEIGHT FIELD */}
                  <PrivacyWrapper fieldKey="height" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <InputField label="Height (cm)" type="number" value={formData.height} onChange={(v: string) => setFormData({...formData, height: v})} disabled={!isMe} />
                  </PrivacyWrapper>

                  {/* WEIGHT FIELD */}
                  <PrivacyWrapper fieldKey="weight" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <InputField label="Weight (kg)" type="number" value={formData.weight} onChange={(v: string) => setFormData({...formData, weight: v})} disabled={!isMe} />
                  </PrivacyWrapper>

                  {/* BMI FIELD */}
                  <PrivacyWrapper fieldKey="bmi" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <InputField label="BMI" value={formData.bmi} onChange={() => {}} disabled={true} />
                  </PrivacyWrapper>
                </div>

                {/* SAVE BASIC INFO BUTTON (Moved inside here) */}
                {isMe && (
                  <div className="pt-3 mt-4 border-t border-slate-100">
                    <button 
                      onClick={handleSaveAllHealthData}
                      disabled={saving}
                      className={`w-full py-3.5 rounded-2xl font-black text-white shadow-md flex justify-center items-center gap-2 transition-all ${
                        saving ? 'bg-indigo-400 cursor-not-allowed scale-95' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'
                      }`}
                    >
                      {saving ? <RefreshCw className="animate-spin" size={18}/> : <UploadCloud size={18}/>}
                      {saving ? 'SAVING PROGRESS...' : 'SAVE BASIC INFO UPDATES'}
                    </button>
                  </div>
                )}
              </div>
            </CollapsibleSection>
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
      <ModalFollow config={modalConfig} onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} followers={followersList} following={followingList} />

      <ModalDOB 
        isOpen={showDOBModal} 
        onClose={() => setShowDOBModal(false)}
        dob={formData.dob}
        setDob={(v) => setFormData({...formData, dob: v, age: calculateAge(v)})}
        saving={saving}
        onSave={async () => {
          await handleSaveAllHealthData();
          setShowDOBModal(false);
        }}
      />

      <ModalVitals 
        isOpen={showVitalModal}
        onClose={() => setShowVitalModal(false)}
        userId={userId!}
        onSuccess={() => setRefreshTrigger(p => p + 1)}
        dynamicVitals={dynamicVitals}
        dynamicVitalsInputs={dynamicVitalsInputs}
        setDynamicVitalsInputs={setDynamicVitalsInputs}
        hiddenOther={hiddenOther}
        toggleVisibilityOther={toggleVisibilityOther}
        handleDeleteField={handleDeleteField}
        isMe={isMe}
      />

      <ModalExercises 
        isOpen={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        userId={userId!}
        onSuccess={() => setRefreshTrigger(p => p + 1)}
        trackedExercises={trackedExercises}
        exerciseInputs={exerciseInputs}
        setExerciseInputs={setExerciseInputs}
        hiddenOther={hiddenOther}
        toggleVisibilityOther={toggleVisibilityOther}
        handleDeleteField={handleDeleteField}
        isMe={isMe}
      />

      <ModalSchedule 
        isOpen={showScheduleModal} 
        onClose={() => setShowScheduleModal(false)} 
        userId={userId!} 
      />
    </div>
  );
}

export default ProfileScreen;