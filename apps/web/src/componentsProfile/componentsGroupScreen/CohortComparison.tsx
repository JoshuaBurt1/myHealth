// CohortComparison.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, RefreshCw, Info } from 'lucide-react';

import { 
  VITAL_KEY_MAP, 
  BLOODTEST_KEY_MAP,
  SYMPTOM_KEY_MAP,
  DIET_KEY_MAP,
  MICRONUTRIENT_KEY_MAP, 
  STRENGTH_KEY_MAP,
  SPEED_KEY_MAP, 
  PLYO_KEY_MAP, 
  ENDURANCE_KEY_MAP, 
  YOGA_KEY_MAP, 
  MOBILITY_KEY_MAP, 
  PHYSIO_KEY_MAP,
  getThresholds,
  getStandardUnit,
} from '../profileConstants'; 

const VITAL_KEYS = new Set(Object.values(VITAL_KEY_MAP));
const BLOODTEST_KEYS = new Set(Object.values(BLOODTEST_KEY_MAP));
const SYMPTOM_KEYS = new Set(Object.values(SYMPTOM_KEY_MAP));
const DIET_KEYS = new Set(Object.values(DIET_KEY_MAP));
const MICRONUTRIENT_KEYS = new Set(Object.values(MICRONUTRIENT_KEY_MAP));
const STRENGTH_KEYS = new Set(Object.values(STRENGTH_KEY_MAP));
const SPEED_KEYS = new Set(Object.values(SPEED_KEY_MAP));
const PLYO_KEYS = new Set(Object.values(PLYO_KEY_MAP));
const ENDURANCE_KEYS = new Set(Object.values(ENDURANCE_KEY_MAP));
const YOGA_KEYS = new Set(Object.values(YOGA_KEY_MAP));
const MOBILITY_KEYS = new Set(Object.values(MOBILITY_KEY_MAP));
const PHYSIO_KEYS = new Set(Object.values(PHYSIO_KEY_MAP));

const ALL_ALLOWED_KEYS = new Set([
  ...VITAL_KEYS, ...BLOODTEST_KEYS, ...SYMPTOM_KEYS, ...DIET_KEYS, ...MICRONUTRIENT_KEYS,
  ...STRENGTH_KEYS, ...SPEED_KEYS, ...PLYO_KEYS, ...ENDURANCE_KEYS, ...PHYSIO_KEYS, ...YOGA_KEYS, ...MOBILITY_KEYS
]);

const LOWER_IS_BETTER_METRICS = new Set([...SPEED_KEYS]);

const CATEGORIES_VITALS = [
  { title: 'Standard Vitals', keys: VITAL_KEYS },
  { title: 'Blood test Values', keys: BLOODTEST_KEYS },
];

const CATEGORIES_DIETS = [
  { title: 'Macronutrients', keys: DIET_KEYS },
  { title: 'Micronutrients', keys: MICRONUTRIENT_KEYS },
];

const CATEGORIES_EXERCISES = [
  { title: 'Strength', keys: STRENGTH_KEYS },
  { title: 'Speed', keys: SPEED_KEYS },
  { title: 'Plyometrics', keys: PLYO_KEYS},
  { title: 'Endurance', keys: ENDURANCE_KEYS },
  { title: 'Physiotherapy', keys: PHYSIO_KEYS },
  { title: 'Mobility & Yoga', keys: new Set([...MOBILITY_KEYS, ...YOGA_KEYS]) },
];

const getDisplayName = (key: string): string => {
  const ALL_MAPS = {
    ...VITAL_KEY_MAP,
    ...BLOODTEST_KEY_MAP,
    ...SYMPTOM_KEY_MAP,
    ...DIET_KEY_MAP,
    ...MICRONUTRIENT_KEY_MAP,
    ...STRENGTH_KEY_MAP,
    ...SPEED_KEY_MAP,
    ...PLYO_KEY_MAP,
    ...ENDURANCE_KEY_MAP,
    ...YOGA_KEY_MAP,
    ...MOBILITY_KEY_MAP,
    ...PHYSIO_KEY_MAP,
  };

  // Find the display name where the value matches the metric key
  const displayName = Object.keys(ALL_MAPS).find(name => ALL_MAPS[name] === key);  
  return displayName || key.replace(/([A-Z])/g, ' $1').trim();
};

