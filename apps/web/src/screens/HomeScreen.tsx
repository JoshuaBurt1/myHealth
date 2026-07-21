import React, { useEffect, useState, useMemo } from 'react';
import { auth, db } from '../firebase';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { Vote, FileSignature, ArrowRight, Globe, AlertTriangle, HeartHandshake, MapPin, Navigation, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { ExpandableMap } from '../componentsForum/MapComponents';
import { radiusToZoom, zoomToRadius } from '../componentsForum/mapUtils';
import { HAZARD_COLORS, HELP_COLORS } from '../componentsForum/forumConstants';

const tickerStyles = `
  @keyframes ticker {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }
  .animate-ticker {
    display: flex;
    gap: 2rem;
    animation: ticker 30s linear infinite;
    width: max-content;
  }
  .animate-ticker:hover {
    animation-play-state: paused;
  }
`;

interface NewsItem {
  id: string;
  title: string;
  type: 'post' | 'poll' | 'petition';
  content?: string;
  hazard?: { type: string; value: string };
  help?: { type: string; value: string };
  public?: { type: string; value: string };
  location?: [number, number] | null;
  confirm?: { userId: string; location: [number, number]; confirmTime: any }[];
  createdAt: any;
  lastUpdated: any;
  helpStartDate?: any;
  helpEndDate?: any;
  topic?: string;
  detail?: string;
  authorName?: string;
  forumSection?: string;
}

const HomeScreen: React.FC = () => {
  const { userLocation, locationError } = useLocation();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(!!auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setIsLoggedIn(!!user);
    });
    return () => unsubscribe();
  }, []);

  const [radius, setRadius] = useState(1000); 
  const [overrideLocation, setOverrideLocation] = useState<[number, number] | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  const mapZoom = useMemo(() => radiusToZoom(radius), [radius]);
  const effectiveLocation = overrideLocation || userLocation;

  useEffect(() => {
    const newsRef = collection(db, 'myHealth_news');
    const newsQ = query(newsRef, orderBy('lastUpdated', 'desc'), limit(100));

    const unsubNews = onSnapshot(newsQ, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsItem[];
      setNewsItems(items);
    });

    return () => unsubNews();
  }, []);

  const handleApplyCoordinates = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setOverrideLocation([lat, lng]);
    } else {
      alert("Please enter valid numerical coordinates.");
    }
  };

  const filteredNews = useMemo(() => {
    return newsItems.filter(item => {
      if (effectiveLocation && item.location && radius < 20000) {
        const [postLat, postLng] = item.location;
        const [userLat, userLng] = effectiveLocation;
        const distInDegrees = Math.sqrt(Math.pow(postLat - userLat, 2) + Math.pow(postLng - userLng, 2));
        if (distInDegrees > radius * 0.009) return false;
      }
      return true;
    });
  }, [newsItems, effectiveLocation, radius]);

  const newsLinks = useMemo(() => {
    const links = [];
    const poll = filteredNews.find(i => i.type === 'poll');
    const petition = filteredNews.find(i => i.type === 'petition');
    if (poll) links.push({ ...poll, icon: <Vote size={14} />, label: 'Active Poll', color: 'indigo' });
    if (petition) links.push({ ...petition, icon: <FileSignature size={14} />, label: 'New Petition', color: 'emerald' });
    return [...links, ...links];
  }, [filteredNews]);

  const hazardsFeed = useMemo(() => filteredNews.filter(i => i.hazard), [filteredNews]);
  const helpFeed = useMemo(() => filteredNews.filter(i => i.help), [filteredNews]);

  const renderFeedItem = (item: NewsItem, color: string) => {
    const targetPath = `/forum/${item.id}`;
    const displayDate = item.lastUpdated?.toDate ? item.lastUpdated.toDate() : (item.lastUpdated ? new Date(item.lastUpdated) : null);
    const locationCount = item.confirm ? item.confirm.length : (item.location ? 1 : 0);

    return (
      <Link 
        key={item.id} 
        to={targetPath} 
        className="flex flex-col p-2 md:p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-all shadow-sm group"
      >
        <div className="flex justify-between items-start mb-1.5 md:mb-2 gap-1 flex-wrap md:flex-nowrap">
          <span className="text-[clamp(0.5rem,1.5vw,0.625rem)] font-black uppercase tracking-widest px-1.5 py-0.5 md:px-2 md:py-0.5 rounded-md" style={{ backgroundColor: `${color}15`, color: color }}>
            {item.hazard?.type || item.help?.type || "Alert"}
          </span>
          <span className="text-[clamp(0.5rem,1.5vw,0.625rem)] font-medium text-slate-400">
            {displayDate ? displayDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending'}
          </span>
        </div>
        <h4 className="text-[clamp(0.75rem,2.5vw,0.875rem)] font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors leading-tight">{item.title}</h4>
        <div className="flex items-center gap-1.5 text-[clamp(0.55rem,2vw,0.625rem)] text-slate-500 font-bold mt-auto">
          <Globe size={10} className="shrink-0" /> <span className="truncate">{locationCount} Locations Tracking</span>
        </div>
      </Link>
    );
  };

  useEffect(() => {
    window.dispatchEvent(new Event('resize'));
  }, []);

  // Shared Profile Ribbon Component
  const ProfileRibbon = () => (
    <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-2xl flex flex-col gap-3 w-full shadow-sm">
      <div>
        <h3 className="text-sm font-bold text-indigo-900 leading-tight">
          Have you created your profile?
        </h3>
        <p className="text-xs text-indigo-700 mt-1">
          Get started to begin tracking your health.
        </p>
      </div>
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((i) => (
          <Link 
            key={i} 
            to="/register" 
            className="relative -ml-2 first:ml-0 hover:scale-110 hover:z-10 transition-all duration-200"
          >
            <img 
              src={`https://i.pravatar.cc/100?img=${i + 15}`} 
              alt="User profile placeholder" 
              className="w-9 h-9 rounded-full border-2 border-white shadow-sm object-cover bg-slate-200"
            />
          </Link>
        ))}
        <Link to="/register" className="ml-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors">
          Create Profile <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col p-4 bg-slate-50 min-h-screen pb-24 max-w-full mx-auto">
      <style>{tickerStyles}</style>
      <div className="w-full space-y-8"> 
        
        {/* TICKER & RIBBON */}
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 overflow-hidden">
          
          <div className="flex-1 min-w-0 flex flex-col w-full">
            <div>
              <h1 className="text-4xl lg:text-4xl font-bold text-slate-900 tracking-tight">MyHealth Home</h1>
              <p className="text-slate-500 mt-1 text-sm lg:text-base">
                Showing {filteredNews.length} updates based on your active map radius.
              </p>
            </div>

            {/* Mobile profile ribbon */}
            {!isLoggedIn && (
              <div className="md:hidden mt-6 w-full">
                <ProfileRibbon />
              </div>
            )}
            
            {/* Ticker */}
            {newsLinks.length > 0 && (
              <div className={`relative overflow-hidden h-14 bg-white/50 rounded-2xl border border-slate-200 backdrop-blur-sm mt-6 w-full ${isLoggedIn ? 'max-w-full' : 'max-w-3xl'}`}>
                <div className="animate-ticker py-2 px-4">
                  {newsLinks.map((link, idx) => (
                    <Link 
                      key={`${link.id}-${idx}`}
                      to={`/forum/${link.id}`}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-white rounded-xl transition-colors group border border-transparent hover:border-slate-100"
                    >
                      <div className={`p-1.5 rounded-md ${link.color === 'indigo' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {link.icon}
                      </div>
                      <div className="whitespace-nowrap">
                        <span className={`text-[9px] font-black uppercase tracking-widest mr-2 ${link.color === 'indigo' ? 'text-indigo-600' : 'text-emerald-600'}`}>
                          {link.label}
                        </span>
                        <span className="text-sm font-bold text-slate-800">{link.title}</span>
                      </div>
                      <ArrowRight size={12} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Desktop profile ribbon */}
          {!isLoggedIn && (
            <div className="hidden md:block shrink-0 w-72 lg:w-80">
              <ProfileRibbon />
            </div>
          )}
        </header>

        {/* MAP */}
        <div className="w-full">
          <div className="bg-white p-2 md:p-3 rounded-3xl border border-slate-200 shadow-sm flex flex-col min-h-125 md:min-h-150">

            <div className="w-full flex-1 relative z-0 overflow-hidden rounded-2xl bg-slate-100 isolate">
              <div className="absolute inset-0">
                <ExpandableMap 
                  userLocation={effectiveLocation} 
                  mapZoom={mapZoom} 
                  activeSection="Population Health" 
                  filteredPosts={filteredNews.map(item => ({...item, forumSection: 'Population Health'} as any))} 
                  radius={radius}
                  showExpandButton={false}
                />
              </div>

              {/* FLOATING SIDEBARS (Desktop Only) */}
              <div className="hidden md:block absolute inset-0 pointer-events-none z-1000 overflow-hidden rounded-2xl">
                
                {/* LEFT SIDEBAR (Community Help) */}
                <div className={`absolute top-4 bottom-4 left-5 flex transition-transform duration-500 ease-in-out ${showLeftSidebar ? 'translate-x-0' : '-translate-x-[calc(100%+2rem)]'}`}>
                  <aside className="pointer-events-auto w-72 lg:w-80 flex flex-col gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/5 shadow-2xl overflow-y-auto max-h-full transition-all hover:bg-white/10 hover:backdrop-blur-md">
                    <div className="flex items-center border-b border-white/10 pb-2">
                      <button onClick={() => setShowLeftSidebar(false)} className="text-slate-500 hover:text-indigo-500 transition-colors p-1" title="Hide Sidebar">
                        <ChevronLeft size={18} />
                      </button>
                      <div className="flex-1 flex items-center justify-center gap-2 pr-7">
                        <HeartHandshake size={18} className="text-indigo-500" />
                        <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight">Community Help</h2>
                      </div>
                    </div>
                    {helpFeed.length > 0 ? (
                      <div className="grid gap-3">
                        {helpFeed.map(item => renderFeedItem(item, HELP_COLORS[item.help?.type || ''] || '#6366f1'))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold text-center py-4 uppercase tracking-widest">No requests in range</p>
                    )}
                  </aside>
                </div>

                {/* Left Unhide Button */}
                {!showLeftSidebar && (
                  <button 
                    onClick={() => setShowLeftSidebar(true)} 
                    className="pointer-events-auto absolute top-5 left-5 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 shadow-lg text-indigo-500 hover:bg-white/20 transition-all group"
                    title="Show Community Help"
                  >
                    <ChevronRight size={18} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}

                {/* RIGHT SIDEBAR (Active Hazards) */}
                <div className={`absolute top-4 bottom-4 right-4 flex transition-transform duration-500 ease-in-out ${showRightSidebar ? 'translate-x-0' : 'translate-x-[calc(100%+2rem)]'}`}>
                  <aside className="pointer-events-auto w-72 lg:w-80 flex flex-col gap-4 bg-white/5 backdrop-blur-sm p-4 rounded-2xl border border-white/5 shadow-2xl overflow-y-auto max-h-full transition-all hover:bg-white/10 hover:backdrop-blur-md">
                    <div className="flex items-center border-b border-white/10 pb-2">
                      <div className="flex-1 flex items-center justify-center gap-2 pl-7">
                        <AlertTriangle size={18} className="text-orange-500" />
                        <h2 className="text-xs font-black text-slate-800 uppercase tracking-tight">Active Hazards</h2>
                      </div>
                      <button onClick={() => setShowRightSidebar(false)} className="text-slate-500 hover:text-orange-500 transition-colors p-1" title="Hide Sidebar">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                    {hazardsFeed.length > 0 ? (
                      <div className="grid gap-3">
                        {hazardsFeed.map(item => renderFeedItem(item, HAZARD_COLORS[item.hazard?.type || ''] || '#ef4444'))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400 font-bold text-center py-4 uppercase tracking-widest">No hazards in range</p>
                    )}
                  </aside>
                </div>

                {/* Right Unhide Button */}
                {!showRightSidebar && (
                  <button 
                    onClick={() => setShowRightSidebar(true)} 
                    className="pointer-events-auto absolute top-5 right-7 p-4 bg-white/10 backdrop-blur-sm rounded-xl border border-white/10 shadow-lg text-orange-500 hover:bg-white/20 transition-all group"
                    title="Show Active Hazards"
                  >
                    <ChevronLeft size={18} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}
                
              </div>
            </div>
            {/* Map controls */}
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 p-3 md:p-4 shrink-0">
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[11px] md:text-xs font-bold text-slate-600 flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-500" /> Filter Radius
                  </label>
                  <span className="text-[11px] md:text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                    {radius >= 20000 ? "Global" : `${radius}km`}
                  </span>
                </div>
                {effectiveLocation ? (
                  <input 
                    type="range"
                    min="2" max="18" step="1"
                    value={radiusToZoom(radius)}
                    onChange={(e) => setRadius(zoomToRadius(parseInt(e.target.value)))}
                    className="w-full h-1.5 md:h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 scale-x-[-1]" 
                  />
                ) : (
                  <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    {locationError ? `Error: ${locationError}` : "Enable location to use distance filter"}
                  </div>
                )}
              </div>

              {/* Override Location */}
              <div className="flex-1 md:border-l border-slate-100 md:pl-6 flex flex-col justify-center">
                <label className="text-[11px] md:text-xs font-bold text-slate-600 flex items-center gap-2 mb-2">
                  <Navigation size={14} className="text-emerald-500" /> Override Location
                </label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1 md:py-1.5 px-2 md:px-3 outline-none focus:border-indigo-500 text-[12px] md:text-sm" placeholder="Lat" />
                  </div>
                  <div className="flex-1">
                    <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1 md:py-1.5 px-2 md:px-3 outline-none focus:border-indigo-500 text-[12px] md:text-sm" placeholder="Lng" />
                  </div>
                  <button onClick={handleApplyCoordinates} className="bg-indigo-600 text-white px-3 md:px-4 py-1 md:py-1.5 rounded-lg text-[12px] md:text-sm font-bold hover:bg-indigo-700 transition-colors">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE FEEDS GRID (Mobile) */}
        <div className="grid grid-cols-2 gap-3 md:hidden">
          <section className="space-y-4">
             <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
               <HeartHandshake size={16} className="text-indigo-500" />
               <h2 className="text-[10px] font-black text-slate-800 uppercase">Help</h2>
             </div>
             {helpFeed.map(item => renderFeedItem(item, HELP_COLORS[item.help?.type || ''] || '#6366f1'))}
          </section>

          <section className="space-y-4">
             <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
               <AlertTriangle size={16} className="text-orange-500" />
               <h2 className="text-[10px] font-black text-slate-800 uppercase">Hazards</h2>
             </div>
             {hazardsFeed.map(item => renderFeedItem(item, HAZARD_COLORS[item.hazard?.type || ''] || '#ef4444'))}
          </section>
        </div>

      </div>
    </div>
  );
};

export default HomeScreen;