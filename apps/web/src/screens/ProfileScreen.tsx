// ProfileScreen.tsx
// This is used to hide the current steps and sync button in web version (viewable in mobile web view only)
declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void;
    };
  }
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, updateDoc, arrayRemove, setDoc, collection, query, arrayUnion, onSnapshot, deleteField, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Users, Camera, Stars, Activity, Loader2, RefreshCw, LineChart, Bell, Shield, TrendingUp, Settings} from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { Badge, InputField, SexInputField, AgeInputField, MobileTabNav, TDEECalculatorCard, QuickActionsBoard } from '../componentsProfile/ProfileUI';
import { ModalDOB, ModalFollow } from '../componentsProfile/ModalProfile';
import { ModalSettings, type PrivacySettings } from '../componentsProfile/ModalSettings';
import { ModalVitals } from '../componentsProfile/ModalVitals';
import { ModalDiet } from '../componentsProfile/ModalDiet';
import { ModalExercises } from '../componentsProfile/ModalExercises';
import { userImageUpload } from '../componentsProfile/userImageUpload';
import { HealthSyncSection } from '../componentsProfile/HealthSyncSection';
import PrivacyWrapper from '../componentsProfile/PrivacyWrapper';
import FollowButton from '../componentsProfile/FollowButton';
import DataScreen from '../componentsProfile/DataScreen';
import type { Group } from '../componentsProfile/componentsGroupScreen/group';
import { ActiveAlerts } from '../componentsProfile/componentsDataScreen/ActiveAlerts';
import { calculateTDEE, estimateActivityFactorFromSteps } from '../componentsProfile/tdeeUtils';

import { VITAL_KEY_MAP, BLOODTEST_KEY_MAP, SYMPTOM_KEY_MAP, DIET_KEY_MAP, MICRONUTRIENT_KEY_MAP, 
  STRENGTH_KEY_MAP, PLYO_KEY_MAP, ENDURANCE_KEY_MAP, SPEED_KEY_MAP, YOGA_KEY_MAP, 
  MOBILITY_KEY_MAP, PHYSIO_KEY_MAP, getStandardUnit } from '../componentsProfile/profileConstants';

