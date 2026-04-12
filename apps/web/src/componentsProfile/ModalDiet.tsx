import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Apple, CheckCircle, RefreshCw, Utensils, Info, PlusCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { DIET_KEY_MAP, MICRONUTRIENT_KEY_MAP, getStandardUnit } from './profileConstants';
import { InputField } from './ProfileUI';
import PrivacyWrapper from './PrivacyWrapper';

const DIET_CATEGORIES: Record<string, Record<string, string>> = {
  Macros: DIET_KEY_MAP,
  Micros: MICRONUTRIENT_KEY_MAP,
};

type DietCategory = 'Macros' | 'Micros' | 'Custom';
const CATEGORIES: DietCategory[] = ['Macros', 'Micros', 'Custom'];

interface ModalDietProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trackedDiet: { name: string; label: string; unit?: string; isCustom?: boolean }[];
  dietInputs: Record<string, string>;
  setDietInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hiddenOther: string[];
  toggleVisibilityOther: (field: string) => void;
  handleDeleteField: (fieldLabel: string, fieldKey: string, category: 'vital' | 'workout' | 'diet') => Promise<void>;
  isMe: boolean;
}

interface DietEntry {
  name: string;
  label: string;
  unit: string;
  value: string;
  isCustom: boolean;
}

