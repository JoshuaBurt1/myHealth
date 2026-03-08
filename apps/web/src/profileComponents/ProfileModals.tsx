import React from 'react';
import { X, Activity, Dumbbell, PlusCircle, RefreshCw, ChevronDown, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// --- Interfaces ---

interface ModalWrapperProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

interface VitalModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: { type: 'addon' | 'custom'; name: string; value: string; customVarName: string } | any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  addons: string[];
  saving: boolean;
  onSave: () => Promise<void>;
}

interface WorkoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  form: { type: 'strength' | 'speed' | 'custom'; name: string; value: string; customVarName: string } | any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  strengthList: string[];
  speedList: string[];
  saving: boolean;
  onSave: () => Promise<void>;
}

interface FollowModalProps {
  config: { isOpen: boolean; type: string }; 
  onClose: () => void;
  followers: any[];
  following: any[];
}

// --- Components ---

const ModalWrapper: React.FC<ModalWrapperProps> = ({ isOpen, onClose, title, icon, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-black text-slate-800 text-lg flex items-center gap-2 uppercase tracking-tight">
            {icon} {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
        </div>
        {children}
      </div>
    </div>
  );
};

export const VitalModal: React.FC<VitalModalProps> = ({ 
  isOpen, onClose, form, setForm, addons, saving, onSave 
}) => {
  // Guard: Don't evaluate children if modal is closed or form is missing
  if (!isOpen || !form) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Log Extra Vital" icon={<Activity size={20} className="text-red-500" />}>
      <div className="space-y-4 mb-6">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${form.type === 'addon' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            onClick={() => setForm((prev: any) => ({...prev, type: 'addon', name: addons[0] || '', customVarName: ''}))}
          > Standard </button>
          <button 
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors ${form.type === 'custom' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
            onClick={() => setForm((prev: any) => ({...prev, type: 'custom', name: '', customVarName: ''}))}
          > Custom </button>
        </div>

        {form.type === 'addon' ? (
          <div className="relative">
            <select 
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-red-500 appearance-none"
              value={form.name}
              onChange={(e) => setForm({...form, name: e.target.value})}
            >
              {addons.map(a => <option key={a} value={a}>{a}</option>)}
              {addons.length === 0 && <option value="" disabled>All standards tracked</option>}
            </select>
            <ChevronDown className="absolute right-4 top-3 text-slate-400 pointer-events-none" size={18} />
          </div>
        ) : (
          <>
            <input type="text" placeholder="Metric Name (e.g. TSH)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
              value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            <input type="text" placeholder="Unit (e.g. mIU/L)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-red-500"
              value={form.customVarName} onChange={(e) => setForm({...form, customVarName: e.target.value})} />
          </>
        )}
      </div>
      <button onClick={onSave} disabled={saving || !form.name}
        className="w-full bg-red-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-red-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-red-600"
      >
        {saving ? <RefreshCw className="animate-spin" size={20}/> : <PlusCircle size={20}/>} Track this Vital
      </button>
    </ModalWrapper>
  );
};

export const WorkoutModal: React.FC<WorkoutModalProps> = ({ 
  isOpen, onClose, form, setForm, strengthList, speedList, saving, onSave 
}) => {
  // Guard: Don't evaluate children if modal is closed or form is missing
  if (!isOpen || !form) return null;

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Log Workout" icon={<Dumbbell size={20} className="text-emerald-500" />}>
      <div className="space-y-4 mb-6">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {(['strength', 'speed', 'custom'] as const).map((t) => (
            <button key={t} className={`flex-1 py-2 text-xs font-bold rounded-lg capitalize transition-colors ${form.type === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              onClick={() => setForm((prev: any) => ({...prev, type: t, customVarName: '', name: t === 'custom' ? '' : (t === 'strength' ? strengthList[0] : speedList[0])}))}>{t}</button>
          ))}
        </div>
        {form.type !== 'custom' ? (
          <div className="relative">
            <select className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none"
              value={form.name} onChange={(e) => setForm({...form, name: e.target.value})}>
              {(form.type === 'strength' ? strengthList : speedList).map(a => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="absolute right-4 top-3 text-slate-400 pointer-events-none" size={18} />
          </div>
        ) : (
          <>
            <input type="text" placeholder="Exercise Name" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} />
            <input type="text" placeholder="Unit (e.g. sets, reps, lbs)" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.customVarName} onChange={(e) => setForm({...form, customVarName: e.target.value})} />
          </>
        )}
      </div>
      <button onClick={onSave} disabled={saving || !form.name} 
        className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black shadow-lg shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50 transition-all hover:bg-emerald-600"
      >
        {saving ? <RefreshCw className="animate-spin" size={20}/> : <PlusCircle size={20}/>} Add to Tracker
      </button>
    </ModalWrapper>
  );
};

export const FollowModal: React.FC<FollowModalProps> = ({ config, onClose, followers, following }) => {
  const navigate = useNavigate(); 
  
  // Guard: Ensure config exists
  if (!config || !config.isOpen) return null;
  
  const isFollowers = config.type?.toLowerCase() === 'followers';
  const list = isFollowers ? followers : following;
  const displayTitle = isFollowers ? 'Followers' : 'Following';

  return (
    <ModalWrapper isOpen={config.isOpen} onClose={onClose} title={displayTitle}>
      <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
        {list?.map(u => (
          <button 
            key={u.uid} 
            onClick={() => { 
              onClose(); 
              navigate(`/profile/${u.uid}`); 
            }} 
            className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:shadow-sm transition-all">
              <User size={20} />
            </div>
            <span className="font-bold text-slate-700">{u.name || u.displayName || 'User'}</span>
          </button>
        ))}
        {(!list || list.length === 0) && (
          <p className="text-center py-8 text-slate-400 text-sm font-medium">
            No {displayTitle.toLowerCase()} found.
          </p>
        )}
      </div>
    </ModalWrapper>
  );
};