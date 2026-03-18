//ModalExercises.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Dumbbell, PlusCircle, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { doc, getDoc, writeBatch, serverTimestamp, increment, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  STRENGTH_KEY_MAP, 
  SPEED_KEY_MAP, 
  PHYSIO_KEY_MAP, 
  YOGA_KEY_MAP, 
  MOBILITY_KEY_MAP, 
  getStandardUnit 
} from './profileConstants';
import { InputField } from './ProfileUI';
import PrivacyWrapper from './PrivacyWrapper';

const CATEGORY_MAPS: Record<string, Record<string, string>> = {
  Strength: STRENGTH_KEY_MAP,
  Speed: SPEED_KEY_MAP,
  Physio: PHYSIO_KEY_MAP,
  Yoga: YOGA_KEY_MAP,
  Mobility: MOBILITY_KEY_MAP,
};

type ExerciseCategory = 'Strength' | 'Speed' | 'Physio' | 'Yoga' | 'Mobility' | 'Custom';
const CATEGORIES: ExerciseCategory[] = ['Strength', 'Speed', 'Physio', 'Yoga', 'Mobility', 'Custom'];

interface ModalExercisesProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onSuccess: () => void;
  trackedExercises: { name: string; label: string; type: string; unit?: string }[];
  exerciseInputs: Record<string, string>;
  setExerciseInputs: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  hiddenOther: string[];
  toggleVisibilityOther: (field: string) => void;
  handleDeleteField: (fieldLabel: string, fieldKey: string, category: 'vital' | 'workout') => Promise<void>;
  isMe: boolean;
}

interface ExerciseEntry {
  name: string;
  label: string;
  unit: string;
  type: string;
  value: string;
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

  // Use a Set for faster lookup and cleaner code
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

  if (!isOpen) return null;

