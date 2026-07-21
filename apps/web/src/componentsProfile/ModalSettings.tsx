// ModalSettings.tsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Globe, X, Check, BookOpen, UserCheck } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';

interface PrivacySettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export interface PrivacySettings {
  allowPublic: boolean;
  automaticFollow: boolean;
}

const DEFAULT_SETTINGS: PrivacySettings = {
  allowPublic: false,
  automaticFollow: false,
};

export const ModalSettings: React.FC<PrivacySettingsModalProps> = ({
  isOpen, 
  onClose, 
  userId 
}) => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<PrivacySettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  
  useEffect(() => {
    const fetchSettings = async () => {
      const currentUser = auth.currentUser;
      if (!userId || !currentUser || userId !== currentUser.uid) return;
      
      setInitialLoading(true);

      try {
        const privacyDocRef = doc(db, 'users', userId, 'myHealth_privacy', 'settings');
        const docSnap = await getDoc(privacyDocRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setSettings({
            allowPublic: data.allowPublic ?? DEFAULT_SETTINGS.allowPublic,
            automaticFollow: data.automaticFollow ?? DEFAULT_SETTINGS.automaticFollow,
          });
        }
      } catch (error) {
        console.error("Error fetching privacy settings:", error);
      } finally {
        setInitialLoading(false);
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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">  
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
          <button onClick={onClose} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Settings List */}
        <div className="space-y-4">
          {initialLoading ? (
            <>
              <div className="h-20 w-full bg-slate-100 animate-pulse rounded-2xl" />
              <div className="h-20 w-full bg-slate-100 animate-pulse rounded-2xl" />
              <div className="h-20 w-full bg-slate-100 animate-pulse rounded-2xl" />
              <div className="h-20 w-full bg-slate-100 animate-pulse rounded-2xl" />
            </>
          ) : (
            <>
              <PrivacyToggle 
                icon={<Globe size={20} />}
                title="Public"
                description="Make your profile visible to anyone"
                isActive={settings.allowPublic}
                onToggle={() => handleToggle('allowPublic')}
              />
              <PrivacyToggle 
                icon={<UserCheck size={20} />}
                title="Automatic Follow"
                description="If off, you must approve new follow requests"
                isActive={settings.automaticFollow}
                onToggle={() => handleToggle('automaticFollow')}
              />
            </>
          )}
        </div>

        {/* Tutorial Button */}
        <div className="mt-8 pt-6 border-t border-slate-100 space-y-4">
          <button 
            onClick={handleRevisitTutorial}
            disabled={initialLoading}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors font-bold text-sm ${initialLoading && 'opacity-50'}`}
          >
            <BookOpen size={16} />
            Revisit myHealth Tutorial
          </button>

          <div className="flex items-center justify-center gap-2 text-emerald-600">
            {isSaving ? (
              <span className="text-[10px] font-black uppercase animate-pulse">Syncing to Cloud...</span>
            ) : !initialLoading && (
              <>
                <Check size={14} strokeWidth={3} />
                <span className="text-[10px] font-black uppercase">Settings Saved</span>
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