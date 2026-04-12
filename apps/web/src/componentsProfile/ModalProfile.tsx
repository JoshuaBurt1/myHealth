// ModalProfile.tsx
// These are functions used in the Basic Information section of ProfileScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { writeBatch } from 'firebase/firestore';
import { X, RefreshCw, User, Check, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, arrayUnion, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface FollowUser {
  uid: string;
  name: string;
}

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
  config: { isOpen: boolean; type: 'followers' | 'following' | 'requests' };
  onClose: () => void;
  followers: FollowUser[];
  following: FollowUser[];
  requests?: FollowUser[];
  isMe: boolean;
}

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

const TabButton = ({ active, onClick, label, count, alert }: any) => (
  <button
    onClick={onClick}
    className={`flex-1 relative flex flex-col items-center justify-center py-3 rounded-xl transition-all ${
      active ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-slate-200/50'
    }`}
  >
    <span className="text-[11px] font-black uppercase tracking-wider">{label}</span>
    <span className={`text-lg font-black leading-none mt-1 ${active ? 'text-slate-800' : 'text-slate-400'}`}>
      {count}
    </span>
    {alert && !active && (
      <span className="absolute top-2 right-4 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
    )}
  </button>
);

// Exported Modals

export const ModalDOB: React.FC<ModalDOBProps> = ({ 
  isOpen, onClose, userId, dob, setDob, onSuccess 
}) => {
  const [saving, setSaving] = useState(false);
  const hasInitialized = useRef(false);

  const getTodayDate = () => new Date().toISOString().split('T')[0];

  useEffect(() => {
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

export const ModalFollow: React.FC<ModalFollowProps> = ({ 
  config, 
  onClose, 
  followers, 
  following, 
  requests = [],
  isMe 
}) => {
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;
  const [activeTab, setActiveTab] = useState<'followers' | 'following' | 'requests'>(config.type);

  useEffect(() => {
    if (config.isOpen) setActiveTab(config.type);
  }, [config.isOpen, config.type]);

  if (!config.isOpen) return null;

  const handleAcceptRequest = async (requester: FollowUser) => {
    if (!currentUserId) return;
    
    const batch = writeBatch(db);

    // Add another user to your followers list
    const myFollowerRef = doc(db, 'users', currentUserId, 'followers', requester.uid);
    batch.set(myFollowerRef, {
      name: requester.name, 
      uid: requester.uid,
      timestamp: new Date()
    });

    // Add yourself to the other user's following list
    const theirFollowingRef = doc(db, 'users', requester.uid, 'following', currentUserId);
    batch.set(theirFollowingRef, {
      name: auth.currentUser?.displayName || 'User', 
      uid: currentUserId,
      timestamp: new Date()
    });

    const requestRef = doc(db, 'users', currentUserId, 'follow_requests', requester.uid);
    batch.delete(requestRef);

    try {
      await batch.commit();
    } catch (err) {
      console.error("Error accepting request", err);
    }
  };

  const handleDeclineRequest = async (requesterId: string) => {
    if (!currentUserId) return;
    try {
      await deleteDoc(doc(db, 'users', currentUserId, 'follow_requests', requesterId));
    } catch (err) {
      console.error("Error declining request", err);
    }
  };

  const activeList = activeTab === 'followers' ? followers : activeTab === 'following' ? following : requests;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end sm:items-center sm:justify-center" onClick={onClose}>
      <div 
        className="bg-white w-full sm:max-w-md h-[80vh] sm:h-150 sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-6 border-b border-slate-100">
          <h2 className="text-xl font-black text-slate-800">Connections</h2>
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex p-2 bg-slate-50 border-b border-slate-100">
          <TabButton active={activeTab === 'followers'} onClick={() => setActiveTab('followers')} label="Followers" count={followers.length} />
          <TabButton active={activeTab === 'following'} onClick={() => setActiveTab('following')} label="Following" count={following.length} />
          {isMe && (
            <TabButton active={activeTab === 'requests'} onClick={() => setActiveTab('requests')} label="Requests" count={requests.length} alert={requests.length > 0} />
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeList.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <User size={48} className="mb-4 opacity-20" />
              <p className="font-bold">No {activeTab} yet</p>
            </div>
          ) : (
            activeList.map(user => (
              <div key={user.uid} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                <div className="flex items-center gap-3 cursor-pointer" onClick={() => { onClose(); navigate(`/profile/${user.uid}`); }}>
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-black uppercase">
                    {user.name?.charAt(0) || '?'}
                  </div>
                  <span className="font-bold text-slate-700">{user.name}</span>
                </div>

                {activeTab === 'requests' && isMe && (
                  <div className="flex gap-2">
                    <button onClick={() => handleAcceptRequest(user)} className="p-2 bg-emerald-100 text-emerald-600 hover:bg-emerald-200 rounded-xl transition-colors">
                      <Check size={18} strokeWidth={3} />
                    </button>
                    <button onClick={() => handleDeclineRequest(user.uid)} className="p-2 bg-rose-100 text-rose-600 hover:bg-rose-200 rounded-xl transition-colors">
                      <Trash2 size={18} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};