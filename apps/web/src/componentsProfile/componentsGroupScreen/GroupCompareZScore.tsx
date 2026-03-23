import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import type { CompareData } from '../compareUtils';

interface Props {
  data: CompareData;
}

export const GroupCompareZScore: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'recent' | 'average'>('recent');

  const renderCategory = (title: string, categoryData: CompareData['vitals'], colorClass: string, barColor: string) => {
    // Filter out metrics where NO ONE has data
    const activeMetrics = categoryData.filter(metric => 
      metric.members.some(m => (viewMode === 'recent' ? m.recentZScore !== null : m.avgZScore !== null))
    );

    if (activeMetrics.length === 0) return null;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
        <h3 className={`font-bold text-slate-700 mb-6 flex items-center gap-2 ${colorClass}`}>
          <Activity size={18} /> {title}
        </h3>
        
        <div className="space-y-8">
          {activeMetrics.map(metric => (
            <div key={metric.metricKey} className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">{metric.metricName}</p>
              {metric.members.map(member => {
                const zScore = viewMode === 'recent' ? member.recentZScore : member.avgZScore;
                if (zScore === null) return null;

                // Math.min/max constrains the visual bar to +/- 3 std deviations
                const absZ = Math.min(Math.abs(zScore), 3);
                const widthPercent = (absZ / 3) * 50; 

                return (
                  <div key={member.userId} className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 w-24 truncate">{member.displayName}</span>
                    
                    {/* Centered Bar Graph */}
                    <div className="flex-1 mx-4 h-3 bg-slate-50 rounded-full flex items-center relative border border-slate-100">
                      {/* Center Zero Line */}
                      <div className="absolute left-1/2 -top-0.5 -bottom-0.5 w-0.5 bg-slate-300 z-10 rounded-full"></div>
                      
                      <div 
                        className={`absolute h-full rounded-full transition-all duration-500 ${zScore >= 0 ? `${barColor} left-1/2 rounded-l-none` : 'bg-rose-400 right-1/2 rounded-r-none'}`}
                        style={{ width: `${widthPercent}%` }}
                      ></div>
                    </div>
                    
                    <span className="text-xs font-bold text-slate-500 w-10 text-right">
                      {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          Z-Score Comparisons
        </h2>
        <div className="bg-slate-100 p-1 rounded-xl flex items-center text-sm font-bold">
          <button 
            onClick={() => setViewMode('recent')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${viewMode === 'recent' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Recent
          </button>
          <button 
            onClick={() => setViewMode('average')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${viewMode === 'average' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
          >
            Average
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {renderCategory('Exercise Z-Scores', data.exercises, 'text-blue-500', 'bg-blue-400')}
        {renderCategory('Vitals Z-Scores', data.vitals, 'text-purple-500', 'bg-purple-400')}
      </div>
    </div>
  );
};