export const ModalDiet: React.FC<ModalDietProps> = ({
  isOpen, onClose, userId, onSuccess,
  trackedDiet, dietInputs, setDietInputs,
  hiddenOther, toggleVisibilityOther, handleDeleteField, isMe
}) => {
  const [mealName, setMealName] = useState('');
  const [entries, setEntries] = useState<DietEntry[]>([]);
  const [saving, setSaving] = useState(false);
  
  // Custom tracking states
  const [selectedCategory, setSelectedCategory] = useState<DietCategory>('Macros');
  const [selectedMetric, setSelectedMetric] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const existingKeys = useMemo(() => new Set([
    ...trackedDiet.map(d => d.name),
    ...entries.map(e => e.name)
  ]), [trackedDiet, entries]);

  const availableMetrics = useMemo(() => {
    if (selectedCategory === 'Custom') return [];
    
    const activeMap = DIET_CATEGORIES[selectedCategory];
    if (!activeMap) return [];

    return Object.keys(activeMap).filter(
      label => !existingKeys.has(activeMap[label])
    );
  }, [selectedCategory, existingKeys]);

  useEffect(() => {
    if (selectedCategory !== 'Custom' && availableMetrics.length > 0 && !availableMetrics.includes(selectedMetric)) {
      setSelectedMetric(availableMetrics[0]);
    }
  }, [availableMetrics, selectedMetric, selectedCategory]);

  if (!isOpen) return null;

  const handleAddEntry = () => {
    if (selectedCategory !== 'Custom') {
      if (availableMetrics.length === 0) return;
      
      const activeMap = DIET_CATEGORIES[selectedCategory];
      const key = activeMap[selectedMetric];
      
      setEntries(prev => [...prev, {
        name: key,
        label: selectedMetric,
        unit: getStandardUnit(key),
        value: '',
        isCustom: false
      }]);
    } else {
      if (!customName.trim()) return alert('Please enter a nutrient name.');
      const sanitizedKey = `custom_diet_${customName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      if (existingKeys.has(sanitizedKey)) return alert('Metric already tracked.');

      setEntries(prev => [...prev, {
        name: sanitizedKey,
        label: customName.trim(),
        unit: customUnit.trim() || 'g',
        value: '',
        isCustom: true
      }]);
      setCustomName('');
      setCustomUnit('');
    }
  };

  const handleSaveDiet = async () => {
    if (!mealName.trim()) return alert('Please enter the name of your meal or items.');

    const preparedNew: (DietEntry & { finalValue: number })[] = [];
    const preparedExist: (typeof trackedDiet[0] & { finalValue: number })[] = [];

    for (const e of entries) {
      if (e.value.trim() !== '' && !isNaN(Number(e.value)) && Number(e.value) >= 0) {
        preparedNew.push({ ...e, finalValue: Number(e.value) });
      }
    }

    for (const d of trackedDiet) {
      const val = dietInputs[d.name];
      if (val?.trim() !== '' && !isNaN(Number(val)) && Number(val) >= 0) {
        preparedExist.push({ ...d, finalValue: Number(val) });
      }
    }

    if (!preparedNew.length && !preparedExist.length) return alert('Please enter at least one valid nutritional value.');

    setSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');

      const rootSnap = await getDoc(userRootRef);
      const rootData = rootSnap.data() || {};
      
      const lastBaseUpdate = rootData.last_diet_update?.toDate()?.getTime() || 0;
      const isEligibleForBaseGems = (Date.now() - lastBaseUpdate) > 6 * 60 * 60 * 1000;

      const lastStreakUpdate = rootData.last_diet_streak_update?.toDate()?.getTime() || 0;
      const diffMs = Date.now() - lastStreakUpdate;
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const ONE_WEEK_MS = 7 * ONE_DAY_MS;

      let currentStreak = rootData.diet_streak || 0;
      let newStreak = currentStreak;
      let streakIncremented = false;
      let streakBonus = 0;

      if (lastStreakUpdate === 0 || diffMs > ONE_WEEK_MS) {
        newStreak = 1; streakIncremented = true; streakBonus = newStreak;
      } else if (diffMs >= ONE_DAY_MS) {
        newStreak += 1; streakIncremented = true; streakBonus = newStreak;
      }

      const updateData: any = {};
      const newDefs: any[] = [];
      const mealLogEntry = { mealName: mealName.trim(), dateTime: nowISO, macros: {} as Record<string, number> };

      preparedNew.forEach(e => {
        updateData[e.name] = arrayUnion({ value: e.finalValue, dateTime: nowISO, context: mealName.trim(), unit: e.unit });
        mealLogEntry.macros[e.name] = e.finalValue;
        newDefs.push({ name: e.label, key: e.name, unit: e.unit, type: 'diet', isCustom: e.isCustom });
      });

      preparedExist.forEach(d => {
        updateData[d.name] = arrayUnion({ value: d.finalValue, dateTime: nowISO, context: mealName.trim(), unit: d.unit });
        mealLogEntry.macros[d.name] = d.finalValue;
      });

      updateData.diet_history = arrayUnion(mealLogEntry);
      if (newDefs.length > 0) updateData.customDietDefinitions = arrayUnion(...newDefs);

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });

      const rootUpdates: any = {};
      let totalGemsAwarded = 0;

      if (isEligibleForBaseGems) {
        totalGemsAwarded += 10;
        rootUpdates.last_diet_update = serverTimestamp();
      }
      if (streakIncremented) {
        totalGemsAwarded += streakBonus;
        rootUpdates.diet_streak = newStreak;
        rootUpdates.last_diet_streak_update = serverTimestamp();
      }

      if (totalGemsAwarded > 0) {
        rootUpdates.gems = increment(totalGemsAwarded);
        batch.update(userRootRef, rootUpdates);
      }

      await batch.commit();

      setMealName('');
      setEntries([]);
      
      // clear the UI fields
      setDietInputs(prev => {
        const reset = { ...prev };
        preparedExist.forEach(d => { reset[d.name] = ''; });
        return reset;
      });

      const gemMessage = (streakIncremented || isEligibleForBaseGems)
        ? `\n\n💎 +${totalGemsAwarded} Gems earned!` +
          (streakIncremented ? `\n🔥 Diet Streak: ${newStreak} (+${streakBonus} bonus gems)` : '')
        : '';

      alert(`Diet logged successfully!${gemMessage}`);
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error("Save Error:", err);
      alert('Failed to save diet log.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">        
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight">
            <Apple className="text-emerald-500" size={24} fill="currentColor" fillOpacity={0.2} />
            LOG DIET
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">          
          {/* Meal name input */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Utensils size={16}/> MEAL/ITEM NAME(S)
            </h3>
            <textarea
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              placeholder="e.g. Apple, Banana, Oats..."
              className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-slate-700 font-medium focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all resize-none h-24"
            />
          </div>

          {/* Diet dropdown */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full">
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
              <PlusCircle size={16}/> TRACK A NEW METRIC
            </h3>      
            
            <div className="flex flex-wrap bg-slate-200/50 p-1 rounded-xl mb-4 gap-1 w-fit">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  className={`px-4 py-1.5 text-xs font-black rounded-lg transition-all ${
                    selectedCategory === cat ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:bg-slate-200'
                  }`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              {selectedCategory !== 'Custom' ? (
                <div className="relative flex-1" ref={dropdownRef}>
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-emerald-500 transition-all"
                  >
                    <span className="truncate">
                      {selectedMetric || (availableMetrics.length === 0 ? `All metrics tracked` : 'Select Metric')}
                    </span>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isDropdownOpen && availableMetrics.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="max-h-60 overflow-y-auto">
                        {availableMetrics.map((met) => (
                          <button
                            key={met}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors border-b border-slate-50 last:border-none"
                            onClick={() => {
                              setSelectedMetric(met);
                              setIsDropdownOpen(false);
                            }}
                          >
                            {met}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Nutrient (e.g., Vitamin C)"
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Unit (mg, mcg)"
                    className="w-32 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-emerald-500"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                  />
                </>
              )}
              
              <button
                onClick={handleAddEntry}
                className="px-6 py-3 rounded-xl font-black text-xs text-white bg-slate-800 hover:bg-slate-900 transition-all shadow-sm active:scale-95 whitespace-nowrap"
              >
                ADD TO GRID
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Info size={16}/> ACTIVE NUTRITION FIELDS
            </h3>
            
            {(trackedDiet.length === 0 && entries.length === 0) ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-medium">No diet metrics tracked yet. Add one above.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                
                {/* Existing diet metrics */}
                {trackedDiet.map((dt, idx) => (
                  <PrivacyWrapper
                    key={`exist-${dt.name}-${idx}`}
                    fieldKey={dt.name}
                    isMe={isMe}
                    hiddenOther={hiddenOther}
                    toggleVisibilityOther={toggleVisibilityOther}
                    onDelete={async () => {
                      await handleDeleteField(dt.label, dt.name, 'diet');
                    }}
                  >
                    <div className="h-full w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-2 flex flex-col justify-center">
                      <span className="text-xs font-bold text-slate-500 mb-2 truncate block w-full px-1 uppercase tracking-tight">
                        {dt.label}
                      </span>
                      <InputField
                        label={`Value ${dt.unit ? `(${dt.unit})` : ''}`.trim()}
                        type="number"
                        value={dietInputs[dt.name] || ''}
                        onChange={(v: string) => !v.includes('-') && setDietInputs(p => ({ ...p, [dt.name]: v }))}
                        disabled={!isMe}
                        icon={<div className="w-4 h-4 rounded-full bg-emerald-100 border border-emerald-200" />}
                      />
                    </div>
                  </PrivacyWrapper>
                ))}

                {/* New diet metric input fields */}
                {entries.map((entry) => (
                  <PrivacyWrapper
                    key={`new-${entry.name}`}
                    fieldKey={entry.name}
                    isMe={isMe}
                    hiddenOther={hiddenOther}
                    toggleVisibilityOther={toggleVisibilityOther}
                    onDelete={() => setEntries(prev => prev.filter(e => e.name !== entry.name))}
                  >
                    <div className="h-full w-full bg-emerald-50 rounded-2xl border-2 border-emerald-200 p-2 relative shadow-sm flex flex-col justify-center">
                      <button
                        onClick={() => setEntries(prev => prev.filter(e => e.name !== entry.name))}
                        className="absolute -top-2 -right-2 text-emerald-500 hover:text-emerald-700 bg-white border border-emerald-100 rounded-full z-20 p-1.5 shadow-sm transition-colors"
                      >
                        <X size={14} strokeWidth={3}/>
                      </button>
                      <span className="text-xs font-bold text-emerald-600 mb-2 truncate block w-full px-1 uppercase tracking-tight">
                        {entry.label} (NEW)
                      </span>
                      <InputField
                        label={`Value ${entry.unit ? `(${entry.unit})` : ''}`}
                        type="number"
                        value={entry.value}
                        onChange={(v: string) => !v.includes('-') && setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, value: v } : e))}
                        icon={<PlusCircle size={16} className="text-emerald-500"/>}
                      />
                    </div>
                  </PrivacyWrapper>
                ))}
              </div>
            )}
          </div>

        </div>

        <div className="p-5 border-t border-slate-100 bg-white">
          <button
            onClick={handleSaveDiet}
            disabled={saving}
            className={`w-full py-4 rounded-xl font-black text-white shadow-lg flex justify-center items-center gap-2 transition-all text-lg ${
              saving ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 hover:shadow-emerald-600/20 hover:scale-[1.01] active:scale-[0.98]'
            }`}
          >
            {saving ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
            {saving ? 'SAVING DATA...' : 'SAVE DIET LOG'}
          </button>
        </div>
      </div>
    </div>
  );
};