interface Props {
  userId: string | undefined;
  userData: any; 
  userSex: string;
  userAge: number;
}

type CohortRange = 1 | 3 | 10;

interface MetricStat {
  recent: number;
  avg: number;
}

interface ProcessedMetric {
  key: string;
  name: string;
  unit: string;
  zScore: number | null;
  sampleSize: number;
  skewness: number;
  userValue: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
  stdDev: number;
}

// Convert values to numbers and filter out invalid entries
const extractStats = (dataArr: any[]): MetricStat | null => {
  if (!dataArr || !Array.isArray(dataArr) || dataArr.length === 0) return null;  
  const nums = dataArr
    .map(item => parseFloat(item.value))
    .filter(n => !isNaN(n));
    
  if (nums.length === 0) return null;
  
  const lastFive = nums.slice(-5);
  const recent = lastFive.reduce((a, b) => a + b, 0) / lastFive.length;

  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  
  return { recent, avg };
};

const calculateAge = (dobString: string): number => {
  if (!dobString) return 0;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
};

const ZScoreBellCurve = ({ 
  skewness, 
  metricKey, 
  isVital,
  userValue,
  stats
}: { 
  zScore: number, 
  skewness: number, 
  metricKey: string,
  isVital?: boolean,
  userValue: number,
  stats: { mean: number, median: number, q1: number, q3: number, min: number, max: number, stdDev: number }
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
    user: '#000000', 
  };

  const visualSkew = isLowerBetter ? -skewness : skewness;
  const peakX = Math.min(Math.max(50 - (visualSkew * 12), 20), 80);

  const mapZtoX = (z: number) => {
    if (z < 0) return Math.max(0, peakX + z * (peakX / 3));
    return Math.min(100, peakX + z * ((100 - peakX) / 3));
  };

  const getX = (val: number) => {
    if (stats.stdDev === 0) return peakX;
    const rawZ = (val - stats.mean) / stats.stdDev;
    const plotZ = isLowerBetter ? -rawZ : rawZ;
    return mapZtoX(plotZ);
  };

  const getAbsoluteX = (val: number) => {
    if (stats.stdDev === 0) return peakX;
    const rawZ = (val - stats.mean) / stats.stdDev;
    const plotZ = isLowerBetter ? -rawZ : rawZ;
    return mapZtoX(plotZ);
  };

  const userX = getX(userValue);
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

  return (
    <div className="flex-1 w-content flex flex-col mt-2">
      <svg viewBox="0 -8 100 50" className="w-full h-auto overflow-visible">
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

        <g transform={`translate(${userX}, 0)`} className="transition-transform duration-700">
          <line x1="0" y1={peakY} x2="0" y2={baselineY} stroke={COLORS.user} strokeWidth="1" strokeLinecap="round" />
          <circle cx="0" cy={baselineY} r="1.8" fill={COLORS.user} />
          <text x="0" y={peakY - 3} textAnchor="middle" fill={COLORS.user} className="uppercase">
            <tspan fontSize="3" fontWeight="600">You</tspan>
            <tspan fontSize="3" fontWeight="600" dx="1.5">({userValue.toFixed(1)})</tspan>
          </text>
        </g>
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

const CohortComparison: React.FC<Props> = ({ userId, userData, userSex, userAge }) => {
  const [cohortRange, setCohortRange] = useState<CohortRange>(10);
  const [loading, setLoading] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fetch and process cohort sample
  useEffect(() => {
    if (!userSex || !userAge) return;

    const fetchCohort = async () => {
      setLoading(true);
      try {
        const q = query(
          collectionGroup(db, 'profile'), 
          where('sex', '==', userSex)
        );
        
        const snapshot = await getDocs(q);
        let validMatches: any[] = [];

        snapshot.forEach((doc) => {
          if (doc.ref.path.includes(userId || '')) return;

          const data = doc.data();
          let docAge: number | null = null;

          if (data.dob) {
            docAge = calculateAge(data.dob);
          } else if (data.age && Array.isArray(data.age) && data.age.length > 0) {
            docAge = parseInt(data.age[data.age.length - 1].value);
          }

          if (docAge === null || isNaN(docAge)) return;

          let isMatch = false;
          if (cohortRange === 1 && docAge === userAge) isMatch = true;
          if (cohortRange === 3 && Math.floor(docAge / 3) === Math.floor(userAge / 3)) isMatch = true;
          if (cohortRange === 10 && Math.floor(docAge / 10) === Math.floor(userAge / 10)) isMatch = true;

          if (isMatch) validMatches.push(data);
        });

        const shuffled = validMatches.sort(() => 0.5 - Math.random());
        setSampleData(shuffled.slice(0, 10));

      } catch (error) {
        console.error("Error fetching cohort:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCohort();
  }, [userSex, userAge, cohortRange, refreshTrigger, userId]);

  // Calculate percentiles
  const comparedMetrics = useMemo(() => {
    if (!userData || sampleData.length === 0) return [];

    const results: ProcessedMetric[] = [];
    
    const keysToCompare = Object.keys(userData).filter(key => 
      ALL_ALLOWED_KEYS.has(key) && 
      Array.isArray(userData[key]) && 
      userData[key].length > 0 && 
      userData[key][0].value !== undefined
    );

    keysToCompare.forEach(key => {
      const userStats = extractStats(userData[key]);
      if (!userStats) return;

      const unit = getStandardUnit(key); 

      const cohortRecentValues = sampleData
        .map(user => extractStats(user[key])?.recent)
        .filter((val): val is number => val !== undefined && val !== null);

      if (cohortRecentValues.length === 0) return;

      const distribution = [...cohortRecentValues, userStats.recent];
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

      // SKEWNESS CALCULATION
      const skewness = stdDev === 0 ? 0 : 
        (distribution.reduce((acc, val) => acc + Math.pow(val - mean, 3), 0) / distribution.length) 
        / Math.pow(stdDev, 3);
      
      let zScore = stdDev === 0 ? 0 : (userStats.recent - mean) / stdDev;

      const isLowerBetter = LOWER_IS_BETTER_METRICS.has(key);
      if (isLowerBetter) zScore = zScore * -1;


      results.push({
        key,
        name: getDisplayName(key),
        unit,
        zScore,
        sampleSize: cohortRecentValues.length,
        skewness: skewness || 0,
        userValue: userStats.recent,
        mean,
        median,
        q1,
        q3,
        min,
        max,
        stdDev
      });
    });

    return results;
  }, [userData, sampleData]);

  // UI Helpers
  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    if (val === 0) setCohortRange(1);
    if (val === 1) setCohortRange(3);
    if (val === 2) setCohortRange(10);
  };

  const getSliderValue = () => {
    if (cohortRange === 1) return 0;
    if (cohortRange === 3) return 1;
    return 2;
  };

  if (!userSex || !userAge) return null;

  const renderMetricRow = (metric: ProcessedMetric, isVital: boolean) => {
    const z = metric.zScore || 0;
    const zColor = isVital 
      ? 'text-slate-800' 
      : (z >= 0 ? 'text-indigo-600' : 'text-rose-600');

    return (
      <div key={metric.key} className="space-y-1 p-3 rounded-2xl bg-white border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <div className="flex justify-between items-center mb-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">
              {metric.name}
            </span>
            {metric.unit && (
              <span className="text-[8px] font-bold text-slate-400">
                {metric.unit}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span className={`text-[10px] font-black ${zColor}`}>
              {z > 0 ? '+' : ''}{z.toFixed(2)}σ
            </span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
              N={metric.sampleSize}
            </span>
          </div>
        </div>
        
        <div className="flex items-center">
          <ZScoreBellCurve 
            zScore={z} 
            skewness={metric.skewness || 0} 
            metricKey={metric.key}
            isVital={isVital}
            userValue={metric.userValue}
            stats={{
              mean: metric.mean,
              median: metric.median,
              q1: metric.q1,
              q3: metric.q3,
              min: metric.min,
              max: metric.max,
              stdDev: metric.stdDev
            }}
          />
        </div>
      </div>
    );
  };

  const renderCategoryGroup = (groupTitle: string, categories: {title: string, keys: Set<string>}[]) => {
    // Treat vitals and diet data similarly regarding neutral z-scores and rendering critical thresholds
    const isVitalType = groupTitle === 'Vitals' || groupTitle === 'Nutrition';
    
    const activeCategories = categories.map(cat => {
      const orderedKeys = Array.from(cat.keys);
      const metrics = orderedKeys
        .map(key => comparedMetrics.find(m => m.key === key))
        .filter((m): m is ProcessedMetric => m !== undefined);

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
              {groupTitle === 'Exercises' ? (
                <p> 
                  A higher positive z-score (σ) is better (shorter time & higher strength/output relative to the group)
                </p>
              ) : groupTitle === 'Nutrition' ? (
                <>
                  <p>
                    Nutrition requirements vary between individuals and are dependent on a variety of factors including: height, weight, lean body mass, and physical activity level.
                  </p>
                  <p className="text-[10px] text-slate-400"> 
                    * Data compares individual intake against the random sample. 
                  </p>
                </>
              ) : (
                <>
                  <p>
                    While a z-score (σ) closer to 0 is generally better, indicating you are near the cohort average, staying within the critical bounds or personal targets is the priority.
                  </p>
                  <p className="text-[10px] text-slate-400"> 
                    * The z-score (σ) indicates how many standard deviations you are from the mean. 
                  </p>
                </>
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
                {cat.metrics.map(m => renderMetricRow(m, isVitalType))} 
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-transparent md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 overflow-hidden mt-0 md:mt-6">
      <div className="p-2 md:p-5 border-b-0 md:border-b bg-transparent md:bg-slate-50/50 flex flex-col gap-4">
        <div className="flex items-center justify-between px-2 md:px-0">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Users className="text-indigo-500" size={20} />
            Cohort Comparison
          </h3>
          <button 
            onClick={() => setRefreshTrigger(prev => prev + 1)}
            disabled={loading}
            className="p-2 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-500 hover:text-indigo-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
            <span>Exact Age</span>
            <span>3-Year Range</span>
            <span>10-Year Range</span>
          </div>
          <input 
            type="range" 
            min="0" 
            max="2" 
            step="1" 
            value={getSliderValue()}
            onChange={handleRangeChange}
            className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <p className="text-xs text-slate-500 mt-3 text-center font-medium">
            Comparing your last 5 entries for each vital and exercise category, against {sampleData.length} random {userSex} users in your {cohortRange === 1 ? 'exact age' : `${cohortRange}-year age bracket`}.
          </p>
        </div>
      </div>

      <div className="p-4 md:p-5">
        {loading ? (
          <div className="flex justify-center p-8">
            <RefreshCw className="animate-spin text-slate-300" size={32} />
          </div>
        ) : comparedMetrics.length === 0 ? (
          <div className="text-center p-6 text-slate-500 text-sm">
            Not enough cohort data available for comparison in this bracket.
          </div>
        ) : (
          <div className="space-y-2">
            {renderCategoryGroup('Vitals', CATEGORIES_VITALS)}
            {renderCategoryGroup('Nutrition', CATEGORIES_DIETS)}
            {renderCategoryGroup('Exercises', CATEGORIES_EXERCISES)}
          </div>
        )}
      </div>
    </div>
  );
};

export default CohortComparison;