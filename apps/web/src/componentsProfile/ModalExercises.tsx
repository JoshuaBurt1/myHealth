// ModalExercises.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { X, Dumbbell, PlusCircle, RefreshCw, AlertCircle, ChevronDown, Plus, Trash2, CheckCircle } from 'lucide-react';
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

const STRENGTH_VALUES = Object.values(STRENGTH_KEY_MAP);
const isStrengthExercise = (key: string) => STRENGTH_VALUES.includes(key);

const SPEED_VALUES = Object.values(SPEED_KEY_MAP);
const isSpeedExercise = (key: string) => SPEED_VALUES.includes(key);

const calculatePercentChange = (oldValue: number, newValue: number): number => {
  if (oldValue === 0) return newValue > 0 ? 100 : 0;
  return Number((((newValue - oldValue) / oldValue) * 100).toFixed(2));
};

interface SetEntry {
  id: string;
  weight: string;
  reps: string;
  time: string;
}

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
  sets: SetEntry[];
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
  
  // Dynamic sets mapping for existing tracked strength exercises
  const [trackedSets, setTrackedSets] = useState<Record<string, SetEntry[]>>({});

  // Toggle states for units
  const [strengthUnits, setStrengthUnits] = useState<Record<string, 'kg' | 'lbs'>>({});
  const [speedUnits, setSpeedUnits] = useState<Record<string, 'sec' | 'mm:ss'>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize/Reset strength sets on modal open
  useEffect(() => {
    if (isOpen) {
      const initialTrackedSets: Record<string, SetEntry[]> = {};
      trackedExercises.forEach((ex) => {
        if (isStrengthExercise(ex.name) || isSpeedExercise(ex.name)) {
          initialTrackedSets[ex.name] = [{ id: '1', weight: '', reps: '', time: '' }];
        }
      });
      setTrackedSets(initialTrackedSets);
    }
  }, [isOpen, trackedExercises]);

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
        sets: [{ id: '1', weight: '', reps: '', time: '' }],
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
        sets: [{ id: '1', weight: '', reps: '', time: '' }],
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

  // Set management functions
  const addSetToTracked = (exerciseName: string) => {
    setTrackedSets(prev => {
      const current = prev[exerciseName] || [];
      if (current.length >= 10) {
        alert('Maximum of 10 sets allowed per exercise.');
        return prev;
      }
      return {
        ...prev,
        [exerciseName]: [...current, { id: Date.now().toString(), weight: '', reps: '', time: ''}]
      };
    });
  };

  const removeSetFromTracked = (exerciseName: string, setId: string) => {
    setTrackedSets(prev => {
      const current = prev[exerciseName] || [];
      if (current.length <= 1) return prev;
      return {
        ...prev,
        [exerciseName]: current.filter(s => s.id !== setId)
      };
    });
  };

  const updateTrackedSet = (exerciseName: string, setId: string, field: 'weight' | 'reps' | 'time', val: string) => {
    if (val.includes('-')) return;
    setTrackedSets(prev => ({
      ...prev,
      [exerciseName]: (prev[exerciseName] || []).map(s => s.id === setId ? { ...s, [field]: val } : s)
    }));
  };

  const addSetToEntry = (entryName: string) => {
    setEntries(prev => prev.map(e => {
      if (e.name === entryName) {
        if (e.sets.length >= 10) {
          alert('Maximum of 10 sets allowed per exercise.');
          return e;
        }
        return {
          ...e,
          sets: [...e.sets, { id: Date.now().toString(), weight: '', reps: '', time: '' }]
        };
      }
      return e;
    }));
  };

  const removeSetFromEntry = (entryName: string, setId: string) => {
    setEntries(prev => prev.map(e => {
      if (e.name === entryName && e.sets.length > 1) {
        return {
          ...e,
          sets: e.sets.filter(s => s.id !== setId)
        };
      }
      return e;
    }));
  };

  const updateEntrySet = (entryName: string, setId: string, field: 'weight' | 'reps' | 'time', val: string) => {
    if (val.includes('-')) return;
    setEntries(prev => prev.map(e => {
      if (e.name === entryName) {
        return {
          ...e,
          sets: e.sets.map(s => s.id === setId ? { ...s, [field]: val } : s)
        };
      }
      return e;
    }));
  };

  // Helper to compute strength set analytics according to rules
  const evaluateStrengthSets = (setsList: SetEntry[], unit: 'kg' | 'lbs', label: string) => {
    const validSets: { weightKg: number; reps: number }[] = [];

    for (const s of setsList) {
      if ((s.weight && !s.reps) || (!s.weight && s.reps)) {
        throw new Error(`Missing data: Please complete weight and reps for all filled sets in ${label}.`);
      }
      if (s.weight && s.reps) {
        const w = Number(s.weight);
        const r = Number(s.reps);
        if (!isNaN(w) && !isNaN(r) && w > 0 && r > 0) {
          validSets.push({
            weightKg: convertWeightToKg(w, unit),
            reps: r
          });
        }
      }
    }

    if (validSets.length === 0) return null;

    // Order sets primarily by highest weight (kg), secondarily by reps
    const sortedSets = [...validSets].sort((a, b) => {
      if (b.weightKg !== a.weightKg) {
        return b.weightKg - a.weightKg;
      }
      return b.reps - a.reps;
    });

    const bestSet = sortedSets[0];
    const oneRepMax = Math.round(bestSet.weightKg * (1 + bestSet.reps / 30));
    const totalLoad = Math.round(validSets.reduce((sum, s) => sum + (s.weightKg * s.reps), 0));

    const detailedSets = validSets.map(s => ({
      weightKg: Math.round(s.weightKg * 100) / 100,
      reps: s.reps,
      unit: unit
    }));

    return {
      oneRepMax,
      totalLoad,
      totalSets: validSets.length,
      sets: detailedSets
    };
  };

  const evaluateSpeedSets = (setsList: SetEntry[], unit: 'sec' | 'mm:ss', label: string) => {
    const validSets: { timeSec: number; reps: number }[] = [];

    for (const s of setsList) {
      if ((s.time && !s.reps) || (!s.time && s.reps)) {
        throw new Error(`Missing data: Please complete time and reps for all filled sets in ${label}.`);
      }
      if (s.time && s.reps) {
        const t = parseSpeedValue(s.time, unit);
        const r = Number(s.reps);
        if (!isNaN(t) && !isNaN(r) && t > 0 && r > 0) {
          validSets.push({
            timeSec: t,
            reps: r
          });
        }
      }
    }

    if (validSets.length === 0) return null;

    // Order sets primarily by fastest time (lowest seconds)
    const sortedSets = [...validSets].sort((a, b) => a.timeSec - b.timeSec);

    const bestSet = sortedSets[0];
    const fastestTime = bestSet.timeSec;
    const totalLoad = Math.round(validSets.reduce((sum, s) => sum + (s.timeSec * s.reps), 0));

    const detailedSets = validSets.map(s => ({
      timeSec: s.timeSec,
      reps: s.reps,
      unit: 'sec' // Standardized to DB
    }));

    return {
      value: fastestTime,
      totalLoad,
      totalSets: validSets.length,
      sets: detailedSets
    };
  };

  const handleSaveExercises = async () => {
    const preparedNew: (ExerciseEntry & { finalData: any })[] = [];
    const preparedExist: (typeof trackedExercises[0] & { finalData: any })[] = [];
    let bonusGems = 0;

    try {
      // Process new dynamic entries
      for (const e of entries) {
        if (isStrengthExercise(e.name)) {
          const unit = strengthUnits[e.name] || 'kg';
          const evalResult = evaluateStrengthSets(e.sets, unit, e.label);
          if (evalResult) {
            preparedNew.push({
              ...e,
              finalData: {
                value: evalResult.oneRepMax,
                totalLoad: evalResult.totalLoad,
                totalSets: evalResult.totalSets,
                sets: evalResult.sets,
                unit: 'kg'
              }
            });
          }
        } else if (isSpeedExercise(e.name)) {
          const unit = speedUnits[e.name] || 'sec';
          const evalResult = evaluateSpeedSets(e.sets, unit, e.label);
          if (evalResult) {
            preparedNew.push({
              ...e,
              finalData: {
                value: evalResult.value,
                totalLoad: evalResult.totalLoad,
                totalSets: evalResult.totalSets,
                sets: evalResult.sets,
                unit: 'sec'
              }
            });
          }
        } else {
          if (e.value.trim() !== '' && !isNaN(Number(e.value))) {
            preparedNew.push({
              ...e,
              finalData: { value: Number(e.value), unit: e.unit }
            });
          }
        }
      }

      // Process existing active exercises
      for (const ex of trackedExercises) {
        if (isStrengthExercise(ex.name)) {
          const unit = strengthUnits[ex.name] || 'kg';
          const setsList = trackedSets[ex.name] || [];
          const evalResult = evaluateStrengthSets(setsList, unit, ex.label);
          if (evalResult) {
            preparedExist.push({
              ...ex,
              finalData: {
                value: evalResult.oneRepMax,
                totalLoad: evalResult.totalLoad,
                totalSets: evalResult.totalSets,
                sets: evalResult.sets,
                unit: 'kg'
              }
            });
          }
        } else if (isSpeedExercise(ex.name)) {
          const unit = speedUnits[ex.name] || 'sec';
          const setsList = trackedSets[ex.name] || [];
          const evalResult = evaluateSpeedSets(setsList, unit, ex.label);
          if (evalResult) {
            preparedExist.push({
              ...ex,
              finalData: {
                value: evalResult.value,
                totalLoad: evalResult.totalLoad,
                totalSets: evalResult.totalSets,
                sets: evalResult.sets,
                unit: 'sec'
              }
            });
          }
        } else {
          const val = exerciseInputs[ex.name];
          if (val?.trim() !== '' && !isNaN(Number(val))) {
            preparedExist.push({
              ...ex,
              finalData: { value: Number(val), unit: ex.unit || '' }
            });
          }
        }
      }
    } catch (err: any) {
      return alert(err.message || 'Error processing exercise entries.');
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
      
      const lastUpdate = rootData.last_exercises_update?.toDate()?.getTime() || 0;
      const diffMs = Date.now() - lastUpdate;
      
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const ONE_WEEK_MS = 7 * ONE_DAY_MS;

      let currentStreak = rootData.exercise_streak || 0;
      let newStreak = currentStreak;
      let streakIncremented = false;
      let streakBonus = 0;

      if (lastUpdate === 0 || diffMs > ONE_WEEK_MS) {
        newStreak = 1;
        streakIncremented = true;
        streakBonus = newStreak;
      } 
      else if (diffMs >= ONE_DAY_MS) {
        newStreak += 1;
        streakIncremented = true;
        streakBonus = newStreak;
      }

      const updateData: any = {};
      const newDefs: any[] = [];

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
        const record = { ...e.finalData, dateTime: nowISO };
        updateData[e.name] = arrayUnion(record);
        newDefs.push({ name: e.label, key: e.name, unit: e.unit, type: e.type, isCustom: e.isCustom });
        processEntryChanges(e.name, e.finalData.value);
      });

      preparedExist.forEach(ex => {
        const record = { ...ex.finalData, dateTime: nowISO };
        updateData[ex.name] = arrayUnion(record);
        processEntryChanges(ex.name, ex.finalData.value);
      });

      if (newDefs.length > 0) updateData.customWorkoutsDefinitions = arrayUnion(...newDefs);

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });
      
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
        delete updatedInputs[ex.name];
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

            {(() => {
              const category = selectedCategory;
              const categoryType = category.toLowerCase();
              const currentMap = CATEGORY_MAPS[category];

              const keyOrderLookup = new Map<string, number>();
              if (currentMap) {
                Object.values(currentMap).forEach((key, idx) => keyOrderLookup.set(key, idx));
              }
              const getPos = (key: string) => keyOrderLookup.get(key) ?? Infinity;

              const existingInCat = trackedExercises
                .filter(ex => ex.type === categoryType || (category === 'Custom' && ex.isCustom))
                .sort((a, b) => getPos(a.name) - getPos(b.name));

              const newInCat = entries
                .filter(e => 
                  (e.type === categoryType || (category === 'Custom' && e.isCustom)) && 
                  !trackedExercises.some(ex => ex.name === e.name)
                )
                .sort((a, b) => getPos(a.name) - getPos(b.name));

              if (existingInCat.length === 0 && newInCat.length === 0) {
                return (
                  <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                    <AlertCircle size={32} className="mx-auto mb-2 opacity-50"/>
                    <p className="font-medium">No {category} exercises tracked yet. Add one above to get started.</p>
                  </div>
                );
              }

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
                    {/* EXISTING TRACKED EXERCISES */}
                    {existingInCat.map((ex, idx) => {
                      const isStrength = isStrengthExercise(ex.name);
                      const isSpeed = isSpeedExercise(ex.name);
                      const stUnit = strengthUnits[ex.name] || 'kg';
                      const spUnit = speedUnits[ex.name] || 'sec';
                      const setsList = trackedSets[ex.name] || [{ id: '1', weight: '', reps: '' }];

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
                          <div className="h-full w-full bg-slate-50/50 rounded-2xl border border-slate-100 p-3 flex flex-col justify-between">
                            <span className="text-xs font-bold text-slate-500 mb-2 truncate block w-full px-1 uppercase tracking-tight">
                              {ex.label}
                            </span>
                            
                            {isStrength || isSpeed ? (
                              <div className="space-y-2">
                                {setsList.map((set, setIdx) => (
                                  <div key={set.id} className="flex gap-2 items-center w-full">
                                    <span className="text-[10px] font-bold text-slate-400 w-4">{setIdx + 1}.</span>
                                    
                                    {isStrength ? (
                                      <div className="flex-1">
                                        <InputField 
                                          label={`Weight (${stUnit})`} 
                                          type="number" 
                                          value={set.weight} 
                                          onChange={(v: string) => updateTrackedSet(ex.name, set.id, 'weight', v)}
                                          disabled={!isMe} 
                                          icon={<Dumbbell size={14} className="text-indigo-400"/>} 
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex-1">
                                        <InputField 
                                          label={`Time (${spUnit})`} 
                                          type="text" 
                                          value={set.time || ''} 
                                          onChange={(v: string) => updateTrackedSet(ex.name, set.id, 'time', v)}
                                          disabled={!isMe} 
                                          icon={<RefreshCw size={14} className="text-indigo-400"/>} 
                                        />
                                      </div>
                                    )}

                                    <div className="flex-1">
                                      <InputField 
                                        label="Reps" 
                                        type="number" 
                                        value={set.reps} 
                                        onChange={(v: string) => updateTrackedSet(ex.name, set.id, 'reps', v)}
                                        disabled={!isMe} 
                                        icon={<RefreshCw size={14} className="text-indigo-400"/>} 
                                      />
                                    </div>
                                    
                                    {setsList.length > 1 && isMe && (
                                      <button 
                                        type="button"
                                        onClick={() => removeSetFromTracked(ex.name, set.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Remove set"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                
                                {setsList.length < 10 && isMe && (
                                  <button
                                    type="button"
                                    onClick={() => addSetToTracked(ex.name)}
                                    className="w-full py-2 mt-2 flex items-center justify-center gap-1 text-xs font-bold text-indigo-500 hover:bg-indigo-50 rounded-xl transition-colors border border-dashed border-indigo-200"
                                  >
                                    <Plus size={14} /> ADD SET
                                  </button>
                                )}
                              </div>
                            ) : (
                              <InputField 
                                label={`Value ${ex.unit ? `(${ex.unit})` : ''}`.trim()} 
                                type="number" 
                                value={exerciseInputs[ex.name] || ''} 
                                onChange={(v: string) => !v.includes('-') && setExerciseInputs(p => ({ ...p, [ex.name]: v }))}
                                disabled={!isMe} 
                                icon={<Dumbbell size={16} className="text-indigo-400"/>} 
                              />
                            )}
                          </div>
                        </PrivacyWrapper>
                      );
                    })}

                    {/* NEW UNCOMMITTED EXERCISES */}
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
                          <div className="h-full w-full bg-indigo-50 rounded-2xl border-2 border-indigo-200 p-3 relative shadow-sm flex flex-col justify-between">
                            <button 
                              onClick={() => setEntries(prev => prev.filter(e => e.name !== entry.name))} 
                              className="absolute -top-2 -right-2 text-indigo-400 hover:text-indigo-600 bg-white border border-indigo-100 rounded-full z-20 p-1.5 shadow-sm transition-colors"
                            >
                              <X size={14} strokeWidth={3}/>
                            </button>
                            <span className="text-xs font-bold text-indigo-500 mb-2 truncate block w-full px-1 uppercase tracking-tight">
                              {entry.label} (NEW)
                            </span>

                              {isStrength || isSpeed ? (
                              <div className="space-y-2">
                                {entry.sets.map((set, setIdx) => (
                                  <div key={set.id} className="flex gap-2 items-center w-full">
                                    <span className="text-[10px] font-bold text-indigo-400 w-4">{setIdx + 1}.</span>
                                    
                                    {isStrength ? (
                                      <div className="flex-1">
                                        <InputField 
                                          label={`Weight (${stUnit})`} 
                                          type="number" 
                                          value={set.weight} 
                                          onChange={(v: string) => updateEntrySet(entry.name, set.id, 'weight', v)}
                                          disabled={!isMe} 
                                          icon={<Dumbbell size={14} className="text-indigo-500"/>} 
                                        />
                                      </div>
                                    ) : (
                                      <div className="flex-1">
                                        <InputField 
                                          label={`Time (${spUnit})`} 
                                          type="text" 
                                          value={set.time || ''} 
                                          onChange={(v: string) => updateEntrySet(entry.name, set.id, 'time', v)}
                                          disabled={!isMe} 
                                          icon={<RefreshCw size={14} className="text-indigo-500"/>} 
                                        />
                                      </div>
                                    )}

                                    <div className="flex-1">
                                      <InputField 
                                        label="Reps" 
                                        type="number" 
                                        value={set.reps} 
                                        onChange={(v: string) => updateEntrySet(entry.name, set.id, 'reps', v)}
                                        disabled={!isMe} 
                                        icon={<RefreshCw size={14} className="text-indigo-500"/>} 
                                      />
                                    </div>
                                    
                                    {entry.sets.length > 1 && isMe && (
                                      <button 
                                        type="button"
                                        onClick={() => removeSetFromEntry(entry.name, set.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                        title="Remove set"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    )}
                                  </div>
                                ))}
                                
                                {entry.sets.length < 10 && isMe && (
                                  <button
                                    type="button"
                                    onClick={() => addSetToEntry(entry.name)}
                                    className="w-full py-2 mt-2 flex items-center justify-center gap-1 text-xs font-bold text-indigo-600 bg-white hover:bg-indigo-100/50 rounded-xl transition-colors border border-dashed border-indigo-200"
                                  >
                                    <Plus size={14} /> ADD SET
                                  </button>
                                )}
                              </div>
                            ) : (
                              <InputField 
                                label={`Value ${entry.unit ? `(${entry.unit})` : ''}`.trim()} 
                                type="number" 
                                value={entry.value} 
                                onChange={(v: string) => !v.includes('-') && setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, value: v } : e))} 
                                icon={<Dumbbell size={16} className="text-indigo-500"/>} 
                              />
                            )}
                          </div>
                        </PrivacyWrapper>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button 
            onClick={onClose} 
            className="px-6 py-3 rounded-2xl font-bold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSaveExercises} 
            disabled={saving}
            className="px-8 py-3 rounded-2xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
          >
            {saving ? <RefreshCw className="animate-spin" size={18}/> : <CheckCircle size={18}/>}
            SAVE EXERCISE LOG
          </button>
        </div>
      </div>
    </div>
  );
};