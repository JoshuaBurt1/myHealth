import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../firebase';
import { collection, query, where, limit, onSnapshot, orderBy } from 'firebase/firestore';
import { Vote, FileSignature, ArrowRight, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocation } from '../context/LocationContext';

// --- Map Imports ---
import { MapContainer, TileLayer, CircleMarker, Rectangle, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface ForumPost {
  id: string;
  title: string;
  type: 'poll' | 'petition' | 'discussion';
  createdAt: any;
  location?: [number, number];
  hazard?: {
    type: string;
    value: string;
  };
}

// Map hazard types to specific colors
const HAZARD_COLORS: Record<string, string> = {
  "Food contamination": "#f97316", // Orange
  "Biological event": "#84cc16",   // Lime
  "Radiation": "#a855f7",          // Purple
  "Toxic gas": "#eab308",          // Yellow
  "War zone": "#ef4444",           // Red
  "Substance abuse": "#3b82f6",    // Blue
  "Extreme environment": "#06b6d4" // Cyan
};

// Helper component to dynamically change map center/zoom
const MapController = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
};

const HomeScreen: React.FC = () => {
  // 2. Access global location and errors
  const { userLocation, locationError } = useLocation();
  
  const [activePoll, setActivePoll] = useState<ForumPost | null>(null);
  const [activePetition, setActivePetition] = useState<ForumPost | null>(null);
  const [hazardPosts, setHazardPosts] = useState<ForumPost[]>([]);
  
  // 3. Keep mapZoom as local state, but default it based on if location exists
  const [mapZoom, setMapZoom] = useState(2);

  // 4. Update zoom automatically when a location is finally acquired
  useEffect(() => {
    if (userLocation) {
      setMapZoom(9);
    }
  }, [userLocation]);

  // Firebase Posts Listener (Unchanged)
  useEffect(() => {
    const postsRef = collection(db, 'myHealth_posts');
    const pollQuery = query(postsRef, where('type', '==', 'poll'), orderBy('createdAt', 'desc'), limit(1));
    const petitionQuery = query(postsRef, where('type', '==', 'petition'), orderBy('createdAt', 'desc'), limit(1));
    const recentQuery = query(postsRef, orderBy('createdAt', 'desc'), limit(150));

    const unsubPoll = onSnapshot(pollQuery, (snapshot) => {
      setActivePoll(snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ForumPost);
    });

    const unsubPetition = onSnapshot(petitionQuery, (snapshot) => {
      setActivePetition(snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as ForumPost);
    });

    const unsubHazards = onSnapshot(recentQuery, (snapshot) => {
      const hazardsList: ForumPost[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data() as ForumPost;
        if (data.location && Array.isArray(data.location) && data.hazard?.type) {
          hazardsList.push({ ...data, id: doc.id });
        }
      });
      setHazardPosts(hazardsList);
    });

    return () => {
      unsubPoll();
      unsubPetition();
      unsubHazards();
    };
  }, []);

  // --- Grid & Warning Level Calculation (Unchanged) ---
  const GRID_SIZE = 0.05; 
  const gridCells = useMemo(() => {
    const cells: Record<string, any> = {};
    hazardPosts.forEach(post => {
      if (!post.location) return;
      const [lat, lng] = post.location;
      const gridX = Math.floor(lat / GRID_SIZE);
      const gridY = Math.floor(lng / GRID_SIZE);
      const key = `${gridX}_${gridY}`;

      if (!cells[key]) {
        cells[key] = {
          bounds: [[gridX * GRID_SIZE, gridY * GRID_SIZE], [(gridX + 1) * GRID_SIZE, (gridY + 1) * GRID_SIZE]],
          count: 0,
          types: new Set<string>()
        };
      }
      cells[key].count += 1;
      if (post.hazard?.type) cells[key].types.add(post.hazard.type);
    });
    return Object.values(cells);
  }, [hazardPosts]);

  return (
    <div className="flex flex-col lg:flex-row gap-8 p-4 bg-slate-50 min-h-screen">
      {/* --- LEFT CONTENT AREA --- */}
      <div className="flex-1 max-w-2xl w-full"> 
        <header className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 tracking-tight">Health Desk</h1>
            <p className="text-slate-500 mt-1">
              Welcome back! {locationError ? "Location access is limited." : "Showing local and global updates."}
            </p>
          </div>
        </header>

        <div className="space-y-4">
          {activePoll && (
            <Link to="/forum" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-indigo-50 transition-colors shadow-sm group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg group-hover:bg-white transition-colors">
                  <Vote className="text-indigo-600" size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Active Poll</p>
                  <p className="text-sm font-semibold text-slate-800">{activePoll.title}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-indigo-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}

          {activePetition && (
            <Link to="/forum" className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:bg-emerald-50 transition-colors shadow-sm group">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-50 rounded-lg group-hover:bg-white transition-colors">
                  <FileSignature className="text-emerald-600" size={20} />
                </div>
                <div>
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">New Petition</p>
                  <p className="text-sm font-semibold text-slate-800">{activePetition.title}</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
        </div>
      </div>

      {/* --- RIGHT SIDEBAR --- */}
      <aside className="w-full lg:w-80 shrink-0 space-y-6">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Local Insights</h3>
            <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${userLocation ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'}`}>
              {userLocation ? 'Live' : 'Global View'}
            </span>
          </div>

          <div className="relative aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner z-0">
            {/* We use userLocation || [20, 0] so the map always has a center point. 
               MapController handles updating the view if userLocation loads later.
            */}
            <MapContainer 
              center={userLocation || [20, 0]} 
              zoom={mapZoom} 
              style={{ height: "100%", width: "100%", zIndex: 0 }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              />
              
              <MapController center={userLocation || [20, 0]} zoom={mapZoom} />

              {/* Grid Warning Cells */}
              {gridCells.map((cell, idx) => {
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
                          <span className="text-xs font-semibold text-slate-600">Total Cases:</span>
                          <span className="text-xs font-bold bg-slate-100 px-1.5 rounded">{cell.count}</span>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-500 italic mt-2">
                          Hazards present: {Array.from(cell.types).join(', ')}
                        </p>
                      </div>
                    </Popup>
                  </Rectangle>
                );
              })}

              {/* Hazard Markers */}
              {hazardPosts.map((post) => (
                <CircleMarker 
                  key={post.id}
                  center={post.location as [number, number]} 
                  radius={6} 
                  pathOptions={{ 
                    color: 'white', 
                    fillColor: HAZARD_COLORS[post.hazard?.type || ''] || '#94a3b8', 
                    fillOpacity: 1, 
                    weight: 2 
                  }}
                >
                  <Popup className="font-sans">
                    <strong className="text-slate-800 text-sm">{post.title}</strong>
                  </Popup>
                </CircleMarker>
              ))}

              {/* 2. RENDER INDIVIDUAL COLOR-CODED MARKERS */}
                {hazardPosts.map((post) => {
                  const hazardColor = HAZARD_COLORS[post.hazard?.type || ''] || '#94a3b8'; // Default grey if type missing
                  
                  return (
                    <CircleMarker 
                      key={post.id}
                      center={post.location as [number, number]} 
                      radius={6} 
                      pathOptions={{ 
                        color: 'white', 
                        fillColor: hazardColor, 
                        fillOpacity: 1, 
                        weight: 2 
                      }}
                    >
                      <Popup className="font-sans">
                        <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: hazardColor }}>
                          {post.hazard?.type}
                        </span>
                        <strong className="text-slate-800 text-sm">{post.title}</strong>
                      </Popup>
                    </CircleMarker>
                  )
                })}

              {/* User Position Marker */}
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

            {!userLocation && !locationError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm z-50">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Acquiring Location...</p>
              </div>
            )}

            <div className="absolute bottom-3 left-3 right-3 bg-white/90 backdrop-blur-md p-2 rounded-xl border border-slate-200 shadow-sm z-400 pointer-events-none">
               <div className="flex items-center gap-2">
                  <Globe size={12} className="text-slate-400" />
                  <span className="text-[10px] font-bold text-slate-600 truncate">
                    {userLocation ? "Local Scan Active" : "Global Overview"}
                  </span>
               </div>
            </div>
          </div>
        </div>

        <div className="bg-indigo-600 p-6 rounded-3xl shadow-lg shadow-indigo-100">
           <h4 className="text-white font-bold text-lg leading-tight mb-2">Build Your Infrastructure</h4>
           <p className="text-indigo-100 text-xs mb-4">Share hazards to help your community stay safe.</p>
        </div>
      </aside>
    </div>
  );
};

export default HomeScreen;