// src/screens/GroupScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  ArrowLeft, Send, Users, Loader2, CalendarDays, Info, 
  MessageSquare, ShieldCheck, Activity, BarChart2,
  X, Clock, Settings, LogOut
} from 'lucide-react';

import type { Group, GroupMessage as Message, GroupTabType as TabType } from './componentsGroupScreen/group';
import { ModalGroupSchedule, type GroupScheduleEvent } from './componentsGroupScreen/GroupsSchedule';

const getUserColor = (userId: string) => {
  const colors = [
    'text-emerald-600 bg-emerald-100 border-emerald-200',
    'text-blue-600 bg-blue-100 border-blue-200',
    'text-purple-600 bg-purple-100 border-purple-200',
    'text-rose-600 bg-rose-100 border-rose-200',
    'text-amber-600 bg-amber-100 border-amber-200',
    'text-indigo-600 bg-indigo-100 border-indigo-200',
    'text-cyan-600 bg-cyan-100 border-cyan-200',
    'text-fuchsia-600 bg-fuchsia-100 border-fuchsia-200'
  ];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const GroupScreen: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  
  const [activeTab, setActiveTab] = useState<TabType | 'schedule' | 'compare'>('messages');
  const [scheduleEvents, setScheduleEvents] = useState<GroupScheduleEvent[]>([]);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (activeTab === 'messages' && messages.length > 0) {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !groupId) return;

    const updateReadReceipt = async () => {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, { [`last_read_group_${groupId}`]: serverTimestamp() }, { merge: true });
    };
    updateReadReceipt();
  }, [groupId]);

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!groupId || !currentUid) return;

    const groupRef = doc(db, 'myHealth_groups', groupId);

    const unsubscribeGroup = onSnapshot(groupRef, (groupSnap) => {
      if (groupSnap.exists()) {
        const data = groupSnap.data() as Group;

        if (!data.memberUids.includes(currentUid)) {
          navigate('/');
          return;
        }

        setGroup(data);
        if (data.schedule) setScheduleEvents(data.schedule);
      } else {
        navigate('/');
      }
    });

    const messagesRef = collection(db, 'myHealth_groups', groupId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Message));

      setMessages(msgs);
      setIsLoading(false);
    });

    return () => {
      unsubscribeGroup();
      unsubscribeMessages();
    };

  }, [groupId, navigate]);

  const getMemberDisplayName = (userId: string) => {
    const member = group?.members.find(m => m.userId === userId);
    return member ? member.display_name : 'Unknown User';
  };

  const handleSaveGroupSchedule = async (updatedEvents: GroupScheduleEvent[]) => {
    setIsSavingSchedule(true);
    try {
        const groupRef = doc(db, 'myHealth_groups', groupId!);
        await updateDoc(groupRef, { schedule: updatedEvents });
        setScheduleEvents(updatedEvents);
    } catch (err) {
        console.error("Failed to update group schedule", err);
    } finally {
        setIsSavingSchedule(false);
    }
  };

  // Maps the payload from ModalGroupSchedule to Firestore requirements
  const handleAddGroupEvent = (eventData: Omit<GroupScheduleEvent, 'id'>) => {
      const newEvent: GroupScheduleEvent = {
          id: Date.now().toString(),
          ...eventData
      };
      handleSaveGroupSchedule([...scheduleEvents, newEvent]);
  };

  const handleRemoveGroupEvent = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      handleSaveGroupSchedule(scheduleEvents.filter(ev => ev.id !== id));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const user = auth.currentUser;
    if (!newMessage.trim() || !groupId || !user) return;

    setIsSending(true);
    try {
      const groupRef = doc(db, 'myHealth_groups', groupId);
      const messagesRef = collection(db, 'myHealth_groups', groupId, 'messages');
      const userRef = doc(db, 'users', user.uid);

      const messagePromise = addDoc(messagesRef, {
        text: newMessage.trim(),
        authorId: user.uid,
        authorName: getMemberDisplayName(user.uid), 
        createdAt: serverTimestamp()
      });

      const groupUpdatePromise = updateDoc(groupRef, {
        lastUpdated: serverTimestamp(),
        lastUpdatedBy: user.uid
      });

      const userUpdatePromise = setDoc(userRef, {
        last_login: serverTimestamp(),
        [`last_read_group_${groupId}`]: serverTimestamp()
      }, { merge: true });

      await Promise.all([messagePromise, groupUpdatePromise, userUpdatePromise]);

      setNewMessage('');
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Loader2 className="animate-spin text-emerald-500" size={40} />
    </div>
  );

  if (!group) return null;

  return (
    /* Outer Container: Set bg-white on mobile to remove bleed, md:bg-slate-50 for desktop */
    <div className="w-full md:max-w-7xl mx-auto p-0 md:p-6 bg-white md:bg-slate-50 min-h-screen relative">
      
      <div className="contents md:flex md:flex-col md:flex-1 md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 md:mt-2 md:overflow-hidden">
        
        <div className="h-20 md:h-24 border-b border-slate-100 flex items-center shrink-0 bg-white md:rounded-t-3xl w-full">
          
          {/* Header Left: Back Button (Aligned with Sidebar width, hidden on Desktop) */}
          <div className="w-20 md:w-24 flex justify-center border-r border-slate-100 h-full items-center">
            <button 
              onClick={() => navigate(-1)} 
              className="flex md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
              title="Go Back"
            >
              <ArrowLeft size={28} />
            </button>
          </div>

          {/* Header Right: Title, Members Dashboard, and Info Toggle */}
          <div className="flex-1 h-full px-4 md:px-6 flex justify-between items-center min-w-0 gap-4">
    
            {/* Title & Count - Removed restrictive max-w for full name visibility */}
            <div className="shrink-0 flex flex-col justify-center min-w-0">
              <h2 className="text-lg md:text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight min-w-0">
                <Users className="text-emerald-500 shrink-0 w-6 h-6 md:w-8 md:h-8" /> 
                <span className="whitespace-nowrap truncate">{group.name}</span>
              </h2>
              <p className="text-[10px] md:text-xs text-slate-400 font-medium">{group.memberUids.length} members</p>
            </div>

            {/* Horizontal Member Dashboard - Desktop Only (hidden on mobile) */}
            <div className="hidden md:flex flex-1 gap-2 overflow-x-auto items-center min-w-0 h-full py-2 custom-scrollbar">
              {group.members.map((member) => {
                const colorClasses = getUserColor(member.userId);
                const isCreator = member.userId === group.adminId;
                return (
                  <div 
                    key={member.userId} 
                    onClick={() => navigate(`/profile/${member.userId}`)}
                    className={`shrink-0 flex items-center gap-2 border rounded-full px-3 py-1.5 cursor-pointer hover:shadow-md transition-all ${colorClasses}`}
                  >
                    <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center font-bold text-[10px] relative shrink-0">
                      {member.display_name.charAt(0).toUpperCase()}
                      {isCreator && (
                        <div className="absolute -top-1 -right-1 bg-white rounded-full">
                          <ShieldCheck size={10} className="text-emerald-500 fill-white" />
                        </div>
                      )}
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap">{member.display_name}</span>
                  </div>
                );
              })}
            </div>

            {/* Info Toggle */}
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-full transition-colors shrink-0 ml-2 ${showSidebar ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <Info className="w-6 h-6 md:w-7 md:h-7" />
            </button>
          </div>
        </div>

        {/* --- SECTION 2: BODY (Sidebar + Content) --- */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* LEFT VERTICAL TAB BAR (Sidebar) */}
          <nav className="w-20 md:w-24 bg-white border-r border-slate-200 flex flex-col items-center py-6 shrink-0 z-20 shadow-[4px_0_15px_-10px_rgba(0,0,0,0.05)]">
            
            <div className="flex flex-col gap-4 w-full px-3">
              <button 
                onClick={() => setActiveTab('messages')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeTab === 'messages' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <MessageSquare size={24} className="mb-1" />
                <span className="text-[10px] font-bold">Chat</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('schedule')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeTab === 'schedule' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <CalendarDays size={24} className="mb-1" />
                <span className="text-[10px] font-bold">Schedule</span>
              </button>
              
              <button 
                onClick={() => setActiveTab('compare')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl transition-all ${
                  activeTab === 'compare' ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
                }`}
              >
                <BarChart2 size={24} className="mb-1" />
                <span className="text-[10px] font-bold">Compare</span>
              </button>
            </div>
          </nav>

          {/* MAIN CONTENT AREA */}
          <main className="flex-1 flex overflow-hidden w-full relative">
            
            {/* View Container */}
            <div className="flex-1 flex flex-col min-w-0 bg-slate-50 md:bg-transparent h-full">
              
              {/* --- MESSAGES TAB --- */}
              {activeTab === 'messages' && (
                <section className="flex-1 flex flex-col min-h-0"> 
                  <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
                    <div className="max-w-4xl mx-auto w-full space-y-6">
                      {messages.length === 0 ? (
                        <div className="text-center py-20 text-slate-400">
                          <MessageSquare size={48} className="mx-auto mb-4 opacity-20" />
                          <p className="font-medium">The conversation starts here.</p>
                        </div>
                      ) : (
                        messages.map((msg) => {
                          const isMine = msg.authorId === auth.currentUser?.uid;
                          const colorClasses = getUserColor(msg.authorId);
                          const textColor = colorClasses.split(' ')[0];
                          
                          return (
                            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                              {!isMine && (
                                <button 
                                  onClick={() => navigate(`/profile/${msg.authorId}`)}
                                  className={`text-xs font-bold mb-1 ml-2 hover:underline ${textColor}`}
                                >
                                  {getMemberDisplayName(msg.authorId)}
                                </button>
                              )}
                              
                              <div className="flex items-end gap-2 group max-w-[85%]">
                                <div className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm ${
                                  isMine 
                                    ? 'bg-emerald-600 text-white rounded-tr-none' 
                                    : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'
                                }`}>
                                  {msg.text}
                                </div>
                                <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap mb-1">
                                  {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          );
                        })
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </div>

                  <div className="shrink-0 p-4 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.05)]">
                    <div className="max-w-4xl mx-auto">
                      <form onSubmit={handleSendMessage} className="relative flex items-center">
                        <input
                          type="text"
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Message the group..."
                          className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-5 pr-14 py-3.5 shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                        />
                        <button 
                          type="submit" 
                          disabled={!newMessage.trim() || isSending}
                          className="absolute right-2 p-2.5 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 disabled:bg-slate-300 transition-colors shadow-sm"
                        >
                          {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                        </button>
                      </form>
                    </div>
                  </div>
                </section>
              )}

              {/* --- SCHEDULE TAB --- */}
              {activeTab === 'schedule' && (
                <section className="flex-1 flex flex-col min-h-0 overflow-y-auto relative">
                  <ModalGroupSchedule 
                    scheduleEvents={scheduleEvents}
                    onAddEvent={handleAddGroupEvent}
                    onRemoveEvent={handleRemoveGroupEvent}
                    isSavingSchedule={isSavingSchedule}
                  />
                </section>
              )}

              {/* --- COMPARE TAB --- */}
              {activeTab === 'compare' && (
                <section className="flex-1 flex flex-col min-h-0 overflow-y-auto p-4 md:p-6">
                  <div className="max-w-4xl mx-auto w-full">
                    <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <Activity className="text-emerald-500" /> Z-Score Comparisons
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                          <Activity size={18} className="text-blue-500"/> Exercise Z-Scores
                        </h3>
                        <div className="space-y-4">
                          {group.members.map(member => (
                            <div key={member.userId} className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-600">{member.display_name}</span>
                              <div className="flex-1 mx-4 h-2 bg-slate-100 rounded-full overflow-hidden flex items-center">
                                <div className="h-full bg-blue-400 rounded-full w-[60%]"></div>
                              </div>
                              <span className="text-xs font-bold text-slate-400">+1.2</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                          <Activity size={18} className="text-rose-500"/> Vitals Z-Scores
                        </h3>
                        <div className="space-y-4">
                          {group.members.map(member => (
                            <div key={member.userId} className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-600">{member.display_name}</span>
                              <div className="flex-1 mx-4 h-2 bg-slate-100 rounded-full overflow-hidden flex items-center">
                                <div className="h-full bg-rose-400 rounded-full w-[40%]"></div>
                              </div>
                              <span className="text-xs font-bold text-slate-400">-0.4</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </main>

          {/* Right Amenities Sidebar (Moved to SECTION 2 root to cover the nav bar on mobile) */}
          {showSidebar && (
            <aside className="absolute inset-0 z-50 flex h-full w-full flex-col shrink-0 overflow-y-auto bg-white animate-in slide-in-from-right-full duration-300 md:relative md:inset-auto md:w-80 md:border-l md:border-slate-200 md:shadow-none">
              
              {/* Sidebar Header */}
              <div className="p-4 md:p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center sticky top-0 z-10 w-full min-w-0">
                <div className="min-w-0">
                  <h2 className="font-bold text-slate-800 truncate">Group Amenities</h2>
                  <p className="text-xs text-slate-500 truncate">Manage your squad goals</p>
                </div>
                <button 
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors shrink-0" 
                  onClick={() => setShowSidebar(false)}
                >
                  <X size={24} />
                </button>
              </div>

              {/* Sidebar Content */}
              <div className="p-4 md:p-6 space-y-8 flex-1 w-full min-w-0">
                
                {/* Team Members Section */}
                <div className="lg:hidden"> 
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Users size={14} /> Team Members
                  </h3>
                  <div className="grid grid-cols-1 gap-2 w-full">
                    {group.members.map((member) => {
                      const colorClasses = getUserColor(member.userId);
                      const isCreator = member.userId === group.adminId;
                      return (
                        <div 
                          key={member.userId}
                          onClick={() => navigate(`/profile/${member.userId}`)}
                          className={`flex items-center justify-between p-3 rounded-2xl border cursor-pointer hover:shadow-sm transition-all min-w-0 ${colorClasses}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center font-bold text-xs shrink-0 relative">
                              {member.display_name.charAt(0).toUpperCase()}
                              {isCreator && (
                                <ShieldCheck size={12} className="absolute -top-1 -right-1 text-emerald-500 fill-white" />
                              )}
                            </div>
                            <span className="font-bold text-sm text-slate-700 truncate min-w-0">
                              {member.display_name}
                            </span>
                          </div>
                          {isCreator && (
                            <span className="shrink-0 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase ml-2">
                              Admin
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Upcoming Events Section */}
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CalendarDays size={14} /> Upcoming Today
                  </h3>
                  <div className="space-y-3 w-full">
                    {scheduleEvents.filter(e => e.day === DAYS[new Date().getDay() - 1 === -1 ? 6 : new Date().getDay() - 1]).length > 0 ? (
                      scheduleEvents
                        .filter(e => e.day === DAYS[new Date().getDay() - 1 === -1 ? 6 : new Date().getDay() - 1])
                        .map(ev => (
                          <div key={ev.id} className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl relative overflow-hidden group min-w-0">
                            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                            <p className="text-sm font-bold text-slate-700 truncate min-w-0">{ev.title}</p>
                            <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1 shrink-0">
                              <Clock size={12} /> {ev.time} ({ev.duration}h)
                            </p>
                          </div>
                        ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No events scheduled for today.</p>
                    )}
                  </div>
                </div>

                {/* Actions Section */}
                <div className="pb-10 md:pb-0">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                      <Settings size={18} className="shrink-0" /> <span className="truncate">Group Settings</span>
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                      <Users size={18} className="shrink-0" /> <span className="truncate">Manage Members</span>
                    </button>
                    <hr className="my-2 border-slate-100" />
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                      <LogOut size={18} className="shrink-0" /> <span className="truncate">Leave Group</span>
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
};