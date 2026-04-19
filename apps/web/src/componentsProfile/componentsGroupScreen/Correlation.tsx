// Correlation.tsx
// Note: For this to actually output true information; users data must be real and accurate

import React, { useState, useMemo } from 'react';
import { db } from '../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  Info, Play, Database, User as UserIcon, Calendar, Calculator, AlertCircle, Clock, CheckCircle2
} from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Label
} from 'recharts';
import {
  VITAL_KEY_MAP, BLOODTEST_KEY_MAP, SYMPTOM_KEY_MAP,
  DIET_KEY_MAP, MICRONUTRIENT_KEY_MAP, 
  STRENGTH_KEY_MAP, SPEED_KEY_MAP, ENDURANCE_KEY_MAP
} from '../profileConstants';

export interface CorrelationProps {
  profileData?: Record<string, any>;
}

interface CorrelationResults {
  rValue: number;
  rSquared: number;
  sampleSize: number;
  interpretation: string;
  equation: string;
  modelType: 'Linear' | 'Quadratic';
  regressionPoints: { x: number; y: number }[];
  statValue: number;
  statType: 't' | 'F';
  pValue: number;
  df1: number;
  df2: number;
  slope: number;
}

interface PlotPoint {
  x: number;
  y: number;
  timestamp: number;
}

const TOPIC_GROUPS = [
  { label: 'Nutrition', options: [...Object.keys(DIET_KEY_MAP), ...Object.keys(MICRONUTRIENT_KEY_MAP)] },
  { label: 'Body Measurements', options: ['Weight', 'Height'] },
  { label: 'Vitals & Blood', options: [...Object.keys(VITAL_KEY_MAP), ...Object.keys(BLOODTEST_KEY_MAP)] },
  { label: 'Symptoms', options: Object.keys(SYMPTOM_KEY_MAP) },
  { label: 'Performance', options: [...Object.keys(STRENGTH_KEY_MAP), ...Object.keys(SPEED_KEY_MAP), ...Object.keys(ENDURANCE_KEY_MAP)] }
];

const getDbKey = (displayName: string): string => {
  const ALL_MAPS: Record<string, string> = {
    ...VITAL_KEY_MAP, ...BLOODTEST_KEY_MAP, ...SYMPTOM_KEY_MAP,
    ...DIET_KEY_MAP, ...MICRONUTRIENT_KEY_MAP, ...STRENGTH_KEY_MAP,
    ...SPEED_KEY_MAP, ...ENDURANCE_KEY_MAP
  };
  return ALL_MAPS[displayName] || displayName.toLowerCase();
};

// Numerical approximation for standard normal cumulative distribution
const normalCDF = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
};

