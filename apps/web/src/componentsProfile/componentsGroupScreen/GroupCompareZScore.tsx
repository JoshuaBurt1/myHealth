import React, { useState, useMemo } from 'react';
import { Users, Info } from 'lucide-react';
import type { CompareData, CategoryComparison } from '../compareUtils';
import { 
  VITAL_KEY_MAP, 
  STRENGTH_KEY_MAP, 
  SPEED_KEY_MAP, 
  PLYO_KEY_MAP, 
  ENDURANCE_KEY_MAP, 
  YOGA_KEY_MAP, 
  MOBILITY_KEY_MAP, 
  PHYSIO_KEY_MAP,
  getThresholds, 
  getStandardUnit 
} from '../profileConstants'; 

const VITAL_KEYS = new Set(Object.values(VITAL_KEY_MAP));
const STRENGTH_KEYS = new Set(Object.values(STRENGTH_KEY_MAP));
const SPEED_KEYS = new Set(Object.values(SPEED_KEY_MAP));
const PLYO_KEYS = new Set(Object.values(PLYO_KEY_MAP));
const ENDURANCE_KEYS = new Set(Object.values(ENDURANCE_KEY_MAP));
const YOGA_KEYS = new Set(Object.values(YOGA_KEY_MAP));
const MOBILITY_KEYS = new Set(Object.values(MOBILITY_KEY_MAP));
const PHYSIO_KEYS = new Set(Object.values(PHYSIO_KEY_MAP));

// Speed metrics are "lower is better" (shorter time)
const LOWER_IS_BETTER_METRICS = new Set([...SPEED_KEYS]);

const CATEGORIES_VITALS = [
  { title: 'Standard Vitals', keys: VITAL_KEYS },
];

const CATEGORIES_EXERCISES = [
  { title: 'Strength', keys: STRENGTH_KEYS },
  { title: 'Speed', keys: SPEED_KEYS },
  { title: 'Plyometrics', keys: PLYO_KEYS},
  { title: 'Endurance', keys: ENDURANCE_KEYS },
  { title: 'Physiotherapy', keys: PHYSIO_KEYS },
  { title: 'Mobility & Yoga', keys: new Set([...MOBILITY_KEYS, ...YOGA_KEYS]) },
];

// INTERFACES
interface Props {
  data: CompareData;
}

type ViewMode = 'recent' | 'average' | 'recentVsAvg';

interface GroupUserData {
  id: string;
  name: string;
  value: number;
  zScore: number;
}

interface GroupStats {
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  stdDev: number;
  skewness: number;
}

// HELPER FUNCTIONS
const extractGroupStats = (distribution: number[]): GroupStats | null => {
  if (!distribution || distribution.length === 0) return null;
  
  const sortedDist = [...distribution].sort((a, b) => a - b);
  const mean = distribution.reduce((a, b) => a + b, 0) / distribution.length;
  const mid = Math.floor(sortedDist.length / 2);
  const median = sortedDist.length % 2 !== 0 
    ? sortedDist[mid] 
    : (sortedDist[mid - 1] + sortedDist[mid]) / 2;
  const variance = distribution.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distribution.length;
  const stdDev = Math.sqrt(variance);

  const min = sortedDist[0];
  const max = sortedDist[sortedDist.length - 1];
  const q1 = sortedDist[Math.floor(sortedDist.length * 0.25)];
  const q3 = sortedDist[Math.floor(sortedDist.length * 0.75)];

  const skewness = stdDev === 0 ? 0 : 
    (distribution.reduce((acc, val) => acc + Math.pow(val - mean, 3), 0) / distribution.length) 
    / Math.pow(stdDev, 3);

  return { mean, median, min, max, q1, q3, stdDev, skewness };
};

