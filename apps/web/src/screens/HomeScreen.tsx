import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { Vote, FileSignature, ArrowRight, Globe, AlertTriangle, HeartHandshake, MapPin, Navigation } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';
import { ExpandableMap } from '../componentsForum/MapComponents';
import { radiusToZoom, zoomToRadius } from '../componentsForum/mapUtils';

// Ticker Animation Style
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

const HAZARD_COLORS: Record<string, string> = {
  "Food contamination": "#f97316", "Biological event": "#84cc16",
  "Radiation": "#a855f7", "Toxic gas": "#eab308",
  "War zone": "#ef4444", "Substance abuse": "#3b82f6", "Extreme environment": "#06b6d4"
};

const HELP_COLORS: Record<string, string> = {
  "Medical aid": "#ec4899", "Supplies": "#10b981",
  "Volunteering": "#3b82f6", "Information": "#f59e0b"
};

const HomeScreen: React.FC = () => {
  const { userLocation, locationError } = useLocation();
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
  
  const [radius, setRadius] = useState(2500); 
  const [overrideLocation, setOverrideLocation] = useState<[number, number] | null>(null);
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

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
        className="flex flex-col p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-300 transition-all shadow-sm group"
      >
        <div className="flex justify-between items-start mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md" style={{ backgroundColor: `${color}15`, color: color }}>
            {item.hazard?.type || item.help?.type || "Alert"}
          </span>
          <span className="text-[10px] font-medium text-slate-400">
            {displayDate ? displayDate.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Pending'}
          </span>
        </div>
        <h4 className="text-sm font-bold text-slate-800 mb-1 group-hover:text-indigo-600 transition-colors">{item.title}</h4>
        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold">
          <Globe size={10} /> {locationCount} Locations Tracking
        </div>
      </Link>
    );
  };

  return (
    /* Changed to max-w-7xl and added pb-24 to match reference */
    <div className="flex flex-col p-4 bg-slate-50 min-h-screen pb-24 max-w-7xl mx-auto">
      <style>{tickerStyles}</style>
      <div className="w-full space-y-8"> 
        
        {/* HEADER & TICKER RIBBON */}
        <header className="flex flex-col md:flex-row md:items-start justify-between gap-6 overflow-hidden">
          <div className="flex-shrink-0">
            {/* Changed font-black to font-bold and text size to match reference */}
            <h1 className="text-4xl lg:text-4xl font-bold text-slate-900 tracking-tight">Health Desk</h1>
            {/* Adjusted typography for the description */}
            <p className="text-slate-500 mt-1 text-sm lg:text-base">
              Showing {filteredNews.length} updates based on your active map radius.
            </p>
          </div>
          
          {newsLinks.length > 0 && (
            <div className="flex-1 relative overflow-hidden h-14 bg-white/50 rounded-2xl border border-slate-200 backdrop-blur-sm mt-2">
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
        </header>

        {/* MAP SECTION */}
        <div className="w-full">
          <div className="bg-white p-2 rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-full aspect-6/1 relative z-0 overflow-hidden rounded-2xl bg-slate-100">
              <ExpandableMap 
                userLocation={effectiveLocation} 
                mapZoom={mapZoom} 
                activeSection="Population Health" 
                filteredPosts={filteredNews.map(item => ({...item, forumSection: 'Population Health'} as any))} 
                radius={radius}
              />
            </div>

            <div className="flex flex-col md:flex-row gap-6 p-4">
              <div className="flex-1 space-y-2">
                <div className="flex justify-between items-end">
                  <label className="text-xs font-bold text-slate-600 flex items-center gap-2">
                    <MapPin size={14} className="text-indigo-500" /> Filter Radius
                  </label>
                  <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                    {radius >= 20000 ? "Global" : `${radius}km`}
                  </span>
                </div>
                {effectiveLocation ? (
                  <input 
                    type="range"
                    min="2" max="18" step="1"
                    value={radiusToZoom(radius)}
                    onChange={(e) => setRadius(zoomToRadius(parseInt(e.target.value)))}
                    className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 scale-x-[-1]" 
                  />
                ) : (
                  <div className="text-[10px] font-bold text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-100">
                    {locationError ? `Error: ${locationError}` : "Enable location to use distance filter"}
                  </div>
                )}
              </div>

              <div className="flex-1 border-l border-slate-100 pl-6 flex flex-col justify-center">
                <label className="text-xs font-bold text-slate-600 flex items-center gap-2 mb-2">
                  <Navigation size={14} className="text-emerald-500" /> Override Location
                </label>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <input type="number" step="any" value={latInput} onChange={e => setLatInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-sm" placeholder="Lat" />
                  </div>
                  <div className="flex-1">
                    <input type="number" step="any" value={lngInput} onChange={e => setLngInput(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg py-1.5 px-3 outline-none focus:border-indigo-500 text-sm" placeholder="Lng" />
                  </div>
                  <button onClick={handleApplyCoordinates} className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors">Apply</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEEDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <HeartHandshake size={18} className="text-indigo-500" />
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Community Help</h2>
            </div>
            {helpFeed.length > 0 ? (
              <div className="grid gap-4">
                {helpFeed.map(item => renderFeedItem(item, HELP_COLORS[item.help?.type || ''] || '#6366f1'))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-medium">No help requests within range.</p>
            )}
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <AlertTriangle size={18} className="text-orange-500" />
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Hazards</h2>
            </div>
            {hazardsFeed.length > 0 ? (
              <div className="grid gap-4">
                {hazardsFeed.map(item => renderFeedItem(item, HAZARD_COLORS[item.hazard?.type || ''] || '#ef4444'))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 font-medium">No hazards within range.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default HomeScreen;