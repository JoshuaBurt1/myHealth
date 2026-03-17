import React, { useState } from 'react';
import { ChevronDown, Timer } from 'lucide-react';

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

// 4. Sex Input Field (Select Dropdown)
interface SexInputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const SexInputField: React.FC<SexInputFieldProps> = ({ label, value, onChange, disabled = false }) => (
  <div className="flex flex-col space-y-1">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
    <div className="relative flex items-center">
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold text-slate-400 appearance-none cursor-pointer outline-none transition-all shadow-sm disabled:cursor-default"
      >
        <option value="" disabled>--</option>
        <option value="M">M</option>
        <option value="F">F</option>
      </select>
      <div className="absolute right-3 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg pointer-events-none">
        <ChevronDown size={14} />
      </div>
    </div>
  </div>
);

// 5. Age Input Field (Disabled with Modal Trigger)
interface AgeInputFieldProps {
  label: string;
  value: string;
  onIconClick?: () => void;
  isMe?: boolean;
}

export const AgeInputField: React.FC<AgeInputFieldProps> = ({ label, value, onIconClick, isMe }) => (
  <div className="relative">
    <InputField 
      label={label} 
      value={value} 
      onChange={() => {}} 
      disabled={true} 
    />
    {isMe && onIconClick && (
      <button 
        onClick={onIconClick}
        className="absolute right-3 top-8.5 p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        <Timer size={14} />
      </button>
    )}
  </div>
);

// 6. Collapsible Section Component
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
          <div className="flex flex-col items-start">
            <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase">{title}</h3>
          </div>
          {badge}
        </div>
        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          <ChevronDown size={18} className="text-slate-400" />
        </div>
      </div>
      {isOpen && (
        <div className="p-5 pt-0 border-t border-slate-50/50">
          {children}
        </div>
      )}
    </div>
  );
};