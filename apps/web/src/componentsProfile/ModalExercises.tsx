// ModalExercises.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { SPEED_KEY_MAP, getStandardUnit } from './profileConstants';
import { ModalExercisesView, ExerciseCategory, CATEGORY_MAPS, isStrengthExercise, isSpeedExercise } from './ModalExercisesView';

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
  const [trackedSets, setTrackedSets] = useState<Record<string, SetEntry[]>>({});
  const [strengthUnits, setStrengthUnits] = useState<Record<string, 'kg' | 'lbs'>>({});
  const [speedUnits, setSpeedUnits] = useState<Record<string, 'sec' | 'mm:ss'>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Initialize/Reset sets on modal open
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
          // Standardize set weight rounding immediately
          const normalizedKg = Number(convertWeightToKg(w, unit).toFixed(1));
          validSets.push({
            weightKg: normalizedKg,
            reps: r
          });
        }
      }
    }

    if (validSets.length === 0) return null;

    // Calculate 1RM using standardized set weights
    const max1RM = Math.max(
      ...validSets.map(s => (s.reps === 1 ? s.weightKg : s.weightKg * (1 + s.reps / 30)))
    );
    const oneRepMax = Number(max1RM.toFixed(1));

    // Compute total load using exact set weights
    const totalLoad = Number(
      validSets.reduce((sum, s) => sum + (s.weightKg * s.reps), 0).toFixed(1)
    );

    // Calculate average weight per rep
    const totalReps = validSets.reduce((sum, s) => sum + s.reps, 0);
    const average = totalReps > 0 ? Number((totalLoad / totalReps).toFixed(1)) : 0;

    const detailedSets = validSets.map(s => ({
      weightKg: s.weightKg,
      reps: s.reps,
      unit: unit
    }));

    return {
      oneRepMax,
      totalLoad,
      average,
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

    // Calculate average speed/time per rep
    const totalReps = validSets.reduce((sum, s) => sum + s.reps, 0);
    const average = totalReps > 0 ? Number((totalLoad / totalReps).toFixed(1)) : 0;

    const detailedSets = validSets.map(s => ({
      timeSec: s.timeSec,
      reps: s.reps,
      unit: 'sec'
    }));

    return {
      value: fastestTime,
      totalLoad,
      average,
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
                average: evalResult.average, // <--- ADDED
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
                average: evalResult.average, // <--- ADDED
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
                average: evalResult.average,
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
                average: evalResult.average,
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
    <ModalExercisesView
      onClose={onClose}
      selectedCategory={selectedCategory}
      setSelectedCategory={setSelectedCategory}
      dropdownRef={dropdownRef}
      isDropdownOpen={isDropdownOpen}
      setIsDropdownOpen={setIsDropdownOpen}
      availableExercises={availableExercises}
      selectedExercise={selectedExercise}
      setSelectedExercise={setSelectedExercise}
      currentCustomCount={currentCustomCount}
      customName={customName}
      setCustomName={setCustomName}
      customUnit={customUnit}
      setCustomUnit={setCustomUnit}
      handleAddEntry={handleAddEntry}
      trackedExercises={trackedExercises}
      entries={entries}
      strengthUnits={strengthUnits}
      setStrengthUnits={setStrengthUnits}
      speedUnits={speedUnits}
      setSpeedUnits={setSpeedUnits}
      trackedSets={trackedSets}
      isMe={isMe}
      hiddenOther={hiddenOther}
      toggleVisibilityOther={toggleVisibilityOther}
      handleDeleteField={handleDeleteField}
      userId={userId}
      updateTrackedSet={updateTrackedSet}
      removeSetFromTracked={removeSetFromTracked}
      addSetToTracked={addSetToTracked}
      exerciseInputs={exerciseInputs}
      setExerciseInputs={setExerciseInputs}
      setEntries={setEntries}
      updateEntrySet={updateEntrySet}
      removeSetFromEntry={removeSetFromEntry}
      addSetToEntry={addSetToEntry}
      handleSaveExercises={handleSaveExercises}
      saving={saving}
    />
  );
};