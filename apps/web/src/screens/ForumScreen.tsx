// ForumScreen.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, doc, getDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { useLocation } from '../context/LocationContext';
import { 
  MessageSquarePlus, BarChart2, Type, FileText, MapPin, Globe, Activity, Heart, Hash, Search, ChevronLeft, ChevronRight
} from 'lucide-react';
import { PostCard } from '../forumComponents/PostCard';
import type { Post, TabItem } from '../forumComponents/forum';
import { CreatePostModal } from '../forumComponents/CreatePostModal';

// --- Map Imports ---
import L from 'leaflet';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, Rectangle, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    iconRetinaUrl: markerIcon2x,
    shadowUrl: markerShadow,
    iconSize: [16, 26], 
    iconAnchor: [8, 26], 
    popupAnchor: [0, -26], 
    shadowSize: [26, 26] 
});

L.Marker.prototype.options.icon = DefaultIcon;

const tabs: TabItem[] = [
  { id: 'post', label: 'Post', icon: <Type size={16} /> },
  { id: 'poll', label: 'Poll', icon: <BarChart2 size={16} /> },
  { id: 'petition', label: 'Petition', icon: <FileText size={16} /> }
];

const FORUM_SECTIONS = [
  { id: 'Personal Health', icon: <Heart size={18} /> },
  { id: 'Population Health', icon: <Activity size={18} /> },
  { id: 'Off topic', icon: <Hash size={18} /> }
];

const HAZARD_TYPES = ["Food contamination", "Water contamination", "Biological hazard", "Chemical hazard", "Radiation", "Unsafe Area", "Medication side-effect", "Environmental event"];
const TOPIC_TYPES = ["Fitness", "Health product", "Medical", "Mental health", "Cessation groups"];

const HAZARD_COLORS: Record<string, string> = {
  "Food contamination": "#ef4444",     // Red
  "Water contamination": "#3333ff",    // Indigo
  "Biological hazard": "#84cc16",      // Lime
  "Chemical hazard": "#eab308",        // Yellow
  "Radiation": "#a855f7",              // Purple
  "Unsafe Area": "#0f172b",            // Black
  "Medication side-effect": "#ff99cc", // Rose/Pink
  "Environmental event": "#06b6d4"     // Cyan
};

const TOPIC_COLORS: Record<string, string> = {
  "Fitness": "#22c55e",       // Green
  "Health product": "#3b82f6",// Blue
  "Medical": "#ef4444",       // Red
  "Mental health": "#8b5cf6", // Violet
  "Cessation groups": "#f59e0b" // Amber
};

