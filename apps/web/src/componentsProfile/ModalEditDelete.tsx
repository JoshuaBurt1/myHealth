import React, { useState, useEffect, useMemo } from 'react';
import { 
  isStrengthExercise, 
  isSpeedExercise, 
  isCmPlyometricsExercise, 
  isPlyometricExercise,
  isYogaExercise, 
  isEnduranceExercise,
  isSecEnduranceExercise, 
  isKgSecEnduranceExercise,
  isDiet,
  isMicronutrient
} from './profileConstants';
import { Trash2, RefreshCw } from 'lucide-react';

interface ModalEditDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (updatedFields: any) => void;
  initialValue: any;
  initialItem: any;
  title: string;
  recordedDate: number;
  metricKey: string;
}

export const ModalEditDelete: React.FC<ModalEditDeleteProps> = ({
  isOpen, onClose, onDelete, onUpdate, initialValue, initialItem, title, recordedDate, metricKey
}) => {
  // Check metric types
  const isStrength = isStrengthExercise(metricKey);
  const isSpeed = isSpeedExercise(metricKey);
  const isYoga = isYogaExercise(metricKey);
  const isEndurance = isEnduranceExercise(metricKey);
  const isSecEndurance = isSecEnduranceExercise(metricKey);
  const isKgSecEndurance = isKgSecEnduranceExercise(metricKey);
  const isCmPlyo = isCmPlyometricsExercise(metricKey);
  const isPlyo = isPlyometricExercise(metricKey);
  const isDietMetric = isDiet(metricKey) || isMicronutrient(metricKey);

  // Group all duration/time-based exercises together (isEndurance is reps-only, excluding it here)
  const isTimeBased = isSpeed || isYoga || isSecEndurance || isKgSecEndurance;

  // Check if item or current context uses 'reps'
  const targetItem = initialItem?.rawObject || initialItem;
  const targetUnit = String(targetItem?.unit || '').toLowerCase();
  const isReps = isPlyo || isEndurance || targetUnit === 'reps';

  const [inputValue, setInputValue] = useState('');
  const [unit, setUnit] = useState('');
  
  // State for exercise sets
  const [sets, setSets] = useState<any[]>([]);
  const [hasSets, setHasSets] = useState(false);

  // State for grouped diet entries with preserved DB key
  const [dietGroups, setDietGroups] = useState<{ key?: string; dateTime: string; entries: { context: string; value: any }[] }[]>([]);

  useEffect(() => {
    const item = initialItem?.rawObject || initialItem;

    if (isDietMetric) {
      const parsedGroups: { key?: string; dateTime: string; entries: { context: string; value: any }[] }[] = [];
      const itemData = initialItem?.rawObject || initialItem;

      if (itemData && typeof itemData === 'object' && !Array.isArray(itemData)) {
        // Filter out root metadata keys like value, unit, rawObject
        const dateTimeKeys = Object.keys(itemData).filter(
          (key) =>
            key !== 'value' &&
            key !== 'unit' &&
            key !== 'rawObject' &&
            typeof itemData[key] === 'object' &&
            itemData[key] !== null
        );

        dateTimeKeys.forEach((dtKey) => {
          const groupData = itemData[dtKey];
          const dateTime = groupData?.dateTime || dtKey;
          const rawContext = groupData?.context;
          const rawValue = groupData?.value ?? initialValue;

          const contexts = Array.isArray(rawContext)
            ? rawContext
            : (rawContext !== undefined && rawContext !== null ? [rawContext] : []);

          const values = Array.isArray(rawValue)
            ? rawValue
            : (Array.isArray(initialValue)
                ? initialValue
                : (rawValue !== undefined && rawValue !== null ? [rawValue] : []));

          const maxLen = Math.max(contexts.length, values.length);
          const entries = [];

          for (let i = 0; i < maxLen; i++) {
            entries.push({
              context: contexts[i] !== undefined ? String(contexts[i]) : '',
              value: values[i] !== undefined ? values[i] : ''
            });
          }

          if (entries.length === 0) {
            entries.push({
              context: typeof rawContext === 'string' ? rawContext : '',
              value: initialValue ?? ''
            });
          }

          parsedGroups.push({ key: dtKey, dateTime, entries });
        });
      }

      if (parsedGroups.length === 0) {
        const defaultIso = new Date(recordedDate).toISOString();
        parsedGroups.push({
          key: defaultIso,
          dateTime: defaultIso,
          entries: [{ context: '', value: initialValue ?? '' }]
        });
      }

      // Order diet entries by time: earliest on top to latest
      parsedGroups.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      setDietGroups(parsedGroups);
      setHasSets(false);
      setSets([]);
    } else if (item && Array.isArray(item.sets) && item.sets.length > 0) {
      setSets(item.sets);
      setHasSets(true);
    } else if (isStrength || isTimeBased || isCmPlyo || isReps) {
      const legacySet: any = {
        reps: 1,
        unit: isKgSecEndurance ? 'kg*sec' : isStrength ? 'KG' : isTimeBased ? 'SEC' : isCmPlyo ? 'CM' : 'REPS',
      };
      
      if (isStrength) {
        legacySet.weightKg = Number(initialValue) || 0;
      } else if (isTimeBased) {
        legacySet.timeSec = Number(initialValue) || 0;
        if (isKgSecEndurance) {
          legacySet.weightKg = Number(targetItem?.weightKg) || 0;
        }
      } else if (isCmPlyo) {
        legacySet.weightCm = Number(initialValue) || 0;
      } else {
        legacySet.reps = Number(initialValue) || 1;
      }

      setSets([legacySet]);
      setHasSets(true);
    } else {
      setHasSets(false);
      setSets([]);
    }

    if (isTimeBased) {
      setUnit('SEC');
      setInputValue(String(initialValue));
    } else if (isStrength) {
      setUnit('KG');
      setInputValue(String(initialValue));
    } else if (isCmPlyo) {
      setUnit('CM');
      setInputValue(String(initialValue));
    } else if (isReps) {
      setUnit('REPS');
      setInputValue(String(initialValue));
    } else {
      setInputValue(String(initialValue));
    }
  }, [initialValue, initialItem, isTimeBased, isStrength, isCmPlyo, isReps, isDietMetric, recordedDate]);

  const handleToggleUnit = () => {
    if (isStrength) {
      const nextUnit = unit === 'KG' ? 'LBS' : 'KG';
      const updatedSets = sets.map((s) => {
        if (s.weightKg === '' || s.weightKg === undefined || s.weightKg === null) return s;
        const currentW = parseFloat(s.weightKg);
        if (isNaN(currentW)) return s;
        
        const converted = nextUnit === 'LBS' ? currentW / 0.45359237 : currentW * 0.45359237;
        return { ...s, weightKg: Number(converted.toFixed(1)) };
      });
      setSets(updatedSets);
      setUnit(nextUnit);
    } else if (isTimeBased) {
      const nextUnit = unit === 'SEC' ? 'MM:SS' : 'SEC';
      const updatedSets = sets.map((s) => {
        if (!s.timeSec) return s;
        if (nextUnit === 'MM:SS') {
          const totalSec = parseFloat(s.timeSec);
          if (isNaN(totalSec)) return s;
          const mins = Math.floor(totalSec / 60);
          const secs = (totalSec % 60).toFixed(1);
          const formattedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
          return { ...s, timeSec: `${mins}:${formattedSecs}` };
        } else {
          const parts = String(s.timeSec).split(':');
          let secVal = 0;
          if (parts.length === 2) {
            secVal = (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
          } else {
            secVal = parseFloat(parts[0]) || 0;
          }
          return { ...s, timeSec: isNaN(secVal) ? '' : Number(secVal.toFixed(1)) };
        }
      });
      setSets(updatedSets);
      setUnit(nextUnit);
    }
  };

  const projectedMetrics = useMemo(() => {
    if (!hasSets || sets.length === 0) return { totalLoad: 0, value: 0, average: 0 };

    let totalLoad = 0;
    let totalReps = 0;
    let bestValue = isSpeed ? Infinity : 0;
    let hasWeight = false;

    sets.forEach((s) => {
      const reps = parseFloat(s.reps) || 0;
      let setLoad = 0;
      let setVal = 0;

      if (isStrength) {
        let weightKg = parseFloat(s.weightKg) || 0;
        if (unit === 'LBS') {
          weightKg = Number((weightKg * 0.45359237).toFixed(1));
        }
        setLoad = weightKg * reps;

        setVal = reps === 1 ? weightKg : weightKg * (1 + reps / 30);
        if (setVal > bestValue) bestValue = setVal;
      } else if (isTimeBased) {
        let timeSec = 0;
        if (unit === 'MM:SS') {
          const parts = String(s.timeSec || '').split(':');
          if (parts.length === 2) {
            timeSec = (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
          } else {
            timeSec = parseFloat(parts[0]) || 0;
          }
        } else {
          timeSec = parseFloat(s.timeSec) || 0;
        }

        if (isKgSecEndurance) {
          const weightKg = parseFloat(s.weightKg) || 0;
          setLoad = reps * weightKg * timeSec;
          setVal = weightKg * timeSec;
        } else {
          setLoad = timeSec * reps;
          setVal = timeSec;
        }
        if (isSpeed) {
          if (setVal > 0 && setVal < bestValue) bestValue = setVal;
        } else {
          if (setVal > 0 && setVal > bestValue) bestValue = setVal;
        }
      } else if (isCmPlyo) {
        let cmVal = parseFloat(s.weightCm || s.cm || s.valueCm || s.weight || s.value) || 0;
        setLoad = cmVal * reps;
        setVal = cmVal;
        if (setVal > bestValue) bestValue = setVal;
      } else if (isReps) {
        let weight = parseFloat(s.weightKg ?? s.weight) || 0;
        if (weight > 0) {
          hasWeight = true;
          setLoad = weight * reps;
          setVal = weight;
        } else {
          setLoad = reps;
          setVal = reps;
        }
        if (setVal > bestValue) bestValue = setVal;
      }

      totalLoad += setLoad;
      totalReps += reps;
    });

    if (bestValue === Infinity) bestValue = 0;

    const average = isCmPlyo
      ? (totalReps > 0 ? Number((totalLoad / totalReps).toFixed(1)) : 0)
      : (isReps && !hasWeight)
        ? (sets.length > 0 ? Number((totalReps / sets.length).toFixed(1)) : 0)
        : (totalReps > 0 ? Number((totalLoad / totalReps).toFixed(1)) : 0);

    return {
      totalLoad: Number(totalLoad.toFixed(1)),
      value: Number(bestValue.toFixed(1)),
      average
    };
  }, [sets, hasSets, isStrength, isSpeed, isTimeBased, isCmPlyo, isReps, unit]);

  if (!isOpen) return null;

  const handleSetChange = (index: number, field: string, val: string) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: val === '' ? '' : Number(val) || val };
    setSets(newSets);
  };

  const handleDeleteSet = (index: number) => {
    const newSets = sets.filter((_, i) => i !== index);
    setSets(newSets);
  };

  const handleAddSet = () => {
    const fallbackUnit = isStrength ? (unit || 'KG') : isTimeBased ? (unit || 'SEC') : isCmPlyo ? 'CM' : isReps ? 'REPS' : '';

    const newSet: any = {
      reps: '',
      unit: fallbackUnit,
    };

    if (isStrength) {
      newSet.weightKg = '';
    } else if (isTimeBased) {
      newSet.timeSec = '';
      if (isKgSecEndurance) {
        newSet.weightKg = '';
      }
    } else if (isCmPlyo) {
      newSet.weightCm = '';
    }

    setSets([...sets, newSet]);
  };

  // Diet handlers
  const handleDietChange = (groupIndex: number, entryIndex: number, field: 'context' | 'value', val: string) => {
    const newGroups = [...dietGroups];
    newGroups[groupIndex].entries[entryIndex] = { 
      ...newGroups[groupIndex].entries[entryIndex], 
      [field]: val 
    };
    setDietGroups(newGroups);
  };

  const handleDeleteDietEntry = (groupIndex: number, entryIndex: number) => {
    const newGroups = [...dietGroups];
    newGroups[groupIndex].entries = newGroups[groupIndex].entries.filter((_, i) => i !== entryIndex);
    
    // Remove the group entirely if no entries remain in that specific timestamp
    if (newGroups[groupIndex].entries.length === 0) {
      newGroups.splice(groupIndex, 1);
    }
    setDietGroups(newGroups);
  };

  const handleAddDietEntry = (groupIndex?: number) => {
    if (groupIndex !== undefined) {
      const newGroups = [...dietGroups];
      newGroups[groupIndex].entries.push({ context: '', value: '' });
      setDietGroups(newGroups);
    } else {
      // Create a brand new group with current time, ISO key, maintaining chronological order
      const newIso = new Date().toISOString();
      const updatedGroups = [
        ...dietGroups, 
        { key: newIso, dateTime: newIso, entries: [{ context: '', value: '' }] }
      ].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

      setDietGroups(updatedGroups);
    }
  };

  const handleUpdate = () => {
    if (isDietMetric) {
      // Calculate total sum of values across all diet groups for the day
      const totalSum = dietGroups.reduce((acc, group) => {
        return acc + group.entries.reduce((sum, e) => {
          const num = parseFloat(String(e.value));
          return sum + (isNaN(num) ? 0 : num);
        }, 0);
      }, 0);
      const value = Number(totalSum.toFixed(1));

      // Root payload structure with preserved key and value
      const updatedDietPayload: Record<string, any> = {
        value
      };

      dietGroups.forEach((group) => {
        const updatedValues = group.entries.map((e) => {
          const num = parseFloat(String(e.value));
          return isNaN(num) ? 0 : Number(num.toFixed(1));
        });
        const updatedContexts = group.entries.map((e) => e.context);

        const groupKey = group.key || group.dateTime;

        updatedDietPayload[groupKey] = {
          context: updatedContexts,
          dateTime: group.dateTime,
          unit: targetUnit || 'kcal',
          value: updatedValues
        };
      });

      onUpdate(updatedDietPayload);
    } else if (hasSets) {
      const normalizedSets = sets.map((s) => {
        const newSet = { ...s };
        if (isStrength) {
          let w = parseFloat(s.weightKg);
          if (!isNaN(w) && unit === 'LBS') {
            w = w * 0.45359237;
          }
          newSet.weightKg = isNaN(w) ? s.weightKg : Number(w.toFixed(1));
          newSet.unit = 'KG';
        } else if (isTimeBased) {
          let t = 0;
          if (unit === 'MM:SS') {
            const parts = String(s.timeSec || '').split(':');
            if (parts.length === 2) {
              t = (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
            } else {
              t = parseFloat(parts[0]) || 0;
            }
          } else {
            t = parseFloat(s.timeSec) || 0;
          }
          newSet.timeSec = isNaN(t) ? s.timeSec : Number(t.toFixed(1));
  
          if (isKgSecEndurance) {
            const w = parseFloat(s.weightKg);
            newSet.weightKg = isNaN(w) ? s.weightKg : Number(w.toFixed(1));
            newSet.unit = 'kg*sec';
          } else {
            newSet.unit = 'SEC';
          }
        } else if (isCmPlyo) {
          let rawCm = s.weightCm || s.cm || s.valueCm || s.weight || s.value;
          let cm = parseFloat(rawCm);
          newSet.weightCm = isNaN(cm) ? rawCm : Number(cm.toFixed(1));
          newSet.unit = 'cm';
        } else if (isReps) {
          let r = parseFloat(s.reps);
          newSet.reps = isNaN(r) ? s.reps : Number(r);
          newSet.unit = 'reps';
        }
        return newSet;
      });

      onUpdate({
        sets: normalizedSets,
        totalSets: sets.length,
        totalLoad: projectedMetrics.totalLoad,
        average: projectedMetrics.average,
        value: projectedMetrics.value
      });
    } else {
      let finalValue = parseFloat(inputValue);

      if (isStrength && unit === 'LBS') {
        finalValue = finalValue * 0.45359237; 
      } else if (isTimeBased && unit === 'MM:SS') {
        const parts = inputValue.split(':');
        if (parts.length === 2) {
          finalValue = (parseInt(parts[0]) * 60) + parseFloat(parts[1]);
        }
      }

      if (!isNaN(finalValue)) {
        const truncatedValue = Number(finalValue.toFixed(1));
        onUpdate({ value: truncatedValue });
      }
    }
  };

  const dbUnitLabel = isKgSecEndurance ? 'kg*sec' : isStrength ? 'KG' : isTimeBased ? 'SEC' : isCmPlyo ? 'CM' : isReps ? 'REPS' : unit;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 isolate">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-lg w-full border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-hidden">
        <p className="text-slate-500 text-sm mb-2 font-medium">
          Recorded on {new Date(recordedDate).toLocaleString()}
        </p>
        <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight truncate">
          Manage {title}
        </h3>

        {isDietMetric ? (
          <>
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Diet Log Entries
              </span>
            </div>

            <div className="mb-4 max-h-60 overflow-y-auto space-y-4 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {dietGroups.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-3 relative">
                  {/* DateTime Header */}
                  <div className="sticky top-0 bg-white/95 backdrop-blur-sm py-1.5 z-10 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-500 tracking-wide">
                      {new Date(group.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(group.dateTime).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {group.entries.map((entry, entryIndex) => (
                    <div key={entryIndex} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="flex flex-col flex-1 min-w-0">
                        <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">
                          Context / Food
                        </label>
                        <input
                          type="text"
                          value={entry.context}
                          onChange={(e) => handleDietChange(groupIndex, entryIndex, 'context', e.target.value)}
                          placeholder="Food description"
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl font-medium text-xs text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 truncate"
                        />
                      </div>

                      <div className="flex flex-col w-24 shrink-0">
                        <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">
                          Value ({targetUnit || 'kcal'})
                        </label>
                        <input
                          type="number"
                          value={entry.value}
                          onChange={(e) => handleDietChange(groupIndex, entryIndex, 'value', e.target.value)}
                          placeholder="0"
                          className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                        />
                      </div>

                      <button 
                        type="button"
                        onClick={() => handleDeleteDietEntry(groupIndex, entryIndex)}
                        className="mt-4.5 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                        title="Delete Entry"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={() => handleAddDietEntry(groupIndex)}
                    className="w-full py-2 px-4 bg-slate-50 text-slate-400 font-semibold rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-colors text-[11px] flex items-center justify-center gap-1 border border-slate-200 border-dashed cursor-pointer"
                  >
                    + Add Item to this Time
                  </button>
                </div>
              ))}
              {dietGroups.length === 0 && (
                <p className="text-sm text-slate-500 italic text-center p-4">All entries deleted. Click Update to save.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleAddDietEntry()}
              className="w-full mb-6 py-3 px-4 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 active:scale-[0.99] transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
            >
              + Add New Time Entry
            </button>
          </>
        ) : hasSets ? (
          <>
            {(isStrength || isTimeBased) && (
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Sets Log
                </span>
                <button
                  type="button"
                  onClick={handleToggleUnit}
                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-lg transition-colors group cursor-pointer"
                >
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">
                    Set Unit:
                  </span>
                  <span className="text-[10px] font-black text-indigo-600 group-hover:scale-105 transition-transform">
                    {unit}
                  </span>
                  <RefreshCw size={10} className="text-indigo-400 group-hover:rotate-180 transition-transform duration-500" />
                </button>
              </div>
            )}

            <div className="mb-4 max-h-60 overflow-y-auto space-y-3 pr-2 scrollbar-thin scrollbar-thumb-slate-200">
              {sets.map((setObj, index) => (
                <div key={index} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100">
                  <div className="flex flex-col flex-1">
                    <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">Reps</label>
                    <input
                      type="number"
                      value={setObj.reps || ''}
                      onChange={(e) => handleSetChange(index, 'reps', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  
                  {(isStrength || isKgSecEndurance) && (
                    <div className="flex flex-col flex-1">
                      <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">
                        Weight ({isStrength ? unit : 'KG'})
                      </label>
                      <input
                        type="number"
                        value={setObj.weightKg || ''}
                        onChange={(e) => handleSetChange(index, 'weightKg', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}

                  {isTimeBased && (
                    <div className="flex flex-col flex-1">
                      <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">
                        Time ({unit})
                      </label>
                      <input
                        type={unit === 'MM:SS' ? "text" : "number"}
                        value={setObj.timeSec || ''}
                        placeholder={unit === 'MM:SS' ? "00:00" : ""}
                        onChange={(e) => handleSetChange(index, 'timeSec', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}

                  {isCmPlyo && (
                    <div className="flex flex-col flex-1">
                      <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">
                        Height (CM)
                      </label>
                      <input
                        type="number"
                        value={setObj.weightCm || setObj.cm || setObj.valueCm || setObj.weight || setObj.value || ''}
                        onChange={(e) => handleSetChange(index, 'weightCm', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}

                  <button 
                    type="button"
                    onClick={() => handleDeleteSet(index)}
                    className="mt-4.5 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 cursor-pointer"
                    title="Delete Set"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
              {sets.length === 0 && (
                <p className="text-sm text-slate-500 italic text-center p-4">All sets have been deleted. Click Update to save.</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAddSet}
              className="w-full mb-4 py-3 px-4 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 active:scale-[0.99] transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
            >
              + Add Set
            </button>

            <div className="grid grid-cols-2 gap-3 mb-6 p-3 bg-slate-50 border border-slate-100 rounded-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase ml-1 mb-1">
                  Peak Value
                </span>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`${projectedMetrics.value} ${dbUnitLabel}`}
                  className="w-full p-2 bg-slate-100/80 border border-slate-200 rounded-xl font-bold text-slate-500 cursor-not-allowed outline-none select-none"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold uppercase ml-1 mb-1">
                  Total Load
                </span>
                <input
                  type="text"
                  readOnly
                  disabled
                  value={`${projectedMetrics.totalLoad} ${dbUnitLabel}`}
                  className="w-full p-2 bg-slate-100/80 border border-slate-200 rounded-xl font-bold text-slate-500 cursor-not-allowed outline-none select-none"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="mb-6">
            <div className="flex gap-2 w-full items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={isTimeBased && unit === 'MM:SS' ? "00:00" : "Value"}
                className="flex-1 min-w-0 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              
              {(isStrength || isTimeBased) && (
                <select 
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="shrink-0 px-3 py-4 bg-slate-100 border-none rounded-2xl font-bold text-indigo-600 outline-none cursor-pointer text-sm"
                >
                  {isStrength ? (
                    <>
                      <option value="KG">KG</option>
                      <option value="LBS">LBS</option>
                    </>
                  ) : (
                    <>
                      <option value="SEC">SEC</option>
                      <option value="MM:SS">MM:SS</option>
                    </>
                  )}
                </select>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <button onClick={onClose} className="py-4 px-2 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors cursor-pointer text-sm">
            Cancel
          </button>
          <button onClick={onDelete} className="py-4 px-2 rounded-2xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors cursor-pointer text-sm">
            Delete
          </button>
        </div>

        <button 
          onClick={handleUpdate}
          className="w-full mt-4 py-4 px-6 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all cursor-pointer"
        >
          Update Value
        </button>
      </div>
    </div>
  );
};