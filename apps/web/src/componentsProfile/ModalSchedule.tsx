// src/componentsProfile/ScheduleModal.tsx
import React, { useState, useEffect } from 'react';
import { X, Calendar, Plus, Dumbbell, Pill, AlignLeft, Info, Save, RefreshCw, ChevronDown } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { STANDARD_MEDICATIONS } from '../componentsProfile/medicationsList';

interface ScheduleEvent {
  id: string;
  day: string;
  time: string;
  type: 'workout' | 'medication' | 'other';
  title: string;
  details?: string;
}

interface ModalScheduleProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);

export const ModalSchedule: React.FC<ModalScheduleProps> = ({ isOpen, onClose, userId }) => {
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Slot selection state
  const [activeSlot, setActiveSlot] = useState<{ day: string, time: string } | null>(null);
  const [eventType, setEventType] = useState<'workout' | 'medication' | 'other'>('workout');
  const [customInput, setCustomInput] = useState('');
  const [selectedMed, setSelectedMed] = useState<string>('');

  useEffect(() => {
    if (!isOpen || !userId) return;
    const loadSchedule = async () => {
      setLoading(true);
      try {
        const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
        const snap = await getDoc(profileRef);
        if (snap.exists() && snap.data().schedule) {
          setEvents(snap.data().schedule);
        } else {
          setEvents([]);
        }
      } catch (err) {
        console.error("Failed to load schedule", err);
      } finally {
        setLoading(false);
      }
    };
    loadSchedule();
  }, [isOpen, userId]);

  const handleAddEvent = () => {
    if (!activeSlot) return;
    
    let title = customInput;
    if (eventType === 'medication') {
      title = selectedMed;
    }

    if (!title.trim()) return alert("Please provide details for the event.");

    const newEvent: ScheduleEvent = {
      id: Date.now().toString(),
      day: activeSlot.day,
      time: activeSlot.time,
      type: eventType,
      title: title.trim()
    };

    setEvents(prev => [...prev, newEvent]);
    setActiveSlot(null);
    setCustomInput('');
    setSelectedMed('');
  };

  const handleRemoveEvent = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEvents(prev => prev.filter(ev => ev.id !== id));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      
      // Extract unique medications to store in the dedicated medications array
      const uniqueMeds = Array.from(new Set(
        events.filter(e => e.type === 'medication').map(e => e.title)
      ));

      await setDoc(profileRef, {
        schedule: events,
        medications: uniqueMeds
      }, { merge: true });
      
      alert("Schedule saved successfully!");
      onClose();
    } catch (err) {
      console.error("Failed to save schedule", err);
      alert("Failed to save schedule.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-4xl w-full max-w-6xl h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* HEADER */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
              <Calendar size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Weekly Schedule</h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tap a slot to add an event</p>
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
        <div className="flex-1 overflow-auto bg-slate-50 p-6 relative">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <RefreshCw className="animate-spin text-indigo-500" size={32} />
            </div>
          ) : (
            <div className="min-w-200 border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-sm">
              {/* Grid Header */}
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-200 bg-slate-100 text-center">
                <div className="p-3 border-r border-slate-200"></div>
                {DAYS.map(day => (
                  <div key={day} className="p-3 font-black text-slate-700 uppercase text-sm border-r border-slate-200 last:border-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Grid Body */}
              {HOURS.map(time => (
                <div key={time} className="grid grid-cols-[80px_repeat(7,1fr)] border-b border-slate-100 last:border-0">
                  {/* Time Label */}
                  <div className="p-3 text-[11px] font-bold text-slate-400 text-center border-r border-slate-100 bg-slate-50 flex items-center justify-center">
                    {time}
                  </div>
                  
                  {/* Day Cells */}
                  {DAYS.map(day => {
                    const cellEvents = events.filter(e => e.day === day && e.time === time);
                    return (
                      <div 
                        key={`${day}-${time}`} 
                        onClick={() => setActiveSlot({ day, time })}
                        className="p-1 min-h-15 border-r border-slate-100 last:border-0 hover:bg-indigo-50/50 cursor-pointer transition-colors relative group flex flex-col gap-1"
                      >
                        {cellEvents.map(ev => (
                          <div 
                            key={ev.id} 
                            className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center justify-between group/ev ${
                              ev.type === 'medication' ? 'bg-rose-100 text-rose-700' : 
                              ev.type === 'workout' ? 'bg-emerald-100 text-emerald-700' : 
                              'bg-slate-100 text-slate-700'
                            }`}
                          >
                            <span className="truncate">{ev.title}</span>
                            <button 
                              onClick={(e) => handleRemoveEvent(ev.id, e)}
                              className="opacity-0 group-hover/ev:opacity-100 hover:text-red-600 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                          <Plus size={16} className="text-indigo-300" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ADD EVENT OVERLAY MODAL */}
        {activeSlot && (
          <div className="absolute inset-0 z-10 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-4">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-black text-slate-800">Add Schedule Event</h3>
                  <p className="text-xs font-bold text-indigo-600">{activeSlot.day} @ {activeSlot.time}</p>
                </div>
                <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-5">
                {/* Event Type Selector */}
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

                    {/* Medication Clinical Details (Hover/Selected Card) */}
                    {selectedMed && (
                      <div className="mt-3 bg-rose-50 border border-rose-100 p-4 rounded-xl relative group">
                        <div className="flex items-center gap-2 mb-2 text-rose-600">
                          <Info size={16} />
                          <span className="font-bold text-sm">Clinical Details</span>
                        </div>
                        {STANDARD_MEDICATIONS.filter(m => m.name === selectedMed).map(m => (
                          <div key={m.name} className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                            <div className="text-rose-900/60 font-semibold">Dose:</div><div className="font-medium">{m.dose}</div>
                            <div className="text-rose-900/60 font-semibold">Freq:</div><div className="font-medium">{m.timePeriod}</div>
                            <div className="text-rose-900/60 font-semibold">Onset:</div><div className="font-medium">{m.onset}</div>
                            <div className="text-rose-900/60 font-semibold">Dur:</div><div className="font-medium">{m.duration}</div>
                            <div className="text-rose-900/60 font-semibold">Effect:</div><div className="font-medium line-clamp-1 group-hover:line-clamp-none">{m.effect}</div>
                            <div className="text-rose-900/60 font-semibold">Warnings:</div><div className="font-medium line-clamp-1 group-hover:line-clamp-none text-red-600">{m.contraindications}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">
                      {eventType === 'workout' ? 'Workout Details' : 'Task Details'}
                    </label>
                    <input 
                      type="text"
                      value={customInput}
                      onChange={(e) => setCustomInput(e.target.value)}
                      placeholder={eventType === 'workout' ? "e.g., Upper Body Power..." : "e.g., Team Practice"}
                      className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
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