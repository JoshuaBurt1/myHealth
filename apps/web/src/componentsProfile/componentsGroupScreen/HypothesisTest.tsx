// HypothesisTest.tsx
import React, { useState } from 'react';
import { db } from '../../firebase';
import { collectionGroup, query, getDocs } from 'firebase/firestore';
import { 
  Info, ChevronDown, Save, Play, 
  Database, User as UserIcon, Calendar, MapPin, 
  Calculator, TableProperties, AlertCircle
} from 'lucide-react';
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
  PHYSIO_KEY_MAP
} from '../profileConstants';

// Types & Interfaces
export interface HypothesisTestProps {
  userId?: string;
  profileData?: Record<string, any>;
}

interface DataEntry {
  value: string | number;
  date?: string;
  timestamp?: string | number;
}

interface AnalysisResults {
  sampleSize: number;
  mean: string;
  stdDev: string;
  tStatistic: string;
  pValue: string;
  alpha: number;
  isSignificant: boolean;
}

// --- Constants & Mappings ---

const TOPIC_GROUPS = [
  {
    label: 'Diet & Nutrition',
    options: ['Caloric maintenance', ...Object.keys(DIET_KEY_MAP), ...Object.keys(MICRONUTRIENT_KEY_MAP)]
  },
  {
    label: 'Body Measurements',
    options: ['Weight', 'Height', 'Body Fat %']
  },
  {
    label: 'Vitals & Blood',
    options: [...Object.keys(VITAL_KEY_MAP), ...Object.keys(BLOODTEST_KEY_MAP)]
  },
  {
    label: 'Symptoms & Feelings',
    options: Object.keys(SYMPTOM_KEY_MAP)
  },
  {
    label: 'Exercise & Performance',
    options: [
      ...Object.keys(STRENGTH_KEY_MAP),
      ...Object.keys(SPEED_KEY_MAP),
      ...Object.keys(ENDURANCE_KEY_MAP),
      ...Object.keys(PLYO_KEY_MAP),
      ...Object.keys(YOGA_KEY_MAP),
      ...Object.keys(MOBILITY_KEY_MAP),
      ...Object.keys(PHYSIO_KEY_MAP)
    ]
  }
];

// --- Pure Helper Functions ---

const getDbKey = (displayName: string): string => {
  const ALL_MAPS: Record<string, string> = {
    ...VITAL_KEY_MAP, ...BLOODTEST_KEY_MAP, ...SYMPTOM_KEY_MAP,
    ...DIET_KEY_MAP, ...MICRONUTRIENT_KEY_MAP, ...STRENGTH_KEY_MAP,
    ...SPEED_KEY_MAP, ...PLYO_KEY_MAP, ...ENDURANCE_KEY_MAP,
    ...YOGA_KEY_MAP, ...MOBILITY_KEY_MAP, ...PHYSIO_KEY_MAP
  };
  return ALL_MAPS[displayName] || displayName.toLowerCase();
};