const MapController = ({ userLocation, zoom }: { userLocation: [number, number] | null; zoom: number }) => {
  const map = useMap();
  
  useEffect(() => {
    map.setZoom(zoom);
  }, [zoom, map]);

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
  
  // Section State
  const [activeSection, setActiveSection] = useState<string>('Personal Health');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'post' | 'poll' | 'petition'>('post');
  const [postTitle, setPostTitle] = useState(''); 
  const [newPostContent, setNewPostContent] = useState('');
  const [pollContent, setPollContent] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [postLocation, setPostLocation] = useState<[number, number] | null>(null);

  // Hazards & Specific Section Modal Data
  const [hazardType, setHazardType] = useState('');
  const [hazardValue, setHazardValue] = useState('');
  const [postTopic, setPostTopic] = useState('');
  const [topicValue, setTopicValue] = useState('');

  // Filtering & Pagination
  const [filterHazard, setFilterHazard] = useState('none');
  const [filterTopic, setFilterTopic] = useState('none');
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(20000); 
  const [currentPage, setCurrentPage] = useState(1);
  const POSTS_PER_PAGE = 10;
  
  const [showTypes, setShowTypes] = useState({
    post: true,
    poll: true,
    petition: true,
  });

  const user = auth.currentUser;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSection, filterHazard, filterTopic, searchQuery, radius, showTypes]);

  const filteredPosts = posts.filter(post => {
    // 0. Filter by Post Type Checkboxes
    if (!showTypes[post.type as keyof typeof showTypes]) return false;

    // 1. Filter by Section First
    if (post.forumSection !== activeSection) return false;

    // 2. Global Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        post.title.toLowerCase().includes(query) || 
        post.content.toLowerCase().includes(query) ||
        post.authorName.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // 3. Specific Section Filtering
    let sectionMatch = true;
    if (activeSection === 'Population Health') {
      // Allow posts, polls, and petitions to match hazard filters
      sectionMatch = filterHazard === 'none' || post.hazard?.type === filterHazard; 
    } else if (activeSection === 'Personal Health') {
      sectionMatch = filterTopic === 'none' || post.topic === filterTopic; 
    } 
    if (!sectionMatch) return false;

    // 4. Check Location Radius
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
    
    return matchesLocation;
  });

  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * POSTS_PER_PAGE,
    currentPage * POSTS_PER_PAGE
  );

  const GRID_SIZE = 0.05;
  const gridCells = useMemo(() => {
    const cells: Record<string, any> = {};
    filteredPosts.forEach(post => {
      // Include all types with a confirmation location
      if (!post.confirm || !Array.isArray(post.confirm)) return;

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

      // 1. Initialize base data common to ALL posts
      const commonData: any = {
        authorId: user.uid,
        authorName: realName,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp(),
        forumSection: activeSection,
        likes: [],
        dislikes: [],
        replyCount: 0,
        location: postLocation || null
      };

      // 2. Handle Section-Specific Metadata (Topic or Hazard)
      if (activeSection === 'Personal Health' && postTopic) {
        commonData.topic = postTopic;
      }

      if (activeSection === 'Population Health' && hazardType && hazardValue.trim()) {
        const confirmLocation = postLocation || userLocation;
        
        commonData.hazard = {
          type: hazardType,
          value: hazardValue.trim()
        };
        
        // Attach confirmation data if we're in Population Health
        commonData.confirm = confirmLocation ? [{ 
          userId: user.uid, 
          location: confirmLocation,
          confirmTime: Timestamp.now() 
        }] : [];
      }

      // 3. Construct the final object based on Modal Mode
      let finalPostData: any = { ...commonData };

      if (modalMode === 'post') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        finalPostData = { 
          ...finalPostData, 
          type: 'post', 
          title: postTitle, 
          content: newPostContent 
        };

      } else if (modalMode === 'poll') {
        if (!pollContent.trim() || pollOptions.some(opt => !opt.trim())) {
          return alert("Please provide a question and fill all option fields.");
        }
        finalPostData = { 
          ...finalPostData, 
          type: 'poll', 
          title: postTitle, 
          content: pollContent, 
          options: pollOptions.map(text => ({ text, votes: 0 })), 
          userVotes: {} 
        };

      } else if (modalMode === 'petition') {
        if (!newPostContent.trim() || !postTitle.trim()) return alert("Please fill out the title and content.");
        finalPostData = { 
          ...finalPostData, 
          type: 'petition', 
          title: postTitle, 
          content: newPostContent, 
          signatures: [] 
        };
      }

      // 4. Single entry point for database write
      await addDoc(collection(db, 'myHealth_posts'), finalPostData);
      resetModal();

    } catch (err) {
      console.error("Error creating post:", err);
      alert("Something went wrong while publishing.");
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
    setPostTopic('');
    setIsModalOpen(false);
    setModalMode('post');
  };

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 bg-slate-50 min-h-screen pb-24 max-w-7xl mx-auto">
      {/* MAIN FEED */}
      <div className="flex-1 max-w-2xl w-full mx-auto lg:mx-0">
        <header className="mb-6 flex flex-row items-start justify-between gap-4">
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

        {/* SECTION TABS */}
        <div className="flex gap-2 mb-6 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto hide-scrollbar">
          {FORUM_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => {
                setActiveSection(section.id);
                setFilterHazard('none');
                setFilterTopic('none');
                setSearchQuery('');
              }}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${
                activeSection === section.id 
                  ? 'bg-indigo-50 text-indigo-700 shadow-sm border border-indigo-100' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
            >
              {section.icon}
              {section.id}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {paginatedPosts.length > 0 ? (
            <>
              {paginatedPosts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
              
              {/* PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 mt-6">
                  <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-30 hover:text-indigo-600 transition-colors"
                  >
                    <ChevronLeft size={16} /> Prev
                  </button>
                  <span className="text-sm font-bold text-slate-400">
                    Page <span className="text-slate-800">{currentPage}</span> of {totalPages}
                  </span>
                  <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center gap-1 text-sm font-bold text-slate-600 disabled:opacity-30 hover:text-indigo-600 transition-colors"
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-3xl border border-slate-200">
              <p className="text-slate-500 font-medium">No posts found.</p>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="mt-4 text-indigo-600 font-bold hover:underline"
              >
                Be the first to post
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SIDEBAR COLUMN */}
      <div className="w-full lg:w-96 order-1 lg:order-2">
        <div className="lg:sticky lg:top-4 space-y-4 h-fit">
          
          {/* COMMUNITY PULSE CARD */}
          <div className="bg-linear-to-br from-indigo-600 to-violet-700 p-5 rounded-3xl shadow-lg text-white">
            <h3 className="text-[10px] font-black uppercase tracking-widest opacity-70 mb-4 flex items-center gap-2"> {activeSection} Pulse</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/5">
                <span className="block text-2xl font-black">{filteredPosts.length}</span>
                <span className="text-[10px] font-bold uppercase opacity-60">Active Now</span>
              </div>
              <div className="bg-white/10 p-3 rounded-2xl backdrop-blur-md border border-white/5">
                <span className="block text-2xl font-black">
                  {activeSection === 'Population Health' 
                    ? filteredPosts.filter(p => p.hazard).length // Counts any post type with a hazard
                    : filteredPosts.reduce((acc, p) => acc + (p.replyCount || 0), 0)
                  } 
                </span>
                <span className="text-[10px] font-bold uppercase opacity-60">
                  {activeSection === 'Population Health' ? 'Hazards' : 'Total Replies'}
                </span>
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

            <div className="p-4 space-y-4">
              
              {/* GLOBAL SEARCH */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Search Discussions</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-3 text-slate-400" />
                  <input 
                    type="text"
                    placeholder="Search posts, topics, or authors..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-9 pr-4 outline-none focus:border-indigo-500 text-sm font-medium text-slate-700"
                  />
                </div>
              </div>

              {/* Post Type Checkboxes */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-600">Post Types</label>
                <div className="flex gap-4">
                  {(['post', 'poll', 'petition'] as const).map((type) => (
                    <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={showTypes[type]}
                        onChange={(e) => setShowTypes(prev => ({ ...prev, [type]: e.target.checked }))}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="text-xs font-medium text-slate-700 capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* INTEGRATED MAP VIEW */}
              <div className="relative h-48 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner z-0">
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
                  
                  {/* GRID MAP LOGIC (ONLY SHOWN FOR POPULATION HEALTH) */}
                  {activeSection === 'Population Health' && gridCells.map((cell: any, idx: number) => {
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

                  {/* POST & CONFIRM LOCATION MARKERS (ALL SECTIONS) */}
                  {filteredPosts.map((post) => {
                    const elements = [];

                    // 1. Render Confirmed Locations (Population Health uses this array for its events)
                    if (activeSection === 'Population Health' && post.confirm && post.confirm.length > 0) {
                      const hazardColor = post.hazard?.type ? (HAZARD_COLORS[post.hazard.type] || '#94a3b8') : '#94a3b8';
                      const labelText = post.hazard?.type || 'Hazard';

                      post.confirm.forEach((c: any, idx: number) => {
                        if (c.location) {
                          elements.push(
                            <CircleMarker 
                              key={`conf-${post.id}-${idx}`} 
                              center={c.location as [number, number]} 
                              radius={4} 
                              pathOptions={{ color: 'white', fillColor: hazardColor, fillOpacity: 0.7, weight: 1.5 }}
                            >
                              <Popup className="font-sans">
                                <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: hazardColor }}>
                                  {labelText} ({post.type})
                                </span>
                                <strong className="text-slate-800 text-sm">{post.title}</strong>
                                <div className="text-xs text-slate-500 italic mt-1">Community Confirmed</div>
                              </Popup>
                            </CircleMarker>
                          );
                        }
                      });
                    } 
                    // 2. Render Single Location Marker (Personal Health, Off Topic, or Posts lacking a confirm array)
                    else if (post.location) {
                      let markerColor = '#94a3b8';
                      let labelText: string = post.forumSection;

                      if (post.forumSection === 'Personal Health' && post.topic) {
                        markerColor = TOPIC_COLORS[post.topic] || markerColor;
                        labelText = post.topic;
                      } else if (post.forumSection === 'Population Health' && post.hazard?.type) {
                        markerColor = HAZARD_COLORS[post.hazard.type] || markerColor;
                        labelText = post.hazard.type;
                      }

                      elements.push(
                        <CircleMarker 
                          key={`loc-${post.id}`} 
                          center={post.location as [number, number]} 
                          radius={6} 
                          pathOptions={{ color: 'white', fillColor: markerColor, fillOpacity: 0.8, weight: 1.5 }}
                        >
                          <Popup className="font-sans">
                            <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: markerColor }}>
                              {labelText} ({post.type})
                            </span>
                            <strong className="text-slate-800 text-sm">{post.title}</strong>
                            <div className="text-xs text-slate-500 italic mt-1">By {post.authorName}</div>
                          </Popup>
                        </CircleMarker>
                      );
                    }
                    return elements;
                  })}

                  {/* USER LOCATION PIN */}
                  {userLocation && (
                    <Marker position={userLocation}>
                      <Popup className="font-sans">
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1">Current Position</p>
                          <strong className="text-slate-800 text-sm">You are here</strong>
                        </div>
                      </Popup>
                    </Marker>
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

              {/* SHARED RANGE SLIDER */}
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

              {/* DYNAMIC FILTERS BASED ON ACTIVE SECTION */}
              <div className="space-y-3">
                {activeSection === 'Population Health' && (
                  <>
                    <label className="text-xs font-bold text-slate-600">Active Alert Types</label>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setFilterHazard('none')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          filterHazard === 'none' 
                            ? 'bg-indigo-600 text-white shadow-md' 
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
                            onClick={() => setFilterHazard(isActive ? "none" : type)}
                            style={{ backgroundColor: isActive ? activeColor : undefined }}
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
                  </>
                )}

                {activeSection === 'Personal Health' && (
                  <>
                    <label className="text-xs font-bold text-slate-600">Filter by Topic</label>
                    <div className="flex flex-wrap gap-2">
                      <button 
                        onClick={() => setFilterTopic('none')}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                          filterTopic === 'none' 
                            ? 'bg-indigo-600 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        All Topics
                      </button>
                      {TOPIC_TYPES.map(topic => {
                        const isActive = filterTopic === topic;
                        const activeColor = TOPIC_COLORS[topic];

                        return (
                          <button 
                            key={topic}
                            onClick={() => setFilterTopic(isActive ? "none" : topic)}
                            style={{ backgroundColor: isActive ? activeColor : undefined }}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                              isActive 
                                ? 'text-white shadow-md' 
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                          >
                            {topic}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
                
      {/* MODAL OVERLAY */}
      <CreatePostModal 
        isOpen={isModalOpen}
        onClose={resetModal}
        activeSection={activeSection}
        modalMode={modalMode}
        setModalMode={setModalMode}
        tabs={tabs}
        postTitle={postTitle}
        setPostTitle={setPostTitle}
        newPostContent={newPostContent}
        setNewPostContent={setNewPostContent}
        pollContent={pollContent}
        setPollContent={setPollContent}
        pollOptions={pollOptions}
        setPollOptions={setPollOptions}
        hazardType={hazardType}
        setHazardType={setHazardType}
        hazardValue={hazardValue}
        setHazardValue={setHazardValue}
        postTopic={postTopic}
        setPostTopic={setPostTopic}
        topicValue={topicValue}
        setTopicValue={setTopicValue}
        HAZARD_TYPES={HAZARD_TYPES}
        TOPIC_TYPES={TOPIC_TYPES}
        postLocation={postLocation}
        onToggleLocation={handleTogglePostLocation}
        onCreate={handleCreate}
      />
    </div>
  );
};

export default ForumScreen;