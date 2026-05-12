// ModalEditDelete.tsx
import React, { useState, useEffect } from 'react';
import { STRENGTH_KEY_MAP, SPEED_KEY_MAP } from './profileConstants';

interface ModalEditDeleteProps {
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onUpdate: (value: number) => void;
  initialValue: any;
  title: string;
  recordedDate: number;
  metricKey: string;
}

export const ModalEditDelete: React.FC<ModalEditDeleteProps> = ({
  isOpen, onClose, onDelete, onUpdate, initialValue, title, recordedDate, metricKey
}) => {
  const isStrength = Object.values(STRENGTH_KEY_MAP).includes(metricKey);
  const isSpeed = Object.values(SPEED_KEY_MAP).includes(metricKey);

  const [inputValue, setInputValue] = useState('');
  const [unit, setUnit] = useState('');

  useEffect(() => {
    if (isSpeed) {
      setUnit('SEC');
      setInputValue(String(initialValue));
    } else if (isStrength) {
      setUnit('KG');
      setInputValue(String(initialValue));
    } else {
      setInputValue(String(initialValue));
    }
  }, [initialValue, isSpeed, isStrength]);

  if (!isOpen) return null;

  const handleUpdate = () => {
    let finalValue = parseFloat(inputValue);

    if (isStrength && unit === 'LBS') {
      finalValue = finalValue / 2.20462; 
    } else if (isSpeed && unit === 'MM:SS') {
      const parts = inputValue.split(':');
      if (parts.length === 2) {
        finalValue = (parseInt(parts[0]) * 60) + parseFloat(parts[1]);
      }
    }

    if (!isNaN(finalValue)) {
      const truncatedValue = Number(finalValue.toFixed(3));
      onUpdate(truncatedValue);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 isolate">
      <div className="absolute inset-0" onClick={onClose} />
      {/* Container ensures content doesn't overflow the white box */}
      <div className="relative bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100 animate-in fade-in zoom-in duration-200 overflow-hidden">
        <p className="text-slate-500 text-sm mb-2 font-medium">
          Recorded on {new Date(recordedDate).toLocaleString()}
        </p>
        <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight truncate">
          Manage {title}
        </h3>

        <div className="mb-6">
          <div className="flex gap-2 w-full items-center">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isSpeed && unit === 'MM:SS' ? "00:00" : "Value"}
              /* Added min-w-0 to allow the input to shrink so the unit fits */
              className="flex-1 min-w-0 p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            
            {(isStrength || isSpeed) && (
              <select 
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                /* Changed p-4 to px-3 py-4 to save horizontal space and added shrink-0 */
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