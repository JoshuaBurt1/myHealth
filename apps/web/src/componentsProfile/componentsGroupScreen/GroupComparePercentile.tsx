import React, { useState } from 'react';
import { BarChart2 } from 'lucide-react';
import type { CompareData } from '../compareUtils';

interface Props {
  data: CompareData;
}

export const GroupComparePercentile: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'recent' | 'average'>('recent');

  const renderCategory = (title: string, categoryData: CompareData['vitals'], colorClass: string, barColor: string) => {
    const activeMetrics = categoryData.filter(metric => 
      metric.members.some(m => (viewMode === 'recent' ? m.recentPercentile !== null : m.avgPercentile !== null))
    );

    if (activeMetrics.length === 0) return null;

    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
        <h3 className={`font-bold text-slate-700 mb-6 flex items-center gap-2 ${colorClass}`}>
          <BarChart2 size={18} /> {title}
        </h3>
        
        <div className="space-y-8">
          {activeMetrics.map(metric => (
            <div key={metric.metricKey} className="space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">{metric.metricName}</p>
              {metric.members.map(member => {
                const percentile = viewMode === 'recent' ? member.recentPercentile : member.avgPercentile;
                if (percentile === null) return null;

                return (
                  <div key={member.userId} className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-600 w-24 truncate">{member.displayName}</span>
                    
                    {/* 0-100 Bar Graph */}
                    <div className="flex-1 mx-4 h-3 bg-slate-100 rounded-full overflow-hidden flex items-center border border-slate-200/50">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                        style={{ width: `${percentile}%` }}
                      ></div>
                    </div>
                    
                    <span className="text-xs font-bold text-slate-500 w-12 text-right">
                      {Math.round(percentile)}
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
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          Percentile Rankings
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
        {renderCategory('Exercise Percentiles', data.exercises, 'text-emerald-500', 'bg-emerald-400')}
        {renderCategory('Vitals Percentiles', data.vitals, 'text-amber-500', 'bg-amber-400')}
      </div>
    </div>
  );
};