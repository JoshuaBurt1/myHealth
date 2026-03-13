import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { 
  MessageSquarePlus, X, BarChart2, Plus, Type, FileText, MapPin, Globe
} from 'lucide-react';
import { PostCard } from '../forumComponents/PostCard';
import type { Post, TabItem } from '../forumComponents/forum';

// --- Map Imports ---
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const tabs: TabItem[] = [
  { id: 'post', label: 'Post', icon: <Type size={16} /> },
  { id: 'poll', label: 'Poll', icon: <BarChart2 size={16} /> },
  { id: 'petition', label: 'Petition', icon: <FileText size={16} /> }
];

const HAZARD_TYPES = [
  "Food contamination", 
  "Water contamination", 
  "Biological event", 
  "Radiation", 
  "Toxic gas", 
  "War zone", 
  "Gang activity",
  "Substance abuse", 
  "Medication side-effect",
  "Extreme environment"
];

const HAZARD_COLORS: Record<string, string> = {
  "Food contamination": "#f97316",    // Orange
  "Water contamination": "#0ea5e9",   // Sky Blue
  "Biological event": "#84cc16",      // Lime
  "Radiation": "#a855f7",             // Purple
  "Toxic gas": "#eab308",             // Yellow
  "War zone": "#ef4444",              // Red
  "Gang activity": "#1e293b",         // Slate/Dark
  "Substance abuse": "#6366f1",       // Indigo
  "Medication side-effect": "#f43f5e", // Rose/Pink
  "Extreme environment": "#06b6d4"    // Cyan
};

