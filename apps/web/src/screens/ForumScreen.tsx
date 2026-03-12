import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { 
  MessageSquarePlus, X, BarChart2, Plus, Type, FileText, MapPin
} from 'lucide-react';
import { PostCard } from '../forumComponents/PostCard';
import type { Post, TabItem } from '../forumComponents/forum';

const tabs: TabItem[] = [
  { id: 'post', label: 'Post', icon: <Type size={16} /> },
  { id: 'poll', label: 'Poll', icon: <BarChart2 size={16} /> },
  { id: 'petition', label: 'Petition', icon: <FileText size={16} /> }
];

const HAZARD_TYPES = [
  "Food contamination", "Biological event", "Radiation", 
  "Toxic gas", "War zone", "Substance abuse", "Extreme environment"
];

const ForumScreen: React.FC = () => {
  const { userLocation, locationError } = useLocation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'post' | 'poll' | 'petition'>('post');
  const [postTitle, setPostTitle] = useState(''); 
  const [newPostContent, setNewPostContent] = useState('');
  const [pollContent, setPollContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [postLocation, setPostLocation] = useState<[number, number] | null>(null);

  // Hazards & Filtering
  const [hazardType, setHazardType] = useState('');
  const [hazardValue, setHazardValue] = useState('');
  const [filterHazard, setFilterHazard] = useState('none');
  const [radius, setRadius] = useState(20000);
  
  const user = auth.currentUser;

  useEffect(() => {
    const q = query(collection(db, 'myHealth_posts'), orderBy('lastUpdated', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredPosts = posts.filter(post => {
    const matchesHazard = filterHazard === 'none' || post.hazard?.type === filterHazard;
    let matchesLocation = true;

    if (userLocation && post.location && radius < 20000) {
      const [postLat, postLng] = post.location;
      const [userLat, userLng] = userLocation;
      const latDiff = postLat - userLat;
      const lngDiff = postLng - userLng;
      const distInDegrees = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
      const radiusInDegrees = radius * 0.009;
      matchesLocation = distInDegrees <= radiusInDegrees;
    }
    
    return matchesHazard && matchesLocation;
  });

  const handleCreate = async () => {
    if (!user) return alert("Please log in!");
    
    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      const commonData: any = {
        authorId: user.uid,
        authorName: realName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        likes: [],
        dislikes: [],
        replyCount: 0,
      };

      if (hazardType && hazardValue.trim()) {
        commonData.hazard = {
          type: hazardType,
          value: hazardValue.trim()
        };
      }

      if (postLocation) commonData.location = postLocation;

      if (modalMode === 'post') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        await addDoc(collection(db, 'myHealth_posts'), {
          ...commonData,
          title: postTitle,
          content: newPostContent,
          type: 'post',
        });
      } else if (modalMode === 'poll') {
        if (!pollContent.trim() || pollOptions.some(opt => !opt.trim())) {
            return alert("Please provide a question and fill all option fields.");
        }
        await addDoc(collection(db, 'myHealth_posts'), {
          ...commonData,
          title: postTitle,
          content: pollContent,
          type: 'poll',
          options: pollOptions.map(text => ({ text, votes: 0 })),
          userVotes: {} 
        });
      } else if (modalMode === 'petition') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        await addDoc(collection(db, 'myHealth_posts'), {
          ...commonData,
          title: postTitle,
          content: newPostContent,
          type: 'petition',
          signatures: [],
        });
      }

      resetModal();
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const handleTogglePostLocation = () => {
    if (postLocation) {
      setPostLocation(null);
    } else {
      if (!userLocation) return alert("Location not available. Check permissions.");
      setPostLocation(userLocation);
    }
  };

  const resetModal = () => {
    setPostTitle('');
    setNewPostContent('');
    setPollContent('');
    setPollOptions(['', '']);
    setPostLocation(null);
    setHazardType('');
    setHazardValue('');
    setIsModalOpen(false);
    setModalMode('post');
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 bg-slate-50 min-h-screen pb-24 max-w-7xl mx-auto">
      {/* MAIN FEED */}
      <div className="flex-1 max-w-2xl w-full mx-auto lg:mx-0">
        <header className="mb-8 flex flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight">Community Forum</h1>
            <p className="text-slate-500 mt-1 text-sm lg:text-base">Engage with local health initiatives.</p>
          </div>
          
          {/* NEW IN-LINE CREATE BUTTON */}
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 lg:px-6 lg:py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
          >
            <MessageSquarePlus size={20} />
            <span className="hidden sm:inline">Create Post</span>
            <span className="sm:hidden text-sm">Create</span>
          </button>
        </header>

        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* SIDEBAR */}
      <aside className="w-full lg:w-80 space-y-6 order-1 lg:order-2">
        <div className="lg:sticky lg:top-6 space-y-6">
          
          {/* COMMUNITY PULSE CARD */}
          <div className="bg-linear-to-br from-indigo-600 to-violet-700 p-4 lg:p-5 rounded-3xl shadow-lg text-white">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-2 lg:mb-4">Community Pulse</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-2 lg:p-3 rounded-2xl backdrop-blur-md">
                <span className="block text-xl lg:text-2xl font-black">{filteredPosts.length}</span>
                <span className="text-[9px] lg:text-[10px] font-bold uppercase opacity-60">Active Now</span>
              </div>
              <div className="bg-white/10 p-2 lg:p-3 rounded-2xl backdrop-blur-md">
                <span className="block text-xl lg:text-2xl font-black">
                  {filteredPosts.filter(p => p.hazard).length}
                </span>
                <span className="text-[9px] lg:text-[10px] font-bold uppercase opacity-60">Hazards</span>
              </div>
            </div>
          </div>

          {/* FILTER CARD */}
          <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400">Filter Discovery</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                  <MapPin size={14} className="text-indigo-500" /> Nearby Range
                </label>
                <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                  {radius === 20000 ? "Global" : `${radius}km`}
                </span>
              </div>
              
              {userLocation ? (
                <input 
                  type="range"
                  min="5"
                  max="20000"
                  step="5"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              ) : (
                <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-3 rounded-xl border border-amber-100">
                  {locationError ? `Error: ${locationError}` : "Enable location to filter"}
                </div>
              )}
            </div>

            <hr className="border-slate-50" />

            <div className="space-y-3">
              <label className="text-xs font-bold text-slate-600">Active Alert Types</label>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setFilterHazard('none')}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                    filterHazard === 'none' 
                      ? 'bg-slate-900 text-white shadow-md' 
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  All Posts
                </button>

                {HAZARD_TYPES.map(type => (
                  <button 
                    key={type}
                    onClick={() => setFilterHazard(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      filterHazard === type 
                        ? 'bg-red-500 text-white shadow-md shadow-red-200' 
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setModalMode(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-bold transition-all ${
                    modalMode === tab.id ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Title</label>
                <input 
                  autoFocus
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500 font-bold text-slate-800 text-lg"
                  placeholder={modalMode === 'petition' ? "Petition Title" : modalMode === 'poll' ? "Poll Topic" : "Post Title"}
                  value={postTitle}
                  onChange={(e) => setPostTitle(e.target.value)}
                />
              </div>

              {modalMode === 'poll' ? (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Content</label>
                    <input 
                      className="w-full bg-indigo-50/30 border border-slate-200 p-4 rounded-2xl outline-none focus:border-indigo-500 font-normal text-slate-600"
                      placeholder="Ask a question..."
                      value={pollContent}
                      onChange={(e) => setPollContent(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    {pollOptions.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 group">
                        <input 
                          className="flex-1 border border-slate-200 p-3 rounded-xl outline-none focus:border-indigo-500 text-sm font-normal text-slate-600 bg-white"
                          placeholder={`Option ${i + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...pollOptions];
                            newOpts[i] = e.target.value;
                            setPollOptions(newOpts);
                          }}
                        />
                        {pollOptions.length > 2 && (
                          <button 
                            onClick={() => {
                              const newOpts = pollOptions.filter((_, index) => index !== i);
                              setPollOptions(newOpts);
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <X size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {pollOptions.length < 5 && (
                    <button 
                      onClick={() => setPollOptions([...pollOptions, ''])} 
                      className="text-indigo-600 text-xs font-bold flex items-center gap-1 mt-1"
                    >
                      <Plus size={14} /> Add Option
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Content</label>
                  <textarea 
                    className="w-full border border-slate-200 bg-slate-50 rounded-xl p-3 outline-none min-h-32 resize-none font-normal text-slate-600 leading-relaxed"
                    placeholder={modalMode === 'petition' ? "Describe the goal..." : "What's on your mind?"}
                    value={newPostContent}
                    onChange={(e) => setNewPostContent(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Hazard Reporting</label>
                <div className="flex flex-col gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                  <select 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600"
                    value={hazardType}
                    onChange={(e) => setHazardType(e.target.value)}
                  >
                    <option value="">Select Hazard Type...</option>
                    {HAZARD_TYPES.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input 
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-600"
                    placeholder="Specific details..."
                    value={hazardValue}
                    onChange={(e) => setHazardValue(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-bold">
                  <MapPin size={18} className={postLocation ? "text-emerald-500" : "text-slate-400"} />
                  {postLocation ? "Location Attached" : "Attach Location"}
                </div>
                <button 
                  onClick={handleTogglePostLocation}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${postLocation ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
                >
                  {postLocation ? "Remove" : "Add"}
                </button>
              </div>
            </div>

            <div className="flex gap-3 mt-8">
              <button onClick={resetModal} className="flex-1 py-3 text-slate-500 bg-slate-100 rounded-xl font-bold">Cancel</button>
              <button onClick={handleCreate} className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700">
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ForumScreen;