import React, { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import type { Group } from './group';

interface ManageDataSourceModalProps {
  group: Group;
  onClose: () => void;
}

export const ManageDataSourceModal: React.FC<ManageDataSourceModalProps> = ({ group, onClose }) => {
  const [excludedUids, setExcludedUids] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setExcludedUids((group as any).adminExcludedUids || []);
  }, [group]);

  const toggleUser = (uid: string) => {
    setExcludedUids(prev => 
      prev.includes(uid) ? prev.filter(id => id !== uid) : [...prev, uid]
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const groupRef = doc(db, 'myHealth_groups', group.id);
      await updateDoc(groupRef, {
        adminExcludedUids: excludedUids
      });
      onClose();
    } catch (error) {
      console.error("Error updating data sources:", error);
      alert("Failed to update data sources.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Manage Data Source</h2>
            <p className="text-xs text-slate-500 mt-1">Select whose data contributes to group stats.</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-2 custom-scrollbar">
          {group.members.map(member => {
            const isExcluded = excludedUids.includes(member.userId);
            return (
              <div 
                key={member.userId} 
                onClick={() => toggleUser(member.userId)}
                className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                  !isExcluded ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-100 bg-white hover:border-slate-300'
                }`}
              >
                <span className={`text-sm font-semibold ${!isExcluded ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {member.display_name}
                </span>
                <div className={`w-5 h-5 rounded flex items-center justify-center transition-colors ${
                  !isExcluded ? 'bg-emerald-500' : 'bg-slate-200'
                }`}>
                  {!isExcluded && <Check size={14} className="text-white" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3.5 rounded-xl transition-all flex justify-center items-center gap-2"
          >
            {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};