  const handleAddEntry = () => {
    if (selectedCategory !== 'Custom') {
      if (availableExercises.length === 0) return;
      const map = CATEGORY_MAPS[selectedCategory];
      const key = map[selectedExercise];
      
      setEntries(prev => [...prev, {
        name: key,
        label: selectedExercise,
        unit: getStandardUnit(key) || (selectedCategory === 'Strength' ? 'kg' : 'min'),
        type: selectedCategory.toLowerCase(),
        value: '',
        isCustom: false
      }]);
    } else {
      if (!customName.trim()) return alert('Please enter a name.');
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

  const handleSaveExercises = async () => {
    const validNew = entries.filter(e => e.value.trim() !== '' && !isNaN(Number(e.value)));
    const validExist = trackedExercises.filter(ex => 
      exerciseInputs[ex.name]?.trim() !== '' && !isNaN(Number(exerciseInputs[ex.name]))
    );

    if (!validNew.length && !validExist.length) return alert('Enter a value first.');

    setSaving(true);
    try {
      const nowISO = new Date().toISOString();
      const userRootRef = doc(db, 'users', userId);
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');

      const rootSnap = await getDoc(userRootRef);
      const rootData = rootSnap.data() || {};
      const lastUpdate = rootData.last_exercises_update?.toDate()?.getTime() || 0;
      const isEligibleForGems = (Date.now() - lastUpdate) > 6 * 60 * 60 * 1000;

      const updateData: any = {};
      const newDefs: any[] = [];

      validNew.forEach(e => {
        updateData[e.name] = arrayUnion({ value: Number(e.value), dateTime: nowISO, unit: e.unit });
        newDefs.push({ name: e.label, key: e.name, unit: e.unit, type: e.type });
      });

      validExist.forEach(ex => {
        updateData[ex.name] = arrayUnion({ value: Number(exerciseInputs[ex.name]), dateTime: nowISO, unit: ex.unit });
      });

      if (newDefs.length > 0) updateData.customWorkoutsDefinitions = arrayUnion(...newDefs);

      const batch = writeBatch(db);
      batch.set(profileRef, updateData, { merge: true });
        if (isEligibleForGems) {
            batch.update(userRootRef, { 
            gems: increment(10),
            last_exercises_update: serverTimestamp()
            });
        }
      await batch.commit();

      // --- STATE CLEANUP TO PREVENT DUPLICATES ---
      setEntries([]); 
      const updatedInputs = { ...exerciseInputs };
      validExist.forEach(ex => delete updatedInputs[ex.name]);
      setExerciseInputs(updatedInputs);

      alert(`Exercises saved successfully!${isEligibleForGems ? ' +10 gems earned!' : ''}`);

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
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-3 tracking-tight uppercase">
            <Dumbbell className="text-indigo-600" size={24} /> LOG EXERCISES
          </h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Top Section: Add New Vital Dropdown / Inputs */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 w-full">
            <h3 className="text-sm font-bold text-slate-500 mb-3 flex items-center gap-2">
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
                <select 
                  className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:border-indigo-500"
                  value={selectedExercise}
                  onChange={(e) => setSelectedExercise(e.target.value)}
                >
                  {availableExercises.map(ex => <option key={ex} value={ex}>{ex}</option>)}
                  {availableExercises.length === 0 && <option>All {selectedCategory} tracked</option>}
                </select>
              ) : (
                <>
                  <input 
                    type="text" 
                    placeholder="Exercise Name" 
                    className="flex-1 p-3 bg-white border border-slate-200 rounded-xl" 
                    value={customName} 
                    onChange={(e) => setCustomName(e.target.value)}
                  />
                  <input 
                    type="text" 
                    placeholder="Unit" 
                    className="w-32 p-3 bg-white border border-slate-200 rounded-xl" 
                    value={customUnit} 
                    onChange={(e) => setCustomUnit(e.target.value)}
                  />
                </>
              )}
              <button 
                onClick={handleAddEntry} 
                className="px-6 py-3 rounded-xl font-black text-xs text-white bg-slate-800 hover:bg-slate-900 transition-colors"
              >
                ADD TO GRID
              </button>
            </div>
          </div>

          {/* Grid Area */}
          <div>
            <h3 className="text-sm font-bold text-slate-500 mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Dumbbell size={16}/> Active Tracking Fields
            </h3>
            
            {(trackedExercises.length === 0 && entries.length === 0) ? (
              <div className="text-center p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-slate-400">
                <AlertCircle size={32} className="mx-auto mb-2 opacity-50"/>
                <p className="font-medium">No exercises tracked yet. Add one above to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 sm:gap-4 gap-2">
                
                {/* 1. Existing Exercises */}
                {trackedExercises.map((ex, idx) => (
                  <PrivacyWrapper 
                    key={`exist-${ex.name}-${idx}`} 
                    fieldKey={ex.name} 
                    isMe={isMe} 
                    hiddenOther={hiddenOther} 
                    toggleVisibilityOther={toggleVisibilityOther} 
                    onDelete={() => handleDeleteField(ex.label, ex.name, 'workout')}
                  >
                    <div className="h-full bg-slate-50/50 rounded-2xl border border-slate-100 p-1">
                      <InputField 
                        label={`${ex.label} ${ex.unit ? `(${ex.unit})` : ''}`.trim()} 
                        type="number" 
                        value={exerciseInputs[ex.name] || ''} 
                        onChange={(v: string) => {
                          if (v.includes('-')) return;
                          setExerciseInputs(prev => ({ ...prev, [ex.name]: v }));
                        }}
                        disabled={!isMe} 
                        icon={<Dumbbell size={16} className="text-indigo-400"/>} 
                      />
                    </div>
                  </PrivacyWrapper>
                ))}

                {/* 2. Brand New Exercises */}
                {entries
                  .filter(entry => !trackedExercises.some(ex => ex.name === entry.name))
                  .map((entry) => (
                    <PrivacyWrapper 
                      key={`new-${entry.name}`} 
                      fieldKey={entry.name} 
                      isMe={isMe} 
                      hiddenOther={hiddenOther} 
                      toggleVisibilityOther={toggleVisibilityOther} 
                      onDelete={() => setEntries(prev => prev.filter(e => e.name !== entry.name))} 
                    >
                      <div className="h-full bg-indigo-50 rounded-2xl border-2 border-indigo-200 p-1 relative shadow-sm transition-all">
                        <button 
                          onClick={() => setEntries(prev => prev.filter(e => e.name !== entry.name))} 
                          className="absolute -top-1 -right-1 text-indigo-400 hover:text-indigo-600 bg-white border border-indigo-100 rounded-full z-20 p-1 shadow-sm transition-colors"
                          title="Remove from session"
                        >
                          <X size={12} strokeWidth={3}/>
                        </button>

                        <div className="opacity-100">
                          <InputField 
                            label={`${entry.label} ${entry.unit ? `(${entry.unit})` : ''} (NEW)`} 
                            type="number" 
                            value={entry.value} 
                            onChange={(v: string) => {
                              if (v.includes('-')) return;
                              setEntries(prev => prev.map(e => e.name === entry.name ? { ...e, value: v } : e));
                            }} 
                            icon={<PlusCircle size={16} className="text-indigo-500"/>} 
                          />
                        </div>
                      </div>
                    </PrivacyWrapper>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-100 bg-white">
          <button 
            onClick={handleSaveExercises}
            disabled={saving}
            className={`w-full py-4 rounded-xl font-black text-white shadow-lg flex justify-center items-center gap-2 transition-all text-lg ${
              saving ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:scale-[1.01] active:scale-[0.98]'
            }`}
          >
            {saving ? <RefreshCw className="animate-spin" size={20}/> : <CheckCircle size={20}/>}
            {saving ? 'SAVING...' : 'SAVE EXERCISE LOGS'}
          </button>
        </div>
      </div>
    </div>
  );
};