// MapComponents.tsx
import { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Popup, useMap, Rectangle, Marker } from 'react-leaflet';
import { Search, X, Globe } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Constants & Utils
import { HAZARD_TYPES, HELP_TYPES, PUBLIC_TYPES, TOPIC_TYPES, HAZARD_COLORS, HELP_COLORS, PUBLIC_COLORS, TOPIC_COLORS } from '../componentsForum/forumConstants';
import { getShapeIcon } from '../componentsForum/mapUtils';
import type { Post } from '../componentsForum/forum';

// --- MAP CONTROLLER ---
export const MapController = ({ userLocation, zoom }: { userLocation: [number, number] | null; zoom: number }) => {
  const map = useMap();
  
  useEffect(() => { map.setZoom(zoom); }, [zoom, map]);
  useEffect(() => { if (userLocation) map.panTo(userLocation); }, [userLocation, map]);
  
  // Force a resize check when the map container mounts/unmounts (vital for modal map rendering)
  useEffect(() => {
    const timer = setTimeout(() => { map.invalidateSize(); }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  
  return null;
};

// --- REUSABLE MAP CONTENT ---
export const MapContent = ({ userLocation, mapZoom, activeSection, gridCells, posts }: any) => {
  return (
    <>
      <TileLayer 
        attribution='&copy; OpenStreetMap' 
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" 
      />
      <MapController userLocation={userLocation} zoom={mapZoom} />
      
      {/* Grid Cells for Population Health (Heatmap style) */}
      {activeSection === 'Population Health' && gridCells.map((cell: any, idx: number) => {
        let color = cell.count > 5 ? '#ef4444' : cell.count >= 3 ? '#f97316' : '#fbbf24';
        return (
          <Rectangle key={`grid-${idx}`} bounds={cell.bounds} pathOptions={{ color: color, weight: 1, fillOpacity: 0.15 }}>
            <Popup className="font-sans">
              <div className="min-w-35">
                <div className="text-[10px] font-black uppercase text-slate-400 mb-1 border-b pb-1">Area Warning Level</div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-bold text-slate-700">Severity:</span>
                  <span className="text-sm font-black" style={{ color }}>{cell.count > 5 ? 'Severe' : cell.count >= 3 ? 'Elevated' : 'Low'}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-semibold text-slate-600">Reports:</span>
                  <span className="text-xs font-bold bg-slate-100 px-1.5 rounded">{cell.count}</span>
                </div>
                <p className="text-[10px] font-semibold text-slate-500 italic mt-2">Hazards: {Array.from(cell.types).join(', ')}</p>
              </div>
            </Popup>
          </Rectangle>
        );
      })}

      {/* Post Markers */}
      {posts.map((post: Post) => {
        const elements = [];

        // --- POPULATION HEALTH SECTION ---
        if (activeSection === 'Population Health') {
          // 1. Hazard Markers (Triangles - Based on Community Confirmations)
          if (post.hazard?.type && post.confirm && post.confirm.length > 0) {
            const hazardColor = HAZARD_COLORS[post.hazard.type] || '#ef4444';
            const hazardIcon = getShapeIcon('triangle', hazardColor);
            
            post.confirm.forEach((c: any, idx: number) => {
              if (c.location) elements.push(
                <Marker key={`conf-${post.id}-${idx}`} position={c.location as [number, number]} icon={hazardIcon}>
                  <Popup className="font-sans">
                    <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: hazardColor }}>{post.hazard!.type}</span>
                    <strong className="text-slate-800 text-sm">{post.title}</strong>
                    <div className="text-xs text-slate-500 italic mt-1">Community Confirmed Position</div>
                  </Popup>
                </Marker>
              );
            });
          } 
          
          // 2. Help/Events Markers (Squares)
          if (post.help?.type && post.location) {
            const helpColor = HELP_COLORS[post.help.type] || '#6366f1';
            elements.push(
              <Marker key={`help-${post.id}`} position={post.location as [number, number]} icon={getShapeIcon('square', helpColor)}>
                <Popup className="font-sans">
                  <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: helpColor }}>{post.help.type} (Event)</span>
                  <strong className="text-slate-800 text-sm">{post.title}</strong>
                  <div className="text-xs text-slate-500 italic mt-1">Location via {post.authorName}</div>
                </Popup>
              </Marker>
            );
          }

          // 3. Public Access Markers (Circles)
          if (post.public?.type && post.location) {
            const publicColor = PUBLIC_COLORS[post.public.type] || '#10b981';
            elements.push(
              <Marker key={`pub-${post.id}`} position={post.location as [number, number]} icon={getShapeIcon('circle', publicColor)}>
                <Popup className="font-sans">
                  <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: publicColor }}>{post.public.type}</span>
                  <strong className="text-slate-800 text-sm">{post.title}</strong>
                  <div className="text-xs text-slate-500 italic mt-1">Resource Location</div>
                </Popup>
              </Marker>
            );
          }
        } 
        
        // --- PERSONAL HEALTH & OFF-TOPIC SECTIONS ---
        else if (post.location) {
          let markerColor = '#94a3b8';
          let labelText: string = post.forumSection;
          let shape: 'star' | 'diamond' | 'circle' = 'circle'; 

          if (post.forumSection === 'Personal Health') {
            shape = 'star'; // Star for Personal Health
            markerColor = post.topic ? (TOPIC_COLORS[post.topic] || '#6366f1') : '#6366f1';
            labelText = post.topic || 'General Health';
          } else if (post.forumSection === 'Off Topic') {
            shape = 'diamond'; // Diamond for Off Topic
            markerColor = '#64748b'; 
            labelText = 'Off Topic';
          }

          elements.push(
            <Marker key={`other-${post.id}`} position={post.location as [number, number]} icon={getShapeIcon(shape, markerColor)}>
              <Popup className="font-sans">
                <span className="text-[10px] font-black uppercase tracking-widest block mb-1" style={{ color: markerColor }}>
                  {labelText}
                </span>
                <strong className="text-slate-800 text-sm">{post.title}</strong>
                <div className="text-xs text-slate-500 italic mt-1">Shared by {post.authorName}</div>
              </Popup>
            </Marker>
          );
        }

        return elements;
      })}

      {/* User Location Pin */}
      {userLocation && (
        <Marker position={userLocation}>
          <Popup className="font-sans">
            <div className="text-center">
              <p className="text-[10px] font-black uppercase text-indigo-500 tracking-widest mb-1">Your Device</p>
              <strong className="text-slate-800 text-sm">Current Location</strong>
            </div>
          </Popup>
        </Marker>
      )}
    </>
  );
};

