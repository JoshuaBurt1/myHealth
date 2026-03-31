import React from 'react';
import { X, RefreshCw, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';

// --- Interfaces ---

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

interface ModalDOBProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  dob: string;
  setDob: (v: string) => void;
  onSuccess: () => void;
}

interface ModalFollowProps {
  config: { isOpen: boolean; type: string }; 
  onClose: () => void;
  followers: any[];
  following: any[];
}

// --- Components ---
const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, onClose, title, icon, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 uppercase tracking-tight">
            {icon} {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const ModalDOB: React.FC<ModalDOBProps> = ({ 
  isOpen, onClose, userId, dob, setDob, onSuccess 
}) => {
  const [saving, setSaving] = React.useState(false);
  const hasInitialized = React.useRef(false);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  React.useEffect(() => {
    if (isOpen) {
      if (!hasInitialized.current) {
        if (!dob) {
          const defaultDate = new Date();
          defaultDate.setFullYear(defaultDate.getFullYear() - 18);
          setDob(defaultDate.toISOString().split('T')[0]);
        }
        hasInitialized.current = true;
      }
    } else {
      hasInitialized.current = false;
    }
  }, [isOpen, dob, setDob]);

  const handleInternalSave = async () => {
    if (!userId || !dob) return;
    setSaving(true);

    try {
      const calculateAge = (dobString: string): string => {
        const today = new Date();
        const birthDate = new Date(dobString);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
        return age.toString();
      };

      const ageValue = calculateAge(dob);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      
      await setDoc(profileRef, { 
        dob: dob,
        age: arrayUnion({ value: ageValue, dateTime: new Date().toISOString() }) 
      }, { merge: true });

      onSuccess(); 
    } catch (err) {
      console.error("Save DOB error:", err);
      alert("Failed to save birthday.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalWrapper 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Set Date of Birth" 
      icon={<User size={20} className="text-indigo-500" />}
    >
      <div className="space-y-4 mb-6">
        <p className="text-xs text-slate-500 font-medium px-1">
          Your DOB is used to calculate your age and is never shown to other users.
        </p>
        <input 
          type="date" 
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
          value={dob || ""} 
          max={getTodayDate()}
          onChange={(e) => setDob(e.target.value)}
        />
      </div>
      <button 
        onClick={handleInternalSave}
        disabled={saving || !dob}
        className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-indigo-700"
      >
        {saving ? <RefreshCw className="animate-spin" size={20}/> : "Confirm Birthday"}
      </button>
    </ModalWrapper>
  );
};

export const ModalFollow: React.FC<ModalFollowProps> = ({ config, onClose, followers, following }) => {
  const navigate = useNavigate(); 
  
  // Guard: Ensure config exists
  if (!config || !config.isOpen) return null;
  
  const isFollowers = config.type?.toLowerCase() === 'followers';
  const list = isFollowers ? followers : following;
  const displayTitle = isFollowers ? 'Followers' : 'Following';

  return (
    <ModalWrapper isOpen={config.isOpen} onClose={onClose} title={displayTitle}>
      <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
        {list?.map(u => (
          <button 
            key={u.uid} 
            onClick={() => { 
              onClose(); 
              navigate(`/profile/${u.uid}`); 
            }} 
            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
              <User size={20} />
            </div>
            <span className="font-bold text-slate-700">{u.name || u.displayName || 'User'}</span>
          </button>
        ))}
        {(!list || list.length === 0) && (
          <p className="text-center py-8 text-slate-400 text-sm font-medium">
            No {displayTitle.toLowerCase()} found.
          </p>
        )}
      </div>
    </ModalWrapper>
  );
};