// COMPONENTS
const GroupZScoreBellCurve = ({ 
  metricKey, 
  isVital,
  users, 
  stats
}: { 
  metricKey: string,
  isVital?: boolean,
  users: GroupUserData[],
  stats: GroupStats
}) => {
  const isLowerBetter = LOWER_IS_BETTER_METRICS.has(metricKey);

  const COLORS = {
    minMax: '#ec4899', 
    quartiles: '#f59e0b', 
    mean: '#6366f1', 
    median: '#8b5cf6', 
    sigmaLines: '#bfdbfe', 
    sigmaLabels: '#1e40af', 
    crit: '#ef4444', 
    user: '#0f172a',
  };

  const visualSkew = isLowerBetter ? -stats.skewness : stats.skewness;
  const peakX = Math.min(Math.max(50 - (visualSkew * 12), 20), 80);

  const mapZtoX = (z: number) => {
    if (z < 0) return Math.max(0, peakX + z * (peakX / 3));
    return Math.min(100, peakX + z * ((100 - peakX) / 3));
  };

  const baselineY = 35;
  const peakY = 15;
  
  const bellPath = `M 0 ${baselineY} C ${peakX * 0.6} ${baselineY}, ${peakX - 10} ${peakY}, ${peakX} ${peakY} S ${peakX + (100 - peakX) * 0.4} ${baselineY}, 100 ${baselineY}`;

  const thresholds = getThresholds(metricKey);
  const critLow = thresholds?.criticalLow;
  const critHigh = thresholds?.criticalHigh;

  const renderSigmaStep = (step: number) => {
    const x = mapZtoX(step);
    const label = step > 0 ? `+${step}σ` : `${step}σ`;
    if (step === 0) return null;
    return (
      <g key={`sigma-${step}`}>
        <line x1={x} y1={baselineY - 2} x2={x} y2={baselineY + 2} stroke={COLORS.sigmaLines} strokeWidth="0.5" />
        <text x={x} y={baselineY + 6} textAnchor="middle" fontSize="3" fontWeight="bold" fill={COLORS.sigmaLabels} opacity="0.5">
          {label}
        </text>
      </g>
    );
  };

  // Z-Score calculation 
const calculatePlotZ = (val: number, isLowerBetter: boolean) => {
  if (stats.stdDev === 0) {
    if (val === stats.mean) return 0;
    const direction = val > stats.mean ? 1 : -1;
    return isLowerBetter ? -direction * 3 : direction * 3;
  }
  
  const rawZ = (val - stats.mean) / stats.stdDev;
  return isLowerBetter ? -rawZ : rawZ;
};

const getX = (val: number) => {
  const plotZ = calculatePlotZ(val, isLowerBetter);
  return mapZtoX(plotZ);
};

const getAbsoluteX = (val: number) => {
  const plotZ = calculatePlotZ(val, isLowerBetter);
  return mapZtoX(plotZ);
};

const staggeredUsers = useMemo(() => {
  const levels: number[] = []; 
  const labelBuffer = 12;

  return [...users]
    .sort((a, b) => a.value - b.value) 
    .map((u) => {
      const uX = getX(u.value);
      
      let level = 0;
      while (levels[level] !== undefined && uX < levels[level] + labelBuffer) {
        level++;
      }
      
      levels[level] = uX;
      const yOffset = peakY - 2 - (level * 4.5); 
      return { ...u, uX, yOffset };
    });
}, [users, isLowerBetter, peakX, stats]);

  return (
    <div className="flex-1 w-content flex flex-col mt-2">
      <svg viewBox="0 -12 100 55" className="w-full h-auto overflow-visible">
        {[-3, -2, -1, 1, 2, 3].map(step => renderSigmaStep(step))}

        {isVital && critLow !== undefined && (
          <g>
            <line x1={getAbsoluteX(critLow)} y1="5" x2={getAbsoluteX(critLow)} y2={baselineY} stroke={COLORS.crit} strokeWidth="0.6" strokeDasharray="1 1" />
            <text x={getAbsoluteX(critLow)} y="3" textAnchor="middle" fontSize="3" fontWeight="bold" fill={COLORS.crit} className="uppercase">Crit Low</text>
          </g>
        )}
        {isVital && critHigh !== undefined && (
          <g>
            <line x1={getAbsoluteX(critHigh)} y1="5" x2={getAbsoluteX(critHigh)} y2={baselineY} stroke={COLORS.crit} strokeWidth="0.6" strokeDasharray="1 1" />
            <text x={getAbsoluteX(critHigh)} y="3" textAnchor="middle" fontSize="3" fontWeight="bold" fill={COLORS.crit} className="uppercase">Crit High</text>
          </g>
        )}

        <path d={bellPath} fill="none" stroke="#e2e8f0" strokeWidth="1.2" strokeLinecap="round" />
        
        <line x1={getX(stats.min)} y1={peakY} x2={getX(stats.min)} y2={baselineY} stroke={COLORS.minMax} strokeWidth="0.4" />
        <line x1={getX(stats.max)} y1={peakY} x2={getX(stats.max)} y2={baselineY} stroke={COLORS.minMax} strokeWidth="0.4" />
        <line x1={getX(stats.q1)} y1={peakY} x2={getX(stats.q1)} y2={baselineY} stroke={COLORS.quartiles} strokeWidth="0.4" />
        <line x1={getX(stats.q3)} y1={peakY} x2={getX(stats.q3)} y2={baselineY} stroke={COLORS.quartiles} strokeWidth="0.4" />
        <line x1={peakX} y1={peakY} x2={peakX} y2={baselineY} stroke={COLORS.mean} strokeWidth="0.6" />
        <line x1={getX(stats.median)} y1={peakY} x2={getX(stats.median)} y2={baselineY} stroke={COLORS.median} strokeWidth="0.4" strokeDasharray="1.5 1" />

        {staggeredUsers.map(u => (
          <g key={u.id} transform={`translate(${u.uX}, 0)`} className="transition-transform duration-700">
            <line x1="0" y1={u.yOffset + 1} x2="0" y2={baselineY} stroke={COLORS.user} strokeWidth="0.5" strokeDasharray="1 1" opacity="0.4" />
            <circle cx="0" cy={baselineY} r="1.5" fill={COLORS.user} />
            <text x="0" y={u.yOffset} textAnchor="middle" fill={COLORS.user} className="uppercase">
              <tspan fontSize="2.5" fontWeight="700">{u.name}</tspan>
              <tspan fontSize="2.5" fontWeight="700" dx="0.5">({u.value.toFixed(1)})</tspan>
            </text>
          </g>
        ))}
      </svg>

      <div className="flex flex-row flex-wrap justify-between items-center gap-x-2 mt-2 px-2 py-1.5 rounded-lg bg-blue-50/20 border border-blue-100/50">
        <LegendItem label="Min" value={stats.min} color={COLORS.minMax} />
        <LegendItem label="Q1" value={stats.q1} color={COLORS.quartiles} />
        <LegendItem label="Mean" value={stats.mean} color={COLORS.mean} bold />
        <LegendItem label="Median" value={stats.median} color={COLORS.median} bold />
        <LegendItem label="Q3" value={stats.q3} color={COLORS.quartiles} />
        <LegendItem label="Max" value={stats.max} color={COLORS.minMax} />
      </div>
    </div>
  );
};

