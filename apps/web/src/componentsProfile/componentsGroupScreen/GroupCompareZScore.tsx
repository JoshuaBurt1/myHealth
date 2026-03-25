import React, { useState, useMemo } from 'react';
import { Activity } from 'lucide-react';
import type { CompareData, CategoryComparison, MetricComparison } from '../compareUtils';

// --- KEY MAPS & LOGIC ---
const LOWER_IS_BETTER_METRICS = new Set([
  'bpSyst', 'bpDias', 'hr', 'rr', 'temp', 'glucose', 'cholesterol', 'uricAcid', 'lactate',
  'speed100m', 'speed400m', 'speed1Mile'
]);

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

// Memoized Row for Performance
const ZScoreRow = React.memo(({ 
  member, 
  viewMode, 
  metricKey,
  defaultBarColor 
}: { 
  member: MetricComparison; 
  viewMode: ViewMode; 
  metricKey: string;
  defaultBarColor: string 
}) => {
  const zScore = viewMode === 'recent' 
    ? member.recentZScore 
    : viewMode === 'average' 
      ? member.avgZScore 
      : member.recentVsAvgZScore;

  if (zScore === null) return null;

  const isLowerBetter = LOWER_IS_BETTER_METRICS.has(metricKey);
  const isPositiveOutlier = zScore > 0;
  const isGoodPerformance = isLowerBetter ? !isPositiveOutlier : isPositiveOutlier;

  const absZ = Math.min(Math.abs(zScore), 3);
  const widthPercent = (absZ / 3) * 50; 

  const barColorClass = isGoodPerformance ? defaultBarColor : 'bg-rose-400';

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-slate-600 w-24 truncate">{member.displayName}</span>
      <div className="flex-1 mx-4 h-3 bg-slate-50 rounded-full flex items-center relative border border-slate-100">
        <div className="absolute left-1/2 -top-0.5 -bottom-0.5 w-0.5 bg-slate-300 z-10 rounded-full"></div>
        <div 
          className={`absolute h-full rounded-full transition-all duration-500 ${
            zScore >= 0 ? `${barColorClass} left-1/2 rounded-l-none` : `${barColorClass} right-1/2 rounded-r-none`
          }`}
          style={{ width: `${widthPercent}%` }}
        ></div>
      </div>
      <span className="text-xs font-bold text-slate-500 w-10 text-right">
        {zScore > 0 ? '+' : ''}{zScore.toFixed(2)}
      </span>
    </div>
  );
});

export const GroupCompareZScore: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('recent');

  const processedCats = useMemo(() => {
    const filterByKeys = (source: CategoryComparison[], keySet: Set<string>) => {
      return source
        .filter(metric => keySet.has(metric.metricKey))
        .filter(metric => 
          metric.members.some(m => {
            const val = viewMode === 'recent' ? m.recentZScore : viewMode === 'average' ? m.avgZScore : m.recentVsAvgZScore;
            return val !== null;
          })
        );
    };

    return [
      { title: 'Strength', data: filterByKeys(data.exercises, STRENGTH_KEYS), colorText: 'text-blue-600', colorBg: 'bg-blue-400' },
      { title: 'Speed & Endurance', data: filterByKeys(data.exercises, SPEED_KEYS), colorText: 'text-sky-600', colorBg: 'bg-sky-400' },
      { title: 'Physiotherapy', data: filterByKeys(data.exercises, PHYSIO_KEYS), colorText: 'text-indigo-600', colorBg: 'bg-indigo-400' },
      { title: 'Yoga', data: filterByKeys(data.exercises, YOGA_KEYS), colorText: 'text-violet-600', colorBg: 'bg-violet-400' },
      { title: 'Mobility', data: filterByKeys(data.exercises, MOBILITY_KEYS), colorText: 'text-fuchsia-600', colorBg: 'bg-fuchsia-400' },
      { title: 'Standard Vitals', data: filterByKeys(data.vitals, VITAL_KEYS), colorText: 'text-purple-600', colorBg: 'bg-purple-400' },
      { title: 'Blood Tests', data: filterByKeys(data.vitals, BLOOD_TEST_KEYS), colorText: 'text-pink-600', colorBg: 'bg-pink-400' },
    ].filter(cat => cat.data.length > 0);
  }, [data, viewMode]);

  const renderCategoryBox = (cat: typeof processedCats[0]) => (
    <div key={cat.title} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
      <h3 className={`font-bold mb-6 flex items-center gap-2 ${cat.colorText}`}>
        <Activity size={18} /> {cat.title} Z-Scores
      </h3>
      <div className="space-y-8">
        {cat.data.map(metric => (
          <div key={metric.metricKey} className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b pb-1">{metric.metricName}</p>
            {metric.members.map(member => (
              <ZScoreRow 
                key={member.userId} 
                member={member} 
                viewMode={viewMode} 
                metricKey={metric.metricKey}
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
          Z-Score Comparisons
        </h2>
        <div className="bg-slate-100 p-1 rounded-xl flex items-center text-sm font-bold overflow-x-auto">
          <button onClick={() => setViewMode('recent')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'recent' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Recent</button>
          <button onClick={() => setViewMode('average')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'average' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Average</button>
          <button onClick={() => setViewMode('recentVsAvg')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'recentVsAvg' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>vs Avg Baseline</button>
        </div>
      </div>

      <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
        <p className="text-sm text-slate-600 leading-relaxed">
          {viewMode === 'recent' && <><strong>Current Deviation (Recent vs. Recent):</strong> Measures how your latest entry compares to the group's current average. A high score means you are a significant outlier in today's session.</>}
          {viewMode === 'average' && <><strong>Historical Consistency (Average vs. Average):</strong> Measures how your long-term average deviates from the group's overall norm. This identifies who consistently performs at a different tier than the rest of the group.</>}
          {viewMode === 'recentVsAvg' && <><strong>Breakout Performance (Recent vs. Average):</strong> Measures your current form against the group's established historical benchmark. This highlights significant personal improvements or "bad days" relative to the group's standard.</>}
        </p>
      </div>

      {/* Dynamic Masonry-style Grid filling the area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {processedCats.map(renderCategoryBox)}
      </div>
    </div>
  );
};