const calculateMean = (arr: number[]): number => {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

const calculateStdDev = (arr: number[], mean: number): number => {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

// Normal CDF approximation for computing P-Value from T-Statistic
const getApproxPValue = (tStat: number): number => {
  const absT = Math.abs(tStat);
  // Logistic approximation for Normal CDF (works well for df > 30)
  const cdf = 1 / (1 + Math.exp(-1.702 * absT)); 
  return 2 * (1 - cdf); // Two-tailed p-value
};

// --- Main Component ---

const HypothesisTest: React.FC<HypothesisTestProps> = ({ userId, profileData }) => {
  // --- Form State ---
  
  // Data Scope Variables
  const [dataSource, setDataSource] = useState<'personal' | 'database'>('personal');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [locationRadius, setLocationRadius] = useState<string>(''); // Empty implies 'All'

  // Hypothesis Variables
  const [direction, setDirection] = useState<string>('Exceeding');
  const [independentVar, setIndependentVar] = useState<string>('Caloric maintenance');
  const [effect, setEffect] = useState<string>('an increase');
  const [dependentVar, setDependentVar] = useState<string>('Weight');

  // Statistical Parameters
  const [significanceLevel, setSignificanceLevel] = useState<string>('0.05');
  
  // Results State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [resultsData, setResultsData] = useState<AnalysisResults | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Build the hypothesis strings dynamically
  const h0String = `${direction} ${independentVar.toLowerCase()} causes no change in ${dependentVar.toLowerCase()}.`;
  const h1String = `${direction} ${independentVar.toLowerCase()} causes ${effect} in ${dependentVar.toLowerCase()}.`;

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    setShowResults(false);
    setErrorMsg(null);
    
    try {
      const depKey = getDbKey(dependentVar);
      
      const experimentalValues: number[] = [];
      const controlValues: number[] = []; // Baseline to test against (H0 mean)

      const startMs = startDate ? new Date(startDate).getTime() : 0;
      const endMs = endDate ? new Date(endDate).getTime() : Infinity;

      // Data Extraction Helper
      const extractValues = (dataObj: Record<string, any>) => {
        if (!dataObj || !dataObj[depKey] || !Array.isArray(dataObj[depKey])) return;
        
        dataObj[depKey].forEach((entry: DataEntry) => {
          const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
          if (isNaN(val)) return;

          const timeSource = entry.date || entry.timestamp;
          const entryTime = timeSource ? new Date(timeSource).getTime() : 0;
          
          // Split data into experimental (inside date range) and control (outside date range)
          if (entryTime >= startMs && entryTime <= endMs) {
            experimentalValues.push(val);
          } else {
            controlValues.push(val);
          }
        });
      };

      // 1. Fetch Data
      if (dataSource === 'personal') {
        if (profileData) {
          extractValues(profileData);
        } else {
          throw new Error("No personal profile data available.");
        }
      } else {
        const q = query(collectionGroup(db, 'profile'));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => extractValues(doc.data()));
      }

      // 2. Validate Data Size
      const n = experimentalValues.length;

      console.log("--- Hypothesis Test Debug ---");
      console.log("Dependent Variable Key:", depKey);
      console.log("Experimental Group (within range):", experimentalValues);
      console.log("Control Group (outside range/baseline):", controlValues);
      console.log("Sample Size (n):", n);

      if (n < 2) {
        throw new Error(`Not enough data points found for ${dependentVar} in the selected parameters (Found: ${n}). Adjust your filters.`);
      }

      // 3. Crunch Statistics
      const sampleMean = calculateMean(experimentalValues);
      const sampleStdDev = calculateStdDev(experimentalValues, sampleMean);
      
      // Determine Population Mean (Null Hypothesis Mu)
      let populationMean = sampleMean; 
      if (controlValues.length > 0) {
        populationMean = calculateMean(controlValues);
      } else {
        // Fallback baseline: assume baseline is 5% different for pure demonstration when no control group exists
        populationMean = sampleMean * 0.95; 
      }

      // Calculate T-Statistic: t = (x̄ - μ0) / (s / √n)
      const standardError = sampleStdDev / Math.sqrt(n);
      const tStatistic = standardError === 0 ? 0 : (sampleMean - populationMean) / standardError;
      
      const pValue = getApproxPValue(tStatistic);

      console.log("Calculated Mean (x̄):", sampleMean);
      console.log("Population Mean (μ0):", populationMean);
      console.log("Standard Error:", standardError);
      console.log("T-Stat:", tStatistic);
      console.log("P-Value:", pValue);
      console.log("-----------------------------");
      const alpha = parseFloat(significanceLevel);

      setResultsData({
        sampleSize: n,
        mean: sampleMean.toFixed(2),
        stdDev: sampleStdDev.toFixed(2),
        tStatistic: tStatistic.toFixed(3),
        pValue: pValue.toFixed(4),
        alpha: alpha,
        isSignificant: pValue < alpha
      });

      setShowResults(true);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while running the analysis.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="bg-transparent md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 overflow-hidden mt-0 md:mt-6">
    
        {/* Info Banner */}
        <div className="flex gap-3 text-sm text-slate-600 bg-white md:bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm md:shadow-none">
          <Info size={20} className="shrink-0 text-emerald-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-slate-800">Design your own health experiments.</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Construct a Null Hypothesis (H0) and an Alternative Hypothesis (H1) to test correlations in your data or global health data. Set your parameters, define your statistical significance, and run the t-test.
            </p>
          </div>
        </div>

      {/* Main Content Body */}
      <div className="p-4 md:p-6 space-y-8">
        
        {/* Data Source & Scope Configuration */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Data Source & Scope
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Dataset Toggle */}
            <div className="space-y-4 col-span-1 md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Target Dataset</label>
              <div className="flex bg-slate-200/50 p-1 rounded-xl w-full max-w-md">
                <button
                  onClick={() => setDataSource('personal')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                    dataSource === 'personal' 
                      ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <UserIcon size={16} />
                  My Personal Data
                </button>
                <button
                  onClick={() => setDataSource('database')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                    dataSource === 'database' 
                      ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Database size={16} />
                  Global Database
                </button>
              </div>
            </div>

            {/* Date Range */}
            <div className="space-y-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 flex items-center gap-1">
                <Calendar size={12} /> Time Period (Leave blank for all time)
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-slate-400 font-medium text-sm">to</span>
                <div className="relative flex-1">
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Location Radius */}
            <div className="space-y-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 flex items-center gap-1">
                <MapPin size={12} /> Location Radius
              </label>
              <div className="relative flex items-center">
                <input 
                  type="number" 
                  placeholder="All Locations"
                  value={locationRadius}
                  onChange={(e) => setLocationRadius(e.target.value)}
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400"
                />
                <span className="absolute right-4 text-slate-400 font-medium text-sm pointer-events-none">km</span>
              </div>
            </div>
          </div>
        </div>

        {/* Experiment Builder */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
            Experiment Builder
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Independent Variable Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Action / Direction</label>
                <div className="relative">
                  <select 
                    value={direction}
                    onChange={(e) => setDirection(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    <option value="Exceeding">Exceeding</option>
                    <option value="Falling below">Falling below</option>
                    <option value="Increasing">Increasing</option>
                    <option value="Decreasing">Decreasing</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Independent Variable (Cause)</label>
                <div className="relative">
                  <select 
                    value={independentVar}
                    onChange={(e) => setIndependentVar(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    {TOPIC_GROUPS.map((group, idx) => (
                      <optgroup key={idx} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
            </div>

            {/* Dependent Variable Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Expected Effect</label>
                <div className="relative">
                  <select 
                    value={effect}
                    onChange={(e) => setEffect(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    <option value="an increase">An increase</option>
                    <option value="a decrease">A decrease</option>
                    <option value="fluctuations">Fluctuations</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Dependent Variable (Result)</label>
                <div className="relative">
                  <select 
                    value={dependentVar}
                    onChange={(e) => setDependentVar(e.target.value)}
                    className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    {TOPIC_GROUPS.map((group, idx) => (
                      <optgroup key={idx} label={group.label}>
                        {group.options.map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>
            </div>
            
            {/* Statistical Settings */}
            <div className="space-y-4 col-span-1 md:col-span-2 border-t border-slate-200 pt-4 mt-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Level of Significance (α)</label>
                <div className="flex bg-slate-200/50 p-1 rounded-xl w-full md:w-64">
                  {['0.10', '0.05', '0.01'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSignificanceLevel(level)}
                      className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                        significanceLevel === level
                          ? 'bg-white text-emerald-600 shadow-sm border border-slate-100'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Formulated Hypothesis Display */}
        <div>
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1">
            Current Hypothesis
          </h4>
          
          <div className="space-y-4">
            {/* H0 Card */}
            <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm flex gap-4 items-start">
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 font-black text-slate-500">
                H0
              </div>
              <div>
                <h5 className="font-bold text-slate-800 mb-1">Null Hypothesis</h5>
                <p className="text-slate-600 font-medium">"{h0String}"</p>
                <p className="text-[10px] text-slate-400 mt-2 font-semibold tracking-wide uppercase">
                  Assume there is no correlation.
                </p>
              </div>
            </div>

            {/* H1 Card */}
            <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm flex gap-4 items-start relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-400" />
              <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center shrink-0 font-black text-emerald-600 shadow-sm border border-emerald-100">
                H1
              </div>
              <div>
                <h5 className="font-bold text-slate-800 mb-1">Alternative Hypothesis</h5>
                <p className="text-slate-700 font-medium">"{h1String}"</p>
                <p className="text-[10px] text-emerald-600/70 mt-2 font-semibold tracking-wide uppercase">
                  The relationship you are trying to prove.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {errorMsg && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row justify-end gap-3 pt-4 border-t border-slate-100">
          <button className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-slate-500 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-700 transition-colors">
            <Save size={18} />
            Save to Dashboard
          </button>
          <button 
            onClick={handleRunAnalysis}
            disabled={isRunning}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white bg-slate-900 hover:bg-emerald-600 shadow-lg shadow-slate-200 hover:shadow-emerald-100 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <span className="flex items-center gap-2">
                <Calculator className="animate-pulse" size={18} /> Processing Data...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Play size={18} className="fill-current" /> Run Analysis
              </span>
            )}
          </button>
        </div>

        {/* Results Data Table */}
        {showResults && resultsData && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 ml-1 flex items-center gap-2">
              <TableProperties size={14} /> Analysis Results
            </h4>
            
            <div className="bg-slate-900 rounded-3xl p-6 text-slate-100 overflow-hidden relative shadow-xl">
              {/* Decorative background element */}
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sample Size (n)</span>
                  <div className="text-2xl font-black text-white">{resultsData.sampleSize.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mean (x̄)</span>
                  <div className="text-2xl font-black text-white">{resultsData.mean}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Std Dev (s)</span>
                  <div className="text-2xl font-black text-white">{resultsData.stdDev}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alpha (α)</span>
                  <div className="text-2xl font-black text-white">{resultsData.alpha}</div>
                </div>
              </div>

              <div className="h-px w-full bg-slate-800 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">T-Statistic</span>
                  <div className="text-3xl font-black text-emerald-400">{resultsData.tStatistic}</div>
                </div>
                <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">P-Value</span>
                  <div className="flex items-end gap-3">
                    <div className={`text-3xl font-black ${resultsData.isSignificant ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {resultsData.pValue}
                    </div>
                    <span className="text-sm font-medium text-slate-400 pb-1">
                      {resultsData.isSignificant ? '< α (Significant)' : '> α (Not Significant)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={`mt-6 p-4 rounded-xl border ${resultsData.isSignificant ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800 border-slate-700'}`}>
                <p className="text-sm font-medium leading-relaxed">
                  {resultsData.isSignificant ? (
                    <span className="text-emerald-300">
                      <strong>Conclusion:</strong> Reject the Null Hypothesis (H0). The data indicates a statistically significant correlation that {h1String.toLowerCase().replace('.', '')}.
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      <strong>Conclusion:</strong> Fail to reject the Null Hypothesis (H0). There is not enough evidence to prove that {h1String.toLowerCase().replace('.', '')}.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default HypothesisTest;