const ProfileScreen: React.FC = () => {
  const [steps, setSteps] = useState(0);
  const [dailySteps, setDailySteps] = useState(0);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  
  const { userId } = useParams<{ userId: string }>();
  const currentUserId = auth.currentUser?.uid;
  const isMe = userId === currentUserId;

  const [loading, setLoading] = useState(true);
  const { handlePickImage, isUploading: imageUploading } = userImageUpload(
    userId, 
    (base64) => setProfileImage(base64)
  );

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  const [privacySettings, setPrivacySettings] = useState<PrivacySettings | null>(null);

  const [followingList, setFollowingList] = useState<{uid: string, name: string}[]>([]);
  const [followersList, setFollowersList] = useState<{uid: string, name: string}[]>([]);
  const [followRequests, setFollowRequests] = useState<{uid: string, name: string}[]>([]);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'followers' | 'following' | 'requests'}>({ isOpen: false, type: 'followers' });

  const [showDOBModal, setShowDOBModal] = useState(false);
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [showVitalModal, setShowVitalModal] = useState(false);
  const [showDietModal, setShowDietModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'profile' | 'history' | 'status'>('profile');
  const [mobileAlerts, setMobileAlerts] = useState<any[]>([]);

  const lastSavedAlertsRef = useRef<string>('');
  // Obtains the active alerts Datascreen.tsx
  const handleExportAlerts = React.useCallback((alerts: any[]) => {
    setMobileAlerts(alerts);
    setActiveAlertCount(alerts.length);
  }, []);
  
  // Unread Groups State
  const { userData: myUserData, userGroups: myGroups } = useNotifications();

  const [trackedVitals, setTrackedVitals] = useState<{key: string, label: string, type: string, unit?: string, isCustom: boolean}[]>([]);
  const [trackedVitalsInputs, setTrackedVitalsInputs] = useState<Record<string, string>>({});

  const [trackedDiet, setTrackedDiet] = useState<{name: string, label: string, type: string, unit?: string, isCustom: boolean}[]>([]);
  const [dietInputs, setDietInputs] = useState<Record<string, string>>({});
  const [dietStreak, setDietStreak] = useState(0);
  const dietKeys = useMemo(() => trackedDiet.map(d => d.name), [trackedDiet]);

  const [trackedExercises, setTrackedExercises] = useState<{name: string, label: string, type: string, unit?: string, isCustom: boolean}[]>([]);
  const [exerciseInputs, setExerciseInputs] = useState<Record<string, string>>({});
  const [exerciseStreak, setExerciseStreak] = useState(0);

  const [hiddenOther, setHiddenOther] = useState<string[]>([]);

  const navigate = useNavigate();
  const handleOpenGroupManagement = () => navigate('/group/manage');

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
    name: '', sex: '', dob: '', age: '', height: '', weight: '', gems: ''
  });

  // State to track if there are active alerts
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const [activeAlertLast, setActiveAlertLast] = useState<number | null>(null);
  const [currentSeverity, setCurrentSeverity] = useState<'critical' | 'info'>('info');

  // TDEE STATES
  const [tdeeFormula, setTdeeFormula] = useState<'mifflin' | 'katch'>('mifflin');
  const [lbm, setLbm] = useState<string>('');
  const [selectedActivityFactor, setSelectedActivityFactor] = useState<number | 'auto'>('auto');
  const [selectedDiet, setSelectedDiet] = useState<string>('Food Guide');

  // TDEE CALCULATIONS
  const autoActivityData = estimateActivityFactorFromSteps(steps);
  const currentActivityFactor = selectedActivityFactor === 'auto' ? autoActivityData.factor : selectedActivityFactor;

  const tdeeResult = useMemo(() => {
    const weightVal = parseFloat(formData.weight) || 0;
    const heightVal = parseFloat(formData.height) || 0;
    const ageVal = parseInt(formData.age) || 0;
    const lbmVal = parseFloat(lbm) || 0;

    return calculateTDEE(
      tdeeFormula, 
      weightVal, 
      heightVal, 
      ageVal, 
      formData.sex, 
      lbmVal, 
      currentActivityFactor
    );
  }, [tdeeFormula, formData, lbm, currentActivityFactor]);

  // Load user data 
  useEffect(() => {
    if (!userId) return;

    setLoading(true);

    const userRootRef = doc(db, 'users', userId);
    const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
    const imageRef = doc(db, 'users', userId, 'profile', 'image_data');
    const followersRef = query(collection(db, 'users', userId, 'followers'));
    const requestsRef = query(collection(db, 'users', userId, 'follow_requests'));
    const followingRef = query(collection(db, 'users', userId, 'following'));
    const privacyDocRef = doc(db, 'users', userId, 'myHealth_privacy', 'settings');

    let unsubRequests = () => {};
    if (isMe) {
      unsubRequests = onSnapshot(requestsRef, (snap) => {
        setFollowRequests(snap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' })));
      });
    }

    // Listen to root user doc
    const unsubRoot = onSnapshot(userRootRef, (docSnap) => {
      if (docSnap.exists()) {
        const rootData = docSnap.data();
        
        setFormData(prev => ({ 
          ...prev, 
          name: rootData.display_name || prev.name,
          gems: rootData.gems !== undefined ? rootData.gems.toString() : '0' 
        }));
        if (rootData.daily_steps !== undefined) setDailySteps(rootData.daily_steps);
        if (rootData.last_step_update) setLastSynced(rootData.last_step_update.toDate());
        if (rootData.exercise_streak !== undefined) setExerciseStreak(rootData.exercise_streak);
        if (rootData.diet_streak !== undefined) setDietStreak(rootData.diet_streak);

      }
    });

    // Listen to profile
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

        // 0. TDEE metabolic rate calculation requirement (steps)
        if (Array.isArray(profData.steps) && profData.steps.length > 0) {

          // Calculate the sum of values
          const last5Entries = profData.steps.slice(-5);          
          const totalSteps = last5Entries.reduce((sum: number, entry: any) => {
            const val = typeof entry.value === 'number' ? entry.value : parseFloat(entry.value) || 0;
            return sum + val;
          }, 0);

          // Calculate average and update the steps state
          const averageSteps = Math.round(totalSteps / last5Entries.length);
          setSteps(averageSteps);
        } else {
          setSteps(0);
        }

        // 1. Vitals Parsing
        const loadedTrackedVitals: typeof trackedVitals = [];
        const newTrackedVitalsInputs: Record<string, string> = {};
        const seenVitals = new Set<string>();

        if (Array.isArray(profData.customVitalsDefinitions)) {
          profData.customVitalsDefinitions.forEach((def: any) => {
            if (!seenVitals.has(def.key)) {
              const isCustom = def.key.startsWith('custom_');
              const correctUnit = isCustom ? def.unit : getStandardUnit(def.key);
              
              loadedTrackedVitals.push({ key: def.key, label: def.name, type: def.type, unit: correctUnit, isCustom });
              newTrackedVitalsInputs[def.key] = '';
              seenVitals.add(def.key);
            }
          });
        }

        const allStandardVitalMaps = [
          { map: VITAL_KEY_MAP, type: 'vitals' },
          { map: BLOODTEST_KEY_MAP, type: 'blood test' },
          { map: SYMPTOM_KEY_MAP, type: 'symptoms' }
        ];

        allStandardVitalMaps.forEach(({ map, type }) => {
          Object.entries(map).forEach(([label, key]) => {
            if (profData[key] !== undefined && !seenVitals.has(key)) {
              loadedTrackedVitals.push({ key, label, type: type, unit: getStandardUnit(key), isCustom: false });
              newTrackedVitalsInputs[key] = '';
              seenVitals.add(key);
            }
          });
        });

        setTrackedVitals(loadedTrackedVitals);

        // 2. Exercises Parsing
        const loadedExercises: typeof trackedExercises = [];
        const newExerciseInputs: Record<string, string> = {};
        const seenExercises = new Set<string>();

        if (Array.isArray(profData.customWorkoutsDefinitions)) {
          profData.customWorkoutsDefinitions.forEach((def: any) => {
            if (!seenExercises.has(def.key)) {
              const isCustom = def.key.startsWith('custom_');
              const correctUnit = isCustom ? def.unit : getStandardUnit(def.key);
              loadedExercises.push({ name: def.key, label: def.name, type: def.type, unit: correctUnit, isCustom });
              newExerciseInputs[def.key] = '';
              seenExercises.add(def.key);
            }
          });
        }

        const allStandardExerciseMaps = [
          { map: STRENGTH_KEY_MAP, type: 'strength' },
          { map: SPEED_KEY_MAP, type: 'speed' },
          { map: PLYO_KEY_MAP, type: 'plyometrics' },
          { map: ENDURANCE_KEY_MAP, type: 'endurance' },
          { map: PHYSIO_KEY_MAP, type: 'physio' },
          { map: YOGA_KEY_MAP, type: 'yoga' },
          { map: MOBILITY_KEY_MAP, type: 'mobility' }
        ];

        allStandardExerciseMaps.forEach(({ map, type }) => {
          Object.entries(map).forEach(([label, key]) => {
            if (profData[key] !== undefined && !seenExercises.has(key)) {
              loadedExercises.push({ name: key, label: label, type: type, unit: getStandardUnit(key), isCustom: false });
              newExerciseInputs[key] = '';
              seenExercises.add(key);
            }
          });
        });

        setTrackedExercises(loadedExercises);
        setExerciseInputs(prev => {
          const updated = { ...newExerciseInputs };
          let isDifferent = Object.keys(updated).length !== Object.keys(prev).length;
          Object.keys(updated).forEach(k => {
            if (prev[k] !== undefined && prev[k] !== '') updated[k] = prev[k];
            if (updated[k] !== prev[k]) isDifferent = true;
          });
          return isDifferent ? updated : prev;
        });

        // 3. Diet Metrics Parsing
        const loadedDiet: typeof trackedDiet = [];
        const newDietInputs: Record<string, string> = {};
        const seenDiet = new Set<string>();

        if (Array.isArray(profData.customDietDefinitions)) {
          profData.customDietDefinitions.forEach((def: any) => {
            if (!seenDiet.has(def.key)) {
              const isCustom = def.key.startsWith('custom_');
              const correctUnit = isCustom ? def.unit : getStandardUnit(def.key);
              loadedDiet.push({ name: def.key, label: def.name, type: def.type, unit: correctUnit, isCustom });
              newDietInputs[def.key] = '';
              seenDiet.add(def.key);
            }
          });
        }

        const nutritionMaps = [
          { map: DIET_KEY_MAP, type: 'diet' },
          { map: MICRONUTRIENT_KEY_MAP, type: 'micronutrients' }
        ];

        nutritionMaps.forEach(({ map, type }) => {
          Object.entries(map).forEach(([label, key]) => {
            if (profData[key] !== undefined && !seenDiet.has(key)) {
              loadedDiet.push({ name: key, label: label, type: type, unit: getStandardUnit(key), isCustom: false });
              newDietInputs[key] = '';
              seenDiet.add(key);
            }
          });
        });

        setTrackedDiet(loadedDiet);
        setDietInputs(prev => {
          const updated = { ...newDietInputs };
          let isDifferent = Object.keys(updated).length !== Object.keys(prev).length;
          Object.keys(updated).forEach(k => {
            if (prev[k] !== undefined && prev[k] !== '') updated[k] = prev[k];
            if (updated[k] !== prev[k]) isDifferent = true;
          });
          return isDifferent ? updated : prev; 
        });
      }
      setLoading(false); 
    });

    // Listen to profile image
    const unsubImage = onSnapshot(imageRef, (docSnap) => {
      if (docSnap.exists()) setProfileImage(docSnap.data().imageId);
    });

    // Listen to followers/following lists
    const unsubFollowers = onSnapshot(followersRef, (snap) => {
      setFollowersList(snap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' })));
      setFollowerCount(snap.size);
    });

    const unsubFollowing = onSnapshot(followingRef, (snap) => {
      setFollowingList(snap.docs.map(d => ({ uid: d.id, name: d.data().name || 'Unknown User' })));
      setFollowingCount(snap.size);
    });

    const unsubPrivacy = onSnapshot(privacyDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPrivacySettings(docSnap.data() as PrivacySettings);
      } else {
        setPrivacySettings({allowPublic: false, automaticFollow: false });
      }
    });

    // Follow status
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
      unsubPrivacy();
      unsubStatus();
      unsubRequests();
    };
  }, [userId, isMe, currentUserId]);

  // Compute unread badge for groups
  const hasNewGroupMessages = useMemo(() => {
    if (!myUserData || !myGroups.length || !currentUserId) return false;

    return myGroups.some((group: Group) => {
      const updatedTime = group.lastUpdated?.toMillis() || 0;
      const readTime = myUserData[`last_read_group_${group.id}`]?.toMillis() || 0;
      
      const isNotMe = group.lastUpdatedBy !== currentUserId;

      return updatedTime > readTime && isNotMe;
    });
  }, [myUserData, myGroups, currentUserId]);

  const hasAccess = useMemo(() => {
    if (loading || isMe) return true;
    if (!privacySettings) return false;

    const isFollower = followersList.some(f => f.uid === currentUserId);
    const isFollowingThem = followingList.some(f => f.uid === currentUserId);

    if (isFollower || isFollowingThem) {
      if (isFollower) return true;
      if (isFollowingThem) return true;
      return false;
    }

    return privacySettings.allowPublic;
  }, [loading, isMe, privacySettings, currentUserId, followersList, followingList]);

  const toggleVisibilityOther = async (fieldName: string) => {
    const isHidden = hiddenOther.includes(fieldName);
    const newList = isHidden ? hiddenOther.filter(n => n !== fieldName) : [...hiddenOther, fieldName];
    setHiddenOther(newList);

    try {
      const profileRef = doc(db, 'users', userId!, 'profile', 'user_data');
      await setDoc(profileRef, { hiddenOther: newList }, { merge: true });
    } catch (err) {
      console.error("Error toggling visibility", err);
    }
  };

  const handleDeleteField = async (
    fieldLabel: string, 
    fieldKey: string, 
    category: 'vital' | 'diet' | 'exercise'
  ) => {
    if (!window.confirm(`Delete ${fieldLabel}?`)) return;

    const profileRef = doc(db, 'users', userId!, 'profile', 'user_data');
    
    const definitionKey = 
      category === 'exercise' ? 'customWorkoutsDefinitions' : 
      category === 'diet' ? 'customDietDefinitions' : 
      'customVitalsDefinitions';

    const sourceArray = 
      category === 'exercise' ? trackedExercises : 
      category === 'diet' ? trackedDiet : 
      trackedVitals;

    // Use a type cast to any to find the item regardless of 'name' vs 'key' property
    const item = (sourceArray as any[]).find(i => (i.name === fieldKey || i.key === fieldKey));

    try {
      const updates: any = {
        [fieldKey]: deleteField()
      };

      if (item) {
        // Construct the exact object as it exists in your Firestore arrays
        const objectToRemove: any = {
          name: item.label || item.name || item.key,
          key: item.name || item.key,
          unit: item.unit ?? (category === 'diet' ? 'g' : ''),
          type: item.type,
          isCustom: !!item.isCustom
        };

        updates[definitionKey] = arrayRemove(objectToRemove);
      }

      await updateDoc(profileRef, updates);
      console.log(`Successfully removed ${fieldKey} and its definition.`);

    } catch (err) {
      console.error("Delete failed:", err);
      alert("Failed to delete the field. Please try again.");
    }
  };

  const updateBasicInfo = async (field: string, value: any) => {
    if (!userId || !isMe) return;

    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const timestamp = new Date().toISOString();
      const historicalFields = ['height', 'weight'];
      
      let updates: any = {};
      
      if (historicalFields.includes(field)) {
        updates[field] = arrayUnion({ value: value, dateTime: timestamp });
        
      } else {
        updates[field] = value;
        if (field === 'name') {
          updates['name_lowercase'] = value.toLowerCase();
        }
      }

      await setDoc(profileRef, updates, { merge: true });
    } catch (err) {
      console.error(`Error autosaving ${field}:`, err);
    }
  };

  useEffect(() => {
    if (!userId || !isMe) return;

    const activeAlertsMap = mobileAlerts.map(a => ({
      type: a.id,
      onset: a.timestamp
    }));

    const currentHash = JSON.stringify(activeAlertsMap);

    // Only proceed if the alerts have actually changed
    if (currentHash !== lastSavedAlertsRef.current) {
      const syncAlertsToDB = async () => {
        try {
          const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
          
          const updates: any = { 
            activeAlerts: activeAlertsMap,
            activeAlert_count: activeAlertsMap.length 
          };

          if (activeAlertsMap.length > 0) {
            updates.activeAlert_last = serverTimestamp();
          }

          await setDoc(profileRef, updates, { merge: true });

          lastSavedAlertsRef.current = currentHash;
          console.log("✅ Sync: activeAlerts updated");
        } catch (err) {
          console.error("❌ Sync Error:", err);
        }
      };

      syncAlertsToDB();
    }
  }, [mobileAlerts, userId, isMe]);

  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50">
        <RefreshCw className="animate-spin text-indigo-600 mb-2" size={32} />
        <p className="text-slate-500 font-medium text-sm">Loading Profile...</p>
      </div>
    );
  }

  // PRIVACY RENDER BLOCK
  if (!loading && !hasAccess) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <Shield size={64} className="text-slate-300 mb-4" />
        <h2 className="text-2xl font-black text-slate-800 tracking-tight">Content Blocked</h2>
        <p className="text-slate-500 mt-2 font-medium max-w-sm">
          This user has restricted who can view their profile and activity data based on their privacy settings.
        </p>
        <button 
          onClick={() => navigate(-1)} 
          className="mt-6 px-6 py-3 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-xl font-bold transition-colors"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 bg-slate-50 min-h-screen pb-20 relative">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start mt-2">
      <div className={`${activeTab === 'profile' ? 'block' : 'hidden lg:block'} space-y-4`}>
         <div className="space-y-4">
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-2 md:p-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <h3 className="hidden lg:flex text-xs font-bold text-slate-500 uppercase tracking-widest items-center gap-2 px-1">
                <User size={14} className="text-blue-400"/> Basic Information
              </h3>

              {/* Tab Navigator (mobile) */}
              {<MobileTabNav 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                activeAlertCount={activeAlertCount} 
                alertType={currentSeverity}
              />}
            </div>
                
            {/* COMPACT PROFILE HEADER */}
            <div className="bg-white p-4 md:p-5 3xl border-slate-100">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <div className="relative shrink-0">
                  <div className="w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden bg-slate-200 border-4 border-white shadow-md flex items-center justify-center">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User size={64} className="text-slate-400" />
                    )}
                    {imageUploading && (
                      <div className="absolute inset-0 bg-black/20 flex items-center justify-center rounded-full">
                        <Loader2 className="animate-spin text-white" />
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

                {/* Stats & Badges */}
                <div className="flex-1 w-full flex flex-col justify-center">
                  <div className="flex justify-center sm:justify-start gap-3 mb-3">
                    {/* Followers Button */}
                    <div 
                      className="relative bg-blue-50 hover:bg-blue-100 transition-colors rounded-xl px-2 py-1.5 sm:py-2 cursor-pointer flex-1 sm:min-w-24 flex flex-col items-center justify-center"
                      onClick={() => setModalConfig({ isOpen: true, type: 'followers' })}
                    >
                      {/* Notification Bell for pending requests */}
                      {isMe && followRequests.length > 0 && (
                        <div 
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setModalConfig({ isOpen: true, type: 'requests' }); 
                          }}
                          className="absolute -top-1 -right-1 flex items-center justify-center z-10 cursor-pointer group"
                        >
                          <span className="absolute inline-flex h-4 w-4 rounded-full opacity-75 animate-ping bg-rose-600" />
                          <div className="relative flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow-sm bg-rose-500 transition-colors group-hover:bg-rose-600">
                            <Bell size={11} className="text-white fill-white" />
                          </div>
                        </div>
                      )}

                      <div className="text-base sm:text-xl font-black text-slate-800 leading-tight">
                        {followerCount}
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Followers
                      </div>
                    </div>

                      {/* Following Button */}
                      <div 
                        className="bg-indigo-50 hover:bg-indigo-100 transition-colors rounded-xl px-2 py-1.5 sm:py-2 cursor-pointer flex-1 sm:min-w-24 flex flex-col items-center justify-center"
                        onClick={() => setModalConfig({ isOpen: true, type: 'following' })}
                      >
                        <div className="text-base sm:text-xl font-black text-slate-800 leading-tight">
                          {followingCount}
                        </div>
                        <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Following
                        </div>
                      </div>

                      {/* Groups Button */}
                      {isMe && (
                        <div 
                          className="relative bg-emerald-50 hover:bg-emerald-100 transition-colors rounded-xl px-2 py-1.5 sm:py-2 cursor-pointer flex-1 sm:min-w-24 flex flex-col items-center justify-center"
                          onClick={handleOpenGroupManagement}
                        >
                          {hasNewGroupMessages && (
                            <div className="absolute -top-1 -right-1 flex items-center justify-center z-10">
                              <span className="absolute inline-flex h-4 w-4 rounded-full opacity-75 animate-ping bg-emerald-600" />
                              <div className="relative flex items-center justify-center w-5 h-5 rounded-full border-2 border-white shadow-sm bg-emerald-600">
                                <Bell size={11} className="text-white fill-white" />
                              </div>
                            </div>
                          )}
                          
                          <div className="h-5 sm:h-7 flex items-center justify-center">
                            <Users size={18} className="text-emerald-600"/>
                          </div>
                          <div className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Groups
                          </div>
                        </div>
                      )}
                    </div>
                  <div className="flex flex-wrap justify-center sm:justify-start gap-2">
                    <Badge icon={<Stars size={14} className="fill-current"/>} color="bg-indigo-100 text-indigo-700 border border-indigo-200" label={`${formData.gems} Gems`}/>
                    {followerCount > 10 && <Badge icon={<Stars size={14}/>} color="bg-amber-100 text-amber-600" label="Social" />}
                    {profileImage && <Badge icon={<Camera size={14}/>} color="bg-blue-100 text-blue-600" label="Photogenic" />}
                    {followingCount > 0 && <Badge icon={<TrendingUp size={14}/>} color="bg-green-100 text-green-600" label="Networker" />}
                  </div>
                </div>
              </div>

              {/* Basic Information Fields */}
              <div className="pt-2 mt-4 border-t border-slate-50 space-y-4">
              <div className="grid grid-cols-2 gap-3 items-end">
                {/* Name Field */}
                <InputField 
                  label="Name" 
                  value={formData.name} 
                  onChange={(v) => setFormData({...formData, name: v})} 
                  onBlur={() => updateBasicInfo('name', formData.name)}
                  disabled={!isMe}
                />

                {/* Settings Button */}
                {isMe && (
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[9px] sm:text-[10px] font-bold text-transparent uppercase tracking-wider ml-1 select-none">
                      Settings
                    </label>
                    <button 
                      onClick={() => setShowPrivacyModal(true)}
                      className="w-full bg-white text-slate-600 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-xs sm:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-800 transition-all shadow-sm"
                    >
                      <Settings size={16} className="text-slate-400" />
                      Settings
                    </button>
                  </div>
                )}
              </div>
                              
                <div className="grid grid-cols-4 gap-1.5 sm:gap-3">
                  {/* SEX FIELD */}
                  <PrivacyWrapper fieldKey="sex" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <SexInputField 
                      label="Sex" 
                      value={formData.sex} 
                      onChange={(v) => {
                        setFormData({ ...formData, sex: v });
                        updateBasicInfo('sex', v);
                      }} 
                      disabled={!isMe}
                    />
                  </PrivacyWrapper>

                  {/* AGE FIELD */}
                  <PrivacyWrapper fieldKey="age" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <AgeInputField 
                      label="Age" 
                      value={formData.age} 
                      isMe={isMe} 
                      onIconClick={() => isMe && setShowDOBModal(true)} 
                      disabled={!isMe}
                    />
                  </PrivacyWrapper>

                  {/* HEIGHT FIELD */}
                  <PrivacyWrapper fieldKey="height" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <InputField 
                      label="Height (cm)" 
                      type="number" 
                      value={formData.height} 
                      onChange={(v) => setFormData({...formData, height: v})} 
                      onBlur={() => updateBasicInfo('height', formData.height)}
                      disabled={!isMe}
                    />
                  </PrivacyWrapper>

                  {/* WEIGHT FIELD */}
                  <PrivacyWrapper fieldKey="weight" isMe={isMe} hiddenOther={hiddenOther} toggleVisibilityOther={toggleVisibilityOther}>
                    <InputField 
                      label="Weight (kg)" 
                      type="number" 
                      value={formData.weight} 
                      onChange={(v) => setFormData({...formData, weight: v})} 
                      onBlur={() => updateBasicInfo('weight', formData.weight)}
                      disabled={!isMe}
                    />
                  </PrivacyWrapper>
                </div>
                {/* TDEE CALCULATOR CARD */}
                <TDEECalculatorCard 
                  tdeeFormula={tdeeFormula}
                  setTdeeFormula={setTdeeFormula}
                  lbm={lbm}
                  setLbm={setLbm}
                  selectedActivityFactor={selectedActivityFactor}
                  setSelectedActivityFactor={setSelectedActivityFactor}
                  autoActivityData={autoActivityData}
                  tdeeResult={tdeeResult}
                  isMe={isMe}
                  updateBasicInfo={updateBasicInfo}
                  formData={formData}
                  selectedDiet={selectedDiet}
                  setSelectedDiet={setSelectedDiet}
                />
                {isMe && !!window.ReactNativeWebView && (
                    <HealthSyncSection 
                      userId={userId!} 
                      isMe={isMe} 
                      steps={dailySteps} 
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
              </div>
            </div>

            {!isMe && (
              <FollowButton 
                targetUserId={userId!} 
                targetUserName={formData.name}
                isFollowing={isFollowing}
              />
            )}

            {/* QUICK ACTIONS DASHBOARD */}
            {isMe && (
              <QuickActionsBoard 
                setShowExerciseModal={setShowExerciseModal}
                setShowVitalModal={setShowVitalModal}
                setShowDietModal={setShowDietModal}
                activeAlertCount={activeAlertCount}
                activeAlertLast={activeAlertLast}
                alertType={currentSeverity}
                exerciseStreak={exerciseStreak}
                dietStreak={dietStreak}
              />
            )}
          </div>
        </div>
        </div>

        {/* Active History */}
        <div className={`${activeTab === 'history' ? 'block' : 'hidden lg:block'} lg:sticky lg:top-4 h-full`}>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden h-full flex flex-col">
            
            {/* Mirrored Tab Switcher */}
            <div className="p-2 md:p-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between shrink-0">
              
              {/* Title (Desktop) */}
              <h3 className="hidden lg:flex text-xs font-bold text-slate-500 uppercase tracking-widest items-center gap-2 px-1">
                <LineChart size={14} className="text-indigo-400" /> Health History
              </h3>

              {/* Tab Navigator (mobile) */}
              {<MobileTabNav 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                activeAlertCount={activeAlertCount} 
                alertType={currentSeverity}
              />}
            </div>

            <div className="flex-1 min-h-100">
              <DataScreen 
                userId={userId!} 
                isMe={isMe} 
                hiddenOther={hiddenOther} 
                onExportAlerts={handleExportAlerts} 
                onExportSeverity={setCurrentSeverity}
                onExportAlertLastMs={setActiveAlertLast}
                dietKeys={dietKeys}
                tdeeResult={tdeeResult}
                selectedDiet={selectedDiet}
              />
            </div>
          </div>
        </div>
        {/* Status tab (mobile only) */}
        <div className={`${activeTab === 'status' ? 'block' : 'hidden'} lg:hidden space-y-4`}>
          <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
            
            <div className="p-2 md:p-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between shrink-0">
              {<MobileTabNav 
                activeTab={activeTab} 
                setActiveTab={setActiveTab} 
                activeAlertCount={activeAlertCount} 
                alertType={currentSeverity}
              />}
            </div>

            <div className="p-4 md:p-5">
              <ActiveAlerts 
                alerts={mobileAlerts} 
              />
              
              {/* Fallback layout if no active alerts */}
              {activeAlertCount === 0 && (
                <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 animate-in fade-in duration-300">
                  <div className="h-16 w-16 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
                    <Activity size={32} className="text-emerald-500" />
                  </div>
                  <h4 className="text-lg font-bold text-slate-800 mb-1">In Good Health</h4>
                  <p className="text-sm">No alerts active at this time!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GLOBAL MODALS */}
      <ModalFollow 
        config={modalConfig} 
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })} 
        followers={followersList} 
        following={followingList} 
        requests={followRequests}
        isMe={isMe}
      />
      <ModalDOB 
        isOpen={showDOBModal} 
        onClose={() => setShowDOBModal(false)}
        userId={userId!}
        dob={formData.dob}
        setDob={(v) => setFormData({...formData, dob: v})} 
        onSuccess={() => {
          setShowDOBModal(false);
        }}
      />

      <ModalVitals 
        isOpen={showVitalModal}
        onClose={() => setShowVitalModal(false)}
        userId={userId!}
        onSuccess={() => setShowVitalModal(false)}
        trackedVitals={trackedVitals}
        trackedVitalsInputs={trackedVitalsInputs}
        setTrackedVitalsInputs={setTrackedVitalsInputs}
        hiddenOther={hiddenOther}
        toggleVisibilityOther={toggleVisibilityOther}
        handleDeleteField={handleDeleteField}
        isMe={isMe}
      />

      <ModalDiet
        isOpen={showDietModal}
        onClose={() => setShowDietModal(false)}
        userId={userId!}
        onSuccess={() => {}}
        trackedDiet={trackedDiet}
        dietInputs={dietInputs}
        setDietInputs={setDietInputs}
        hiddenOther={hiddenOther}
        toggleVisibilityOther={toggleVisibilityOther}
        handleDeleteField={handleDeleteField}
        isMe={isMe}
      />

      <ModalExercises 
        isOpen={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        userId={userId!}
        onSuccess={() => setShowExerciseModal(false)}
        trackedExercises={trackedExercises}
        exerciseInputs={exerciseInputs}
        setExerciseInputs={setExerciseInputs}
        hiddenOther={hiddenOther}
        toggleVisibilityOther={toggleVisibilityOther}
        handleDeleteField={handleDeleteField}
        isMe={isMe}
      />

      <ModalSettings 
        isOpen={showPrivacyModal} 
        onClose={() => setShowPrivacyModal(false)} 
        userId={userId!} 
      />
    </div>
  );
}

export default ProfileScreen;