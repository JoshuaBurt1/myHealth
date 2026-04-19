// Intervention.tsx
// Note: For this to actually output true information; users data must be real and accurate

import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Info, ChevronDown, Play, Database, User as UserIcon, Calendar, MapPin, Calculator, AlertCircle
} from 'lucide-react';
import {
  VITAL_KEY_MAP, BLOODTEST_KEY_MAP, SYMPTOM_KEY_MAP,
  DIET_KEY_MAP, MICRONUTRIENT_KEY_MAP, STRENGTH_KEY_MAP,
  SPEED_KEY_MAP, PLYO_KEY_MAP, ENDURANCE_KEY_MAP,
  YOGA_KEY_MAP, MOBILITY_KEY_MAP, PHYSIO_KEY_MAP
} from '../profileConstants';
import { InterventionGraph } from './InterventionGraph';

// Types & Interfaces
export interface InterventionProps {
  profileData?: Record<string, any>;
}

interface AnalysisResults {
  sampleSize: number;
  mu0: string;       
  sigma: string;     
  xBar: string;      
  zStatistic: string;
  controlEndStr: string; 
  interventionRatio?: string;
  dependentChange?: string;
}

const TOPIC_GROUPS = [
  { label: 'Nutrition', options: [...Object.keys(DIET_KEY_MAP), ...Object.keys(MICRONUTRIENT_KEY_MAP)] },
  { label: 'Body Measurements', options: ['Weight', 'Height'] },
  { label: 'Vitals & Blood', options: [...Object.keys(VITAL_KEY_MAP), ...Object.keys(BLOODTEST_KEY_MAP)] },
  { label: 'Symptoms & Feelings', options: Object.keys(SYMPTOM_KEY_MAP) },
  { label: 'Exercise', options: [
      ...Object.keys(STRENGTH_KEY_MAP), ...Object.keys(SPEED_KEY_MAP),
      ...Object.keys(ENDURANCE_KEY_MAP), ...Object.keys(PLYO_KEY_MAP),
      ...Object.keys(YOGA_KEY_MAP), ...Object.keys(MOBILITY_KEY_MAP),
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

const calculateMean = (arr: number[]): number => arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
const calculateStdDev = (arr: number[], mean: number): number => {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

const normalCDF = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-z * z / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};

const getCriticalZ = (alpha: number, effect: string): number => {
  if (effect === 'a difference') {
    if (alpha === 0.10) return 1.645;
    if (alpha === 0.05) return 1.960;
    if (alpha === 0.01) return 2.576;
    return 1.96;
  } else {
    if (alpha === 0.10) return 1.282;
    if (alpha === 0.05) return 1.645;
    if (alpha === 0.01) return 2.326;
    return 1.645;
  }
};

const BellCurvePlot = ({ zScore, alpha, effect }: { zScore: number, alpha: number, effect: string }) => {
  const width = 400;
  const height = 150;
  
  const scaleX = (val: number) => ((val + 4) / 8) * width;
  const scaleY = (val: number) => height - (val * height * 2.2);
  const getPDF = (x: number) => Math.exp(-0.5 * Math.pow(x, 2)) / Math.sqrt(2 * Math.PI);

  let curvePath = `M 0 ${height} `;
  for (let x = -4; x <= 4; x += 0.1) curvePath += `L ${scaleX(x)} ${scaleY(getPDF(x))} `;
  curvePath += `L ${width} ${height} Z`;

  const critZ = getCriticalZ(alpha, effect);
  let highlights = [];

  const createRegion = (start: number, end: number) => {
    let path = `M ${scaleX(start)} ${height} `;
    for (let x = start; x <= end; x += 0.1) path += `L ${scaleX(x)} ${scaleY(getPDF(x))} `;
    path += `L ${scaleX(end)} ${scaleY(getPDF(end))} L ${scaleX(end)} ${height} Z`;
    return path;
  };

  if (effect === 'an increase') highlights.push(createRegion(critZ, 4));
  else if (effect === 'a decrease') highlights.push(createRegion(-4, -critZ));
  else {
    highlights.push(createRegion(critZ, 4));
    highlights.push(createRegion(-4, -critZ));
  }

  const clampedZ = Math.max(-3.8, Math.min(3.8, zScore));
  const zX = scaleX(clampedZ);
  const zY = scaleY(getPDF(clampedZ));

  return (
    <div className="flex flex-col items-center justify-center w-full py-4">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        <path d={curvePath} fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2" />
        {highlights.map((d, i) => <path key={i} d={d} fill="#10b981" opacity="0.4" />)}
        <line x1="0" y1={height} x2={width} y2={height} stroke="#64748b" strokeWidth="2" />
        <line x1={zX} y1={0} x2={zX} y2={height} stroke="#ef4444" strokeWidth="2" strokeDasharray="4" />
        <circle cx={zX} cy={zY} r={4} fill="#ef4444" />
        <text x={zX} y="-10" fill="#ef4444" fontSize="12" fontWeight="bold" textAnchor="middle">Z = {zScore.toFixed(2)}</text>
        <text x={zX} y="-25" fill="#ef4444" fontSize="10" textAnchor="middle">p-value</text>
      </svg>
      <div className="flex gap-4 mt-8 text-[10px] font-bold text-slate-400 uppercase">
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-slate-200 border border-slate-400 rounded-sm"></div> Distribution</span>
        <span className="flex items-center gap-1"><div className="w-3 h-3 bg-emerald-400/40 border border-emerald-400 rounded-sm"></div> Rejection Region (α)</span>
        <span className="flex items-center gap-1"><div className="w-3 h-0.5 bg-rose-500 rounded-sm"></div> P-Value Location</span>
      </div>
    </div>
  );
};

const Intervention: React.FC<InterventionProps> = ({ profileData }) => {
  const [dataSource, setDataSource] = useState<'personal' | 'global'>('personal');
  const [controlStartDate, setControlStartDate] = useState<string>('');
  const [interventionDate, setInterventionDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [locationRadius, setLocationRadius] = useState<string>('');

  const [interventionCategory, setInterventionCategory] = useState<string>(TOPIC_GROUPS[2].label); // Default to Vitals
  const [interventionVar, setInterventionVar] = useState<string>(''); 
  const [dependentCategory, setDependentCategory] = useState<string>(TOPIC_GROUPS[0].label); // Default to Nutrition
  const [dependentVar, setDependentVar] = useState<string>('Weight');
  const [effect, setEffect] = useState<string>('a difference');
  const [significanceLevel, setSignificanceLevel] = useState<string>('0.05');
  
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const [resultsData, setResultsData] = useState<AnalysisResults | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [globalData, setGlobalData] = useState<Record<string, any> | null>(null);
  const currentGraphData = dataSource === 'personal' ? profileData : globalData;

  useEffect(() => {
    if (dataSource === 'global' && !globalData) {
      const fetchGlobalData = async () => {
        try {
          const globalRef = doc(db, 'myHealth_globalStats', 'globalStats');
          const globalSnap = await getDoc(globalRef);
          if (globalSnap.exists()) {
            setGlobalData(globalSnap.data());
          }
        } catch (err) {
          console.error("Error fetching global stats:", err);
        }
      };
      fetchGlobalData();
    }
  }, [dataSource, globalData]);
  

  // Dynamic Hypothesis Strings
  const getHypothesisStrings = (formattedDate: string, interventionRatio?: string) => {
    let mathOperator = '≠';
    if (effect === 'an increase') mathOperator = '>';
    if (effect === 'a decrease') mathOperator = '<';

    const dateText = formattedDate || '[Intervention Date]';
    
    let displayIntPct = "";
    if (interventionRatio && interventionRatio !== "N/A") {
      const num = parseFloat(interventionRatio);
      displayIntPct = ` (${num > 0 ? "+" : ""}${interventionRatio}%)`;
    }

    const causeText = interventionVar 
      ? `${interventionVar} intervention${displayIntPct} starting on ${dateText}`
      : `the time period post-${dateText}`;

    // Removed displayDepPct from h1String
    const h0String = `${causeText} is associated with no change in ${dependentVar.toLowerCase()} (μ = μ0).`;
    const h1String = `${causeText} is associated with ${effect} in ${dependentVar.toLowerCase()} (μ ${mathOperator} μ0).`;
    
    return { h0String, h1String };
  };

  const handleGraphPointClick = (point: any) => {
    if (!point || !point.timestamp) return;

    try {
      const date = new Date(point.timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;

      // Sets the intervention boundary directly
      setInterventionDate(formattedDate);
    } catch (error) {
      console.error("Error setting date from graph:", error);
    }
  };

  const handleRunAnalysis = async () => {
    if (!interventionDate) {
      setErrorMsg("Please select an intervention date.");
      return;
    }
    
    setIsRunning(true);
    setShowResults(false);
    setErrorMsg(null);
    
    try {
      const depKey = getDbKey(dependentVar);
      const intKey = getDbKey(interventionVar);
      
      const experimentalValues: number[] = [];
      const controlValues: number[] = [];
      
      const intExperimentalValues: number[] = [];
      const intControlValues: number[] = [];

      const controlStartMs = controlStartDate 
        ? new Date(controlStartDate + 'T00:00:00').getTime() 
        : 0; 

      const controlEndMs = new Date(interventionDate + 'T23:59:59').getTime();
      const expStartMs = controlEndMs + 1;
      const expEndMs = endDate 
        ? new Date(endDate + 'T23:59:59').getTime() 
        : Infinity;

      const extractOneSampleValues = (dataObj: Record<string, any>) => {
        if (!dataObj) return;

        // Extract Dependent Variable
        if (dataObj[depKey] && Array.isArray(dataObj[depKey])) {
          dataObj[depKey].forEach((entry: any) => {
            const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
            const timeSource = entry.dateTime || entry.date || entry.timestamp;
            if (isNaN(val) || !timeSource) return;

            const entryTime = new Date(timeSource).getTime();
            if (entryTime >= controlStartMs && entryTime <= controlEndMs) {
              controlValues.push(val);
            } else if (entryTime >= expStartMs && entryTime <= expEndMs) {
              experimentalValues.push(val);
            }
          });
        }

        // Extract Intervention Variable
        if (interventionVar && dataObj[intKey] && Array.isArray(dataObj[intKey])) {
           dataObj[intKey].forEach((entry: any) => {
            const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
            const timeSource = entry.dateTime || entry.date || entry.timestamp;
            if (isNaN(val) || !timeSource) return;

            const entryTime = new Date(timeSource).getTime();
            if (entryTime >= controlStartMs && entryTime <= controlEndMs) {
              intControlValues.push(val);
            } else if (entryTime >= expStartMs && entryTime <= expEndMs) {
              intExperimentalValues.push(val);
            }
          });
        }
      };

      if (dataSource === 'personal') {
        if (!profileData) throw new Error("No personal profile data available.");
        extractOneSampleValues(profileData);
      } else {
        if (globalData) {
          extractOneSampleValues(globalData);
        } else {
          const globalRef = doc(db, 'myHealth_globalStats', 'globalStats');
          const globalSnap = await getDoc(globalRef);
          
          if (globalSnap.exists()) {
            const data = globalSnap.data();
            setGlobalData(data);
            extractOneSampleValues(data);
          } else {
            throw new Error("Global statistics have not been generated yet.");
          }
        }
      }

      // Dataset Logging
      console.log(`--- Analysis Datasets for ${dependentVar} ---`);
      console.log("Control Group (Baseline):", controlValues);
      console.log("Experimental Group (Post-Intervention):", experimentalValues);      
      console.table({
        controlGroup: { count: controlValues.length, mean: calculateMean(controlValues) },
        experimentalGroup: { count: experimentalValues.length, mean: calculateMean(experimentalValues) }
      });

      let interventionRatioStr = "N/A";
      if (intControlValues.length > 0 && intExperimentalValues.length > 0) {
        const intControlMean = calculateMean(intControlValues);
        const intExpMean = calculateMean(intExperimentalValues);
        
        // Calculate percentage change: ((New - Old) / Old) * 100
        if (intControlMean !== 0) {
          const pctChange = ((intExpMean - intControlMean) / intControlMean) * 100;
          // Store as a string with 1 decimal place
          interventionRatioStr = pctChange.toFixed(1); 
        }
      }

      const n = experimentalValues.length;
      if (n < 1) throw new Error(`Not enough data points found for ${dependentVar} in the experimental dataset (Found: ${n}).`);
      
      const controlN = controlValues.length;
      if (controlN < 2) throw new Error("Control group requires at least 2 data points to establish a baseline standard deviation (σ).");

      const mu0 = calculateMean(controlValues);
      const sigma = calculateStdDev(controlValues, mu0);
      if (sigma === 0) throw new Error("Control group standard deviation is 0. A Z-test cannot be performed without variance in the control baseline.");

      const xBar = calculateMean(experimentalValues);

      let dependentChangeStr = "0.0";
      if (mu0 !== 0) {
        const depPctChange = ((xBar - mu0) / mu0) * 100;
        dependentChangeStr = depPctChange.toFixed(1);
      }

      const standardError = sigma / Math.sqrt(n);
      const zStatistic = (xBar - mu0) / standardError;

      setResultsData({
        sampleSize: n,
        mu0: mu0.toFixed(2),
        sigma: sigma.toFixed(2),
        xBar: xBar.toFixed(2),
        zStatistic: zStatistic.toFixed(3),
        controlEndStr: interventionDate,
        interventionRatio: interventionRatioStr,
        dependentChange: dependentChangeStr
      });

      setShowResults(true);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred while running the analysis.");
    } finally {
      setIsRunning(false);
    }
  };

  // Dynamic p-value and significance calculations
  let dynamicPValue = 0;
  let isSignificant = false;
  let currentAlpha = parseFloat(significanceLevel);
  
  if (showResults && resultsData) {
    const zStatNum = parseFloat(resultsData.zStatistic);
    if (effect === 'an increase') dynamicPValue = 1 - normalCDF(zStatNum);
    else if (effect === 'a decrease') dynamicPValue = normalCDF(zStatNum);
    else dynamicPValue = 2 * (1 - normalCDF(Math.abs(zStatNum)));

    isSignificant = dynamicPValue < currentAlpha;
  }

  return (
    <div className="bg-transparent md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 overflow-hidden mt-0 md:mt-6">
        <div className="flex gap-3 text-sm text-slate-600 bg-white md:bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm md:shadow-none m-4">
          <Info size={20} className="shrink-0 text-emerald-500 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-slate-800">Design your own health experiments.</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Establish a baseline (Group A) to extract your mean (μ0) and standard deviation (σ), and compare it against your post-intervention group (Group B) using a one-sample Z-test.
            </p>
          </div>
        </div>
      <div className="p-4 md:p-6 space-y-8">
        
        {/* Config Block */}
        <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Intervention Experiment Builder</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4  mb-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Target Dataset</label>
              <div className="flex bg-slate-200/50 p-1 rounded-xl w-full">
                <button onClick={() => setDataSource('personal')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${dataSource === 'personal' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>
                  <UserIcon size={16} /> Personal
                </button>
                <button onClick={() => setDataSource('global')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-bold transition-all ${dataSource === 'global' ? 'bg-white text-emerald-600 shadow-sm border border-slate-100' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Database size={16} /> Global
                </button>
              </div>
            </div>

            {dataSource === 'global' && (
              <div className="space-y-4">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 items-center gap-1">
                  <MapPin size={12} className="inline mr-1 mb-0.5" /> Location Radius
                </label>
                <div className="relative flex items-center w-full">
                  <input type="number" placeholder="All Locations" value={locationRadius} onChange={(e) => setLocationRadius(e.target.value)} className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 placeholder:text-slate-400" />
                  <span className="absolute right-4 text-slate-400 font-medium text-sm pointer-events-none">km</span>
                </div>
              </div>
            )}
          </div>
          {/* 4-Column Metric Selector Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            
            {/* 1. Intervention Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Intervention Category</label>
              <div className="relative">
                <select 
                  value={interventionCategory}
                  onChange={(e) => {
                    setInterventionCategory(e.target.value);
                    setInterventionVar(''); // Reset option when category changes
                  }}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  {TOPIC_GROUPS.map(group => <option key={group.label} value={group.label}>{group.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* 2. Intervention Option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Intervention Metric</label>
              <div className="relative">
                <select 
                  value={interventionVar}
                  onChange={(e) => setInterventionVar(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="">Select metric...</option>
                  {TOPIC_GROUPS.find(g => g.label === interventionCategory)?.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* 3. Dependent Category */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Dependent Category</label>
              <div className="relative">
                <select 
                  value={dependentCategory}
                  onChange={(e) => {
                    setDependentCategory(e.target.value);
                    setDependentVar('');
                  }}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                >
                  {TOPIC_GROUPS.map(group => <option key={group.label} value={group.label}>{group.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>

            {/* 4. Dependent Option */}
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Dependent Metric</label>
              <div className="relative">
                <select 
                  value={dependentVar}
                  onChange={(e) => setDependentVar(e.target.value)}
                  className="w-full appearance-none bg-white border border-slate-200 text-slate-800 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                >
                  <option value="">Select metric...</option>
                  {TOPIC_GROUPS.find(g => g.label === dependentCategory)?.options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
            {/* Left Column: Intervention Graph */}
            <div>
              {interventionVar && currentGraphData && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4 h-full">
                  <h5 className="text-xs font-bold text-slate-500 mb-2">
                    Select a point to set Intervention Date:
                  </h5>
                  <InterventionGraph 
                    data={currentGraphData} 
                    metricKey={getDbKey(interventionVar)} 
                    title={interventionVar}
                    onPointClick={handleGraphPointClick} 
                  />
                </div>
              )}
            </div>

            {/* Right Column: Dependent Variable Graph */}
            <div>
              {dependentVar && currentGraphData && (
                <div className="bg-white rounded-2xl border border-slate-100 p-4 h-full">
                  <h5 className="text-xs font-bold text-slate-500 mb-2">
                    Dependent Variable Trends
                  </h5>
                  <InterventionGraph 
                    data={currentGraphData} 
                    metricKey={getDbKey(dependentVar)} 
                    title={dependentVar}
                    onPointClick={handleGraphPointClick} 
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Unified Timeline Layout */}
        <div className="grid grid-cols-1 gap-4">
          <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl space-y-4">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 items-center gap-1">
              <Calendar size={12} className="inline mr-1 mb-0.5" /> Timeline
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 ml-1">Control Group Start</label>
                <input 
                  type="date" 
                  value={controlStartDate} 
                  onChange={(e) => setControlStartDate(e.target.value)} 
                  className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 ml-1">Intervention Date</label>
                <input 
                  type="date" 
                  value={interventionDate}
                  onChange={(e) => setInterventionDate(e.target.value)} 
                  className={`w-full bg-white transition-all rounded-xl px-4 py-2.5 text-sm font-medium outline-none ${
                    !interventionDate 
                      ? 'border-2 border-amber-500 ring-amber-100 shadow-md text-slate-700' 
                      : 'border border-slate-200 text-slate-600 focus:ring-2 focus:ring-emerald-500'
                  }`} 
                />
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 ml-1">End Date</label>
                <input 
                  type="date" 
                  value={endDate} 
                  onChange={(e) => setEndDate(e.target.value)} 
                  className="w-full bg-white border border-slate-200 text-slate-600 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 outline-none" 
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-400 font-semibold ml-1">*Intervention Date establishes the end of baseline (μ0, σ) and start of the experiment.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1">Expected Effect</label>
                <div className="relative">
                  <select 
                    value={effect}
                    onChange={(e) => setEffect(e.target.value)}
                    className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 rounded-xl px-4 py-3 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  >
                    <option value="a difference">A difference (Two-Tailed Z-Test)</option>
                    <option value="an increase">An increase (Right-Tailed)</option>
                    <option value="a decrease">A decrease (Left-Tailed)</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                </div>
              </div>

              <div className="p-4 bg-white border border-slate-200 shadow-sm rounded-2xl">
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 ml-1">SIGNIFICANCE LEVEL (α)</label>
                <div className="flex bg-slate-100 p-1 rounded-xl w-full">
                  {['0.10', '0.05', '0.01'].map((level) => (
                    <button
                      key={level}
                      onClick={() => setSignificanceLevel(level)}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                        significanceLevel === level
                          ? 'bg-white text-emerald-600 shadow-sm border border-slate-200'
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

        {errorMsg && (
          <div className="flex items-center gap-3 p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col md:flex-row justify-center gap-3 pt-4 border-t border-slate-100">
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
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="bg-slate-900 rounded-3xl p-6 text-slate-100 overflow-hidden relative shadow-xl">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Top Level Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-slate-800">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Test Type</p>
                  <p className="text-lg font-medium text-slate-200">One-Sample Z-Test</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold tracking-wider">EXPERIMENTAL SIZE (n)</p>
                  <p className="text-lg font-medium text-slate-200">{resultsData.sampleSize}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold tracking-wider">ALPHA (α)</p>
                  <p className="text-lg font-medium text-slate-200">{currentAlpha}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Result</p>
                  <p className={`text-lg font-bold ${isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {isSignificant ? 'Significant' : 'Not Significant'}
                  </p>
                </div>
              </div>

              {/* Math Breakdown Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                  <h5 className="text-sm font-bold text-slate-300 mb-4 border-b border-slate-700 pb-2">Group Parameters</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Control Mean (μ0)</span>
                      <span className="text-sm font-bold font-mono">{resultsData.mu0}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Control Std Dev (σ)</span>
                      <span className="text-sm font-bold font-mono">{resultsData.sigma}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Experimental Mean (x̄)</span>
                      <span className="text-sm font-bold font-mono text-emerald-300">{resultsData.xBar}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                  <h5 className="text-sm font-bold text-slate-300 mb-4 border-b border-slate-700 pb-2">Z-Test Variables</h5>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Z-Statistic</span>
                      <span className="text-sm font-bold font-mono">{resultsData.zStatistic}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">P-Value</span>
                      <span className={`text-sm font-bold font-mono ${isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {dynamicPValue.toFixed(4)}
                      </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-400 leading-relaxed italic">
                      {isSignificant 
                        ? `p (${dynamicPValue.toFixed(4)}) < α (${currentAlpha}). Reject H0.` 
                        : `p (${dynamicPValue.toFixed(4)}) > α (${currentAlpha}). Fail to reject H0.`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Visualization */}
              <div className="bg-slate-950 rounded-2xl p-6 border border-slate-800 overflow-hidden relative mb-8">
                <div className="absolute top-4 left-4 z-10">
                  <h5 className="text-xs font-bold text-slate-300">Z-Distribution & P-Value</h5>
                </div>
                <BellCurvePlot 
                  zScore={parseFloat(resultsData.zStatistic)} 
                  alpha={currentAlpha} 
                  effect={effect} 
                />
              </div>

              {/* Hypothesis Highlighting Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                
                {/* Null Hypothesis (H0) */}
                <div className={`p-4 rounded-2xl border transition-all duration-500 ${
                  !isSignificant 
                    ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                    : 'bg-slate-800/30 border-slate-700 opacity-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-bold ${!isSignificant ? 'text-amber-400' : 'text-slate-400'}`}>
                      H0: Null Hypothesis
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {getHypothesisStrings(resultsData.controlEndStr, resultsData.interventionRatio).h0String}
                  </p>              
                  </div>

                {/* Alternative Hypothesis (H1) */}
                <div className={`p-4 rounded-2xl border transition-all duration-500 ${
                  isSignificant 
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-800/30 border-slate-700 opacity-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-sm font-bold ${isSignificant ? 'text-emerald-400' : 'text-slate-400'}`}>
                      H1: Alternative Hypothesis
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    {getHypothesisStrings(resultsData.controlEndStr, resultsData.interventionRatio).h1String}
                  </p>
                </div>
              </div>
              {/* Analysis Statement Section */}
              <div className={`mt-6 p-5 rounded-2xl border transition-all duration-500 shadow-inner ${
                isSignificant 
                  ? 'bg-emerald-500/10 border-emerald-500/50' 
                  : 'bg-amber-500/10 border-amber-500/50'
              }`}>
                <div className="flex items-start gap-3">
                  <div className="space-y-1">
                    <span className={`text-sm font-bold ${isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Results:
                    </span>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      An average change of <span className="font-mono font-bold text-white">
                        {parseFloat(resultsData.interventionRatio || '0') > 0 ? '+' : ''}{resultsData.interventionRatio}%
                      </span> in <span className="text-white">{interventionVar || 'the intervention'}</span> was associated with an average change of <span className="font-mono font-bold text-white">
                        {parseFloat(resultsData.dependentChange || '0') > 0 ? '+' : ''}{resultsData.dependentChange}%
                      </span> in <span className="text-white">{dependentVar}</span>, which is <span className={`font-bold ${isSignificant ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {isSignificant ? 'statistically significant' : 'not statistically significant'}
                      </span> at a <span className="text-white">{( (1 - parseFloat(significanceLevel)) * 100).toFixed(0)}%</span> confidence level 
                      (p = <span className="font-mono">{dynamicPValue.toFixed(4)}</span>, α = <span className="font-mono">{significanceLevel}</span>).
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Intervention;