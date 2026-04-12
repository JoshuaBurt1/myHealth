// ProfileUI.tsx
// These are various buttons and fields used in ProfileScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {ChevronDown, Timer, AlertTriangle, AlertCircle, Activity, Dumbbell, User, LineChart, Stars, Apple} from 'lucide-react';

const SHARED_INPUT_CLASSES = `
  w-full bg-slate-50 border border-slate-100 rounded-xl 
  text-slate-700 font-medium outline-none transition-all
  focus:border-indigo-500 focus:bg-white
  disabled:opacity-60 disabled:cursor-not-allowed
  text-xs sm:text-sm 
  p-2.5 sm:p-3
`;


// theme based on vital sign alert status
export const getStatusTheme = (activeAlertCount: number, alertType?: 'critical' | 'warning' | 'info') => {
  if (activeAlertCount === 0) {
    return {
      bg: "bg-emerald-50 border-emerald-100",
      text: "text-emerald-600",
      iconColor: "text-emerald-500",
      Icon: Timer,
      pulse: false
    };
  }
  
  if (alertType === 'critical') {
    return {
      bg: "bg-red-50 border-red-100",
      text: "text-red-600",
      iconColor: "text-red-500",
      Icon: AlertTriangle,
      pulse: true
    };
  }

  return {
    bg: "bg-yellow-50 border-yellow-100",
    text: "text-yellow-600",
    iconColor: "text-yellow-500",
    Icon: AlertCircle,
    pulse: true
  };
};

// 1. BADGE
export const Badge: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  color: string 
}> = ({ icon, label, color }) => (
  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black uppercase tracking-wider shadow-sm ${color}`}>
    {icon} {label}
  </div>
);

// 2. STAT ITEM
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

// 3. INPUT FIELD
interface InputFieldProps {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  onBlur?: () => void;
  type?: string;
  disabled?: boolean;
  icon?: React.ReactNode;
  placeholder?: string;
}

export const InputField: React.FC<InputFieldProps> = ({ 
  label, value, onChange, onBlur, type = "text", disabled, icon, placeholder 
}) => {
  return (
    <div className="flex flex-col gap-1 flex-1">
      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
        {label}
      </label>
      <div className="relative">
        {icon && React.isValidElement(icon) && (
          <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-slate-400 flex items-center">
            {React.cloneElement(icon as React.ReactElement<any>, { 
              size: 16,
              className: "shrink-0" 
            })}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          className={`${SHARED_INPUT_CLASSES} ${icon ? 'pl-8 sm:pl-10' : ''}`}
        />
      </div>
    </div>
  );
};

// 4. SEX INPUT FIELD
interface SexInputFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export const SexInputField: React.FC<SexInputFieldProps> = ({ label, value, onChange, disabled }) => (
  <div className="flex flex-col gap-1 flex-1">
    <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
      {label}
    </label>
    <div className="relative">
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${SHARED_INPUT_CLASSES} appearance-none cursor-pointer pr-8 sm:pr-10`}
      >
        <option value="" disabled>--</option>
        <option value="M">M</option>
        <option value="F">F</option>
      </select>
      <div className="absolute right-2.5 sm:right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-500">
        <ChevronDown size={14} />
      </div>
    </div>
  </div>
);

// 5. AGE INPUT FIELD
interface AgeInputFieldProps {
  label: string;
  value: string;
  onIconClick?: () => void;
  isMe?: boolean;
  disabled?: boolean;
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
        className="absolute right-2 sm:right-2.5 bottom-1.25 sm:bottom-1.5 p-1 sm:p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
      >
        <Timer size={14} className="sm:w-4 sm:h-4 w-3.5 h-3.5" />
      </button>
    )}
  </div>
);

// 6. COLLAPSIBLE SECTION
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

// 7. MOBILE TAB NAVIGATION
interface MobileTabNavProps {
  activeTab: 'profile' | 'history' | 'status';
  setActiveTab: (tab: 'profile' | 'history' | 'status') => void;
  activeAlertCount: number;
  alertType?: 'critical' | 'warning' | 'info';
}

