import React, { useState } from 'react';
import { AlertTriangle, AlertCircle, X, ChevronUp, ChevronDown, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface Alert {
  id: string;
  type: 'critical' | 'info';
  title: string;
  timestamp: any;
  trends: string[];
  metricText: string;
  reasoning: string;
}

interface ActiveAlertsProps {
  alerts: Alert[];
  onDismiss: (id: string) => void;
  className?: string;
}

const renderTrendArrow = (trend: string) => {
  if (trend === 'up') return <TrendingUp size={14} />;
  if (trend === 'down') return <TrendingDown size={14} />;
  return <Minus size={14} />;
};

export const ActiveAlerts: React.FC<ActiveAlertsProps> = ({ alerts = [], onDismiss, className = "" }) => {
  const [expandedAlerts, setExpandedAlerts] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedAlerts(prev => ({ ...prev, [id]: !prev[id] }));
  };

  if (!alerts || alerts.length === 0) return null;

  return (
    <div className={`flex flex-col gap-3 animate-in fade-in slide-in-from-top-4 duration-500 ${className}`}>
      {alerts.map((alert) => {
        const isExpanded = !!expandedAlerts[alert.id];
        
        // Handle both Firestore Timestamps and standard Dates
        const dateObj = alert.timestamp?.toDate ? alert.timestamp.toDate() : new Date(alert.timestamp);
        const alertDate = dateObj.toLocaleString([], { 
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        });

        return (
          <div 
            key={alert.id}
            className={`group flex flex-col rounded-2xl border transition-all duration-300 overflow-hidden ${
              alert.type === 'critical' ? 'bg-red-50/50 border-red-100' : 'bg-yellow-50/50 border-yellow-100'
            }`}
          >
            <div 
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-black/5"
              onClick={() => toggleExpand(alert.id)}
            >
              <div className="flex items-center gap-4">
                <div className={alert.type === 'critical' ? 'text-red-500' : 'text-yellow-500'}>
                  {alert.type === 'critical' ? <AlertTriangle size={20} /> : <AlertCircle size={20} />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold uppercase tracking-tight text-xs text-slate-900">{alert.title}</h4>
                    <span className="text-[10px] font-medium opacity-40 px-2 py-0.5 bg-black/5 rounded-full">{alertDate}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {alert.trends?.map((trend, i) => (
                    <span key={i} className={alert.type === 'critical' ? 'text-red-600' : 'text-yellow-600'}>
                      {renderTrendArrow(trend)}
                    </span>
                  ))}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDismiss(alert.id); }}
                  className="p-1.5 hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-slate-600"
                >
                  <X size={16} />
                </button>
                <div className="text-slate-400">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
              </div>
            </div>

            {isExpanded && (
              <div className="px-12 pb-5 pt-0 animate-in slide-in-from-top-2 duration-300">
                <p className={`text-xs font-bold mb-2 ${alert.type === 'critical' ? 'text-red-700/80' : 'text-yellow-700/80'}`}>
                  {alert.metricText}
                </p>
                <p className={`text-sm leading-relaxed ${alert.type === 'critical' ? 'text-red-800' : 'text-yellow-800'}`}>
                  {alert.reasoning}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};