// Helper component to dynamically change map zoom based on the slider, 
// and pan to user location ONLY when it first loads (so it remains scrollable).
const MapController = ({ userLocation, zoom }: { userLocation: [number, number] | null; zoom: number }) => {
  const map = useMap();
  
  // Update zoom when radius slider changes
  useEffect(() => {
    map.setZoom(zoom);
  }, [zoom, map]);

  // Jump to user location once it is acquired
  useEffect(() => {
    if (userLocation) {
      map.panTo(userLocation);
    }
  }, [userLocation, map]);

  return null;
};

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
  const [radius, setRadius] = useState(20000); // Max 20000km for "Global"
  
  const user = auth.currentUser;

  // Calculate dynamic map zoom from radius
  const mapZoom = Math.max(2, Math.round(15 - Math.log2(radius === 20000 ? 50000 : radius)));

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
    // Narrow down to post type before checking hazard
    const matchesHazard = filterHazard === 'none' || (post.type === 'post' && post.hazard?.type === filterHazard); 
    let matchesLocation = true;

    if (userLocation && post.location && radius < 20000) {
      const [postLat, postLng] = post.location;
      const [userLat, userLng] = userLocation;
      const latDiff = postLat - userLat;
      const lngDiff = postLng - userLng;
      const distInDegrees = Math.sqrt(Math.pow(latDiff, 2) + Math.pow(lngDiff, 2));
      const radiusInDegrees = radius * 0.009; // Approx 1km = 0.009 degrees
      matchesLocation = distInDegrees <= radiusInDegrees;
    }
    
    return matchesHazard && matchesLocation;
  });

  const GRID_SIZE = 0.05;
  const gridCells = useMemo(() => {
    const cells: Record<string, any> = {};
    filteredPosts.forEach(post => {
      // Safely check type before iterating confirm
      if (post.type !== 'post' || !post.confirm || !Array.isArray(post.confirm)) return;

      post.confirm.forEach((c: any) => { 
        if (!c.location) return;
        const [lat, lng] = c.location;
        const gridX = Math.floor(lat / GRID_SIZE);
        const gridY = Math.floor(lng / GRID_SIZE);
        const key = `${gridX}_${gridY}`;

        if (!cells[key]) {
          cells[key] = {
            bounds: [
              [gridX * GRID_SIZE, gridY * GRID_SIZE], 
              [(gridX + 1) * GRID_SIZE, (gridY + 1) * GRID_SIZE]
            ],
            count: 0,
            types: new Set<string>()
          };
        }
        cells[key].count += 1;
        if (post.hazard?.type) cells[key].types.add(post.hazard.type);
      });
    });
    return Object.values(cells);
  }, [filteredPosts]);

  const handleCreate = async () => {
    if (!user) return alert("Please log in!");

    try {
      const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      const realName = profileSnap.exists() ? profileSnap.data().name : "Anonymous";

      // Base data shared by every single post type
      const commonData = {
        authorId: user.uid,
        authorName: realName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        likes: [],
        dislikes: [],
        replyCount: 0,
      };

      if (modalMode === 'post') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        
        const postData: any = {
          ...commonData,
          title: postTitle,
          content: newPostContent,
          type: 'post',
        };

        // Rule: Only add hazard and confirm if a hazard is actually being reported
        if (hazardType && hazardValue.trim()) {
          const confirmLocation = postLocation || userLocation;
          
          postData.hazard = {
            type: hazardType,
            value: hazardValue.trim()
          };
          postData.confirm = confirmLocation ? [{ 
            userId: user.uid, 
            location: confirmLocation,
            confirmTime: Timestamp.now() 
          }] : [];
        }

        if (postLocation) postData.location = postLocation;

        await addDoc(collection(db, 'myHealth_posts'), postData);

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
      console.error("Error creating post:", err);
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
          
          <button 
            onClick={() => setIsModalOpen(true)} 
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 lg:px-6 lg:py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 whitespace-nowrap"
          >
            <MessageSquarePlus size={20} />
            <span className="hidden sm:inline">Create</span>
            <span className="sm:hidden text-sm">Create</span>
          </button>
        </header>

        <div className="space-y-4">
          {filteredPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {/* SIDEBAR COLUMN */}
      <div className="w-full lg:w-96 order-1 lg:order-2">
        <div className="lg:sticky lg:top-4 space-y-6 h-fit">
          
          {/* COMMUNITY PULSE CARD */}
          <div className="bg-linear-to-br from-indigo-600 to-violet-700 p-5 rounded-3xl shadow-lg text-white">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2"> Community Pulse</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/5">
                <span className="block text-2xl font-black">{filteredPosts.length}</span>
                <span className="text-[10px] font-bold uppercase opacity-60">Active Now</span>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/5">
                <span className="block text-2xl font-black">
                  {/* Safely narrow down to hazard posts */}
                  {filteredPosts.filter(p => p.type === 'post' && p.hazard).length} 
                </span>
                <span className="text-[10px] font-bold uppercase opacity-60">Hazards</span>
              </div>
            </div>
          </div>

          {/* FILTER DISCOVERY & MAP CARD */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-50 bg-slate-50/50 shrink-0">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Globe size={14} className="text-indigo-500" /> Filter Discovery
              </h3>
            </div>

            <div className="p-6 space-y-6">
              {/* INTEGRATED MAP VIEW */}
              <div className="relative h-64 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner z-0">
                <MapContainer 
                  center={userLocation || [20, 0]} 
                  zoom={mapZoom} 
                  style={{ height: "100%", width: "100%", zIndex: 0 }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; OpenStreetMap'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  />
                  
                  <MapController userLocation={userLocation} zoom={mapZoom} />
                  
                  {/* 1. RENDER WARNING AREA GRID */}
                  {gridCells.map((cell: any, idx: number) => {
                    let color = cell.count > 5 ? '#ef4444' : cell.count >= 3 ? '#f97316' : '#fbbf24';
                    let levelText = cell.count > 5 ? 'Severe' : cell.count >= 3 ? 'Elevated' : 'Low';

                    return (
                      <Rectangle
                        key={`grid-${idx}`}
                        bounds={cell.bounds}
                        pathOptions={{ color: color, weight: 1, fillOpacity: 0.15 }}
                      >
                        <Popup className="font-sans">
                          <div className="min-w-35">
                            <div className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-widest border-b pb-1">
                              Area Warning Level
                            </div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm font-bold text-slate-700">Severity:</span>
                              <span className="text-sm font-black" style={{ color }}>{levelText}</span>
                            </div>
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-semibold text-slate-600">Reports:</span>
                              <span className="text-xs font-bold bg-slate-100 px-1.5 rounded">{cell.count}</span>
                            </div>
                            <p className="text-[10px] font-semibold text-slate-500 italic mt-2">
                              Hazards: {Array.from(cell.types).join(', ')}
                            </p>
                          </div>
                        </Popup>
                      </Rectangle>
                    );
                  })}

                  {/* 2. RENDER MULTIPLE OCCURRENCE MARKERS */}
                  {filteredPosts.map((post) => {
                    // Type guard ensures post is a StandardPost before checking hazard and confirm
                    if (post.type !== 'post' || !post.hazard?.type || !post.confirm) return null; 
                    const hazardColor = HAZARD_COLORS[post.hazard.type] || '#94a3b8'; 

                    return post.confirm.map((c: any, idx: number) => ( 
                      <CircleMarker 
                        key={`${post.id}-conf-${idx}`}
                        center={c.location as [number, number]} 
                        radius={4} 
                        pathOptions={{ 
                          color: 'white', 
                          fillColor: hazardColor, 
                          fillOpacity: 0.7, 
                          weight: 1.5 
                        }}
                      >
                        <Popup className="font-sans">
                          <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: hazardColor }}>
                            {post.hazard?.type} 
                          </span>
                          <strong className="text-slate-800 text-sm">{post.title}</strong>
                          <div className="text-xs text-slate-500 italic mt-1">Community Confirmed</div>
                        </Popup>
                      </CircleMarker>
                    ));
                  })}

                  {userLocation && (
                    <CircleMarker 
                      center={userLocation} 
                      radius={5} 
                      pathOptions={{ color: 'white', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
                    >
                      <Popup className="font-sans font-bold text-slate-800">You are here</Popup>
                    </CircleMarker>
                  )}
                </MapContainer>

                <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-200 shadow-sm z-400 pointer-events-none flex justify-center">
                  <div className="flex items-center gap-1">
                      <Globe size={10} className="text-slate-400" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase">
                        {radius === 20000 ? "Global Overview" : `${radius}km Radius Area`}
                      </span>
                  </div>
                </div>
              </div>

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

                  {HAZARD_TYPES.map(type => {
                    const isActive = filterHazard === type;
                    const activeColor = HAZARD_COLORS[type];

                    return (
                      <button 
                        key={type}
                        onClick={() => setFilterHazard(isActive ? "" : type)}
                        style={{
                          backgroundColor: isActive ? activeColor : undefined,
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          isActive 
                            ? 'text-white shadow-md' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL OVERLAY */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 relative shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setModalMode(tab.id as 'post' | 'poll' | 'petition')}
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

              {modalMode === 'post' && (
                <div className="space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    Hazard Reporting
                  </label>
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
              )}
              
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