export const MobileTabNav: React.FC<MobileTabNavProps> = ({ 
  activeTab, 
  setActiveTab, 
  activeAlertCount,
  alertType 
}) => {
  const theme = useMemo(() => 
    getStatusTheme(activeAlertCount, alertType), 
    [activeAlertCount, alertType]
  );

  return (
    <div className="lg:hidden flex flex-1 p-1 bg-slate-200/50 rounded-xl gap-1 max-w-full">
      <button
        onClick={() => setActiveTab('profile')}
        className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
          activeTab === 'profile' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/30'
        }`}
      >
        <User size={12} /> Profile
      </button>

      <button
        onClick={() => setActiveTab('history')}
        className={`flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
          activeTab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-200/30'
        }`}
      >
        <LineChart size={12} /> History
      </button>

      <button
        onClick={() => setActiveTab('status')}
        className={`relative flex-1 flex items-center justify-center gap-1 sm:gap-2 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all overflow-hidden ${
          activeTab === 'status' 
            ? `bg-white shadow-sm ${theme.text}` 
            : activeAlertCount > 0 
              ? `${theme.bg} ${theme.text}` 
              : 'text-slate-500 hover:bg-slate-200/30'
        }`}
      >
        {theme.pulse && (
          <div className={`absolute inset-0 opacity-20 animate-pulse ${theme.bg.split(' ')[0]}`} />
        )}
        
        <div className="relative flex items-center gap-1 sm:gap-2 z-10">
          <theme.Icon 
            size={12} 
            className={activeAlertCount > 0 ? theme.iconColor : ''} 
          /> 
          <span>Status</span>
        </div>
      </button>
    </div>
  );
};

// 8. QUICK ACTIONS DASHBOARD
interface QuickActionsBoardProps {
  setShowExerciseModal: (val: boolean) => void;
  setShowVitalModal: (val: boolean) => void;
  setShowDietModal: (val: boolean) => void;
  activeAlertCount: number;
  activeAlertLast: number | null;
  alertType?: 'critical' | 'warning' | 'info';
  exerciseStreak: number;
  dietStreak: number;
}

export const QuickActionsBoard: React.FC<QuickActionsBoardProps> = ({ 
  setShowExerciseModal, 
  setShowVitalModal, 
  setShowDietModal,
  activeAlertCount,
  activeAlertLast,
  alertType = 'info',
  exerciseStreak,
  dietStreak
}) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const theme = useMemo(() => 
    getStatusTheme(activeAlertCount, alertType), 
    [activeAlertCount, alertType]
  );

  const streakText = useMemo(() => {
    if (activeAlertCount > 0) return `${activeAlertCount} Alert${activeAlertCount > 1 ? 's' : ''}`;
    if (!activeAlertLast) return "0d 0h 0m";

    const diffMs = Math.max(0, currentTime - activeAlertLast);
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

    return `${days}d ${hours}h ${minutes}m`;
  }, [activeAlertCount, activeAlertLast, currentTime]);

  return (
    <div className="bg-white p-4 md:p-5 border-slate-100">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
        <Stars size={14} className="text-indigo-400"/> Quick Logs & Actions
      </h3>
      <div className="grid grid-cols-3 gap-3">
        {/* Vitals Button */}
        <button 
          onClick={() => setShowVitalModal(true)} 
          className={`relative flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl border shadow-sm hover:shadow-md transition-all group overflow-hidden ${theme.bg} ${activeAlertCount === 0 ? 'border-emerald-100 hover:border-emerald-300' : 'border-rose-100 hover:border-rose-300'}`}
        >
          <div className="absolute top-1.5 left-0 right-0 px-3 flex justify-between items-center">
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tighter opacity-80">
              streak
            </span>
            <span className="text-[8px] sm:text-[9px] font-black text-emerald-500 uppercase tracking-tighter">
              {streakText}
            </span>
          </div>

          <div className="bg-white p-2.5 sm:p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform mt-1">
            <Activity className={activeAlertCount > 0 ? theme.iconColor : "text-rose-500"} size={18}/>
          </div>
          <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wider uppercase text-center">
            Vitals
          </span>
          {theme.pulse && (
            <div className={`absolute inset-0 opacity-10 animate-pulse ${theme.bg.split(' ')[0]}`} />
          )}
        </button>

        {/* Diet Button */}
        <button 
          onClick={() => setShowDietModal(true)} 
          className="relative flex flex-col items-center justify-center p-3 sm:p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 shadow-sm hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md transition-all group overflow-hidden"
        >
          <div className="absolute top-1.5 left-0 right-0 px-3 flex justify-between items-center">
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tighter opacity-80">
              Streak
            </span>
            <span className="text-[8px] sm:text-[9px] font-black text-indigo-600 uppercase tracking-tighter flex items-center gap-0.5">
              <Apple size={10} strokeWidth={3} /> {dietStreak}
            </span>
          </div>

          <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform mt-1">
            <Apple className="text-indigo-600" size={20}/>
          </div>
          <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wider uppercase text-center">
            Diet
          </span>
        </button>
        {/* Exercises Button */}
        <button 
          onClick={() => setShowExerciseModal(true)} 
          className="relative flex flex-col items-center justify-center p-3 sm:p-4 bg-purple-50/50 rounded-2xl border border-purple-100 shadow-sm hover:bg-purple-50 hover:border-purple-300 hover:shadow-md transition-all group overflow-hidden"
        >
          <div className="absolute top-1.5 left-0 right-0 px-3 flex justify-between items-center">
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-tighter opacity-80">
              Streak
            </span>
            <span className="text-[8px] sm:text-[9px] font-black text-purple-600 uppercase tracking-tighter flex items-center gap-0.5">
              <Dumbbell size={10} strokeWidth={3} /> {exerciseStreak}
            </span>
          </div>

          <div className="bg-white p-3 rounded-full mb-2 shadow-sm group-hover:scale-110 transition-transform mt-1">
            <Dumbbell className="text-purple-600" size={20}/>
          </div>
          <span className="text-[10px] sm:text-xs font-black text-slate-700 tracking-wider uppercase text-center">
            Exercises
          </span>
        </button>
      </div>
    </div>
  );
};