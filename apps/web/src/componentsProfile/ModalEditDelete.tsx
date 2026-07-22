import React, { useState, useEffect, useMemo } from 'react';
import { STRENGTH_KEY_MAP, SPEED_KEY_MAP } from './profileConstants';
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
  const isStrength = Object.values(STRENGTH_KEY_MAP).includes(metricKey);
  const isSpeed = Object.values(SPEED_KEY_MAP).includes(metricKey);

  const [inputValue, setInputValue] = useState('');
  const [unit, setUnit] = useState('');
  
  // State for sets
  const [sets, setSets] = useState<any[]>([]);
  const [hasSets, setHasSets] = useState(false);

  useEffect(() => {
    // Safely extract the target object, checking if the parent passed the selectedPoint wrapper
    const targetItem = initialItem?.rawObject || initialItem;

    // Check if the datapoint has sets array
    if (targetItem && Array.isArray(targetItem.sets) && targetItem.sets.length > 0) {
      setSets(targetItem.sets);
      setHasSets(true);
    } else {
      setHasSets(false);
      setSets([]);
    }

    if (isSpeed) {
      setUnit('SEC');
      setInputValue(String(initialValue));
    } else if (isStrength) {
      setUnit('KG');
      setInputValue(String(initialValue));
    } else {
      setInputValue(String(initialValue));
    }
  }, [initialValue, initialItem, isSpeed, isStrength]);

  // Unit toggle handler for converting between KG/LBS or SEC/MM:SS
  const handleToggleUnit = () => {
    if (isStrength) {
      const nextUnit = unit === 'KG' ? 'LBS' : 'KG';
      const updatedSets = sets.map((s) => {
        if (s.weightKg === '' || s.weightKg === undefined || s.weightKg === null) return s;
        const currentW = parseFloat(s.weightKg);
        if (isNaN(currentW)) return s;
        
        // Updated logic using 0.45359237 ratio
        const converted = nextUnit === 'LBS' ? currentW / 0.45359237 : currentW * 0.45359237;
        return { ...s, weightKg: Number(converted.toFixed(2)) };
      });
      setSets(updatedSets);
      setUnit(nextUnit);
    } else if (isSpeed) {
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
          return { ...s, timeSec: isNaN(secVal) ? '' : Number(secVal.toFixed(2)) };
        }
      });
      setSets(updatedSets);
      setUnit(nextUnit);
    }
  };

  // Compute live projected totalLoad and best value ALWAYS in base DB units (KG / SEC)
  const projectedMetrics = useMemo(() => {
    if (!hasSets || sets.length === 0) return { totalLoad: 0, value: 0 };

    let totalLoad = 0;
    let bestValue = isSpeed ? Infinity : 0;

    sets.forEach((s) => {
      const reps = parseFloat(s.reps) || 0;
      let setLoad = 0;
      let setVal = 0;

      if (isStrength) {
        let weightKg = parseFloat(s.weightKg) || 0;
        // Convert to KG if currently displayed in LBS
        if (unit === 'LBS') {
          weightKg = weightKg * 0.45359237;
        }
        setLoad = weightKg * reps;
        // Standard Epley 1RM formula
        setVal = weightKg * (1 + reps / 30);
        if (setVal > bestValue) bestValue = setVal;
      } else if (isSpeed) {
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
        setLoad = timeSec * reps;
        setVal = timeSec;
        if (setVal > 0 && setVal < bestValue) bestValue = setVal;
      }

      totalLoad += setLoad;
    });

    if (bestValue === Infinity) bestValue = 0;

    return {
      totalLoad: Number(totalLoad.toFixed(3)),
      value: Number(bestValue.toFixed(3))
    };
  }, [sets, hasSets, isStrength, isSpeed, unit]);

  if (!isOpen) return null;

  // Handlers for modifying sets
  const handleSetChange = (index: number, field: string, val: string) => {
    const newSets = [...sets];
    newSets[index] = { ...newSets[index], [field]: val === '' ? '' : Number(val) || val };
    setSets(newSets);
  };

  const handleDeleteSet = (index: number) => {
    const newSets = sets.filter((_, i) => i !== index);
    setSets(newSets);
  };

  // Handler to append a new set
  const handleAddSet = () => {
    const fallbackUnit = isStrength ? (unit || 'KG') : isSpeed ? (unit || 'SEC') : '';

    const newSet: any = {
      reps: '',
      unit: fallbackUnit,
    };

    if (isStrength) {
      newSet.weightKg = '';
    } else if (isSpeed) {
      newSet.timeSec = '';
    }

    setSets([...sets, newSet]);
  };

  const handleUpdate = () => {
    if (hasSets) {
      // Normalize sets back to DB base units (KG / SEC)
      const normalizedSets = sets.map((s) => {
        const newSet = { ...s };
        if (isStrength) {
          let w = parseFloat(s.weightKg);
          if (!isNaN(w) && unit === 'LBS') {
            w = w * 0.45359237;
          }
          newSet.weightKg = isNaN(w) ? s.weightKg : Number(w.toFixed(3));
          newSet.unit = 'KG';
        } else if (isSpeed) {
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
          newSet.timeSec = isNaN(t) ? s.timeSec : Number(t.toFixed(3));
          newSet.unit = 'SEC';
        }
        return newSet;
      });

      // Pass back updated fields using standard base unit metrics
      onUpdate({
        sets: normalizedSets,
        totalSets: sets.length,
        totalLoad: projectedMetrics.totalLoad,
        value: projectedMetrics.value
      });
    } else {
      // EXISTING LOGIC for datapoints without sets
      let finalValue = parseFloat(inputValue);

      if (isStrength && unit === 'LBS') {
        finalValue = finalValue * 0.45359237; 
      } else if (isSpeed && unit === 'MM:SS') {
        const parts = inputValue.split(':');
        if (parts.length === 2) {
          finalValue = (parseInt(parts[0]) * 60) + parseFloat(parts[1]);
        }
      }

      if (!isNaN(finalValue)) {
        const truncatedValue = Number(finalValue.toFixed(3));
        onUpdate({ value: truncatedValue });
      }
    }
  };

  // Base unit name obtained from DB
  const dbUnitLabel = isStrength ? 'KG' : isSpeed ? 'SEC' : unit;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 isolate">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-hidden">
        <p className="text-slate-500 text-sm mb-2 font-medium">
          Recorded on {new Date(recordedDate).toLocaleString()}
        </p>
        <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight truncate">
          Manage {title}
        </h3>

        {/* CONDITIONALLY RENDER Sets OR Standard Input */}
        {hasSets ? (
          <>
            {/* UNIT TOGGLE BUTTON ABOVE SETS */}
            {(isStrength || isSpeed) && (
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
                  <div className="flex flex-col w-[4.5rem]">
                    <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">Reps</label>
                    <input
                      type="number"
                      value={setObj.reps || ''}
                      onChange={(e) => handleSetChange(index, 'reps', e.target.value)}
                      className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  
                  {isStrength && (
                    <div className="flex flex-col flex-1">
                      <label className="text-[10px] text-slate-400 font-bold ml-1 mb-1 uppercase">
                        Weight ({unit})
                      </label>
                      <input
                        type="number"
                        value={setObj.weightKg || ''}
                        onChange={(e) => handleSetChange(index, 'weightKg', e.target.value)}
                        className="w-full p-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  )}

                  {isSpeed && (
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

                  {/* Trash icon with red on hover */}
                  <button 
                    onClick={() => handleDeleteSet(index)}
                    className="mt-[18px] p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0 cursor-pointer"
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

            {/* ADD SET BUTTON */}
            <button
              type="button"
              onClick={handleAddSet}
              className="w-full mb-4 py-3 px-4 bg-indigo-50 text-indigo-600 font-bold rounded-2xl hover:bg-indigo-100 active:scale-[0.99] transition-all cursor-pointer text-sm flex items-center justify-center gap-1"
            >
              + Add Set
            </button>

            {/* UNMODIFIABLE PROJECTED METRICS DISPLAY */}
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
                placeholder={isSpeed && unit === 'MM:SS' ? "00:00" : "Value"}
                className="flex-1 min-w-0 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              
              {(isStrength || isSpeed) && (
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