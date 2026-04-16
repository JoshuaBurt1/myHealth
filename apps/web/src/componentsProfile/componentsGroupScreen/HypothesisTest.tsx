// HypothesisTest.tsx
// Note: For this to actually output true information; users data must be real and accurate
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
  profileData?: Record<string, any>;
}


interface AnalysisResults {
  testType: 'one-sample' | 'two-sample';
  sampleSize: number;
  mean: string;
  stdDev: string;
  tStatistic: string;
  pValue: string;
  alpha: number;
  isSignificant: boolean;
  // For Two-Sample
  pearsonR?: string;
  groupAMean?: string;
  groupBMean?: string;
  groupASize?: number;
  groupBSize?: number;
}

// Constants & Mappings

const TOPIC_GROUPS = [
  {
    label: 'Diet & Nutrition',
    options: [...Object.keys(DIET_KEY_MAP), ...Object.keys(MICRONUTRIENT_KEY_MAP)]
  },
  {
    label: 'Body Measurements',
    options: ['Weight', 'Height']
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

// Helper Functions

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
  // Logistic approximation for Normal CDF (works for df > 30)
  const cdf = 1 / (1 + Math.exp(-1.702 * absT)); 
  return 2 * (1 - cdf); // Two-tailed p-value
};

// Main Component

const HypothesisTest: React.FC<HypothesisTestProps> = ({ profileData }) => {
  // Form State
  const [testType, setTestType] = useState<'one-sample' | 'two-sample'>('one-sample');
  
  // Data Scope Variables
  const [dataSource, setDataSource] = useState<'personal' | 'database'>('personal');
  const [controlStartDate, setControlStartDate] = useState<string>('');
  const [controlEndDate, setControlEndDate] = useState<string>('');
  const [experimentStartDate, setExperimentStartDate] = useState<string>('');
  const [experimentEndDate, setExperimentEndDate] = useState<string>('');
  const [locationRadius, setLocationRadius] = useState<string>('');

  // Hypothesis Variables
  const [direction, setDirection] = useState<string>('Exceeding');
  const [independentVar, setIndependentVar] = useState<string>('Calories');
  const [indepThreshold, setIndepThreshold] = useState<string>(''); // For Two-Sample
  const [effect, setEffect] = useState<string>('an increase');
  const [dependentVar, setDependentVar] = useState<string>('Weight');

  // Statistical Parameters
  const [significanceLevel, setSignificanceLevel] = useState<string>('0.05');
  
  // Results State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [resultsData, setResultsData] = useState<AnalysisResults | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Build the hypothesis strings dynamically based on test type
  const causeText = testType === 'one-sample' ? 'the time period' : `${direction} ${independentVar.toLowerCase()} (Threshold: ${indepThreshold || '?'})`;
  const h0String = `${causeText} causes no change in ${dependentVar.toLowerCase()}.`;
  const h1String = `${causeText} causes ${effect} in ${dependentVar.toLowerCase()}.`;

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    setShowResults(false);
    setErrorMsg(null);
    
    try {
      const depKey = getDbKey(dependentVar);
      const indepKey = getDbKey(independentVar);
      
      const experimentalValues: number[] = [];
      const controlValues: number[] = [];
      const pairedValues: {x: number, y: number}[] = []; // For Two-Sample correlation

      // Time Boundary Logic
      const controlStartMs = controlStartDate ? new Date(controlStartDate).getTime() : -Infinity;
      const controlEndMs = controlEndDate ? new Date(controlEndDate).getTime() + (24 * 60 * 60 * 1000 - 1) : -Infinity;
      
      // If two-sample, we only use the experimental date range for BOTH datasets
      const baseStartForExp = testType === 'one-sample' ? (controlEndMs + 1) : -Infinity;
      const expStartMs = experimentStartDate ? new Date(experimentStartDate).getTime() : baseStartForExp;
      const expEndMs = experimentEndDate ? new Date(experimentEndDate).getTime() + (24 * 60 * 60 * 1000 - 1) : Infinity;

      // Data Extraction Helper for One-Sample
      const extractOneSampleValues = (dataObj: Record<string, any>) => {
        if (!dataObj || !dataObj[depKey] || !Array.isArray(dataObj[depKey])) return;

        dataObj[depKey].forEach((entry: any) => {
          const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
          if (isNaN(val)) return;

          const timeSource = entry.dateTime || entry.date || entry.timestamp;
          if (!timeSource) return;

          const entryTime = new Date(timeSource).getTime();
          if (isNaN(entryTime)) return;

          if (entryTime >= controlStartMs && entryTime <= controlEndMs) {
            controlValues.push(val);
          } else if (entryTime >= expStartMs && entryTime <= expEndMs) {
            experimentalValues.push(val);
          }
        });
      };

      // Data Extraction Helper for Two-Sample
      const extractTwoSampleValues = (dataObj: Record<string, any>) => {
        if (!dataObj) return;
        const depData = dataObj[depKey] || [];
        const indepData = dataObj[indepKey] || [];

        const getDay = (entry: any) => {
          const timeSource = entry.dateTime || entry.date || entry.timestamp;
          if (!timeSource) return null;
          const d = new Date(timeSource);
          return isNaN(d.getTime()) ? null : d.toISOString().split('T')[0];
        };

        const depDict: Record<string, number> = {};
        depData.forEach((entry: any) => {
          const day = getDay(entry);
          const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
          if (day && !isNaN(val)) depDict[day] = val;
        });

        indepData.forEach((entry: any) => {
          const day = getDay(entry);
          const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
          if (day && !isNaN(val) && depDict[day] !== undefined) {
             const entryTime = new Date(day).getTime();
             if (entryTime >= expStartMs && entryTime <= expEndMs) {
                pairedValues.push({ x: val, y: depDict[day] });
             }
          }
        });
      };

      // 1. Fetch Data
      if (dataSource === 'personal') {
        if (!profileData) throw new Error("No personal profile data available.");
        if (testType === 'one-sample') extractOneSampleValues(profileData);
        else extractTwoSampleValues(profileData);
      } else {
        const q = query(collectionGroup(db, 'profile'));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          if (testType === 'one-sample') extractOneSampleValues(doc.data());
          else extractTwoSampleValues(doc.data());
        });
      }

      const alpha = parseFloat(significanceLevel);

      // 2. Statistical Processing
      if (testType === 'one-sample') {
        if (!controlEndDate) throw new Error("Control Dataset End Date must be defined for a One-Sample T-Test.");
        const n = experimentalValues.length;
        if (n < 2) throw new Error(`Not enough data points found for ${dependentVar} in the experimental dataset (Found: ${n}).`);
        if (controlValues.length === 0) throw new Error("Control group is empty. Adjust control dates to establish a baseline.");

        const sampleMean = calculateMean(experimentalValues);
        const sampleStdDev = calculateStdDev(experimentalValues, sampleMean);
        const populationMean = calculateMean(controlValues);

        const standardError = sampleStdDev / Math.sqrt(n);
        const tStatistic = standardError === 0 ? 0 : (sampleMean - populationMean) / standardError;
        const pValue = getApproxPValue(tStatistic);

        setResultsData({
          testType: 'one-sample',
          sampleSize: n,
          mean: sampleMean.toFixed(2),
          stdDev: sampleStdDev.toFixed(2),
          tStatistic: tStatistic.toFixed(3),
          pValue: pValue.toFixed(4),
          alpha: alpha,
          isSignificant: pValue < alpha
        });

      } else { // Two-Sample
        if (!indepThreshold) throw new Error("Threshold Value is required to split the data for a Two-Sample T-Test.");
        const threshold = parseFloat(indepThreshold);
        
        let groupA: number[] = []; // indep >= threshold
        let groupB: number[] = []; // indep < threshold
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        const nPairs = pairedValues.length;

        pairedValues.forEach(pair => {
           if (pair.x >= threshold) groupA.push(pair.y);
           else groupB.push(pair.y);

           sumX += pair.x;
           sumY += pair.y;
           sumXY += pair.x * pair.y;
           sumX2 += pair.x * pair.x;
           sumY2 += pair.y * pair.y;
        });

        if (groupA.length < 2 || groupB.length < 2) {
          throw new Error(`Insufficient data in split groups (Group A: ${groupA.length}, Group B: ${groupB.length}). Ensure your threshold divides the dataset adequately.`);
        }

        // Pearson r
        let r = 0;
        if (nPairs > 1) {
           const numerator = (nPairs * sumXY) - (sumX * sumY);
           const denominator = Math.sqrt((nPairs * sumX2 - sumX * sumX) * (nPairs * sumY2 - sumY * sumY));
           r = denominator === 0 ? 0 : numerator / denominator;
        }

        // Welch's T-test
        const meanA = calculateMean(groupA);
        const meanB = calculateMean(groupB);
        const varA = Math.pow(calculateStdDev(groupA, meanA), 2);
        const varB = Math.pow(calculateStdDev(groupB, meanB), 2);
        
        const standardError = Math.sqrt((varA / groupA.length) + (varB / groupB.length));
        const tStatistic = standardError === 0 ? 0 : (meanA - meanB) / standardError;
        const pValue = getApproxPValue(tStatistic);

        const combinedDepValues = [...groupA, ...groupB];
        const overallMean = calculateMean(combinedDepValues);
        const overallStd = calculateStdDev(combinedDepValues, overallMean);

        setResultsData({
          testType: 'two-sample',
          sampleSize: nPairs,
          mean: overallMean.toFixed(2),
          stdDev: overallStd.toFixed(2),
          tStatistic: tStatistic.toFixed(3),
          pValue: pValue.toFixed(4),
          alpha: alpha,
          isSignificant: pValue < alpha,
          pearsonR: r.toFixed(3),
          groupAMean: meanA.toFixed(2),
          groupBMean: meanB.toFixed(2),
          groupASize: groupA.length,
          groupBSize: groupB.length
        });
      }

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
        <div className="flex gap-3 text-sm text-slate-600 bg-white md:bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm md:shadow-none m-4">
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

            {/* Test Type Selector */}
            <div className="space-y-2 col-span-1 md:col-span-2 border-t border-slate-200 pt-4 mt-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Analysis Type</label>
              <div className="flex bg-slate-200/50 p-1 rounded-xl w-full max-w-md">
                <button
                  onClick={() => setTestType('one-sample')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                    testType === 'one-sample'
                      ? 'bg-white text-emerald-600 shadow-sm border border-slate-100'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  One-sample T-Test
                </button>
                <button
                  onClick={() => setTestType('two-sample')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${
                    testType === 'two-sample'
                      ? 'bg-white text-emerald-600 shadow-sm border border-slate-100'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Two-sample T-Test
                </button>
              </div>
              <div className="mt-2 text-xs font-medium text-slate-500 leading-relaxed bg-white p-3 rounded-xl border border-slate-100">
                {testType === 'one-sample' 
                  ? "Measures a single variable divided into a control (baseline) and experimental group (post-intervention) with time period as the post-intervention."
                  : "Compares the means of two independent groups based on a single time period and an independent variable threshold, and measures their linear correlation (Pearson r)."}
              </div>
            </div>

            {/* Control Dataset Dates (Only visible for One-Sample) */}
            {testType === 'one-sample' && (
              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 items-center gap-1">
                  <Calendar size={12} className="inline mr-1 mb-0.5" /> Control Dataset (Baseline)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <input 
                      type="date" 
                      value={controlStartDate}
                      onChange={(e) => setControlStartDate(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <span className="text-slate-400 font-medium text-sm">to</span>
                  <div className="relative flex-1">
                    <input 
                      type="date" 
                      value={controlEndDate}
                      onChange={(e) => setControlEndDate(e.target.value)}
                      className={`w-full bg-white border transition-all rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 ${
                        !controlEndDate 
                          ? 'border-amber-400 ring-2 ring-amber-50 shadow-sm' 
                          : 'border-slate-200 text-slate-600 focus:ring-emerald-500'
                      }`}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-semibold ml-1">*End Date is required.</p>
              </div>
            )}

            {/* Experimental / Common Dataset Dates */}
            <div className="space-y-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 items-center gap-1">
                <Calendar size={12} className="inline mr-1 mb-0.5" /> 
                {testType === 'one-sample' ? 'Experimental Dataset' : 'Dataset Time Period'}
              </label>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input 
                    type="date" 
                    value={experimentStartDate}
                    onChange={(e) => setExperimentStartDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <span className="text-slate-400 font-medium text-sm">to</span>
                <div className="relative flex-1">
                  <input 
                    type="date" 
                    value={experimentEndDate}
                    onChange={(e) => setExperimentEndDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-semibold ml-1">Defaults: {testType === 'one-sample' ? 'Control End ➔ Latest Date.' : 'All Available Data.'}</p>
            </div>

            {/* Location Radius */}
            <div className="space-y-4 col-span-1 md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 items-center gap-1">
                <MapPin size={12} className="inline mr-1 mb-0.5" /> Location Radius
              </label>
              <div className="relative flex items-center w-full max-w-md">
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

              {testType === 'two-sample' ? (
                <>
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
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Threshold Value</label>
                    <input 
                      type="number" 
                      placeholder="e.g., 2000"
                      value={indepThreshold}
                      onChange={(e) => setIndepThreshold(e.target.value)}
                      className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Independent Variable (Cause)</label>
                  <div className="w-full bg-slate-100 border border-slate-200 text-slate-400 rounded-xl px-4 py-3 font-medium flex items-center">
                    Time Period
                  </div>
                </div>
              )}
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
            onClick={() => handleRunAnalysis()}
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
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Top Meta Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    {resultsData.testType === 'two-sample' ? 'Total Pairs (n)' : 'Sample Size (n)'}
                  </span>
                  <div className="text-2xl font-black text-white">{resultsData.sampleSize.toLocaleString()}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Mean</span>
                  <div className="text-2xl font-black text-white">{resultsData.mean}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Overall Std Dev</span>
                  <div className="text-2xl font-black text-white">{resultsData.stdDev}</div>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Alpha (α)</span>
                  <div className="text-2xl font-black text-white">{resultsData.alpha}</div>
                </div>
              </div>

              {/* Two-Sample Specific Group Data */}
              {resultsData.testType === 'two-sample' && (
                <div className="grid grid-cols-2 gap-4 mb-6 bg-slate-800/30 p-4 rounded-xl border border-slate-700/50">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      Group A (≥ Threshold) Mean
                    </span>
                    <div className="text-lg font-bold text-white">{resultsData.groupAMean} <span className="text-xs font-normal text-slate-500 ml-1">(n={resultsData.groupASize})</span></div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">
                      Group B (&lt; Threshold) Mean
                    </span>
                    <div className="text-lg font-bold text-white">{resultsData.groupBMean} <span className="text-xs font-normal text-slate-500 ml-1">(n={resultsData.groupBSize})</span></div>
                  </div>
                </div>
              )}

              <div className="h-px w-full bg-slate-800 mb-6" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  </div>
                </div>
                {resultsData.testType === 'two-sample' && (
                  <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/50">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 block">Pearson r</span>
                    <div className="text-3xl font-black text-emerald-400">{resultsData.pearsonR}</div>
                  </div>
                )}
              </div>

              <div className={`mt-6 p-4 rounded-xl border ${resultsData.isSignificant ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-slate-800 border-slate-700'}`}>
                <p className="text-sm font-medium leading-relaxed">
                  {resultsData.isSignificant ? (
                    <span className="text-emerald-300">
                      <strong>Conclusion:</strong> Reject the Null Hypothesis (H0). The data indicates a statistically significant correlation that {h1String.toLowerCase().replace('.', '')}
                    </span>
                  ) : (
                    <span className="text-slate-300">
                      <strong>Conclusion:</strong> Fail to reject the Null Hypothesis (H0). There is not enough evidence to prove that {h1String.toLowerCase().replace('.', '')}
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