const LegendItem = ({ label, value, color, bold = false }: { label: string, value: number, color: string, bold?: boolean }) => (
  <div className="flex items-center gap-1">
    <div className="w-1 h-2.5 rounded-full" style={{ backgroundColor: color }} />
    <span className="text-[7px] font-bold text-blue-900/50 uppercase tracking-tighter">{label}</span>
    <span className={`text-[9px] ${bold ? 'font-black text-indigo-900' : 'font-bold text-blue-800'}`}>
      {value.toFixed(1)}
    </span>
  </div>
);

export const GroupCompareZScore: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<ViewMode>('recent');

  const renderMetricRow = (metric: CategoryComparison, isVital: boolean) => {
  const usersWithValues: GroupUserData[] = [];
  const excludedNames: string[] = [];
  const baselineValues: number[] = [];

  metric.members.forEach(m => {
    const rawValue = viewMode === 'average' ? m.avgValue : m.recentValue;

    const baselineValue = viewMode === 'recent' ? m.recentValue : m.avgValue;
    
    if (baselineValue !== null && !isNaN(baselineValue)) {
      baselineValues.push(baselineValue);
    }

    if (rawValue !== null && !isNaN(rawValue)) {
      const zScore = viewMode === 'recent' 
        ? m.recentZScore 
        : viewMode === 'average' 
          ? m.avgZScore 
          : m.recentVsAvgZScore;

      usersWithValues.push({
        id: m.userId,
        name: m.displayName.split(' ')[0],
        value: rawValue,
        zScore: zScore ?? 0
      });
    } else {
      excludedNames.push(m.displayName);
    }
  });

  if (usersWithValues.length === 0) return null;

  // Build the curve using the baseline distribution
  const populationStats: GroupStats = extractGroupStats(baselineValues) || {
    mean: 0, median: 0, min: 0, max: 0, q1: 0, q3: 0, stdDev: 1, skewness: 0
  };

    const unit = getStandardUnit(metric.metricKey);

    return (
      <div key={metric.metricKey} className="space-y-1 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
              {metric.metricName}
            </span>
            {unit && <span className="text-[8px] font-bold text-slate-400">{unit}</span>}
          </div>
          
          <div className="flex items-center gap-3 group/n relative">
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter cursor-help border-b border-dotted border-slate-300">
              Group N={usersWithValues.length}
            </span>
            
            {excludedNames.length > 0 && (
              <div className="absolute right-0 bottom-full mb-2 hidden group-hover/n:block z-50 bg-slate-800 text-white text-[9px] p-2 rounded shadow-xl whitespace-nowrap">
                <p className="font-bold border-b border-slate-600 mb-1 pb-1">Missing Data:</p>
                {excludedNames.map(name => <div key={name}>{name}</div>)}
              </div>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          <GroupZScoreBellCurve 
            metricKey={metric.metricKey}
            isVital={isVital}
            users={usersWithValues} 
            stats={populationStats} 
          />
        </div>
      </div>
    );
  };

  const renderCategoryGroup = (
    groupTitle: string, 
    categories: {title: string, keys: Set<string>}[],
    dataSource: CategoryComparison[]
  ) => {
    const isVitalGroup = groupTitle === 'Vitals';
    const activeCategories = categories.map(cat => {
      const metrics = dataSource.filter(m => cat.keys.has(m.metricKey));
      return { ...cat, metrics };
    }).filter(cat => cat.metrics.length > 0);

    if (activeCategories.length === 0) return null;

    return (
      <div className="mb-8 last:mb-0">
        <div className="border-b border-slate-200 pb-3 mb-4">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-2">
            {groupTitle}
          </h4>
          
          <div className="flex gap-2 text-xs text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <Info size={16} className="shrink-0 text-indigo-400 mt-0.5" />
            <div className="space-y-1">
              {isVitalGroup ? (
                <>
                  <p>
                    While clustering near the group mean is common, staying within the critical threshold bounds (red dashed lines) is the absolute priority for vitals.
                  </p>
                  <p className="text-[10px] text-slate-400"> * Standard deviation (σ) spreads show how uniformly the group is performing. </p>
                </>
              ) : (
                <p> Curve shifting indicates overall group performance. A tighter curve means the group is highly competitive and similar in output.</p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {activeCategories.map(cat => (
            <div key={cat.title}>
              <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                {cat.title}
              </h5>
              <div className="grid grid-cols-1 [@media(min-width:450px)]:grid-cols-2 gap-4">
                {cat.metrics.map(m => renderMetricRow(m, isVitalGroup))} 
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-transparent md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 overflow-hidden mt-0 md:mt-6 w-full">
      <div className="p-2 md:p-5 border-b-0 md:border-b bg-transparent md:bg-slate-50/50 flex flex-col gap-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-2 gap-4 px-2 md:px-0">
          <h2 className="text-xl md:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-500" size={24} />
            Group Z-Score Distributions
          </h2>
          <div className="bg-white md:bg-slate-100 p-1 rounded-xl flex items-center text-sm font-bold overflow-x-auto border border-slate-200 md:border-none shadow-sm md:shadow-none">
            <button onClick={() => setViewMode('recent')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'recent' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Recent</button>
            <button onClick={() => setViewMode('average')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'average' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Average</button>
            <button onClick={() => setViewMode('recentVsAvg')} className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${viewMode === 'recentVsAvg' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>vs Avg Baseline</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-600 leading-relaxed font-medium text-center md:text-left">
            {viewMode === 'recent' && <><strong>Current Deviation (Recent):</strong> Mapping where everyone in the group currently stands based on their latest logged sessions.</>}
            {viewMode === 'average' && <><strong>Historical Consistency (Average):</strong> Mapping the group's long-term established normals against each other.</>}
            {viewMode === 'recentVsAvg' && <><strong>Breakout Performance (Recent vs Avg):</strong> Mapping today's performance against historical benchmarks to find breakouts.</>}
          </p>
        </div>
      </div>

      <div className="p-4 md:p-5 space-y-2">
        {data?.vitals?.length > 0 && renderCategoryGroup('Vitals', CATEGORIES_VITALS, data.vitals)}
        {data?.exercises?.length > 0 && renderCategoryGroup('Exercises', CATEGORIES_EXERCISES, data.exercises)}
        
        {(!data?.vitals?.length && !data?.exercises?.length) && (
          <div className="text-center p-6 text-slate-500 text-sm">
            Not enough group data available for comparison.
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupCompareZScore;