// ModalExercises.tsx

import React, { useState, useEffect, useMemo, useRef} from 'react';
import { X, Dumbbell, PlusCircle, RefreshCw, CheckCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { STRENGTH_KEY_MAP, SPEED_KEY_MAP, PLYO_KEY_MAP, ENDURANCE_KEY_MAP, YOGA_KEY_MAP, MOBILITY_KEY_MAP, PHYSIO_KEY_MAP, getStandardUnit } from './profileConstants';
import { InputField } from './ProfileUI';
import PrivacyWrapper from './PrivacyWrapper';

const CATEGORY_MAPS: Record<string, Record<string, string>> = {
  Strength: STRENGTH_KEY_MAP,
  Speed: SPEED_KEY_MAP,
  Plyometrics: PLYO_KEY_MAP,
  Endurance: ENDURANCE_KEY_MAP,  
  Yoga: YOGA_KEY_MAP,
  Mobility: MOBILITY_KEY_MAP,
  Physio: PHYSIO_KEY_MAP,
};

type ExerciseCategory = 'Strength' | 'Speed' | 'Plyometrics' | 'Endurance' | 'Yoga' | 'Mobility' | 'Physio' | 'Custom';
const CATEGORIES: ExerciseCategory[] = ['Strength', 'Speed', 'Plyometrics', 'Endurance', 'Yoga', 'Mobility', 'Physio', 'Custom'];

// identify if an exercise requires 1RM Epley Formula
const STRENGTH_VALUES = Object.values(STRENGTH_KEY_MAP);
const isStrengthExercise = (key: string) => STRENGTH_VALUES.includes(key);

// identify if an exercise is a speed tracking metric
const SPEED_VALUES = Object.values(SPEED_KEY_MAP);
const isSpeedExercise = (key: string) => SPEED_VALUES.includes(key);

// calculates percentage changes
const calculatePercentChange = (oldValue: number, newValue: number): number => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Number((((newValue - oldValue) / oldValue) * 100).toFixed(2));
};

interface ModalExercisesProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trackedExercises: { name: string; label: string; type: string; unit?: string; isCustom: boolean }[];
  exerciseInputs: Record<string, string>;
  setExerciseInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hiddenOther: string[];
  toggleVisibilityOther: (field: string) => void;
  handleDeleteField: (fieldLabel: string, fieldKey: string, category: 'vital' | 'diet' | 'exercise') => Promise<void>;
  isMe: boolean;
}

interface ExerciseEntry {
  name: string;
  label: string;
  unit: string;
  type: string;
  value: string;
  weight?: string;
  reps?: string;
  isCustom: boolean;
}

export const ModalExercises: React.FC<ModalExercisesProps> = ({ 
  isOpen, onClose, userId, onSuccess, 
  trackedExercises, exerciseInputs, setExerciseInputs,
  hiddenOther, toggleVisibilityOther, handleDeleteField, isMe
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ExerciseCategory>('Strength');
  const [selectedExercise, setSelectedExercise] = useState<string>('');
  const [customName, setCustomName] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [entries, setEntries] = useState<ExerciseEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // Toggle states for units
  const [strengthUnits, setStrengthUnits] = useState<Record<string, 'kg' | 'lbs'>>({});
  const [speedUnits, setSpeedUnits] = useState<Record<string, 'sec' | 'mm:ss'>>({});

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
    ...trackedExercises.map(ex => ex.name),
    ...entries.map(e => e.name)
  ]), [trackedExercises, entries]);

  const availableExercises = useMemo(() => {
    if (selectedCategory === 'Custom') return [];
    const map = CATEGORY_MAPS[selectedCategory];
    if (!map) return [];
    return Object.keys(map).filter(label => !existingKeys.has(map[label]));
  }, [selectedCategory, existingKeys]);

  useEffect(() => {
    if (selectedCategory !== 'Custom' && availableExercises.length > 0 && !availableExercises.includes(selectedExercise)) {
      setSelectedExercise(availableExercises[0]);
    }
  }, [availableExercises, selectedExercise, selectedCategory]);

  const currentCustomCount = useMemo(() => {
    return trackedExercises.filter(v => v.isCustom).length + entries.filter(e => e.isCustom).length;
  }, [trackedExercises, entries]);

  if (!isOpen) return null;

  const handleAddEntry = () => {
    if (selectedCategory !== 'Custom') {
      if (availableExercises.length === 0) return;
      const map = CATEGORY_MAPS[selectedCategory];
      const key = map[selectedExercise];
      
      setEntries(prev => [...prev, {
        name: key,
        label: selectedExercise,
        unit: getStandardUnit(key) || (selectedCategory === 'Strength' ? 'kg' : 'sec'),
        type: selectedCategory.toLowerCase(),
        value: '',
        weight: '',
        reps: '',
        isCustom: false
      }]);
    } else {
      if (!customName.trim()) return alert('Please enter a custom exercise name.');

      if (currentCustomCount >= 10) return alert('Maximum of 10 custom exercises allowed.');

      const sanitizedKey = `custom_ex_${customName.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`;
      if (existingKeys.has(sanitizedKey)) return alert('Already exists.');

      setEntries(prev => [...prev, {
        name: sanitizedKey,
        label: customName.trim(),
        unit: customUnit.trim() || 'reps',
        type: 'custom',
        value: '',
        isCustom: true
      }]);
      setCustomName('');
      setCustomUnit('');
    }
  };

  const parseSpeedValue = (val: string, unit: 'sec' | 'mm:ss'): number => {
    if (unit === 'sec') return Number(val);
    const parts = val.split(':');
    if (parts.length === 2) {
      return (Number(parts[0]) * 60) + Number(parts[1]);
    } else if (parts.length === 1) {
       return Number(parts[0]);
    }
    return NaN;
  };

  const convertWeightToKg = (weight: number, unit: 'kg' | 'lbs'): number => {
    return unit === 'lbs' ? weight * 0.45359237 : weight;
  };

  const handleSaveExercises = async () => {
    const preparedNew: (ExerciseEntry & { finalValue: number })[] = [];
    const preparedExist: (typeof trackedExercises[0] & { finalValue: number })[] = [];
    let bonusGems = 0;

    // Process new entries
    for (const e of entries) {
      if (isStrengthExercise(e.name)) {
        if ((e.weight && !e.reps) || (!e.weight && e.reps)) {
          return alert(`Missing data: Please enter both weight and reps for ${e.label} to calculate your 1-Rep Max.`);
        }
        if (e.weight && e.reps) {
          const unit = strengthUnits[e.name] || 'kg';
          let w = Number(e.weight);
          w = convertWeightToKg(w, unit);
          const r = Number(e.reps);
          if (isNaN(w) || isNaN(r)) continue;
          // Epley Formula: 1RM = Weight * (1 + Reps/30)
          const oneRepMax = Math.round(w * (1 + r / 30));
          preparedNew.push({ ...e, finalValue: oneRepMax, unit: 'kg' });
        }
      } else if (isSpeedExercise(e.name)) {
        if (e.value.trim() !== '') {
          const unit = speedUnits[e.name] || 'sec';
          const parsedVal = parseSpeedValue(e.value, unit);
          if (!isNaN(parsedVal)) {
             preparedNew.push({ ...e, finalValue: parsedVal, unit: 'sec' });
          }
        }
      } else {
        if (e.value.trim() !== '' && !isNaN(Number(e.value))) {
          preparedNew.push({ ...e, finalValue: Number(e.value) });
        }
      }
    }

    // Process existing tracked exercises
    for (const ex of trackedExercises) {
      if (isStrengthExercise(ex.name)) {
        const wStr = exerciseInputs[`${ex.name}_weight`];
        const rStr = exerciseInputs[`${ex.name}_reps`];
        if ((wStr && !rStr) || (!wStr && rStr)) {
          return alert(`Missing data: Please enter both weight and reps for ${ex.label} to calculate your 1-Rep Max.`);
        }
        if (wStr && rStr) {
          const unit = strengthUnits[ex.name] || 'kg';
          let w = Number(wStr);
          w = convertWeightToKg(w, unit);
          const r = Number(rStr);
          if (isNaN(w) || isNaN(r)) continue;
          // Epley Formula
          const oneRepMax = Math.round(w * (1 + r / 30));
          preparedExist.push({ ...ex, finalValue: oneRepMax, unit: 'kg' });
        }
      } else if (isSpeedExercise(ex.name)) {
        const valStr = exerciseInputs[ex.name];
        if (valStr?.trim() !== '') {
          const unit = speedUnits[ex.name] || 'sec';
          const parsedVal = parseSpeedValue(valStr, unit);
          if (!isNaN(parsedVal)) {
            preparedExist.push({ ...ex, finalValue: parsedVal, unit: 'sec' });
          }
        }
      } else {
        const val = exerciseInputs[ex.name];
        if (val?.trim() !== '' && !isNaN(Number(val))) {
          preparedExist.push({ ...ex, finalValue: Number(val) });
        }
      }
    }

    if (!preparedNew.length && !preparedExist.length) return alert('Enter a value first.');

    setSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');

      const [rootSnap, profileSnap] = await Promise.all([
        getDoc(userRootRef),
        getDoc(profileRef)
      ]);

      const rootData = rootSnap.data() || {};
      const profileData = profileSnap.data() || {};
      
      // STREAK LOGIC
      const lastUpdate = rootData.last_exercises_update?.toDate()?.getTime() || 0;
      const diffMs = Date.now() - lastUpdate;
      
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const ONE_WEEK_MS = 7 * ONE_DAY_MS;

      let currentStreak = rootData.exercise_streak || 0;
      let newStreak = currentStreak;
      let streakIncremented = false;
      let streakBonus = 0;

      // 1: Break streak if > 1 week since last exercise entry (resets to 0, then increments to 1)
      if (lastUpdate === 0 || diffMs > ONE_WEEK_MS) {
        newStreak = 1;
        streakIncremented = true;
        streakBonus = newStreak;
      } 
      // 2: Increment streak if within 1 week AND at least 24 hours have passed
      else if (diffMs >= ONE_DAY_MS) {
        newStreak += 1;
        streakIncremented = true;
        streakBonus = newStreak;
      }

      const updateData: any = {};
      const newDefs: any[] = [];

      // Calculate and set the percent changes (viewable in MetricChartRenderer.tsx)
      const processEntryChanges = (name: string, finalValue: number) => {
        const history = profileData[name] || [];
        let last_percent = 0;
        let total_percent = 0;

        if (history.length > 0) {
          const lastVal = history[history.length - 1].value;
          
          last_percent = calculatePercentChange(lastVal, finalValue);
          total_percent = calculatePercentChange(history[0].value, finalValue);

          const isSpeedEx = Object.values(SPEED_KEY_MAP).includes(name);

          if (isSpeedEx) {
            if (last_percent < 0) bonusGems += 1;
          } else {
            if (last_percent > 0) bonusGems += 1;
          }
        }

        updateData[`change_${name}`] = [last_percent, total_percent];
      };

      preparedNew.forEach(e => {
        updateData[e.name] = arrayUnion({ value: e.finalValue, dateTime: nowISO, unit: e.unit });
        newDefs.push({ name: e.label, key: e.name, unit: e.unit, type: e.type, isCustom: e.isCustom });
        processEntryChanges(e.name, e.finalValue);
      });

      preparedExist.forEach(ex => {
        updateData[ex.name] = arrayUnion({ value: ex.finalValue, dateTime: nowISO, unit: ex.unit });
        processEntryChanges(ex.name, ex.finalValue);
      });

      if (newDefs.length > 0) updateData.customWorkoutsDefinitions = arrayUnion(...newDefs);

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });
      
      // Only award base gems, bonus gems, and create the timestamp if the streak criteria was met
      if (streakIncremented) {
        const totalAward = 10 + bonusGems + streakBonus;
        batch.update(userRootRef, { 
          gems: increment(totalAward),
          exercise_streak: newStreak,
          last_exercises_update: serverTimestamp() 
        });
      }
      
      await batch.commit();

      setEntries([]); 
      const updatedInputs = { ...exerciseInputs };
      preparedExist.forEach(ex => {
        if (isStrengthExercise(ex.name)) {
          delete updatedInputs[`${ex.name}_weight`];
          delete updatedInputs[`${ex.name}_reps`];
        } else {
          delete updatedInputs[ex.name];
        }
      });
      setExerciseInputs(updatedInputs);

      const gemMessage = streakIncremented 
      ? `\n\n💎 +${10 + bonusGems + streakBonus} Gems earned!` +
        `\n🔥 Exercise Streak: ${newStreak} (+${streakBonus} bonus gems)` +
        (bonusGems > 0 ? `\n💪 Exercise Improvement (+${bonusGems} bonus gems)` : '')
      : '';

      alert(`Exercises saved successfully!${gemMessage}`);

      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-3xl shadow-xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[95vh]">        
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight uppercase">
            <Dumbbell className="text-indigo-600" size={24} /> LOG EXERCISES
          </h2>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          
          {/* New exercise dropdown (inputs) */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full">
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2 uppercase tracking-tight">
              <PlusCircle size={16}/> TRACK A NEW EXERCISE
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
                    disabled={availableExercises.length === 0}
                    className={`w-full flex items-center justify-between p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-indigo-500 transition-all ${
                      availableExercises.length === 0 ? 'bg-slate-100 cursor-not-allowed opacity-60' : ''
                    }`}
                  >
                    <span className="truncate">
                      {availableExercises.length === 0 
                        ? `All ${selectedCategory.toLowerCase()} tracked` 
                        : (selectedExercise || 'Select Exercise')}
                    </span>
                    <ChevronDown size={18} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Custom dropdown list */}
                  {isDropdownOpen && availableExercises.length > 0 && (
                    <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        {availableExercises.map((ex) => (
                          <button
                            key={ex}
                            className="w-full text-left px-4 py-3 text-sm font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors border-b border-slate-50 last:border-none"
                            onClick={() => {
                              setSelectedExercise(ex);
                              setIsDropdownOpen(false);
                            }}
                          >
                            {ex}
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
                    placeholder={currentCustomCount >= 10 ? "Custom exercise limit (10) reached" : "Exercise Name"} 
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:opacity-75" 
                    value={customName} 
                    onChange={(e) => setCustomName(e.target.value)}
                    disabled={currentCustomCount >= 10}
                  />
                  <input 
                    type="text" 
                    placeholder="Unit" 
                    className="w-32 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-indigo-500 disabled:bg-slate-100 disabled:opacity-75" 
                    value={customUnit} 
                    onChange={(e) => setCustomUnit(e.target.value)}
                    disabled={currentCustomCount >= 10}
                  />
                </>
              )}
              
              <button 
                onClick={handleAddEntry} 
                disabled={
                  (selectedCategory !== 'Custom' && availableExercises.length === 0) ||
                  (selectedCategory === 'Custom' && currentCustomCount >= 10)
                }
                className="px-6 py-3 rounded-xl font-bold text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 transition-colors whitespace-nowrap"
              >
                Add To Grid
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Dumbbell size={16}/> Active Exercise Fields
            </h3>
            
            {(trackedExercises.length === 0 && entries.length === 0) ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-medium">No exercises tracked yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {CATEGORIES.map(category => {
                  const categoryType = category.toLowerCase();
                  
                  const existingInCat = trackedExercises.filter(ex => ex.type === categoryType || (category === 'Custom' && ex.isCustom));
                  const newInCat = entries.filter(e => (e.type === categoryType || (category === 'Custom' && e.isCustom)) && !trackedExercises.some(ex => ex.name === e.name));

                  if (existingInCat.length === 0 && newInCat.length === 0) return null;

                  // Helper to toggle units for every exercise in this category at once
                  const toggleCategoryUnits = () => {
                    if (category === 'Strength') {
                      const currentUnit = strengthUnits[existingInCat[0]?.name || newInCat[0]?.name] || 'kg';
                      const nextUnit = currentUnit === 'kg' ? 'lbs' : 'kg';
                      const updatedUnits = { ...strengthUnits };
                      [...existingInCat, ...newInCat].forEach(ex => { updatedUnits[ex.name] = nextUnit; });
                      setStrengthUnits(updatedUnits);
                    } else if (category === 'Speed') {
                      const currentUnit = speedUnits[existingInCat[0]?.name || newInCat[0]?.name] || 'sec';
                      const nextUnit = currentUnit === 'sec' ? 'mm:ss' : 'sec';
                      const updatedUnits = { ...speedUnits };
                      [...existingInCat, ...newInCat].forEach(ex => { updatedUnits[ex.name] = nextUnit; });
                      setSpeedUnits(updatedUnits);
                    }
                  };

                  // Determine the label for the category-level toggle
                  const getCategoryUnitLabel = () => {
                    if (category === 'Strength') return (strengthUnits[existingInCat[0]?.name || newInCat[0]?.name] || 'kg').toUpperCase();
                    if (category === 'Speed') {
                      const unit = speedUnits[existingInCat[0]?.name || newInCat[0]?.name] || 'sec';
                      return unit === 'mm:ss' ? 'MM:SS' : 'SEC';
                    }
                    return null;
                  };

                  return (
                    <div key={category} className="w-full">
                      {/* Category Header with Integrated Toggle */}
                      <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                          {category}
                        </h4>
                        {(category === 'Strength' || category === 'Speed') && (
                          <button
                            onClick={toggleCategoryUnits}
                            className="flex items-center gap-2 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-colors group"
                            type="button"
                          >
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">Set Unit:</span>
                            <span className="text-[10px] font-black text-indigo-600 group-hover:scale-110 transition-transform">
                              {getCategoryUnitLabel()}
                            </span>
                            <RefreshCw size={10} className="text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* Existing exercises for this category */}
                        {existingInCat.map((ex, idx) => {
                          const isStrength = isStrengthExercise(ex.name);
                          const isSpeed = isSpeedExercise(ex.name);
                          const stUnit = strengthUnits[ex.name] || 'kg';
                          const spUnit = speedUnits[ex.name] || 'sec';

                          return (
                            <PrivacyWrapper 
                              key={`exist-${ex.name}-${idx}`} 
                              fieldKey={ex.name} 
                              isMe={isMe} 
                              hiddenOther={hiddenOther} 
                              toggleVisibilityOther={toggleVisibilityOther} 
                              onDelete={async () => {
                                await handleDeleteField(ex.label, ex.name, 'exercise');
                                try {
                                  const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
                                  await updateDoc(profileRef, { [`change_${ex.name}`]: deleteField() });
                                } catch (err) {
                                  console.error("Failed to delete matching change field", err);
                                }
                              }}
                            >
                              <div className="h-full w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-2 flex flex-col justify-center">
                                <span className="text-xs font-bold text-slate-500 mb-2 truncate block w-full px-1 uppercase tracking-tight">
                                  {ex.label}
                                </span>
                                {isStrength ? (
                                  <div className="flex gap-2 w-full">
                                    <div className="flex-1">
                                      <InputField 
                                        label={`Weight (${stUnit})`} type="number" 
                                        value={exerciseInputs[`${ex.name}_weight`] || ''} 
                                        onChange={(v: string) => !v.includes('-') && setExerciseInputs(p => ({ ...p, [`${ex.name}_weight`]: v }))}
                                        disabled={!isMe} icon={<Dumbbell size={14} className="text-indigo-400"/>} 
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <InputField 
                                        label="Reps" type="number" 
                                        value={exerciseInputs[`${ex.name}_reps`] || ''} 
                                        onChange={(v: string) => !v.includes('-') && setExerciseInputs(p => ({ ...p, [`${ex.name}_reps`]: v }))}
                                        disabled={!isMe} icon={<RefreshCw size={14} className="text-indigo-400"/>} 
                                      />
                                    </div>
                                  </div>
                                ) : isSpeed ? (
                                  <div className="w-full">
                                    <InputField 
                                      label={`Value (${spUnit})`} 
                                      type={spUnit === 'mm:ss' ? 'text' : 'number'}
                                      value={exerciseInputs[ex.name] || ''} 
                                      onChange={(v: string) => {
                                        if (!isMe) return;
                                        if (spUnit === 'mm:ss') {
                                          if (/^[\d:]*$/.test(v)) setExerciseInputs(p => ({ ...p, [ex.name]: v }));
                                        } else {
                                          if (!v.includes('-')) setExerciseInputs(p => ({ ...p, [ex.name]: v }));
                                        }
                                      }}
                                      disabled={!isMe} icon={<Dumbbell size={16} className="text-indigo-400"/>} 
                                    />
                                  </div>
                                ) : (
                                  <InputField 
                                    label={`Value ${ex.unit ? `(${ex.unit})` : ''}`.trim()} 
                                    type="number" 
                                    value={exerciseInputs[ex.name] || ''} 
                                    onChange={(v: string) => !v.includes('-') && setExerciseInputs(p => ({ ...p, [ex.name]: v }))}
                                    disabled={!isMe} icon={<Dumbbell size={16} className="text-indigo-400"/>} 
                                  />
                                )}
                              </div>
                            </PrivacyWrapper>
                          );
                        })}

                        {/* New exercises for this category */}
                        {newInCat.map((entry) => {
                          const isStrength = isStrengthExercise(entry.name);
                          const isSpeed = isSpeedExercise(entry.name);
                          const stUnit = strengthUnits[entry.name] || 'kg';
                          const spUnit = speedUnits[entry.name] || 'sec';

                          return (
                            <PrivacyWrapper 
                              key={`new-${entry.name}`} 
                              fieldKey={entry.name} 
                              isMe={isMe} 
                              hiddenOther={hiddenOther} 
                              toggleVisibilityOther={toggleVisibilityOther} 
                              onDelete={() => setEntries(prev => prev.filter(e => e.name !== entry.name))} 
                            >
                              <div className="h-full w-full bg-indigo-50 rounded-2xl border-2 border-indigo-200 p-2 relative shadow-sm flex flex-col justify-center">
                                <button 
                                  onClick={() => setEntries(prev => prev.filter(e => e.name !== entry.name))} 
                                  className="absolute -top-2 -right-2 text-indigo-400 hover:text-indigo-600 bg-white border border-indigo-100 rounded-full z-20 p-1.5 shadow-sm transition-colors"
                                >
                                  <X size={14} strokeWidth={3}/>
                                </button>
                                <span className="text-xs font-bold text-indigo-500 mb-2 truncate block w-full px-1 uppercase tracking-tight">
                                  {entry.label} (NEW)
                                </span>
                                {isStrength ? (
                                  <div className="flex gap-2 w-full">
                                    <div className="flex-1">
                                      <InputField 
                                        label={`Weight (${stUnit})`} type="number" value={entry.weight || ''} 
                                        onChange={(v: string) => !v.includes('-') && setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, weight: v } : e))} 
                                        icon={<Dumbbell size={14} className="text-indigo-500"/>} 
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <InputField 
                                        label="Reps" type="number" value={entry.reps || ''} 
                                        onChange={(v: string) => !v.includes('-') && setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, reps: v } : e))} 
                                        icon={<RefreshCw size={14} className="text-indigo-500"/>} 
                                      />
                                    </div>
                                  </div>
                                ) : isSpeed ? (
                                  <div className="w-full">
                                    <InputField 
                                      label={`Value (${spUnit})`} 
                                      type={spUnit === 'mm:ss' ? 'text' : 'number'} 
                                      value={entry.value} 
                                      onChange={(v: string) => {
                                        if (spUnit === 'mm:ss') {
                                          if (/^[\d:]*$/.test(v)) setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, value: v } : e));
                                        } else {
                                          if (!v.includes('-')) setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, value: v } : e));
                                        }
                                      }}
                                      icon={<PlusCircle size={16} className="text-indigo-500"/>} 
                                    />
                                  </div>
                                ) : (
                                  <InputField 
                                    label={`Value ${entry.unit ? `(${entry.unit})` : ''}`} 
                                    type="number" value={entry.value} 
                                    onChange={(v: string) => !v.includes('-') && setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, value: v } : e))} 
                                    icon={<PlusCircle size={16} className="text-indigo-500"/>} 
                                  />
                                )}
                              </div>
                            </PrivacyWrapper>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-white">
          <button 
            onClick={handleSaveExercises}
            disabled={saving}
            className={`w-full py-4 rounded-xl font-black text-white shadow-lg flex justify-center items-center gap-2 transition-all text-lg ${
              saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.98]'
            }`}
          >
            {saving ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
            {saving ? 'SAVING DATA...' : 'SAVE EXERCISE LOG'}
          </button>
        </div>
      </div>
    </div>
  );
};