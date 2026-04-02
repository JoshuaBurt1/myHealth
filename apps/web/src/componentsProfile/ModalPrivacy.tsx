//ModalPrivacy.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, Globe, Lock, X, Check, BookOpen } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

interface PrivacySettings {
  allowFollowers: boolean;
  allowGroupMembers: boolean;
  allowPublic: boolean;
}

const DEFAULT_SETTINGS: PrivacySettings = {
  allowFollowers: true,
  allowGroupMembers: true,
  allowPublic: false,
};

export const ModalPrivacy: React.FC<PrivacySettingsModalProps> = ({
  isOpen, 
  onClose, 
  userId 
}) => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  

  useEffect(() => {
    const fetchSettings = async () => {
      const currentUser = auth.currentUser;
      if (!userId || !currentUser || userId !== currentUser.uid) {
        console.warn("Unauthorized or invalid privacy fetch attempt blocked.");
        return;
      }
      
      try {
        const privacyDocRef = doc(db, 'users', userId, 'myHealth_privacy', 'settings');
        const docSnap = await getDoc(privacyDocRef);
        
        if (docSnap.exists()) {
          setSettings(docSnap.data() as PrivacySettings);
        } else {
          console.warn("Privacy settings document not found. Ensure it was created at registration.");
        }
      } catch (error) {
        console.error("Error fetching privacy settings:", error);
      }
    };

    if (isOpen) fetchSettings();
  }, [isOpen, userId]);

  const handleToggle = async (key: keyof PrivacySettings) => {
    const newValue = !settings[key];
    
    setSettings(prev => ({ ...prev, [key]: newValue }));
    
    setIsSaving(true);
    try {
      const privacyDocRef = doc(db, 'users', userId, 'myHealth_privacy', 'settings');
      await setDoc(privacyDocRef, { [key]: newValue }, { merge: true });
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      setSettings(prev => ({ ...prev, [key]: !newValue }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevisitTutorial = () => {
    onClose();
    navigate(`/tutorial/${userId}`, { state: { revisited: true } });
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 rounded-xl">
              <Shield className="text-emerald-600" size={24} />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-800 leading-tight">Privacy Settings</h3>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Control who sees your data</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Settings List */}
        <div className="space-y-4">
          <PrivacyToggle 
            icon={<Users size={20} />}
            title="Followers"
            description="Allow your followers to view your activity"
            isActive={settings.allowFollowers}
            onToggle={() => handleToggle('allowFollowers')}
          />
          <PrivacyToggle 
            icon={<Lock size={20} />}
            title="Group Members"
            description="Visible to members of the groups you've joined"
            isActive={settings.allowGroupMembers}
            onToggle={() => handleToggle('allowGroupMembers')}
          />
          <PrivacyToggle 
            icon={<Globe size={20} />}
            title="Public"
            description="Make your health profile discoverable to everyone"
            isActive={settings.allowPublic}
            onToggle={() => handleToggle('allowPublic')}
          />
        </div>

        {/* Footer Info & Tutorial Button */}
        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
          
          <button 
            onClick={handleRevisitTutorial}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-bold text-sm"
          >
            <BookOpen size={16} />
            Revisit myHealth Tutorial
          </button>

          <div className="flex items-center justify-center gap-2 text-emerald-600">
            {isSaving ? (
              <span className="text-[10px] font-black uppercase animate-pulse">Syncing to Cloud...</span>
            ) : (
              <>
                <Check size={14} strokeWidth={3} />
                <span className="text-[10px] font-black uppercase">Settings Encrypted & Saved</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface PrivacyToggleProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  isActive: boolean;
  onToggle: () => void;
}

const PrivacyToggle: React.FC<PrivacyToggleProps> = ({ icon, title, description, isActive, onToggle }) => (
  <div 
    onClick={onToggle}
    className={`group flex items-center justify-between p-4 rounded-2xl border-2 cursor-pointer transition-all ${
      isActive ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 bg-slate-50 hover:border-slate-200'
    }`}
  >
    <div className="flex items-center gap-4">
      <div className={`p-2.5 rounded-xl transition-colors ${
        isActive ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400'
      }`}>
        {icon}
      </div>
      <div className="flex flex-col">
        <span className={`font-black text-sm ${isActive ? 'text-emerald-900' : 'text-slate-700'}`}>
          {title}
        </span>
        <span className="text-[10px] font-bold text-slate-400 leading-tight pr-4">
          {description}
        </span>
      </div>
    </div>
    
    <div className={`w-12 h-6 rounded-full relative transition-colors ${
      isActive ? 'bg-emerald-500' : 'bg-slate-200'
    }`}>
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all shadow-sm ${
        isActive ? 'left-7' : 'left-1'
      }`} />
    </div>
  </div>
);