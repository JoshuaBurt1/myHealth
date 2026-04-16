import React from 'react';
import { Trophy, ArrowDownToLine, Calendar } from 'lucide-react';
import type { CompareData, CategoryComparison } from '../compareUtils';

interface Props {
  data: CompareData;
}

export const GroupRanking: React.FC<Props> = ({ data }) => {

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Unknown Date';
    return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderAllTimeStats = (category: CategoryComparison) => {
    const withHighs = [...category.members].filter(m => m.allTimeHigh !== null).sort((a, b) => (b.allTimeHigh as number) - (a.allTimeHigh as number));
    const withLows = [...category.members].filter(m => m.allTimeLow !== null).sort((a, b) => (a.allTimeLow as number) - (b.allTimeLow as number));

    if (withHighs.length === 0) return null;

    return (
      <div key={category.metricKey} className="mb-8 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
          <h4 className="font-bold text-slate-800 tracking-wider uppercase">{category.metricName}</h4>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-100">
          {/* Highs */}
          <div className="p-6">
            <h5 className="text-xs font-bold text-emerald-600 mb-4 flex items-center gap-2">
              <Trophy size={14} /> ALL-TIME HIGHS
            </h5>
            <div className="space-y-4">
              {withHighs.map((member, idx) => (
                <div key={`high-${member.userId}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-sm">{idx + 1}.</span>
                    <div>
                      <div className="text-sm font-bold text-slate-700">{member.displayName}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(member.allTimeHighDate)}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600">{member.allTimeHigh}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Lows */}
          <div className="p-6">
            <h5 className="text-xs font-bold text-blue-600 mb-4 flex items-center gap-2">
              <ArrowDownToLine size={14} /> ALL-TIME LOWS
            </h5>
            <div className="space-y-4">
              {withLows.map((member, idx) => (
                <div key={`low-${member.userId}`} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 font-mono text-sm">{idx + 1}.</span>
                    <div>
                      <div className="text-sm font-bold text-slate-700">{member.displayName}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar size={10} /> {formatDate(member.allTimeLowDate)}
                      </div>
                    </div>
                  </div>
                  <span className="font-bold text-blue-600">{member.allTimeLow}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!data.exercises || data.exercises.length === 0) {
    return null; 
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
          <Trophy className="text-amber-500" /> Hall of Records
        </h3>
        {data.exercises.map(renderAllTimeStats)}
      </div>
    </div>
  );
};