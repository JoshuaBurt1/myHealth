// ModalVitals.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Activity, PlusCircle, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { VITAL_KEY_MAP, BLOODTEST_KEY_MAP, SYMPTOM_KEY_MAP, getStandardUnit } from './profileConstants';
import { InputField } from './ProfileUI';
import PrivacyWrapper from './PrivacyWrapper';

const CATEGORY_MAPS: Record<string, Record<string, string>> = {
  'Vitals': VITAL_KEY_MAP,
  'Blood Test': BLOODTEST_KEY_MAP,
  'Symptoms': SYMPTOM_KEY_MAP,
};

type VitalCategory = 'Vitals' | 'Blood Test' | 'Symptoms' | 'Custom';
const CATEGORIES: VitalCategory[] = ['Vitals', 'Blood Test', 'Symptoms', 'Custom'];

// Shared dropdown options for Pain tracking
const PAIN_LOCATIONS = ['Head', 'Neck', 'Shoulders', 'Chest', 'Upper Back', 'Lower Back', 'Arms', 'Hands', 'Stomach', 'Pelvis', 'Legs', 'Feet', 'Full Body', 'Other'];
const PAIN_DESCRIPTIONS = ['Sharp', 'Dull', 'Aching', 'Throbbing', 'Burning', 'Nerve/Tingling', 'Cramping', 'Stabbing', 'Other'];

interface ModalVitalsProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trackedVitals: { key: string; label: string; type: string; unit?: string; isCustom: boolean }[];
  trackedVitalsInputs: Record<string, string>;
  setTrackedVitalsInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hiddenOther: string[];
  toggleVisibilityOther: (field: string) => void;
  handleDeleteField: (fieldLabel: string, fieldKey: string, category: 'vital' | 'diet' | 'exercise' ) => Promise<void>;
  isMe: boolean;
}

interface VitalEntry {
  key: string;
  label: string;
  unit: string;
  value: string;
  isCustom: boolean;
  type: string;
  location?: string;
  description?: string;
}

