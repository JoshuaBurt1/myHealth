//ProfileScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, getDocs, query, writeBatch, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User, Camera, Stars, TrendingUp, Thermometer, Flag, Activity, Heart, Wind, Droplets, UploadCloud, Footprints, RefreshCw, CheckCircle, X } from 'lucide-react';
import { useGlobalSteps } from '../context/StepContext';
import DataScreen from './DataScreen';

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
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);

  // New states for lists and modal
  const [followersList, setFollowersList] = useState<{uid: string, name: string}[]>([]);
  const [followingList, setFollowingList] = useState<{uid: string, name: string}[]>([]);
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, type: 'followers' | 'following'}>({ isOpen: false, type: 'followers' });

  const [formData, setFormData] = useState({
    name: '', goal: '', gems: '', age: '', height: '', weight: '',
    bmi: '', bpSyst: '', bpDias: '', hr: '', spo2: '', rr: '', temp: ''
  });

  const loadUserData = useCallback(async () => {
    if (!userId) return;
    
    // 1. Reset state immediately on user change to prevent stale data bleed
    setLoading(true);
    setProfileImage(null);
    setFollowerCount(0);
    setFollowingCount(0);
    setFollowersList([]);
    setFollowingList([]);
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

      let fetchedVitals: any = {};

      if (profileDoc.exists()) {
        const profData = profileDoc.data();
        fetchedName = profData.name || fetchedName;
        fetchedGoal = profData.goal || '';
      }

      // 2. Assign fresh data directly instead of merging with the previous user's 'prev' state
      setFormData({
        name: fetchedName,
        goal: fetchedGoal,
        gems: fetchedGems,
        age: fetchedVitals.age || '',
        height: fetchedVitals.height || '',
        weight: fetchedVitals.weight || '',
        bmi: '',
        bpSyst: fetchedVitals.bpSyst || '',
        bpDias: fetchedVitals.bpDias || '',
        hr: fetchedVitals.hr || '',
        spo2: fetchedVitals.spo2 || '',
        rr: fetchedVitals.rr || '',
        temp: fetchedVitals.temp || ''
      });

      if (imageDoc.exists()) setProfileImage(imageDoc.data().imageId);

      // Extract names and UIDs for the lists
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
      
      ['age', 'height', 'weight', 'bpSyst', 'bpDias', 'hr', 'spo2', 'rr', 'temp'].forEach(field => {
        const val = formData[field as keyof typeof formData];
        const trimmed = val.trim();
        // Validation: Not empty, not zero, and MUST be a number
        if (trimmed !== '' && trimmed !== '0' && !isNaN(Number(trimmed))) {
          updateData[field] = arrayUnion({ value: trimmed, dateTime: now.toISOString() });
        }
      });

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });
      batch.update(userRootRef, { gems: newGemTotal, last_vitals_update: serverTimestamp() });
      await batch.commit();
      setRefreshTrigger(prev => prev + 1);
      setFormData(prev => ({ ...prev, gems: newGemTotal.toString(), age: '', bpSyst: '', bpDias: '', hr: '', spo2: '', rr: '', temp: '' }));

      setFormData(prev => ({ ...prev, gems: newGemTotal.toString(), age: '', bpSyst: '', bpDias: '', hr: '', spo2: '', rr: '', temp: '' }));
      alert(isEligibleForGems ? `Vitals updated! +10 gems (12 hour recharge)` : 'Vitals updated!');
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
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

      <div className="space-y-6">
        <section>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
            <User size={20} className="text-blue-500" /> Basic Information
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField label="Name" value={formData.name} onChange={(v) => setFormData({...formData, name: v})} disabled={!isMe} />
              <InputField label="Goal" value={formData.goal} onChange={(v) => setFormData({...formData, goal: v})} disabled={!isMe} icon={<Flag size={18}/>} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <InputField label="Age" type="number" value={formData.age} onChange={(v) => setFormData({...formData, age: v})} disabled={!isMe} />
              <InputField label="Height (cm)" type="number" value={formData.height} onChange={(v) => setFormData({...formData, height: v})} disabled={!isMe} />
              <InputField label="Weight (kg)" type="number" value={formData.weight} onChange={(v) => setFormData({...formData, weight: v})} disabled={!isMe} />
              <InputField label="BMI" value={formData.bmi} onChange={() => {}} disabled={true} />
            </div>
          </div>
        </section>

        {isMe && (
          <section>
            <h3 className="text-lg font-bold text-red-800 flex items-center gap-2 mb-4">
              <Activity size={20} className="text-red-500" /> Vital Signs
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-red-50/50 p-4 rounded-2xl border border-red-100">
              <InputField label="Blood Pressure (Systolic)" value={formData.bpSyst} onChange={(v) => setFormData({...formData, bpSyst: v})} disabled={!isMe} icon={<Heart size={18}/>} />
              <InputField label="Blood Pressure (Diastolic)" value={formData.bpDias} onChange={(v) => setFormData({...formData, bpDias: v})} disabled={!isMe} icon={<Heart size={18}/>} />
              <InputField label="Heart Rate (BPM)" type="number" value={formData.hr} onChange={(v) => setFormData({...formData, hr: v})} disabled={!isMe} icon={<Activity size={18}/>} />
              <InputField label="SpO2 (%)" type="number" value={formData.spo2} onChange={(v) => setFormData({...formData, spo2: v})} disabled={!isMe} icon={<Droplets size={18}/>} />
              <InputField label="Resp Rate" type="number" value={formData.rr} onChange={(v) => setFormData({...formData, rr: v})} disabled={!isMe} icon={<Wind size={18}/>} />
              <InputField label="Temp (°C)" type="number" value={formData.temp} onChange={(v) => setFormData({...formData, temp: v})} disabled={!isMe} icon={<Thermometer size={18}/>} />
            </div>
          </section>
        )}

        {isMe && (
          <button 
            onClick={handleSaveVitals}
            disabled={saving}
            className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all disabled:opacity-50"
          >
            {saving ? <RefreshCw className="animate-spin" /> : <UploadCloud />}
            Update Profile & Vitals
          </button>
        )}
      </div>

      <section>
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-4">
          <TrendingUp size={20} className="text-indigo-500" /> Health Analytics
        </h3>
        <DataScreen userId={userId!} refreshTrigger={refreshTrigger} />
      </section>

      {/* MODAL FOR FOLLOWERS / FOLLOWING */}
      {modalConfig.isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-sm max-h-[70vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()} // Prevent closing when clicking inside the modal
          >
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-slate-800 capitalize tracking-tight text-lg">
                {modalConfig.type}
              </h3>
              <button 
                onClick={() => setModalConfig({ ...modalConfig, isOpen: false })}
                className="p-1.5 bg-slate-200 text-slate-500 rounded-full hover:bg-slate-300 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="overflow-y-auto p-3 flex-1">
              {(modalConfig.type === 'followers' ? followersList : followingList).length === 0 ? (
                <div className="text-center text-slate-400 py-10 font-medium text-sm">
                  No {modalConfig.type} found.
                </div>
              ) : (
                <div className="space-y-1">
                  {(modalConfig.type === 'followers' ? followersList : followingList).map(u => (
                    <div 
                      key={u.uid} 
                      className="p-3 hover:bg-slate-50 rounded-2xl cursor-pointer flex items-center gap-4 transition-colors"
                      onClick={() => {
                        setModalConfig({ ...modalConfig, isOpen: false });
                        navigate(`/profile/${u.uid}`);
                      }}
                    >
                      <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-lg shadow-inner">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-bold text-slate-700">{u.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Badge = ({ icon, color, label }: { icon: any, color: string, label: string }) => (
  <div className={`px-3 py-1 rounded-full flex items-center gap-1.5 text-xs font-bold ${color}`}>
    {icon} {label}
  </div>
);

const StatItem = ({ label, count, onClick }: { label: string, count: number, onClick: () => void }) => (
  <div className="flex flex-col items-center cursor-pointer hover:bg-slate-50 transition-colors py-2 rounded-xl" onClick={onClick}>
    <span className="text-xl font-black text-slate-900">{count}</span>
    <span className="text-sm text-slate-500 font-medium">{label}</span>
  </div>
);

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  disabled?: boolean;
  icon?: React.ReactNode;
  placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({ 
  label, value, onChange, type = "text", disabled = false, icon, placeholder 
}) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">
      {label}
    </label>
    <div className="relative">
      {icon && <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</div>}
      <input 
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        disabled={disabled}
        className={`w-full p-3 ${icon ? 'pl-10' : 'pl-4'} border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all disabled:bg-slate-100 disabled:text-slate-500`}
      />
    </div>
  </div>
);

export default ProfileScreen;