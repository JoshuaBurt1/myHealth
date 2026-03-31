//ManageDataFieldsModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Group } from './group';
// Update imports to include the individual sub-category maps
import { 
  VITAL_KEY_MAP, 
  STRENGTH_KEY_MAP, 
  SPEED_KEY_MAP, 
  PHYSIO_KEY_MAP, 
  YOGA_KEY_MAP, 
  MOBILITY_KEY_MAP 
} from '../compareUtils';

interface ManageDataFieldsModalProps {
  group: Group;
  onClose: () => void;
}

export const ManageDataFieldsModal: React.FC<ManageDataFieldsModalProps> = ({ group, onClose }) => {
  const [activeFields, setActiveFields] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Map all sub-categories into ALL_FIELDS with specific category labels
  const ALL_FIELDS = [
    ...Object.entries(VITAL_KEY_MAP).map(([name, key]) => ({ name, key, category: 'Vitals' })),
    ...Object.entries(STRENGTH_KEY_MAP).map(([name, key]) => ({ name, key, category: 'Strength' })),
    ...Object.entries(SPEED_KEY_MAP).map(([name, key]) => ({ name, key, category: 'Speed' })),
    ...Object.entries(PHYSIO_KEY_MAP).map(([name, key]) => ({ name, key, category: 'Physio' })),
    ...Object.entries(YOGA_KEY_MAP).map(([name, key]) => ({ name, key, category: 'Yoga' })),
    ...Object.entries(MOBILITY_KEY_MAP).map(([name, key]) => ({ name, key, category: 'Mobility' }))
  ];

  const CATEGORY_LIST = ['Vitals', 'Strength', 'Speed', 'Physio', 'Yoga', 'Mobility'];

  useEffect(() => {
    const savedFields = (group as any).activeDataFields;
    if (savedFields) {
      setActiveFields(savedFields);
    } else {
      setActiveFields(ALL_FIELDS.map(f => f.key));
    }
  }, [group]);

  const toggleField = (key: string) => {
    setActiveFields(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const toggleCategory = (category: string) => {
    const categoryKeys = ALL_FIELDS.filter(f => f.category === category).map(f => f.key);
    const allSelected = categoryKeys.every(key => activeFields.includes(key));

    if (allSelected) {
      setActiveFields(prev => prev.filter(key => !categoryKeys.includes(key)));
    } else {
      setActiveFields(prev => {
        const uniqueOtherFields = prev.filter(key => !categoryKeys.includes(key));
        return [...uniqueOtherFields, ...categoryKeys];
      });
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const groupRef = doc(db, 'myHealth_groups', group.id);
      await updateDoc(groupRef, {
        activeDataFields: activeFields
      });
      onClose();
    } catch (error) {
      console.error("Error updating data fields:", error);
      alert("Failed to update data fields.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Manage Data Fields</h2>
            <p className="text-xs text-slate-500 mt-1">Select which metrics appear in comparisons.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
          {CATEGORY_LIST.map(category => {
            const categoryItems = ALL_FIELDS.filter(f => f.category === category);
            if (categoryItems.length === 0) return null;

            const allSelected = categoryItems.every(f => activeFields.includes(f.key));

            return (
              <div key={category}>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">{category}</h3>
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-tight px-2 py-1 rounded-md hover:bg-indigo-50 transition-colors"
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                
                <div className="space-y-2">
                  {categoryItems.map(field => {
                    const isActive = activeFields.includes(field.key);
                    return (
                      <div 
                        key={field.key} 
                        onClick={() => toggleField(field.key)}
                        className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isActive ? 'border-indigo-500 bg-indigo-50/30' : 'border-slate-100 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className={`text-sm font-semibold ${isActive ? 'text-indigo-700' : 'text-slate-500'}`}>
                          {field.name}
                        </span>
                        <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                          isActive ? 'bg-indigo-500' : 'bg-slate-200'
                        }`}>
                          {isActive && <Check size={14} className="text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50 shrink-0">
          <button 
            onClick={handleSave}
            disabled={isSaving || activeFields.length === 0}
            className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};