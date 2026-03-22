// GroupScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, orderBy, onSnapshot, addDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { 
  ArrowLeft, Send, Users, Loader2, CalendarDays, Info, 
  Clock, LogOut, Settings, MessageSquare, ShieldCheck, Activity, BarChart2 
} from 'lucide-react';
import type { Group, GroupMessage as Message, GroupTabType as TabType } from '../componentsProfile/group';

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

export const GroupScreen: React.FC = () => {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('messages');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (activeTab === 'messages') {
      scrollToBottom();
    }
  }, [messages, activeTab]);

  // Mark this group as "Read" to clear notifications when viewing
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !groupId) return;

    const updateReadReceipt = async () => {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        [`last_read_group_${groupId}`]: serverTimestamp()
      }, { merge: true });
    };

    updateReadReceipt();
  }, [groupId]); 

  useEffect(() => {
    const currentUid = auth.currentUser?.uid;
    if (!groupId || !currentUid) return;

    const fetchGroupAndMessages = async () => {
      try {
        const groupRef = doc(db, 'myHealth_groups', groupId);
        const groupSnap = await getDoc(groupRef);
        
        if (groupSnap.exists()) {
          const data = groupSnap.data() as Group;
          if (!data.memberUids.includes(currentUid)) {
            navigate('/');
            return;
          }
          setGroup(data);
        } else {
          navigate('/');
          return;
        }

        const messagesRef = collection(db, 'myHealth_groups', groupId, 'messages');
        const q = query(messagesRef, orderBy('createdAt', 'asc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const msgs = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          } as Message));
          setMessages(msgs);
          setIsLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error("Error:", error);
        setIsLoading(false);
      }
    };

    fetchGroupAndMessages();
  }, [groupId, navigate]);

  const getMemberDisplayName = (userId: string) => {
    const member = group?.members.find(m => m.userId === userId);
    return member ? member.display_name : 'Unknown User';
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

    // 1. Create the message
    const messagePromise = addDoc(messagesRef, {
      text: newMessage.trim(),
      authorId: user.uid,
      authorName: getMemberDisplayName(user.uid), 
      createdAt: serverTimestamp()
    });

    // 2. Update parent Group metadata
    const groupUpdatePromise = updateDoc(groupRef, {
      lastUpdated: serverTimestamp(),
      lastUpdatedBy: user.uid
    });

    // 3. Update user read receipt & login info
    const userUpdatePromise = setDoc(userRef, {
      last_login: serverTimestamp(),
      [`last_read_group_${groupId}`]: serverTimestamp()
    }, { merge: true });

    // Execute all updates in parallel for better performance
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
    <div className="flex h-screen max-h-screen bg-slate-50 overflow-hidden">

      {/* Left Vertical Tab Bar */}
      <nav className="w-20 md:w-24 bg-white border-r border-slate-200 flex flex-col items-center py-6 shrink-0 z-20 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-3 mb-8 hover:bg-slate-100 rounded-xl transition-colors text-slate-500">
          <ArrowLeft size={24} />
        </button>
        
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

      <div className="flex-1 flex flex-col min-w-0 h-full">
        {/* Header Area */}
        <header className="bg-white border-b border-slate-200 shadow-sm z-10 px-6 py-4 shrink-0">
          <div className="max-w-7xl mx-auto flex justify-between items-center mb-4">
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                  <Users className="text-emerald-500" size={20} /> {group.name}
                </h1>
                <p className="text-xs text-slate-400">{group.memberUids.length} members</p>
              </div>
            </div>
            
            <button 
              onClick={() => setShowSidebar(!showSidebar)}
              className={`p-2 rounded-full transition-colors ${showSidebar ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-slate-100 text-slate-500'}`}
            >
              <Info size={24} />
            </button>
          </div>
          
          {/* Horizontal Member Dashboard */}
          <div className="max-w-7xl mx-auto flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {group.members.map((member) => {
              const colorClasses = getUserColor(member.userId);
              const isCreator = member.userId === group.createdBy;
              
              return (
                <div 
                  key={member.userId} 
                  onClick={() => navigate(`/profile/${member.userId}`)}
                  className={`shrink-0 flex items-center gap-2 border rounded-full px-3 py-1.5 cursor-pointer hover:shadow-md transition-all ${colorClasses}`}
                >
                  <div className="w-6 h-6 rounded-full bg-white/50 flex items-center justify-center font-bold text-[10px] relative">
                    {member.display_name.charAt(0).toUpperCase()}
                    {isCreator && (
                      <div className="absolute -top-1 -right-1 bg-white rounded-full">
                        <ShieldCheck size={10} className="text-emerald-500 fill-white" />
                      </div>
                    )}
                  </div>
                  <span className="text-xs font-bold truncate max-w-25">
                    {member.display_name}
                  </span>
                </div>
              );
            })}
          </div>
        </header>

        {/* Main Content Layout */}
        <main className="flex-1 flex overflow-hidden w-full relative">
          
          {/* View Container */}
          <div className="flex-1 flex flex-col min-w-0 bg-slate-50 h-full">
            
            {/* --- MESSAGES TAB --- */}
            {activeTab === 'messages' && (
              <section className="flex-1 flex flex-col min-h-0"> 
                {/* 1. Scrollable Messages Area - Now truly flexible */}
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

                {/* 2. Fixed Input Area - Removed "absolute", added "shrink-0" */}
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
              <section className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto w-full">
                  <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <CalendarDays className="text-emerald-500" /> Group Schedule
                  </h2>
                  <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
                    <CalendarDays size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="font-medium text-slate-600">No events scheduled yet.</p>
                    <p className="text-sm mt-2">Sync up with your group to add workouts, runs, or events.</p>
                    <button className="mt-6 px-6 py-2.5 bg-emerald-100 text-emerald-700 font-bold rounded-xl hover:bg-emerald-200 transition-colors">
                      + Add Group Event
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* --- COMPARE TAB --- */}
            {activeTab === 'compare' && (
              <section className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6">
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

          {/* Right Amenities Sidebar */}
          {showSidebar && (
            <aside className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 overflow-y-auto animate-in slide-in-from-right-10 duration-300 shadow-2xl md:shadow-none absolute md:relative right-0 h-full z-20">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div>
                  <h2 className="font-bold text-slate-800">Group Amenities</h2>
                  <p className="text-xs text-slate-500">Manage your squad goals</p>
                </div>
                <button className="md:hidden p-2 text-slate-400" onClick={() => setShowSidebar(false)}>
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <CalendarDays size={14} /> Upcoming Events
                  </h3>
                  <div className="space-y-3">
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>
                      <p className="text-sm font-bold text-slate-700">Team Sync</p>
                      <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1 mt-1">
                        <Clock size={12} /> Today, 2:00 PM
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Actions</h3>
                  <div className="space-y-2">
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors">
                      <Settings size={18} /> Group Settings
                    </button>
                    <button className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors">
                      <LogOut size={18} /> Leave Group
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          )}
        </main>
      </div>
    </div>
  );
};