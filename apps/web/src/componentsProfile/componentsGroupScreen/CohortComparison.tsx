import React, { useState, useEffect, useMemo } from 'react';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { Users, RefreshCw, BarChart2, Activity } from 'lucide-react';

// --- CONFIGURATION & KEY MAPS ---
const LOWER_IS_BETTER_METRICS = new Set([
  'bpSyst', 'bpDias', 'hr', 'rr', 'temp', 'glucose', 'cholesterol', 'uricAcid', 'lactate',
  'speed100m', 'speed400m', 'speed1Mile'
]);

// Vital types
const VITAL_KEYS = new Set(['bpSyst', 'bpDias', 'hr', 'spo2', 'rr', 'temp']);
const BLOOD_TEST_KEYS = new Set(['glucose', 'cholesterol', 'ketones', 'uricAcid', 'lactate', 'hemoglobin', 'hematocrit']);

// Exercise types
const STRENGTH_KEYS = new Set(['benchPress', 'squat', 'deadlift']);
const SPEED_KEYS = new Set(['speed100m', 'speed400m', 'speed1Mile', 'steps']);
const PHYSIO_KEYS = new Set(['shoulderExtRot', 'tibialisRaise', 'copenhagenPlank', 'assistedPistolSquat', 'singleLegRdl', 'towelScrunches', 'serratusPunch', 'pallofPress', 'nerveGlides', 'proneYtw']);
const YOGA_KEYS = new Set(['downwardDog', 'warrior1', 'warrior2', 'cobraPose', 'childsPose', 'treePose', 'pigeonPose', 'trianglePose', 'crowPose', 'savasana']);
const MOBILITY_KEYS = new Set(['worldsGreatestStretch', 'hip9090Switch', 'tSpineRotation', 'deepSquatHold', 'ankleDorsiflexion', 'cossackSquat', 'inchworms', 'shoulderPassThrough']);

const ALL_ALLOWED_KEYS = new Set([
  ...VITAL_KEYS, ...BLOOD_TEST_KEYS, ...STRENGTH_KEYS, ...SPEED_KEYS, 
  ...PHYSIO_KEYS, ...YOGA_KEYS, ...MOBILITY_KEYS
]);

// Categories structure for rendering
const CATEGORIES_VITALS = [
  { title: 'Standard Vitals', keys: VITAL_KEYS },
  { title: 'Blood Tests', keys: BLOOD_TEST_KEYS },
];

const CATEGORIES_EXERCISES = [
  { title: 'Strength', keys: STRENGTH_KEYS },
  { title: 'Speed & Endurance', keys: SPEED_KEYS },
  { title: 'Physiotherapy', keys: PHYSIO_KEYS },
  { title: 'Yoga', keys: YOGA_KEYS },
  { title: 'Mobility', keys: MOBILITY_KEYS },
];

// --- INTERFACES ---
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
  percentile: number | null;
  zScore: number | null;
  sampleSize: number;
}

// --- HELPER FUNCTIONS ---
const extractStats = (dataArr: any[]): MetricStat | null => {
  if (!dataArr || !Array.isArray(dataArr) || dataArr.length === 0) return null;
  const nums = dataArr.map(item => parseFloat(item.value)).filter(n => !isNaN(n));
  if (nums.length === 0) return null;
  
  const recent = nums[nums.length - 1];
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

// --- COMPONENT ---
export const CohortComparison: React.FC<Props> = ({ userId, userData, userSex, userAge }) => {
  const [cohortRange, setCohortRange] = useState<CohortRange>(10);
  const [loading, setLoading] = useState(false);
  const [sampleData, setSampleData] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // 1. Fetch and process cohort sample
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
          // Exclude current user
          if (doc.ref.path.includes(userId || '')) return;

          const data = doc.data();
          
          // Determine doc age
          let docAge: number | null = null;
          if (data.dob) {
            docAge = calculateAge(data.dob);
          } else if (data.age && Array.isArray(data.age) && data.age.length > 0) {
            docAge = parseInt(data.age[data.age.length - 1].value);
          }

          if (docAge === null || isNaN(docAge)) return;

          // Check against cohort boundaries
          let isMatch = false;
          if (cohortRange === 1 && docAge === userAge) isMatch = true;
          if (cohortRange === 3 && Math.floor(docAge / 3) === Math.floor(userAge / 3)) isMatch = true;
          if (cohortRange === 10 && Math.floor(docAge / 10) === Math.floor(userAge / 10)) isMatch = true;

          if (isMatch) validMatches.push(data);
        });

        // Shuffle and slice for a random 10
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

  // 2. Calculate Percentiles and Z-Scores
  const comparedMetrics = useMemo(() => {
    if (!userData || sampleData.length === 0) return [];

    const results: ProcessedMetric[] = [];
    
    // Filter out age and any other unsupported key
    const keysToCompare = Object.keys(userData).filter(key => 
      ALL_ALLOWED_KEYS.has(key) && 
      Array.isArray(userData[key]) && 
      userData[key].length > 0 && 
      userData[key][0].value !== undefined
    );

    keysToCompare.forEach(key => {
      const userStats = extractStats(userData[key]);
      if (!userStats) return;

      const cohortRecentValues = sampleData
        .map(user => extractStats(user[key])?.recent)
        .filter((val): val is number => val !== undefined && val !== null);

      if (cohortRecentValues.length === 0) return;

      const distribution = [...cohortRecentValues, userStats.recent];
      
      const mean = distribution.reduce((a, b) => a + b, 0) / distribution.length;
      const variance = distribution.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / distribution.length;
      const stdDev = Math.sqrt(variance);
      
      let zScore = stdDev === 0 ? 0 : (userStats.recent - mean) / stdDev;
      
      const isLowerBetter = LOWER_IS_BETTER_METRICS.has(key);
      if (isLowerBetter) zScore = zScore * -1;

      distribution.sort((a, b) => a - b);
      let rank = distribution.findIndex(v => v === userStats.recent) + 1;
      
      let percentile = (rank / distribution.length) * 100;
      if (isLowerBetter) percentile = 100 - percentile + (100 / distribution.length);

      results.push({
        key,
        name: key.replace(/([A-Z])/g, ' $1').trim(), 
        percentile: Math.min(Math.max(percentile, 0), 100),
        zScore,
        sampleSize: cohortRecentValues.length
      });
    });

    return results;
  }, [userData, sampleData]);

  // 3. UI Helpers
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

  // Inside CohortComparison...
