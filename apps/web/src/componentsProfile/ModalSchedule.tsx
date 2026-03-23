// src/componentsProfile/ModalSchedule.tsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, Plus, Dumbbell, Pill, AlignLeft, Save, RefreshCw, ChevronDown, Users, AlertTriangle } from 'lucide-react';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { STANDARD_MEDICATIONS } from '../componentsProfile/medicationsList';

export interface ScheduleEvent {
  id: string;
  day: string;
  time: string;
  duration: number; // In hours (e.g., 1.5, 2)
  type: 'workout' | 'medication' | 'group' | 'appointment' | 'practice' | 'other';
  title: string;
  source: 'personal' | 'group';
  groupName?: string;
}

interface ModalScheduleProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
const HOUR_HEIGHT = 60; // pixels per hour

// Helper to convert "14:00" to pixel offset
const timeToPx = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h + (m || 0) / 60) * HOUR_HEIGHT;
};

export const ModalSchedule: React.FC<ModalScheduleProps> = ({ isOpen, onClose, userId }) => {
  const [personalEvents, setPersonalEvents] = useState<ScheduleEvent[]>([]);
  const [groupEvents, setGroupEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Slot selection state
  const [activeSlot, setActiveSlot] = useState<{ day: string, time: string } | null>(null);
  const [eventType, setEventType] = useState<'workout' | 'medication' | 'other'>('workout');
  const [customInput, setCustomInput] = useState('');
  const [selectedMed, setSelectedMed] = useState<string>('');
  const [duration, setDuration] = useState<number>(1);

  useEffect(() => {
    if (!isOpen || !userId) return;
    
    const loadSchedules = async () => {
      setLoading(true);
      try {
        // 1. Load Personal Schedule
        const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
        const snap = await getDoc(profileRef);
        let pEvents: ScheduleEvent[] = [];
        if (snap.exists() && snap.data().schedule) {
          pEvents = snap.data().schedule.map((e: any) => ({ ...e, source: 'personal' }));
        }

        // 2. Load Group Schedules (Read-Time Aggregation)
        const groupsRef = collection(db, 'myHealth_groups');
        const q = query(groupsRef, where('memberUids', 'array-contains', userId));
        const groupSnaps = await getDocs(q);
        
        let gEvents: ScheduleEvent[] = [];
        groupSnaps.forEach(gDoc => {
          const groupData = gDoc.data();
          if (groupData.schedule) {
            const mapped = groupData.schedule.map((e: any) => ({
              ...e,
              source: 'group',
              groupName: groupData.groupName || 'Team'
            }));
            gEvents = [...gEvents, ...mapped];
          }
        });

        setPersonalEvents(pEvents);
        setGroupEvents(gEvents);
      } catch (err) {
        console.error("Failed to load schedules", err);
      } finally {
        setLoading(false);
      }
    };
    loadSchedules();
  }, [isOpen, userId]);

  const allEvents = [...personalEvents, ...groupEvents];

  const handleAddEvent = () => {
    if (!activeSlot) return;
    
    let title = customInput;
    if (eventType === 'medication') title = selectedMed;
    if (!title.trim()) return alert("Please provide details for the event.");

    const newEvent: ScheduleEvent = {
      id: Date.now().toString(),
      day: activeSlot.day,
      time: activeSlot.time,
      duration: duration,
      type: eventType,
      title: title.trim(),
      source: 'personal'
    };

    setPersonalEvents(prev => [...prev, newEvent]);
    setActiveSlot(null);
    setCustomInput('');
    setSelectedMed('');
    setDuration(1);
  };

  const handleRemoveEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPersonalEvents(prev => prev.filter(ev => ev.id !== id));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      
      const uniqueMeds = Array.from(new Set(
        personalEvents.filter(e => e.type === 'medication').map(e => e.title)
      ));

      // Note: We ONLY save personal events to the profile, preventing group events from duplicating.
      await setDoc(profileRef, {
        schedule: personalEvents.map(({ source, groupName, ...rest }) => rest), // Strip injected properties
        medications: uniqueMeds
      }, { merge: true });
      
      alert("Personal schedule saved successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to save schedule", err);
      alert("Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  // Conflict Detection Logic
  const checkConflict = (ev: ScheduleEvent, dayEvents: ScheduleEvent[]) => {
    const start1 = timeToPx(ev.time);
    const end1 = start1 + (ev.duration * HOUR_HEIGHT);
    
    return dayEvents.some(other => {
      if (other.id === ev.id) return false;
      const start2 = timeToPx(other.time);
      const end2 = start2 + (other.duration * HOUR_HEIGHT);
      return (start1 < end2 && end1 > start2); // Overlap occurs
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-4xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Personal Schedule</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Syncing Personal & Group Events</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
              {saving ? 'SAVING...' : 'SAVE ALL'}
            </button>
            <button onClick={onClose} className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* SCHEDULE GRID */}
        <div className="flex-1 overflow-auto bg-slate-50 p-6">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <RefreshCw className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <div className="h-full border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col relative overflow-hidden">
      
          {/* Header Row - Sticky inside an overflow-y-auto parent */}
          <div className="flex border-b border-slate-200 bg-slate-100 text-center sticky top-0 z-40 shrink-0">
            <div className="w-20 shrink-0 border-r border-slate-200 p-3 bg-slate-100" />
            {DAYS.map(day => (
              <div key={day} className="flex-1 p-3 font-black text-slate-700 uppercase text-sm border-r border-slate-200 last:border-0">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body - THIS needs the overflow-y-auto */}
          <div className="flex-1 overflow-y-auto relative">
            <div className="flex relative" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
              
              {/* Time Axis */}
                <div className="w-20 shrink-0 border-r border-slate-200 bg-slate-50 relative z-10">
                  {HOURS.map(time => (
                    <div key={time} className="absolute w-full flex items-start justify-center text-[11px] font-bold text-slate-400 pt-1" style={{ top: timeToPx(time), height: HOUR_HEIGHT }}>
                      {time}
                    </div>
                  ))}
                </div>

                {/* Day Columns */}
                {DAYS.map(day => {
                  const dayEvents = allEvents.filter(e => e.day === day);
                  
                  return (
                    <div key={day} className="flex-1 border-r border-slate-100 last:border-0 relative">
                      {/* Grid Lines */}
                      {HOURS.map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-slate-100 hover:bg-indigo-50/30 cursor-pointer group transition-colors"
                            style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                            onClick={() => setActiveSlot({ day, time: `${i.toString().padStart(2, '0')}:00` })}>
                          <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Plus size={16} className="text-indigo-300" />
                          </div>
                        </div>
                      ))}

                      {/* Render Events */}
                      {dayEvents.map(ev => {
                        const hasConflict = checkConflict(ev, dayEvents);
                        const isGroup = ev.source === 'group';
                        
                        // Theme determination
                        let bgClass = 'bg-slate-100 text-slate-700 border-slate-200';
                        if (isGroup) bgClass = 'bg-amber-100 text-amber-800 border-amber-300';
                        else if (ev.type === 'medication') bgClass = 'bg-rose-100 text-rose-700 border-rose-200';
                        else if (ev.type === 'workout') bgClass = 'bg-emerald-100 text-emerald-700 border-emerald-200';

                        // Glow border added for conflicts
                        return (
                          <div 
                            key={`${ev.source}-${ev.id}`}
                            className={`absolute left-1 right-1 rounded-lg border p-2 overflow-hidden group/ev shadow-sm transition-all hover:z-30 flex flex-col ${bgClass} ${hasConflict ? 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.7)] z-30 animate-pulse' : 'hover:shadow-md'}`}
                            style={{ 
                              top: timeToPx(ev.time), 
                              height: Math.max((Number(ev.duration) || 0.5) * HOUR_HEIGHT - 2, 24), 
                              zIndex: hasConflict ? 30 : (isGroup ? 10 : 20) 
                            }}
                          >
                            {/* Conflict Badge */}
                            {hasConflict && (
                              <div className="absolute top-1 right-1 text-red-600 bg-white/80 rounded-full p-0.5" title="Time Conflict!">
                                <AlertTriangle size={12} />
                              </div>
                            )}

                            <div className="flex items-start justify-between">
                              <span className="text-xs font-bold leading-tight line-clamp-2 pr-4">{ev.title}</span>
                              {!isGroup && (
                                <button 
                                  onClick={(e) => handleRemoveEvent(ev.id, e)}
                                  className="opacity-0 group-hover/ev:opacity-100 hover:text-red-600 transition-opacity absolute right-2 top-2"
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </div>
                            
                            {isGroup && (
                              <div className="mt-auto flex items-center gap-1 text-[10px] font-bold opacity-70">
                                <Users size={10} /> {ev.groupName}
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ADD EVENT MODAL OVERLAY */}
        {activeSlot && (
          <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Add Personal Event</h3>
                  <p className="text-xs font-bold text-indigo-600">{activeSlot.day} @ {activeSlot.time}</p>
                </div>
                <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5">
                {/* Event Type */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  {(['workout', 'medication', 'other'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setEventType(type)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                        eventType === type ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {type === 'workout' && <Dumbbell size={14} />}
                      {type === 'medication' && <Pill size={14} />}
                      {type === 'other' && <AlignLeft size={14} />}
                      {type}
                    </button>
                  ))}
                </div>

                {/* Duration Picker */}
                <div>
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Duration (Hours)</label>
                   <select 
                      value={duration} 
                      onChange={e => setDuration(Number(e.target.value))}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1"
                   >
                     {[0.5, 1, 1.5, 2, 3, 4, 5, 8].map(h => (
                       <option key={h} value={h}>{h} {h === 1 ? 'Hour' : 'Hours'}</option>
                     ))}
                   </select>
                </div>

                {/* Dynamic Inputs */}
                {eventType === 'medication' ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1">Select Medication</label>
                    <div className="relative">
                      <select 
                        value={selectedMed}
                        onChange={(e) => setSelectedMed(e.target.value)}
                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="" disabled>Choose a medication...</option>
                        {STANDARD_MEDICATIONS.map(m => (
                          <option key={m.name} value={m.name}>{m.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={16} className="absolute right-4 top-4.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Details</label>
                    <input 
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder={eventType === 'workout' ? "e.g., Upper Body Power..." : "e.g., Doctor Appointment"}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1"
                      autoFocus
                    />
                  </div>
                )}

                <button 
                  onClick={handleAddEvent}
                  className="w-full py-4 bg-slate-800 text-white rounded-xl font-black shadow-md hover:bg-slate-900 active:scale-95 transition-all mt-4"
                >
                  ADD TO SCHEDULE
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};