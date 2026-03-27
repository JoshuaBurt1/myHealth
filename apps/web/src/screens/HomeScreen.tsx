import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { Vote, FileSignature, ArrowRight, Globe, AlertTriangle, HeartHandshake } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';

// Import the MapComponent 
import { ExpandableMap } from '../componentsForum/MapComponents';

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
  const [mapZoom, setMapZoom] = useState(2);

  useEffect(() => {
    if (userLocation) setMapZoom(9);
  }, [userLocation]);

  useEffect(() => {
    // Single source of truth: myHealth_news
    const newsRef = collection(db, 'myHealth_news');
    const newsQ = query(newsRef, orderBy('lastUpdated', 'desc'), limit(100));

    const unsubNews = onSnapshot(newsQ, (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsItem[];
      setNewsItems(items);
    });

    return () => unsubNews();
  }, []);

  // Derived state for the top highlight cards
  const activePoll = useMemo(() => newsItems.find(i => i.type === 'poll'), [newsItems]);
  const activePetition = useMemo(() => newsItems.find(i => i.type === 'petition'), [newsItems]);

  // Derived feeds
  const hazardsFeed = useMemo(() => 
    newsItems.filter(i => i.hazard), 
  [newsItems]);
  
  const helpFeed = useMemo(() => 
    newsItems.filter(i => i.help), 
  [newsItems]);

  const renderFeedItem = (item: NewsItem, color: string) => {
    const isForumType = item.type === 'poll' || item.type === 'petition';
    const targetPath = isForumType ? `/forum` : `/news/${item.id}`;

    const displayDate = item.lastUpdated?.toDate 
      ? item.lastUpdated.toDate() 
      : (item.lastUpdated ? new Date(item.lastUpdated) : null);

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
    <div className="flex flex-col lg:flex-row gap-8 p-4 bg-slate-50 min-h-screen">
      <div className="flex-1 max-w-2xl w-full space-y-8"> 
        <header>
          <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Health Desk</h1>
          <p className="text-slate-500 mt-1">
            {locationError ? "Location access limited." : "Showing updates based on recent activity."}
          </p>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {activePoll && (
            <Link to="/forum" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-indigo-50 transition-colors shadow-sm group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-white transition-colors"><Vote className="text-indigo-600" size={20} /></div>
                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Poll</p>
                  <p className="text-sm font-semibold text-slate-800 truncate max-w-35">{activePoll.title}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
          {activePetition && (
            <Link to="/forum" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-emerald-50 transition-colors shadow-sm group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-white transition-colors"><FileSignature className="text-emerald-600" size={20} /></div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">New Petition</p>
                  <p className="text-sm font-semibold text-slate-800 truncate max-w-35">{activePetition.title}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>

        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <AlertTriangle size={18} className="text-orange-500" />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Active Hazards</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {hazardsFeed.map(item => renderFeedItem(item, HAZARD_COLORS[item.hazard?.type || ''] || '#ef4444'))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 mb-4 border-b border-slate-200 pb-2">
            <HeartHandshake size={18} className="text-indigo-500" />
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Community Help</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {helpFeed.map(item => renderFeedItem(item, HELP_COLORS[item.help?.type || ''] || '#6366f1'))}
          </div>
        </section>
      </div>

      <aside className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Activity Map</h3>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${userLocation ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
              {userLocation ? 'Live' : 'Global View'}
            </span>
          </div>

          <ExpandableMap 
            userLocation={userLocation} 
            mapZoom={mapZoom} 
            activeSection="Population Health" 
            filteredPosts={newsItems.map(item => ({...item, forumSection: 'Population Health'}))} 
          />
        </div>

        <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg">
           <h4 className="text-white font-bold text-lg leading-tight mb-2">Community Shield</h4>
           <p className="text-indigo-100 text-xs">When you confirm a hazard from your device, you add a coordinate to the global health map.</p>
        </div>
      </aside>
    </div>
  );
};

export default HomeScreen;