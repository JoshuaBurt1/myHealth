// ModalVitals.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, PlusCircle, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { VITAL_KEY_MAP, getStandardUnit } from './profileConstants';
import { InputField } from './ProfileUI';
import PrivacyWrapper from './PrivacyWrapper'; 

interface ModalVitalsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  dynamicVitals: { key: string; label: string; isCustom: boolean; unit?: string }[];
  dynamicVitalsInputs: Record<string, string>;
  setDynamicVitalsInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hiddenOther: string[];
  toggleVisibilityOther: (field: string) => void;
  handleDeleteField: (fieldLabel: string, fieldKey: string, category: 'vital' | 'workout') => Promise<void>;
  isMe: boolean;
}

interface VitalEntry {
  key: string;
  label: string;
  unit: string;
  value: string;
  isCustom: boolean;
}

export const ModalVitals: React.FC<ModalVitalsProps> = ({ 
  isOpen, onClose, userId, onSuccess, 
  dynamicVitals, dynamicVitalsInputs, setDynamicVitalsInputs,
  hiddenOther, toggleVisibilityOther, handleDeleteField, isMe
}) => {
  const [mode, setMode] = useState<'standard' | 'custom'>('standard');
  const [selectedStandard, setSelectedStandard] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  
  const [entries, setEntries] = useState<VitalEntry[]>([]);
  const [saving, setSaving] = useState(false);

  // Filter out standard vitals that are already tracked
  const availableStandardVitals = useMemo(() => {
    return Object.keys(VITAL_KEY_MAP).filter(label => {
      const key = VITAL_KEY_MAP[label];
      const alreadyInDb = dynamicVitals.some(v => v.key === key);
      const alreadyInSession = entries.some(e => e.key === key);
      return !alreadyInDb && !alreadyInSession;
    });
  }, [dynamicVitals, entries]);

  useEffect(() => {
    if (availableStandardVitals.length > 0 && !availableStandardVitals.includes(selectedStandard)) {
      setSelectedStandard(availableStandardVitals[0]);
    }
  }, [availableStandardVitals, selectedStandard]);

  if (!isOpen) return null;

  const handleAddEntry = () => {
    let newEntry: VitalEntry;

    if (mode === 'standard') {
      if (availableStandardVitals.length === 0) return alert('All standard vitals are already tracked.');
      const key = VITAL_KEY_MAP[selectedStandard];
      
      newEntry = {
        key,
        label: selectedStandard,
        unit: getStandardUnit(key) || '',
        value: '',
        isCustom: false
      };
    } else {
      if (!customName.trim()) return alert('Please enter a custom vital name.');
      const currentCustomCount = dynamicVitals.filter(v => v.isCustom).length + entries.filter(e => e.isCustom).length;
      if (currentCustomCount >= 10) return alert('Maximum of 10 custom vitals allowed.');

      const sanitizedKey = `custom_${customName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      if (dynamicVitals.some(v => v.key === sanitizedKey) || entries.some(e => e.key === sanitizedKey)) {
        return alert('This custom vital already exists.');
      }

      newEntry = {
        key: sanitizedKey,
        label: customName.trim(),
        unit: customUnit.trim(),
        value: '',
        isCustom: true
      };
      setCustomName('');
      setCustomUnit('');
    }

    setEntries([...entries, newEntry]);
  };

  const updateNewEntryValue = (key: string, newValue: string) => {
    // Prevent negative values
    if (newValue.includes('-')) return; 
      setEntries(entries.map(e => e.key === key ? { ...e, value: newValue } : e));
    };

    const removeNewEntry = (key: string) => {
      setEntries(entries.filter(e => e.key !== key));
    };

    const handleSaveVitals = async () => {
    const validNewEntries = entries.filter(e => 
      e.value.trim() !== '' && 
      !isNaN(Number(e.value)) && 
      Number(e.value) >= 0
    );
    
    const validExistingEntries = dynamicVitals.filter(v => 
      dynamicVitalsInputs[v.key] && 
      dynamicVitalsInputs[v.key].trim() !== '' && 
      !isNaN(Number(dynamicVitalsInputs[v.key])) &&
      Number(dynamicVitalsInputs[v.key]) >= 0
    );

    if (validNewEntries.length === 0 && validExistingEntries.length === 0) {
      return alert('Please enter at least one valid non-negative numerical vital value.');
    }

    setSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');

      // Calculate bonuses for logging vital sign data
      const [rootSnap, profileSnap] = await Promise.all([
        getDoc(userRootRef),
        getDoc(profileRef)
      ]);

      const rootData = rootSnap.data() || {};
      const profileData = profileSnap.data() || {};
      
      // Eligibility for standard 6-hour log gems
      const lastUpdate = rootData.last_vitals_update?.toDate()?.getTime() || 0;
      const isEligibleForGems = (Date.now() - lastUpdate) > 6 * 60 * 60 * 1000;

      // Eligibility for 24-hour streak bonus gems
      const lastBonusUpdate = rootData.last_healthy_bonus_update?.toDate()?.getTime() || 0;
      const isEligibleForBonus = (Date.now() - lastBonusUpdate) > 24 * 60 * 60 * 1000;

      let bonusGems = 0;
      let daysSinceAlert = 0;
      if (isEligibleForBonus && profileData.activeAlert_last) {
        const alertRaw = profileData.activeAlert_last;
        const activeAlertLastMs = alertRaw?.toDate ? alertRaw.toDate().getTime() : new Date(alertRaw).getTime();
        
        if (!isNaN(activeAlertLastMs)) {
          const msSinceAlert = Date.now() - activeAlertLastMs;
          daysSinceAlert = Math.floor(msSinceAlert / (1000 * 60 * 60 * 24)); // Assign value here
          
          if (daysSinceAlert > 0) {
            if (daysSinceAlert <= 7) {
              bonusGems = daysSinceAlert;
            } else {
              bonusGems = 7 + Math.floor((daysSinceAlert - 7) / 7);
            }
          }
        }
      }

      const updateData: any = {};
      const newCustomDefinitions: any[] = [];

      validNewEntries.forEach(entry => {
        updateData[entry.key] = arrayUnion({ value: Number(entry.value), dateTime: nowISO });
        if (entry.isCustom) {
          newCustomDefinitions.push({ name: entry.label, key: entry.key, unit: entry.unit, type: 'custom' });
        }
      });

      validExistingEntries.forEach(entry => {
        updateData[entry.key] = arrayUnion({ value: Number(dynamicVitalsInputs[entry.key]), dateTime: nowISO });
      });

      if (newCustomDefinitions.length > 0) {
        updateData.customVitalsDefinitions = arrayUnion(...newCustomDefinitions);
      }

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });

      const rootUpdates: any = {};
      let totalGemsAwarded = 0;

      if (isEligibleForGems) {
        totalGemsAwarded += 10;
        rootUpdates.last_vitals_update = serverTimestamp();
      }

      if (isEligibleForBonus && bonusGems > 0) {
        totalGemsAwarded += bonusGems;
        rootUpdates.last_healthy_bonus_update = serverTimestamp();
      }

      if (totalGemsAwarded > 0) {
        rootUpdates.gems = increment(totalGemsAwarded);
        batch.update(userRootRef, rootUpdates);
      }

      await batch.commit();

      const clearedInputs = { ...dynamicVitalsInputs };
      validExistingEntries.forEach(entry => { delete clearedInputs[entry.key]; });
      setDynamicVitalsInputs(clearedInputs);
      setEntries([]); 

      const gemMessage = isEligibleForGems 
        ? ` +10 gems earned!${bonusGems > 0 ? ` (Additional +${bonusGems} gems for ${daysSinceAlert} consecutive days healthy!)` : ''}`
        : '';

      alert(`Vitals saved successfully!${gemMessage}`);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save Error:", err);
      alert('Failed to save vitals.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">        
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <Activity className="text-rose-500" size={24} /> LOG VITAL SIGNS
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full">
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
              <PlusCircle size={16}/> TRACK A NEW VITAL
            </h3>
            
            <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-xl mb-4 gap-1 w-fit">
              <button 
                className={`flex-1 px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${mode === 'standard' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`} 
                onClick={() => setMode('standard')}
              >
                Standard
              </button>
              <button 
                className={`flex-1 px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${mode === 'custom' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`} 
                onClick={() => setMode('custom')}
              >
                Custom
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {mode === 'standard' ? (
                <select 
                  className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-rose-500 disabled:bg-slate-100"
                  value={selectedStandard}
                  onChange={(e) => setSelectedStandard(e.target.value)}
                  disabled={availableStandardVitals.length === 0}
                >
                  {availableStandardVitals.length === 0 ? (
                    <option>All standard vitals tracked</option>
                  ) : (
                    availableStandardVitals.map(v => <option key={v} value={v}>{v}</option>)
                  )}
                </select>
              ) : (
                <>
                  <input 
                    type="text" 
                    placeholder="Vital Name (e.g. Sleep)" 
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-rose-500" 
                    value={customName} 
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Unit (hrs)" 
                    className="w-24 p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-rose-500" 
                    value={customUnit} 
                    onChange={(e) => setCustomUnit(e.target.value)}
                  />
                </>
              )}
              
              <button 
                onClick={handleAddEntry} 
                disabled={mode === 'standard' && availableStandardVitals.length === 0} 
                className="px-6 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 transition-colors whitespace-nowrap"
              >
                Add to Grid
              </button>
            </div>
          </div>

          {/* Vitals currently being tracked */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Activity size={16}/> Active Tracking Fields
            </h3>
            
            {(dynamicVitals.length === 0 && entries.length === 0) ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-medium">No vital signs tracked yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 sm:gap-4 gap-2">
                {/* 1. Existing Vitals */}
                {dynamicVitals.map((vital, idx) => (
                  <PrivacyWrapper 
                    key={`exist-${vital.key}-${idx}`} 
                    fieldKey={vital.key} 
                    isMe={isMe} 
                    hiddenOther={hiddenOther} 
                    toggleVisibilityOther={toggleVisibilityOther} 
                    onDelete={() => handleDeleteField(vital.label, vital.key, 'vital')}
                  >
                    <div className="h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-1">
                      <InputField 
                        label={`${vital.label} ${vital.unit ? `(${vital.unit})` : ''}`.trim()} 
                        type="number" 
                        value={dynamicVitalsInputs[vital.key] || ''} 
                        onChange={(v: string) => {
                          if (v.includes('-')) return; // Block negative signs
                          setDynamicVitalsInputs(prev => ({...prev, [vital.key]: v}))
                        }} 
                        disabled={!isMe} 
                        icon={<Activity size={16} className="text-rose-400"/>} 
                      />
                    </div>
                  </PrivacyWrapper>
                ))}

                {/* 2. New Vitals (added this session) */}
                {entries
                .filter(entry => !dynamicVitals.some(vital => vital.key === entry.key))
                .map((entry) => (
                  <PrivacyWrapper 
                    key={`new-${entry.key}`} 
                    fieldKey={entry.key} 
                    isMe={isMe} 
                    hiddenOther={hiddenOther} 
                    toggleVisibilityOther={toggleVisibilityOther} 
                    onDelete={() => removeNewEntry(entry.key)} 
                  >
                    <div className="h-full bg-rose-50 rounded-2xl border-2 border-rose-200 p-1 relative shadow-sm transition-all">
                      <button 
                        onClick={() => removeNewEntry(entry.key)} 
                        className="absolute -top-1 -right-1 text-rose-400 hover:text-rose-600 bg-white border border-rose-100 rounded-full z-20 p-1 shadow-sm transition-colors"
                        title="Remove from session"
                      >
                        <X size={12} strokeWidth={3}/>
                      </button>

                      <div className="opacity-100">
                        <InputField 
                          label={`${entry.label} ${entry.unit ? `(${entry.unit})` : ''} (NEW)`} 
                          type="number" 
                          value={entry.value} 
                          onChange={(v: string) => updateNewEntryValue(entry.key, v)} 
                          icon={<PlusCircle size={16} className="text-rose-500"/>} 
                        />
                      </div>
                    </div>
                  </PrivacyWrapper>
              ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white">
          <button 
            onClick={handleSaveVitals}
            disabled={saving}
            className={`w-full py-4 rounded-xl font-black text-white shadow-lg flex justify-center items-center gap-2 transition-all text-lg ${
              saving ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700 hover:scale-[1.01] active:scale-[0.98]'
            }`}
          >
            {saving ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
            {saving ? 'SAVING DATA...' : 'SAVE VITAL LOG'}
          </button>
        </div>
      </div>
    </div>
  );
};