export const ModalVitals: React.FC<ModalVitalsProps> = ({ 
  isOpen, onClose, userId, onSuccess, 
  trackedVitals, trackedVitalsInputs, setTrackedVitalsInputs,
  hiddenOther, toggleVisibilityOther, handleDeleteField, isMe
}) => {
  const [selectedCategory, setSelectedCategory] = useState<VitalCategory>('Vitals');
  const [selectedItem, setSelectedItem] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  
  const [entries, setEntries] = useState<VitalEntry[]>([]);
  const [saving, setSaving] = useState(false);

  const [existingPainMetadata, setExistingPainMetadata] = useState<{location: string, description: string}>({ location: '', description: '' });

  // Filter items that are already tracked based on selected category
  const availableVitals = useMemo(() => {
    if (selectedCategory === 'Custom') return [];
    const map = CATEGORY_MAPS[selectedCategory];
    if (!map) return [];
    
    return Object.keys(map).filter(label => {
      const key = map[label];
      const alreadyInDb = trackedVitals.some(v => v.key === key);
      const alreadyInSession = entries.some(e => e.key === key);
      return !alreadyInDb && !alreadyInSession;
    });
  }, [selectedCategory, trackedVitals, entries]);

  useEffect(() => {
    if (selectedCategory !== 'Custom' && availableVitals.length > 0 && !availableVitals.includes(selectedItem)) {
      setSelectedItem(availableVitals[0]);
    }
  }, [availableVitals, selectedItem, selectedCategory]);

  if (!isOpen) return null;

  const handleAddEntry = () => {
    let newEntry: VitalEntry;

    if (selectedCategory !== 'Custom') {
      if (availableVitals.length === 0) return alert(`All standard ${selectedCategory.toLowerCase()} are already tracked.`);
      const map = CATEGORY_MAPS[selectedCategory];
      const key = map[selectedItem];
      
      newEntry = {
        key,
        label: selectedItem,
        unit: getStandardUnit(key) || '',
        value: '',
        isCustom: false,
        type: selectedCategory.toLowerCase(),
        location: key === 'pain' ? '' : undefined,
        description: key === 'pain' ? '' : undefined
      };
    } else {
      if (!customName.trim()) return alert('Please enter a custom health metric name.');
      const currentCustomCount = trackedVitals.filter(v => v.isCustom).length + entries.filter(e => e.isCustom).length;
      if (currentCustomCount >= 10) return alert('Maximum of 10 custom vitals allowed.');

      const sanitizedKey = `custom_${customName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      if (trackedVitals.some(v => v.key === sanitizedKey) || entries.some(e => e.key === sanitizedKey)) {
        return alert('This custom vital already exists.');
      }

      newEntry = {
        key: sanitizedKey,
        label: customName.trim(),
        unit: customUnit.trim(),
        value: '',
        isCustom: true,
        type: 'custom'
      };
      setCustomName('');
      setCustomUnit('');
    }

    setEntries([...entries, newEntry]);
  };

  const isValidVitalEntry = (key: string, value: string): boolean => {
    if (!value) return true;
    if (key !== 'lastBm' && value.includes('-')) return false;
    if ((key === 'nausea' || key === 'pain') && Number(value) > 10) return false;
    if (key === 'lastBm') {
      const selectedDate = new Date(value);
      const now = new Date();
      if (selectedDate > now) return false;
    }
    return true;
  };

  const updateNewEntryValue = (key: string, newValue: string) => {
    if (!isValidVitalEntry(key, newValue)) return;
    setEntries(prev => 
      prev.map(e => e.key === key ? { ...e, value: newValue } : e)
    );
  };

  const updateNewEntryMeta = (key: string, field: 'location' | 'description', val: string) => {
    setEntries(entries.map(e => e.key === key ? { ...e, [field]: val } : e));
  };

  const removeNewEntry = (key: string) => {
    setEntries(entries.filter(e => e.key !== key));
  };

  const handleSaveVitals = async () => {
    // Validating new entries
    const validNewEntries = entries.filter(e => {
      if (e.key === 'lastBm') return e.value.trim() !== '';
      return e.value.trim() !== '' && !isNaN(Number(e.value)) && Number(e.value) >= 0;
    });
    
    // Validating existing entries
    const validExistingEntries = trackedVitals.filter(v => {
      const val = trackedVitalsInputs[v.key];
      if (!val) return false;
      if (v.key === 'lastBm') return val.trim() !== '';
      return val.trim() !== '' && !isNaN(Number(val)) && Number(val) >= 0;
    });

    if (validNewEntries.length === 0 && validExistingEntries.length === 0) {
      return alert('Please enter at least one valid data point to save.');
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
      
      const lastUpdate = rootData.last_vitals_update?.toDate()?.getTime() || 0;
      const isEligibleForGems = (Date.now() - lastUpdate) > 6 * 60 * 60 * 1000;

      const lastBonusUpdate = rootData.last_healthy_bonus_update?.toDate()?.getTime() || 0;
      const isEligibleForBonus = (Date.now() - lastBonusUpdate) > 24 * 60 * 60 * 1000;

      let bonusGems = 0;
      let daysSinceAlert = 0;
      if (isEligibleForBonus && profileData.activeAlert_last) {
        const alertRaw = profileData.activeAlert_last;
        const activeAlertLastMs = alertRaw?.toDate ? alertRaw.toDate().getTime() : new Date(alertRaw).getTime();
        
        if (!isNaN(activeAlertLastMs)) {
          const msSinceAlert = Date.now() - activeAlertLastMs;
          daysSinceAlert = Math.floor(msSinceAlert / (1000 * 60 * 60 * 24));
          
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

      // Process new entries
      validNewEntries.forEach(entry => {
        const payload: any = { dateTime: nowISO };
        
        if (entry.key === 'lastBm') {
          payload.value = entry.value;
        } else {
          payload.value = Number(entry.value);
        }

        if (entry.key === 'pain') {
          payload.location = entry.location || 'Unspecified';
          payload.description = entry.description || 'Unspecified';
        }

        updateData[entry.key] = arrayUnion(payload);
        
        newCustomDefinitions.push({ 
          name: entry.label, 
          key: entry.key, 
          unit: entry.unit, 
          type: entry.type 
        });
      });

      // Process existing entries on the grid
      validExistingEntries.forEach(entry => {
        const val = trackedVitalsInputs[entry.key];
        const payload: any = { dateTime: nowISO };

        if (entry.key === 'lastBm') {
          payload.value = val;
        } else {
          payload.value = Number(val);
        }

        if (entry.key === 'pain') {
          payload.location = existingPainMetadata.location || 'Unspecified';
          payload.description = existingPainMetadata.description || 'Unspecified';
        }

        updateData[entry.key] = arrayUnion(payload);
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

      // Reset local states
      const clearedInputs = { ...trackedVitalsInputs };
      validExistingEntries.forEach(entry => { delete clearedInputs[entry.key]; });
      setTrackedVitalsInputs(clearedInputs);
      setExistingPainMetadata({ location: '', description: '' });
      setEntries([]); 

      const gemMessage = isEligibleForGems 
        ? ` +10 gems earned!${bonusGems > 0 ? ` (Additional +${bonusGems} gems for ${daysSinceAlert} consecutive days healthy!)` : ''}`
        : '';

      alert(`Log saved successfully!${gemMessage}`);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save Error:", err);
      alert('Failed to save data.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">        
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <Activity className="text-rose-500" size={24} /> LOG MEDICAL DATA
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full">
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
              <PlusCircle size={16}/> TRACK A NEW METRIC
            </h3>
            
            <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-xl mb-4 gap-1 w-fit">
              {CATEGORIES.map(cat => (
                <button 
                  key={cat}
                  className={`px-4 py-1.5 text-sm font-bold rounded-lg transition-all ${
                    selectedCategory === cat ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'
                  }`} 
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {selectedCategory !== 'Custom' ? (
                <select 
                  className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-rose-500 disabled:bg-slate-100"
                  value={selectedItem}
                  onChange={(e) => setSelectedItem(e.target.value)}
                  disabled={availableVitals.length === 0}
                >
                  {availableVitals.length === 0 ? (
                    <option>All {selectedCategory.toLowerCase()} tracked</option>
                  ) : (
                    availableVitals.map(v => <option key={v} value={v}>{v}</option>)
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
                disabled={
                  (selectedCategory !== 'Custom' && availableVitals.length === 0) ||
                  (selectedCategory === 'Custom' && (trackedVitals.filter(v => v.isCustom).length + entries.filter(e => e.isCustom).length >= 10))
                }
                className="px-6 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 transition-colors whitespace-nowrap"
              >
                Add to Grid
              </button>
            </div>
          </div>

          {/* Vitals currently being tracked */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Activity size={16}/> Active Health Metric Fields
            </h3>
            
            {(trackedVitals.length === 0 && entries.length === 0) ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-medium">No metrics tracked yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 sm:gap-4 gap-2">
                
                {/* 1. Existing Vitals on the grid */}
                {trackedVitals.map((vital, idx) => {
                  const isPain = vital.key === 'pain';
                  const isLastBm = vital.key === 'lastBm';

                  return (
                    <PrivacyWrapper 
                      key={`exist-${vital.key}-${idx}`} 
                      fieldKey={vital.key} 
                      isMe={isMe} 
                      hiddenOther={hiddenOther} 
                      toggleVisibilityOther={toggleVisibilityOther} 
                      onDelete={() => handleDeleteField(vital.label, vital.key, 'vital')}
                    >
                      <div className="h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-2 flex flex-col gap-2">
                        <InputField 
                          label={`${vital.label} ${vital.unit && !isPain ? `(${vital.unit})` : ''}${isPain ? ' (/10)' : ''}`.trim()} 
                          type={isLastBm ? "datetime-local" : "number"}
                          value={trackedVitalsInputs[vital.key] || ''} 
                          onChange={(v: string) => {
                            if (isValidVitalEntry(vital.key, v)) {
                              setTrackedVitalsInputs(prev => ({...prev, [vital.key]: v}));
                            }
                          }}
                          disabled={!isMe} 
                          icon={<Activity size={16} className="text-rose-400"/>} 
                        />
                        
                        {/* Extra dropdowns for Pain */}
                        {isPain && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            <select 
                              className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-400"
                              value={existingPainMetadata.location}
                              onChange={(e) => setExistingPainMetadata(prev => ({...prev, location: e.target.value}))}
                              disabled={!isMe}
                            >
                              <option value="">Select Location</option>
                              {PAIN_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>

                            <select 
                              className="w-full p-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-600 focus:outline-none focus:border-rose-400 disabled:bg-slate-50 disabled:text-slate-400"
                              value={existingPainMetadata.description}
                              onChange={(e) => setExistingPainMetadata(prev => ({...prev, description: e.target.value}))}
                              disabled={!isMe}
                            >
                              <option value="">Select Description</option>
                              {PAIN_DESCRIPTIONS.map(desc => <option key={desc} value={desc}>{desc}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    </PrivacyWrapper>
                  );
                })}

                {/* 2. New vitals */}
                {entries
                .filter(entry => !trackedVitals.some(vital => vital.key === entry.key))
                .map((entry) => {
                  const isPain = entry.key === 'pain';
                  const isLastBm = entry.key === 'lastBm';

                  return (
                    <PrivacyWrapper 
                      key={`new-${entry.key}`} 
                      fieldKey={entry.key} 
                      isMe={isMe} 
                      hiddenOther={hiddenOther} 
                      toggleVisibilityOther={toggleVisibilityOther} 
                      onDelete={() => removeNewEntry(entry.key)} 
                    >
                      <div className="h-full bg-rose-50 rounded-2xl border-2 border-rose-200 p-2 relative shadow-sm transition-all flex flex-col gap-2">
                        <button 
                          onClick={() => removeNewEntry(entry.key)} 
                          className="absolute -top-1 -right-1 text-rose-400 hover:text-rose-600 bg-white border border-rose-100 rounded-full z-20 p-1 shadow-sm transition-colors"
                          title="Remove from session"
                        >
                          <X size={12} strokeWidth={3}/>
                        </button>

                        <div className="opacity-100">
                          <InputField 
                            label={`${entry.label} ${entry.unit && !isPain ? `(${entry.unit})` : ''}${isPain ? ' (/10)' : ''} (NEW)`} 
                            type={isLastBm ? "datetime-local" : "number"} 
                            value={entry.value} 
                            onChange={(v: string) => updateNewEntryValue(entry.key, v)}
                          icon={<PlusCircle size={16} className="text-rose-500"/>} 
                        />
                        </div>

                        {/* Extra dropdowns for Pain */}
                        {isPain && (
                          <div className="flex flex-col gap-1.5 mt-1">
                            <select 
                              className="w-full p-2 text-xs bg-white border border-rose-200 rounded-lg text-slate-700 focus:outline-none focus:border-rose-400"
                              value={entry.location || ''}
                              onChange={(e) => updateNewEntryMeta(entry.key, 'location', e.target.value)}
                            >
                              <option value="">Select Location</option>
                              {PAIN_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>

                            <select 
                              className="w-full p-2 text-xs bg-white border border-rose-200 rounded-lg text-slate-700 focus:outline-none focus:border-rose-400"
                              value={entry.description || ''}
                              onChange={(e) => updateNewEntryMeta(entry.key, 'description', e.target.value)}
                            >
                              <option value="">Select Description</option>
                              {PAIN_DESCRIPTIONS.map(desc => <option key={desc} value={desc}>{desc}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    </PrivacyWrapper>
                  );
                })}
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
            {saving ? 'SAVING DATA...' : 'SAVE DATA LOG'}
          </button>
        </div>
      </div>
    </div>
  );
};