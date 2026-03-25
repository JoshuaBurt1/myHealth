import React, { useState, useMemo } from 'react';
import { BarChart2 } from 'lucide-react';
import type { CompareData, CategoryComparison, MetricComparison } from '../compareUtils';

// --- KEY MAPS & LOGIC ---
const VITAL_KEYS = new Set(['bpSyst', 'bpDias', 'hr', 'spo2', 'rr', 'temp']);
const BLOOD_TEST_KEYS = new Set(['glucose', 'cholesterol', 'ketones', 'uricAcid', 'lactate', 'hemoglobin', 'hematocrit']);
const STRENGTH_KEYS = new Set(['benchPress', 'squat', 'deadlift']);
const SPEED_KEYS = new Set(['speed100m', 'speed400m', 'speed1Mile', 'steps']);
const PHYSIO_KEYS = new Set(['shoulderExtRot', 'tibialisRaise', 'copenhagenPlank', 'assistedPistolSquat', 'singleLegRdl', 'towelScrunches', 'serratusPunch', 'pallofPress', 'nerveGlides', 'proneYtw']);
const YOGA_KEYS = new Set(['downwardDog', 'warrior1', 'warrior2', 'cobraPose', 'childsPose', 'treePose', 'pigeonPose', 'trianglePose', 'crowPose', 'savasana']);
const MOBILITY_KEYS = new Set(['worldsGreatestStretch', 'hip9090Switch', 'tSpineRotation', 'deepSquatHold', 'ankleDorsiflexion', 'cossackSquat', 'inchworms', 'shoulderPassThrough']);

interface Props {
  data: CompareData;
}

type ViewMode = 'recent' | 'average' | 'recentVsAvg';

const PercentileRow = React.memo(({ 
  member, 
  viewMode, 
  defaultBarColor 
}: { 
  member: MetricComparison; 
  viewMode: ViewMode; 
  defaultBarColor: string 
}) => {
  const percentile = viewMode === 'recent' 
    ? member.recentPercentile 
    : viewMode === 'average' 
      ? member.avgPercentile 
      : member.recentVsAvgPercentile;

  if (percentile === null) return null;

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-600 w-24 truncate">{member.displayName}</span>
      <div className="flex-1 mx-4 h-3 bg-slate-100 rounded-full overflow-hidden flex items-center border border-slate-200/50">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${defaultBarColor}`}
          style={{ width: `${percentile}%` }}
        ></div>
      </div>
      <span className="text-xs font-bold text-slate-500 w-12 text-right">
        {Math.round(percentile)}
      </span>
    </div>
  );
});

export const GroupComparePercentile: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('recent');

  const processedCats = useMemo(() => {
    const filterByKeys = (source: CategoryComparison[], keySet: Set<string>) => {
      return source
        .filter(metric => keySet.has(metric.metricKey))
        .filter(metric => 
          metric.members.some(m => {
            const val = viewMode === 'recent' ? m.recentPercentile : viewMode === 'average' ? m.avgPercentile : m.recentVsAvgPercentile;
            return val !== null;
          })
        );
    };

    return [
      { title: 'Strength', data: filterByKeys(data.exercises, STRENGTH_KEYS), colorText: 'text-emerald-600', colorBg: 'bg-emerald-400' },
      { title: 'Speed & Endurance', data: filterByKeys(data.exercises, SPEED_KEYS), colorText: 'text-teal-600', colorBg: 'bg-teal-400' },
      { title: 'Physiotherapy', data: filterByKeys(data.exercises, PHYSIO_KEYS), colorText: 'text-cyan-600', colorBg: 'bg-cyan-400' },
      { title: 'Yoga', data: filterByKeys(data.exercises, YOGA_KEYS), colorText: 'text-green-600', colorBg: 'bg-green-400' },
      { title: 'Mobility', data: filterByKeys(data.exercises, MOBILITY_KEYS), colorText: 'text-lime-600', colorBg: 'bg-lime-400' },
      { title: 'Standard Vitals', data: filterByKeys(data.vitals, VITAL_KEYS), colorText: 'text-amber-600', colorBg: 'bg-amber-400' },
      { title: 'Blood Tests', data: filterByKeys(data.vitals, BLOOD_TEST_KEYS), colorText: 'text-orange-600', colorBg: 'bg-orange-400' },
    ].filter(cat => cat.data.length > 0);
  }, [data, viewMode]);

  const renderCategoryBox = (cat: typeof processedCats[0]) => (
    <div key={cat.title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className={`font-bold mb-6 flex items-center gap-2 ${cat.colorText}`}>
        <BarChart2 size={18} /> {cat.title} Percentiles
      </h3>
      <div className="space-y-8">
        {cat.data.map(metric => (
          <div key={metric.metricKey} className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">{metric.metricName}</p>
            {metric.members.map(member => (
              <PercentileRow 
                key={member.userId} 
                member={member} 
                viewMode={viewMode} 
                defaultBarColor={cat.colorBg}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4 gap-4">
        <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
          Percentile Rankings
        </h2>
        <div className="bg-slate-100 p-1 rounded-xl flex items-center text-sm font-bold overflow-x-auto">
          <button onClick={() => setViewMode('recent')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'recent' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Recent</button>
          <button onClick={() => setViewMode('average')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'average' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Average</button>
          <button onClick={() => setViewMode('recentVsAvg')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'recentVsAvg' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>vs Avg Baseline</button>
        </div>
      </div>

      <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <p className="text-sm text-slate-600 leading-relaxed">
          {viewMode === 'recent' && <><strong>Current Ranking (Recent vs. Recent):</strong> Shows your position in the group right now. A score of 90 means your latest entry was higher than 90% of other members' most recent entries.</>}
          {viewMode === 'average' && <><strong>Long-Term Standing (Average vs. Average):</strong> Compares your typical performance level against everyone else's typical level. This reflects your cumulative rank and consistent ability over time.</>}
          {viewMode === 'recentVsAvg' && <><strong>vs. Group Baseline (Recent vs. Average):</strong> Ranks your current performance against the group's historical average. It shows if your "today" is better than the group's "usually."</>}
        </p>
      </div>

      {/* lg:items-start ensures dynamic masonry grid behavior instead of stretching */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {processedCats.map(renderCategoryBox)}
      </div>
    </div>
  );
};