// --- EXPANDABLE MAP WRAPPER ---
export const ExpandableMap = ({ userLocation, mapZoom, activeSection, filteredPosts }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // unified filter state for the dropdown
  const [mapFilter, setMapFilter] = useState('none');

  // 1. Filter pins locally based on the dropdown selection
  const displayedPosts = useMemo(() => {
    if (mapFilter === 'none') return filteredPosts;
    
    return filteredPosts.filter((p: any) => {
      if (activeSection === 'Population Health') {
        // Check Hazards, Help (Events), or Public Access types
        return p.hazard?.type === mapFilter || 
               p.help?.type === mapFilter || 
               p.public?.type === mapFilter;
      } else {
        // Check Personal Health topics
        return p.topic === mapFilter;
      }
    });
  }, [filteredPosts, mapFilter, activeSection]);

  // 2. Compute Map Grid Cells dynamically based on filtered map pins
  const gridCells = useMemo(() => {
    const GRID_SIZE = 0.05;
    const cells: Record<string, any> = {};
    displayedPosts.forEach((post: any) => {
      if (!post.confirm || !Array.isArray(post.confirm)) return;
      post.confirm.forEach((c: any) => { 
        if (!c.location) return;
        const [lat, lng] = c.location;
        const key = `${Math.floor(lat / GRID_SIZE)}_${Math.floor(lng / GRID_SIZE)}`;
        
        if (!cells[key]) {
          cells[key] = {
            bounds: [
              [Math.floor(lat / GRID_SIZE) * GRID_SIZE, Math.floor(lng / GRID_SIZE) * GRID_SIZE], 
              [(Math.floor(lat / GRID_SIZE) + 1) * GRID_SIZE, (Math.floor(lng / GRID_SIZE) + 1) * GRID_SIZE]
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
  }, [displayedPosts]);

  return (
    <>
      {/* SMALL MAP PREVIEW */}
      <div className="relative h-48 bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden shadow-inner z-0 group">
        <button 
          onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
          className="absolute top-3 right-3 z-1001 flex items-center gap-2 bg-white/90 backdrop-blur-md hover:bg-white text-indigo-600 px-3 py-1.5 rounded-xl border border-slate-200 shadow-lg transition-all active:scale-95 group/btn"
        >
          <Globe size={14} className="group-hover/btn:animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-tight">Expand Map</span>
        </button>

        <div className="absolute inset-0 z-1000 pointer-events-none transition-colors" />
        
        <MapContainer center={userLocation || [20, 0]} zoom={mapZoom} style={{ height: "100%", width: "100%", zIndex: 0 }} zoomControl={false}>
          <MapContent userLocation={userLocation} mapZoom={mapZoom} activeSection={activeSection} gridCells={gridCells} posts={displayedPosts} />
        </MapContainer>
      </div>

      {/* FULLSCREEN MAP MODAL */}
      {isExpanded && (
        <div 
          className="fixed inset-0 z-9999 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-8" 
          onClick={() => setIsExpanded(false)}
        >
          <div 
            className="relative w-full h-full max-w-6xl max-h-[85vh] mt-16 bg-slate-100 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()} 
          >
            {/* Modal Header & DYNAMIC DROPDOWN FILTER */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-white z-10 shrink-0 shadow-sm">
              <div className="flex-1 max-w-md">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                    <Search size={18} />
                  </div>
                  <div className="flex-1">
                    <select 
                      value={mapFilter} 
                      onChange={(e) => { setMapFilter(e.target.value); e.target.blur(); }} 
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 outline-none focus:border-indigo-500 focus:bg-white text-sm font-medium text-slate-700 transition-colors cursor-pointer"
                    >
                      <option value="none">All Topics & Categories</option>
                      {activeSection === 'Population Health' ? (
                        <>
                          <optgroup label="── Hazards ──">
                            {HAZARD_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                          </optgroup>
                          <optgroup label="── Events ──">
                            {HELP_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                          </optgroup>
                          <optgroup label="── Public Access ──">
                            {PUBLIC_TYPES.map(type => <option key={type} value={type}>{type}</option>)}
                          </optgroup>
                        </>
                      ) : (
                        <optgroup label="── Categories ──">
                          {TOPIC_TYPES.map(topic => <option key={topic} value={topic}>{topic}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => setIsExpanded(false)} 
                className="p-2 ml-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Expanded Leaflet Container */}
            <div className="flex-1 relative z-0">
              <MapContainer center={userLocation || [20, 0]} zoom={mapZoom} style={{ height: "100%", width: "100%" }} zoomControl={true}>
                <MapContent userLocation={userLocation} mapZoom={mapZoom} activeSection={activeSection} gridCells={gridCells} posts={displayedPosts} />
              </MapContainer>
            </div>
          </div>
        </div>
      )}
    </>
  );
};