import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, MapPin, X, ChevronLeft, ChevronRight } from 'lucide-react';

export interface GroupScheduleEvent {
  id: string;
  day: string;
  date?: string; // Added date string to pin events to specific days
  time: string;
  duration: number;
  type: 'practice' | 'appointment' | 'group' | 'other';
  title: string;
}

interface GroupScheduleProps {
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

export const GroupSchedule: React.FC<GroupScheduleProps> = ({
  scheduleEvents,
  onAddEvent,
  onRemoveEvent,
  isSavingSchedule
}) => {
  const [activeSlot, setActiveSlot] = useState<{ day: string, date: string, time: string } | null>(null);
  const [eventType, setEventType] = useState<'practice' | 'appointment' | 'group' | 'other'>('practice');
  const [eventDuration, setEventDuration] = useState<number>(1);
  const [eventTitle, setEventTitle] = useState('');

  // --- DYNAMIC DATES & INFINITE WEEKS LOGIC ---
  const [weekOffset, setWeekOffset] = useState(0);

  const weekData = useMemo(() => {
    const data = [];
    const curr = new Date();
    const day = curr.getDay();
    // Calculate Monday of the targeted week
    const diff = curr.getDate() - day + (day === 0 ? -6 : 1) + (weekOffset * 7);
    const monday = new Date(curr.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(monday);
      nextDay.setDate(monday.getDate() + i);
      
      const year = nextDay.getFullYear();
      const month = (nextDay.getMonth() + 1).toString().padStart(2, '0');
      const date = nextDay.getDate().toString().padStart(2, '0');
      
      data.push({
        dayName: DAYS[i],
        displayDate: `${month}/${date}`,
        fullDate: `${year}-${month}-${date}` // e.g. "2026-03-24"
      });
    }
    return data;
  }, [weekOffset]);

  // --- RESPONSIVE PAGINATION LOGIC ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [startIndex, setStartIndex] = useState(0);

  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      if (entries[0]) {
        setContainerWidth(entries[0].contentRect.width);
      }
    });
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  const MIN_DAY_WIDTH = 90; 
  const timeAxisWidth = 52; 
  const rightNavWidth = 40; 

  // Always reserve space for the right arrow so we can infinite scroll
  const availableWidth = containerWidth - timeAxisWidth - rightNavWidth;
  const calculatedVisibleDays = containerWidth === 0 ? 7 : Math.max(1, Math.floor(availableWidth / MIN_DAY_WIDTH));
  const visibleDays = Math.min(7, calculatedVisibleDays);

  useEffect(() => {
    if (startIndex + visibleDays > 7) {
      setStartIndex(Math.max(0, 7 - visibleDays));
    }
  }, [visibleDays, startIndex]);

  const handlePrev = () => {
    if (startIndex > 0) {
      setStartIndex(s => Math.max(0, s - 1));
    } else {
      setWeekOffset(w => w - 1);
      setStartIndex(7 - visibleDays); // Jump to end of previous week
    }
  };

  const handleNext = () => {
    if (startIndex < 7 - visibleDays) {
      setStartIndex(s => Math.min(7 - visibleDays, s + 1));
    } else {
      setWeekOffset(w => w + 1);
      setStartIndex(0); // Jump to start of next week
    }
  };

  const innerWidthPercent = (7 / visibleDays) * 100;
  const transformXPercent = -(startIndex / 7) * 100;

  const handleAddGroupEvent = () => {
    if (!activeSlot || !eventTitle.trim()) return;

    onAddEvent({
      day: activeSlot.day,
      date: activeSlot.date,
      time: activeSlot.time,
      duration: eventDuration,
      type: eventType,
      title: eventTitle.trim(),
    });

    setActiveSlot(null);
    setEventTitle('');
    setEventDuration(1);
  };

  return (
    <section className="flex-1 flex flex-col min-h-0 bg-white">
      <div 
        ref={containerRef} 
        className="flex-1 flex flex-col relative overflow-hidden min-h-0 bg-white"
      >
        <div className="flex-1 overflow-y-auto flex flex-col relative">
          
          {/* HEADER ROW - Fixed positioning */}
          <div className="flex border-b border-slate-200 bg-white text-center sticky top-0 z-40 h-16 shadow-sm">
            
            {/* Top-Left Corner: Time Spacer + Left Button */}
            <div className="w-13 shrink-0 border-r border-slate-200 bg-white relative flex items-center justify-center z-50">
              <button 
                onClick={handlePrev}
                className="absolute inset-0 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                title="Previous Days/Week"
              >
                <ChevronLeft size={20} strokeWidth={3} />
              </button>
            </div>
            
            {/* Sliding Header Days */}
            <div className="flex-1 overflow-hidden relative min-w-0 bg-white">
              <div 
                className="flex h-full transition-transform duration-300 ease-in-out"
                style={{ width: `${innerWidthPercent}%`, transform: `translateX(${transformXPercent}%)` }}
              >
                {weekData.map((dayInfo) => (
                  <div key={dayInfo.fullDate} className="flex-1 flex flex-col items-center justify-center border-r border-slate-200 last:border-0">
                    <span className="font-black text-slate-700 uppercase text-xs">{dayInfo.dayName}</span>
                    <span className="text-[10px] font-bold text-slate-400 mt-0.5">{dayInfo.displayDate}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top-Right Corner: Right Button */}
            <div className="w-10 shrink-0 border-l border-slate-200 bg-white relative flex items-center justify-center z-50">
              <button 
                onClick={handleNext}
                className="absolute inset-0 flex items-center justify-center bg-emerald-50 hover:bg-emerald-100 text-emerald-600 transition-colors"
                title="Next Days/Week"
              >
                <ChevronRight size={20} strokeWidth={3} />
              </button>
            </div>
          </div>

          {/* GRID BODY */}
          <div className="flex relative bg-white" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
            {/* Time Axis */}
            <div className="w-13 shrink-0 border-r border-slate-200 bg-white relative z-10">
              {HOURS.map(time => (
                <div key={time} className="absolute w-full flex items-start justify-center text-[10px] font-bold text-slate-400 pt-1" style={{ top: timeToPx(time), height: HOUR_HEIGHT }}>
                  {time}
                </div>
              ))}
            </div>

            {/* Sliding Grid Area */}
            <div className="flex-1 overflow-hidden relative min-w-0">
              <div 
                className="flex absolute inset-0 transition-transform duration-300 ease-in-out"
                style={{ width: `${innerWidthPercent}%`, transform: `translateX(${transformXPercent}%)` }}
              >
                {weekData.map(dayInfo => {
                  // Fallback match for legacy data (day matches) or exact match for new date-bound data
                  const dayEvents = scheduleEvents.filter(e => e.date ? e.date === dayInfo.fullDate : e.day === dayInfo.dayName);
                  return (
                    <div key={dayInfo.fullDate} className="flex-1 border-r border-slate-100 last:border-0 relative h-full">
                      {HOURS.map((_, i) => (
                        <div key={i} className="absolute w-full border-t border-slate-100 hover:bg-emerald-50/50 cursor-pointer group transition-colors"
                             style={{ top: i * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                             onClick={() => setActiveSlot({ day: dayInfo.dayName, date: dayInfo.fullDate, time: `${i.toString().padStart(2, '0')}:00` })}>
                          <div className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center pointer-events-none">
                            <Plus size={16} className="text-emerald-400" />
                          </div>
                        </div>
                      ))}

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

            {/* Empty Right Column mapping directly under the Next button space */}
            <div className="w-10 shrink-0 border-l border-slate-100 bg-white relative z-10"></div>
          </div>
        </div>
      </div>

      {/* ADD EVENT MODAL */}
      {activeSlot && (
        <div className="absolute inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in slide-in-from-bottom-4">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-800">Add Group Event</h3>
                <p className="text-xs font-bold text-emerald-600">{activeSlot.day} ({activeSlot.date}) @ {activeSlot.time}</p>
              </div>
              <button onClick={() => setActiveSlot(null)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-full text-slate-500">
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5">
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