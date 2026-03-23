// src/componentsGroup/ModalGroupSchedule.tsx
import React, { useState } from 'react';
import { CalendarDays, Plus, MapPin, X } from 'lucide-react';

export interface GroupScheduleEvent {
  id: string;
  day: string;
  time: string;
  duration: number;
  type: 'practice' | 'appointment' | 'group' | 'other';
  title: string;
}

interface ModalGroupScheduleProps {
  scheduleEvents: GroupScheduleEvent[];
  onAddEvent: (event: Omit<GroupScheduleEvent, 'id'>) => void;
  onRemoveEvent: (id: string, e: React.MouseEvent) => void;
  isSavingSchedule: boolean;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
const HOUR_HEIGHT = 60; // pixels per hour

const timeToPx = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return (h + (m || 0) / 60) * HOUR_HEIGHT;
};

export const ModalGroupSchedule: React.FC<ModalGroupScheduleProps> = ({
  scheduleEvents,
  onAddEvent,
  onRemoveEvent,
  isSavingSchedule
}) => {
  const [activeSlot, setActiveSlot] = useState<{ day: string, time: string } | null>(null);
  const [eventType, setEventType] = useState<'practice' | 'appointment' | 'group' | 'other'>('practice');
  const [eventDuration, setEventDuration] = useState<number>(1);
  const [eventTitle, setEventTitle] = useState('');

  const handleAddGroupEvent = () => {
    if (!activeSlot || !eventTitle.trim()) return;

    onAddEvent({
      day: activeSlot.day,
      time: activeSlot.time,
      duration: eventDuration,
      type: eventType,
      title: eventTitle.trim(),
    });

    // Reset internal state
    setActiveSlot(null);
    setEventTitle('');
    setEventDuration(1);
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto w-full h-full flex flex-col">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarDays className="text-emerald-500" /> Group Schedule
          </h2>
          <div className="text-sm font-semibold text-slate-500 bg-slate-200/50 px-4 py-2 rounded-xl">
            Events sync to all members' personal schedules automatically.
          </div>
        </div>

        {/* SCHEDULE GRID */}
        <div className="flex-1 overflow-y-auto border border-slate-200 rounded-2xl bg-white shadow-sm flex flex-col relative">
          
          {/* Header Row - Z-INDEX INCREASED TO 40 */}
          <div className="flex border-b border-slate-200 bg-slate-100 text-center sticky top-0 z-40">
            <div className="w-20 shrink-0 border-r border-slate-200 p-3 bg-slate-100" />
            {DAYS.map(day => (
              <div key={day} className="flex-1 p-3 font-black text-slate-700 uppercase text-sm border-r border-slate-200 last:border-0">
                {day}
              </div>
            ))}
          </div>

          {/* Grid Body */}
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
              const dayEvents = scheduleEvents.filter(e => e.day === day);
              return (
                <div key={day} className="flex-1 border-r border-slate-100 last:border-0 relative">
                  {/* Grid Lines */}
                  {HOURS.map((_, i) => (
                    <div key={i} className="absolute w-full border-t border-slate-100 hover:bg-emerald-50/50 cursor-pointer group transition-colors"
                         style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                         onClick={() => setActiveSlot({ day, time: `${i.toString().padStart(2, '0')}:00` })}>
                      <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none">
                        <Plus size={16} className="text-emerald-400" />
                      </div>
                    </div>
                  ))}

                  {/* Render Group Events */}
                  {dayEvents.map(ev => (
                    <div 
                      key={ev.id}
                      className="absolute left-1 right-1 rounded-lg border p-2 overflow-hidden group/ev shadow-sm transition-all hover:z-30 hover:shadow-md bg-amber-100 text-amber-800 border-amber-300 flex flex-col"
                      style={{ 
                        top: timeToPx(ev.time), 
                        height: Math.max(ev.duration * HOUR_HEIGHT - 2, 24),
                        zIndex: 20 
                      }}
                    >
                      <div className="flex items-start justify-between">
                        <span className="text-xs font-bold leading-tight line-clamp-2 pr-4">{ev.title}</span>
                        <button 
                          onClick={(e) => onRemoveEvent(ev.id, e)}
                          className="opacity-0 group-hover/ev:opacity-100 hover:text-red-600 transition-opacity absolute right-2 top-2"
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center gap-1 text-[10px] font-bold opacity-70 uppercase tracking-wide">
                        <MapPin size={10} /> {ev.type}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ADD GROUP EVENT MODAL */}
      {activeSlot && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800">Add Group Event</h3>
                <p className="text-xs font-bold text-emerald-600">{activeSlot.day} @ {activeSlot.time}</p>
              </div>
              <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">
              {/* Event Type */}
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl overflow-x-auto no-scrollbar">
                {(['practice', 'appointment', 'group', 'other'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setEventType(type)}
                    className={`flex-none px-4 py-2 text-xs font-bold uppercase rounded-lg transition-all ${
                      eventType === type ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              {/* Duration Picker */}
              <div>
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Duration</label>
                 <select 
                    value={eventDuration} 
                    onChange={e => setEventDuration(Number(e.target.value))}
                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1"
                 >
                   {[0.5, 1, 1.5, 2, 3, 4, 5, 8].map(h => (
                     <option key={h} value={h}>{h} {h === 1 ? 'Hour' : 'Hours'}</option>
                   ))}
                 </select>
              </div>

              {/* Title Input */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block ml-1 mb-1">Event Name</label>
                <input 
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  placeholder="e.g., Team Scrimmage"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700 outline-none focus:border-emerald-500 focus:ring-1"
                  autoFocus
                />
              </div>

              <button 
                onClick={handleAddGroupEvent}
                disabled={isSavingSchedule}
                className="w-full py-4 bg-emerald-600 text-white rounded-xl font-black shadow-md hover:bg-emerald-700 active:scale-95 transition-all mt-4 disabled:opacity-50"
              >
                {isSavingSchedule ? 'SAVING...' : 'ADD TO GROUP SCHEDULE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};