const Correlation: React.FC<CorrelationProps> = ({ profileData }) => {
  const [dataSource, setDataSource] = useState<'personal' | 'global'>('personal');

  const [independentGroup, setIndependentGroup] = useState<string>(TOPIC_GROUPS[0].label); // Default 'Nutrition'
  const [independentVar, setIndependentVar] = useState<string>('Calories');
  const [dependentGroup, setDependentGroup] = useState<string>(TOPIC_GROUPS[1].label); // Default 'Body Measurements'
  const [dependentVar, setDependentVar] = useState<string>('Weight');
  
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [locationRadius, setLocationRadius] = useState<string>('');
  
  const [bucketHours, setBucketHours] = useState<number>(24);
  const [alpha, setAlpha] = useState<number>(0.05);

  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<CorrelationResults | null>(null);
  const [plotData, setPlotData] = useState<PlotPoint[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getSafeTimestamp = (entry: any): number | null => {
    const rawValue = entry.dateTime || entry.date || entry.timestamp;
    if (!rawValue) return null;
    const parsed = new Date(rawValue).getTime();
    return isNaN(parsed) ? null : parsed;
  };

  const calculateRegression = (data: PlotPoint[]): CorrelationResults => {
    const n = data.length;
    const x = data.map(p => p.x);
    const y = data.map(p => p.y);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = data.reduce((a, b) => a + b.x * b.y, 0);
    const sumX2 = x.reduce((a, b) => a + b * b, 0);
    const sumY2 = y.reduce((a, b) => a + b * b, 0);

    // Linear Model: y = mx + b
    const xDenom = (n * sumX2) - (sumX ** 2);
    const slope = xDenom === 0 ? 0 : (n * sumXY - sumX * sumY) / xDenom;
    const intercept = (sumY - slope * sumX) / n;
    
    const rNum = (n * sumXY) - (sumX * sumY);
    const rDenom = Math.sqrt(((n * sumX2) - (sumX ** 2)) * ((n * sumY2) - (sumY ** 2)));
    const rValue = rDenom === 0 ? 0 : rNum / rDenom;
    const linearRSquared = rValue ** 2;

    // Quadratic Model: y = ax^2 + bx + c
    const sumX3 = x.reduce((a, b) => a + b ** 3, 0);
    const sumX4 = x.reduce((a, b) => a + b ** 4, 0);
    const sumX2Y = data.reduce((a, b) => a + (b.x ** 2) * b.y, 0);

    // Matrix solving for Quadratic coefficients (using Cramer's rule)
    const det = n * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX3 - sumX2 * sumX2);
    const a = (sumY * (sumX2 * sumX4 - sumX3 * sumX3) - sumX * (sumXY * sumX4 - sumX2Y * sumX3) + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2)) / det;
    const b = (n * (sumXY * sumX4 - sumX2Y * sumX3) - sumY * (sumX * sumX4 - sumX2 * sumX3) + sumX2 * (sumX * sumX2Y - sumXY * sumX2)) / det;
    const c = (n * (sumX2 * sumX2Y - sumXY * sumX3) - sumX * (sumX * sumX2Y - sumXY * sumX2) + sumY * (sumX * sumX3 - sumX2 * sumX2)) / det;

    const yMean = sumY / n;
    const ssTot = y.reduce((acc, val) => acc + (val - yMean) ** 2, 0);
    const ssResQuad = data.reduce((acc, p) => acc + (p.y - (a * p.x ** 2 + b * p.x + c)) ** 2, 0);
    const quadraticRSquared = 1 - (ssResQuad / ssTot);

    // Determine better fit
    const isQuadraticBetter = quadraticRSquared > linearRSquared + 0.05; // 5% improvement threshold
    const modelType = isQuadraticBetter ? 'Quadratic' : 'Linear';
    const finalRSquared = isQuadraticBetter ? quadraticRSquared : linearRSquared;
    const equation = isQuadraticBetter 
      ? `y = ${a.toFixed(4)}x² + ${b.toFixed(2)}x + ${c.toFixed(2)}`
      : `y = ${slope.toFixed(2)}x + ${intercept.toFixed(2)}`;

    // Calculate P-Value via t-test or F-test (Paulson-Camp-Peizer Approximation)
    let statValue = 0;
    let statType: 't' | 'F' = 't';
    let pValue = 1;
    let df1 = 1;
    let df2 = n - 2;

    if (n > 3) {
      if (isQuadraticBetter) {
        statType = 'F';
        df1 = 2; // k=2 predictors for quadratic
        df2 = n - 3; // n - k - 1
        statValue = quadraticRSquared === 1 ? 999 : (quadraticRSquared / df1) / ((1 - quadraticRSquared) / df2);
        
        // F-to-Z transformation for p-value
        const z = ((1 - 2/(9*df2)) * Math.pow(statValue, 1/3) - (1 - 2/(9*df1))) / 
                  Math.sqrt((2/(9*df2)) * Math.pow(statValue, 2/3) + (2/(9*df1)));
        pValue = 1 - normalCDF(z);
      } else {
        statType = 't';
        df1 = 1; 
        df2 = n - 2;
        statValue = linearRSquared === 1 ? 999 : Math.abs(rValue) * Math.sqrt(df2 / (1 - linearRSquared));
        
        // t^2 is F(1, df2)
        const fEquiv = statValue * statValue;
        const z = ((1 - 2/(9*df2)) * Math.pow(fEquiv, 1/3) - (1 - 2/(9*df1))) / 
                  Math.sqrt((2/(9*df2)) * Math.pow(fEquiv, 2/3) + (2/(9*df1)));
        pValue = 1 - normalCDF(z);
      }
    }

    // Generate line points
    const minX = Math.min(...x);
    const maxX = Math.max(...x);
    const points = [];
    const steps = 50;
    for (let i = 0; i <= steps; i++) {
      const curX = minX + (maxX - minX) * (i / steps);
      const curY = isQuadraticBetter ? (a * curX ** 2 + b * curX + c) : (slope * curX + intercept);
      points.push({ x: curX, y: curY });
    }

    let interpretation = "No clear relationship.";
    if (Math.abs(rValue) > 0.7) interpretation = `Strong ${rValue > 0 ? 'positive' : 'negative'} correlation.`;
    else if (Math.abs(rValue) > 0.4) interpretation = `Moderate ${rValue > 0 ? 'positive' : 'negative'} correlation.`;

    return { 
      rValue, 
      rSquared: finalRSquared, 
      sampleSize: n, 
      interpretation, 
      equation, 
      modelType,
      regressionPoints: points,
      statValue,
      statType,
      pValue,
      df1,
      df2,
      slope
    };
  };

  const handleRunAnalysis = async () => {
    setIsRunning(true);
    setErrorMsg(null);
    setResults(null);
    
    try {
      const xKey = getDbKey(independentVar);
      const yKey = getDbKey(dependentVar);
      const synchronizedData: PlotPoint[] = [];

      const startTs = startDate ? new Date(startDate).getTime() : -Infinity;
      const endTs = endDate ? new Date(endDate).getTime() + 86400000 : Infinity; //86400000 = 1 day
      const bucketMs = bucketHours * 60 * 60 * 1000;

      const processDataset = (dataObj: Record<string, any>) => {
        // Accessing fields like 'calories', 'weight', etc., from the document
        const xEntries = (dataObj[xKey] || []).filter((e: any) => {
          const ts = getSafeTimestamp(e);
          return ts && ts >= startTs && ts <= endTs;
        });

        const yEntries = (dataObj[yKey] || []).filter((e: any) => {
          const ts = getSafeTimestamp(e);
          return ts && ts >= startTs && ts <= endTs;
        });

        xEntries.forEach((xEntry: any) => {
          const xTs = getSafeTimestamp(xEntry)!;
          const xVal = parseFloat(xEntry.value);
          if (isNaN(xVal)) return;

          let bestY: number | null = null;
          let minDiff = Infinity;

          yEntries.forEach((yEntry: any) => {
            const yTs = getSafeTimestamp(yEntry)!;
            const yVal = parseFloat(yEntry.value);
            if (isNaN(yVal)) return;

            const diff = Math.abs(xTs - yTs);
            if (diff <= bucketMs && diff < minDiff) {
              minDiff = diff;
              bestY = yVal;
            }
          });

          if (bestY !== null) {
            synchronizedData.push({ x: xVal, y: bestY, timestamp: xTs });
          }
        });
      };

      if (dataSource === 'personal') {
        if (!profileData) throw new Error("No data available.");
        processDataset(profileData);
      } else {
        // Access the specific globalStats document
        const globalDocRef = doc(db, 'myHealth_globalStats', 'globalStats');
        const docSnap = await getDoc(globalDocRef);

        if (docSnap.exists()) {
          processDataset(docSnap.data());
        } else {
          throw new Error("Global statistics document not found.");
        }
      }

      if (synchronizedData.length < 4) {
        throw new Error("Insufficient data pairs found. Need at least 4 pairs to calculate degrees of freedom.");
      }

      setPlotData(synchronizedData);
      setResults(calculateRegression(synchronizedData));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const graphTitle = useMemo(() => {
    const dateRange = startDate && endDate 
      ? `(${startDate} to ${endDate})` 
      : (startDate ? `(Since ${startDate})` : (endDate ? `(Until ${endDate})` : "(All Time)"));
    return `${dependentVar} vs. ${independentVar} ${dateRange}`;
  }, [dependentVar, independentVar, startDate, endDate]);

  return (
    <div className="bg-transparent md:bg-white md:rounded-3xl md:shadow-sm md:border md:border-slate-100 overflow-hidden mt-6">
      <div className="flex gap-3 text-sm text-slate-600 bg-slate-50 p-4 rounded-2xl border border-slate-200 m-4">
        <Info size={20} className="shrink-0 text-emerald-500 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-slate-800">Correlation Engine</p>
          <p className="text-xs text-slate-500 leading-relaxed">Select the independent and dependent variables to observe if there is a correlation.</p>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6">
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Correlation Finder</h4>
        
        {/* Target Dataset & Location Radius */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Target Dataset</label>
            <div className="flex bg-slate-200/50 p-1 rounded-xl">
              {['personal', 'global'].map((type) => (
                <button 
                  key={type} 
                  onClick={() => setDataSource(type as any)} 
                  className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all flex items-center justify-center gap-2 ${dataSource === type ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {type === 'personal' ? <UserIcon size={16} /> : <Database size={16} />}
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Location Radius - global only */}
          {dataSource === 'global' ? (
            <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 ml-1 items-center gap-1"> 
                Location Radius
              </label>
              <div className="relative flex items-center w-full">
                <input 
                  type="number" 
                  placeholder="All Locations" 
                  value={locationRadius} 
                  onChange={(e) => setLocationRadius(e.target.value)} 
                  className="w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400" 
                />
                <span className="absolute right-4 text-slate-400 font-medium text-sm pointer-events-none">km</span>
              </div>
            </div>
          ) : <div />}
        </div>

        {/* Variables & Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          
          {/* Independent (X) Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Independent (X) Category & Variable</label>
            <div className="flex gap-2">
              {/* Category Select */}
              <select 
                value={independentGroup} 
                onChange={(e) => {
                  const newGroup = e.target.value;
                  setIndependentGroup(newGroup);
                  const firstOpt = TOPIC_GROUPS.find(g => g.label === newGroup)?.options[0];
                  if (firstOpt) setIndependentVar(firstOpt);
                }} 
                className="w-1/2 bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TOPIC_GROUPS.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
              </select>
              
              {/* Variable Select */}
              <select 
                value={independentVar} 
                onChange={(e) => setIndependentVar(e.target.value)} 
                className="w-1/2 bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TOPIC_GROUPS.find(g => g.label === independentGroup)?.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dependent (Y) Selection */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Dependent (Y) Category & Variable</label>
            <div className="flex gap-2">
              {/* Category Select */}
              <select 
                value={dependentGroup} 
                onChange={(e) => {
                  const newGroup = e.target.value;
                  setDependentGroup(newGroup);
                  const firstOpt = TOPIC_GROUPS.find(g => g.label === newGroup)?.options[0];
                  if (firstOpt) setDependentVar(firstOpt);
                }} 
                className="w-1/2 bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TOPIC_GROUPS.map(g => <option key={g.label} value={g.label}>{g.label}</option>)}
              </select>
              
              {/* Variable Select */}
              <select 
                value={dependentVar} 
                onChange={(e) => setDependentVar(e.target.value)} 
                className="w-1/2 bg-white border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                {TOPIC_GROUPS.find(g => g.label === dependentGroup)?.options.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> Start</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> End</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        {/* Bucket on the left, significance level on the right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Clock size={12}/>Time Bucket (Hours): period to map variables 1:1</label>
            <input type="number" value={bucketHours} onChange={(e) => setBucketHours(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Significance Level (α)</label>
            <div className="flex bg-slate-200/50 p-1 rounded-xl">
              {[0.1, 0.05, 0.01].map((val) => (
                <button 
                  key={val} 
                  onClick={() => setAlpha(val)} 
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2 ${alpha === val ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        </div>

        {errorMsg && <div className="p-4 mb-6 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex gap-2"><AlertCircle size={18}/> {errorMsg}</div>}

        <div className="flex justify-center items-center w-full">
        <button 
            onClick={handleRunAnalysis} 
            disabled={isRunning} 
            className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {isRunning ? (
            <Calculator className="animate-spin" size={20}/>
            ) : (
            <Play size={20} fill="currentColor"/>
            )}
            Run Analysis
        </button>
        </div>

        {/* Results data table */}
        {results && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <h3 className="text-center font-bold text-slate-800 text-lg md:text-xl px-4">{graphTitle}</h3>
            
            <div className="bg-slate-900 rounded-3xl p-6 md:p-8 text-slate-100 overflow-hidden relative shadow-xl">
              <div className="absolute -top-12 -right-12 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              {/* Top level stats */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6 mb-6 pb-6 border-b border-slate-800">
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Pearson (r)</p>
                  <p className="text-2xl font-black text-blue-400">{results.rValue.toFixed(3)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">R-Squared</p>
                  <p className="text-2xl font-medium text-slate-200">{results.rSquared.toFixed(3)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Matched Pairs (n)</p>
                  <p className="text-2xl font-medium text-slate-200">{results.sampleSize}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Alpha (α)</p>
                  <p className="text-2xl font-medium text-slate-200">{alpha}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Result</p>
                  <p className={`text-lg font-bold mt-1 ${results.pValue < alpha ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {results.pValue < alpha ? 'Significant' : 'Not Significant'}
                  </p>
                </div>
              </div>

              {/* Math breakdown row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h5 className="text-sm font-bold text-slate-300">Hypothesis Testing</h5>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Statistic ({results.statType})</span>
                      <span className="text-sm font-bold font-mono">{results.statValue.toFixed(3)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">Degrees of Freedom</span>
                      <span className="text-sm font-bold font-mono">{results.df1}{results.statType === 'F' && `, ${results.df2}`}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">P-Value</span>
                      <span className={`text-sm font-bold font-mono ${results.pValue < alpha ? 'text-emerald-400' : 'text-amber-400'}`}>
                        {results.pValue < 0.001 ? '< 0.001' : results.pValue.toFixed(4)}
                      </span>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-700/50 text-xs text-slate-400 leading-relaxed italic">
                      {results.pValue < alpha 
                        ? `p (${results.pValue.toFixed(4)}) < α (${alpha}). Reject H0.` 
                        : `p (${results.pValue.toFixed(4)}) ≥ α (${alpha}). Fail to reject H0.`}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-800/50 rounded-2xl p-5 border border-slate-700/50 flex flex-col justify-center">
                  <h5 className="text-sm font-bold text-slate-300 mb-4 border-b border-slate-700 pb-2">Equations</h5>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Model Equation</span>
                      <code className="text-sm font-bold text-blue-400 break-all">{results.equation}</code>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">Test Equation</span>
                      {results.modelType === 'Linear' ? (
                        <code className="text-xs font-mono text-slate-300">t = r × √[ (n-2) / (1-r²) ]</code>
                      ) : (
                        <code className="text-xs font-mono text-slate-300">F = (R² / k) / [ (1-R²) / (n-k-1) ]</code>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Graph visualization */}
              <div className="bg-slate-300 rounded-2xl p-6 border border-slate-200 overflow-hidden relative mb-8 h-100 shadow-inner">
                <div className="absolute top-4 left-4 z-10">
                  <h5 className="text-xs font-bold text-slate-500">Scatter Plot & Best Fit ({results.modelType})</h5>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 30, bottom: 40, left: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      type="number" 
                      dataKey="x" 
                      name={independentVar} 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={['dataMin', 'auto']}
                    >
                      <Label value={independentVar} offset={-25} position="insideBottom" style={{ fill: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px' }} />
                    </XAxis>
                    <YAxis 
                      type="number" 
                      dataKey="y" 
                      name={dependentVar} 
                      stroke="#94a3b8" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      domain={['dataMin', 'auto']}
                    >
                      <Label value={dependentVar} angle={-90} position="insideLeft" style={{ fill: '#64748b', fontWeight: 600, textTransform: 'uppercase', fontSize: '10px', textAnchor: 'middle' }} />
                    </YAxis>
                    <Tooltip 
                      cursor={{ strokeDasharray: '3 3' }} 
                      contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#1e293b', fontSize: '12px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} 
                    />
                    <Scatter 
                      data={results.regressionPoints} 
                      line={{ stroke: results.modelType === 'Quadratic' ? '#8b5cf6' : '#f43f5e', strokeWidth: 3 }} 
                      shape={() => null} 
                      legendType="none" 
                      tooltipType="none"
                    />
                    <Scatter name="Data Points" data={plotData} fill="#3b82f6" fillOpacity={0.6} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* Hypothesis section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {/* Null Hypothesis Box */}
                <div className={`p-4 rounded-2xl border transition-all duration-500 ${
                  results.pValue >= alpha 
                    ? 'bg-amber-500/10 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                    : 'bg-slate-800/30 border-slate-700 opacity-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black bg-slate-700 px-1.5 py-0.5 rounded text-white">H₀</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Null Hypothesis</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 leading-relaxed">
                    {results.modelType === 'Linear'
                      ? `There is no statistically significant linear relationship between ${independentVar} and ${dependentVar}.`
                      : `The quadratic model for ${dependentVar} based on ${independentVar} does not explain the variance significantly better than chance.`}
                  </p>
                  {results.pValue >= alpha && (
                    <p className="text-[10px] font-bold text-amber-400 mt-2 uppercase flex items-center gap-1">
                      <CheckCircle2 size={12}/> Result: Fail to Reject
                    </p>
                  )}
                </div>

                {/* Alternative Hypothesis Box */}
                <div className={`p-4 rounded-2xl border transition-all duration-500 ${
                  results.pValue < alpha 
                    ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                    : 'bg-slate-800/30 border-slate-700 opacity-50'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black bg-emerald-600 px-1.5 py-0.5 rounded text-white">H₁</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Alternative Hypothesis</span>
                  </div>
                  <p className="text-sm font-medium text-slate-200 leading-relaxed">
                    {results.modelType === 'Linear'
                      ? `There is a statistically significant linear relationship between ${independentVar} and ${dependentVar}.`
                      : `The quadratic model explains a significant portion of the variance in ${dependentVar} based on ${independentVar}.`}
                  </p>
                  {results.pValue < alpha && (
                    <p className="text-[10px] font-bold text-emerald-400 mt-2 uppercase flex items-center gap-1">
                      <CheckCircle2 size={12}/> Result: Significant Change
                    </p>
                  )}
                </div>
              </div>

              {/* Analysis Statement Section */}
              <div className={`mt-6 p-5 rounded-2xl border transition-all duration-500 shadow-inner ${
                results.pValue < alpha 
                  ? 'bg-emerald-500/10 border-emerald-500/50' 
                  : 'bg-amber-500/10 border-amber-500/50'
              }`}>
                <div className="flex items-start gap-3">
                  <Calculator size={18} className={results.pValue < alpha ? 'text-emerald-400' : 'text-amber-400'} />
                  <div className="space-y-1">
                    <h4 className={`text-[10px] font-bold uppercase tracking-widest ${results.pValue < alpha ? 'text-emerald-400' : 'text-amber-400'}`}>
                      Final Analysis
                    </h4>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {results.modelType === 'Linear' ? (
                        <>
                          A <span className="font-mono font-bold text-white">1-unit</span> increase in <span className="text-white">{independentVar}</span> was associated with an average change of <span className="font-mono font-bold text-white">
                            {results.slope > 0 ? '+' : ''}{results.slope.toFixed(3)} units
                          </span> in <span className="text-white">{dependentVar}</span>, which is <span className={`font-bold ${results.pValue < alpha ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {results.pValue < alpha ? 'statistically significant' : 'not statistically significant'}
                          </span> at a <span className="text-white">{((1 - alpha) * 100).toFixed(0)}%</span> confidence level 
                          (p = <span className="font-mono">{results.pValue < 0.0001 ? '< 0.0001' : results.pValue.toFixed(4)}</span>, α = <span className="font-mono">{alpha}</span>).
                        </>
                      ) : (
                        <>
                          The data is best modeled by a <span className="text-white font-bold">quadratic curve</span>, indicating that the rate of change in <span className="text-white">{dependentVar}</span> relative to <span className="text-white">{independentVar}</span> is dynamic and non-constant. This relationship is <span className={`font-bold ${results.pValue < alpha ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {results.pValue < alpha ? 'statistically significant' : 'not statistically significant'}
                          </span> at a <span className="text-white">{((1 - alpha) * 100).toFixed(0)}%</span> confidence level 
                          (p = <span className="font-mono">{results.pValue < 0.0001 ? '< 0.0001' : results.pValue.toFixed(4)}</span>, α = <span className="font-mono">{alpha}</span>).
                        </>
                      )}
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

export default Correlation;