import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

// 1. Badge Component
export const Badge: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  color: string 
}> = ({ icon, label, color }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm ${color}`}>
    {icon} {label}
  </div>
);

// 2. Stat Item Component
export const StatItem: React.FC<{ 
  label: string; 
  count: number; 
  onClick?: () => void 
}> = ({ label, count, onClick }) => (
  <div className="flex flex-col items-center p-3 cursor-pointer select-none" onClick={onClick}>
    <span className="text-2xl font-black text-slate-800 leading-none">{count}</span>
    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</span>
  </div>
);

// 3. Input Field Component
interface InputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export const InputField: React.FC<InputFieldProps> = ({ 
  label, value, onChange, type = 'text', disabled = false, icon 
}) => (
  <div className="flex flex-col space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <div className="relative flex items-center">
      {icon && <div className="absolute left-4 text-slate-300">{icon}</div>}
      <input 
        type={type} 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        disabled={disabled}
        className={`w-full p-4 ${icon ? 'pl-11' : 'pl-4'} bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-700 focus:ring-4 focus:ring-indigo-50 focus:border-indigo-200 outline-none transition-all shadow-sm disabled:bg-slate-50 disabled:text-slate-400`}
      />
    </div>
  </div>
);

// 4. Collapsible Section Component
interface CollapsibleProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}

export const CollapsibleSection: React.FC<CollapsibleProps> = ({ 
  title, icon, children, defaultOpen = true, badge 
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-50/50 transition-colors cursor-pointer select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsOpen(!isOpen); }}
      >
        <div className="flex items-center gap-3">
          <div className="text-indigo-500">{icon}</div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-tight">{title}</h3>
          {badge}
        </div>
        <ChevronDown size={18} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      {isOpen && <div className="p-5 pt-0">{children}</div>}
    </div>
  );
};