const renderMetricRow = (metric: ProcessedMetric) => (
  // REMOVE "mb-6 last:mb-0" and add a bit of padding/background for better separation if desired
  <div key={metric.key} className="space-y-2 p-2 rounded-xl bg-slate-50/50 border border-transparent hover:border-slate-100 transition-colors">
    <div className="flex justify-between items-end">
      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">
        {metric.name}
      </span>
      <span className="text-[9px] text-slate-400 font-bold uppercase">
        n={metric.sampleSize}
      </span>
    </div>
    
    {/* Percentile Bar */}
    <div className="flex items-center gap-3">
      <BarChart2 size={12} className="text-emerald-500 shrink-0" />
      <div className="flex-1 h-1.5 bg-white rounded-full overflow-hidden border border-slate-100">
        <div 
          className="h-full bg-emerald-400 rounded-full transition-all duration-700"
          style={{ width: `${metric.percentile}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-600 w-8 text-right">
        {Math.round(metric.percentile || 0)}%
      </span>
    </div>

    {/* Z-Score Bar */}
    <div className="flex items-center gap-3">
      <Activity size={12} className="text-indigo-500 shrink-0" />
      <div className="flex-1 h-1.5 bg-white rounded-full relative overflow-hidden border border-slate-100">
        <div className="absolute left-1/2 -top-0.5 -bottom-0.5 w-px bg-slate-200 z-10" />
        <div 
          className={`absolute h-full rounded-full transition-all duration-700 ${
            (metric.zScore || 0) >= 0 ? 'bg-indigo-400 left-1/2 rounded-l-none' : 'bg-rose-400 right-1/2 rounded-r-none'
          }`}
          style={{ width: `${Math.min(Math.abs(metric.zScore || 0) / 3 * 50, 50)}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-slate-600 w-8 text-right">
        {(metric.zScore || 0) > 0 ? '+' : ''}{(metric.zScore || 0).toFixed(1)}
      </span>
    </div>
  </div>
);

  // Inside CohortComparison...
const renderCategoryGroup = (groupTitle: string, categories: {title: string, keys: Set<string>}[]) => {
  const activeCategories = categories.map(cat => {
    // 1. Convert Set to Array to preserve your defined order (BP Syst, BP Dias first)
    const orderedKeys = Array.from(cat.keys);
    
    // 2. Map through the ordered keys and find the matching processed metric
    const metrics = orderedKeys
      .map(key => comparedMetrics.find(m => m.key === key))
      .filter((m): m is ProcessedMetric => m !== undefined);

    return { ...cat, metrics };
  }).filter(cat => cat.metrics.length > 0);

  if (activeCategories.length === 0) return null;

  return (
    <div className="mb-8 last:mb-0">
      <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-2 mb-4">
        {groupTitle}
      </h4>
      <div className="space-y-8">
        {activeCategories.map(cat => (
          <div key={cat.title}>
            <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
              {cat.title}
            </h5>
            {/* grid-cols-1: default (stack on very small phones)
                [@media...]: custom breakpoint to switch to 2-columns earlier than 640px
            */}
            <div className="grid grid-cols-1 [@media(min-width:450px)]:grid-cols-2 gap-4">
              {cat.metrics.map(renderMetricRow)}
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

        {/* Slider Controls */}
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
            Comparing against {sampleData.length} random {userSex} users in your {cohortRange === 1 ? 'exact age' : `${cohortRange}-year age bracket`}.
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
            {renderCategoryGroup('Exercises', CATEGORIES_EXERCISES)}
          </div>
        )}
      </div>
    </div>
  );
};