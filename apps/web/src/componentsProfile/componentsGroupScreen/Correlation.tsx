import React, { useState, useMemo } from 'react';
import { db } from '../../firebase';
import { collectionGroup, query, getDocs } from 'firebase/firestore';
import { 
  Info, Play, Database, User as UserIcon, Calendar, Calculator, AlertCircle, Clock, LineChart
} from 'lucide-react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, 
  CartesianGrid, Tooltip, ResponsiveContainer, Label
} from 'recharts';
import {
  VITAL_KEY_MAP, BLOODTEST_KEY_MAP, SYMPTOM_KEY_MAP,
  DIET_KEY_MAP, MICRONUTRIENT_KEY_MAP, STRENGTH_KEY_MAP,
  SPEED_KEY_MAP, ENDURANCE_KEY_MAP
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
}

interface PlotPoint {
  x: number;
  y: number;
  timestamp: number;
}

const TOPIC_GROUPS = [
  { label: 'Diet & Nutrition', options: [...Object.keys(DIET_KEY_MAP), ...Object.keys(MICRONUTRIENT_KEY_MAP)] },
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

const Correlation: React.FC<CorrelationProps> = ({ profileData }) => {
  const [dataSource, setDataSource] = useState<'personal' | 'database'>('personal');
  const [independentVar, setIndependentVar] = useState<string>('Calories');
  const [dependentVar, setDependentVar] = useState<string>('Weight');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [bucketHours, setBucketHours] = useState<number>(24);

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
      regressionPoints: points 
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
      const endTs = endDate ? new Date(endDate).getTime() + 86400000 : Infinity;
      const bucketMs = bucketHours * 60 * 60 * 1000;

      const processDataset = (dataObj: Record<string, any>) => {
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
        const snapshot = await getDocs(query(collectionGroup(db, 'profile')));
        snapshot.forEach(doc => processDataset(doc.data()));
      }

      if (synchronizedData.length < 3) throw new Error("Insufficient data pairs found.");

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
        <Info size={20} className="shrink-0 text-blue-500 mt-0.5" />
        <div className="space-y-1">
          <p className="font-medium text-slate-800">Trend & Relationship Engine</p>
          <p className="text-xs text-slate-500 leading-relaxed">Scaling graph to minimum values for higher resolution.</p>
        </div>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        <div className="bg-slate-50 p-6 rounded-3xl space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Dataset</label>
              <div className="flex bg-slate-200/50 p-1 rounded-xl">
                {['personal', 'database'].map((type) => (
                  <button 
                    key={type} 
                    onClick={() => setDataSource(type as any)} 
                    className={`flex-1 py-2 rounded-lg text-sm font-bold capitalize transition-all flex items-center justify-center gap-2 ${dataSource === type ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                  >
                    {type === 'personal' ? <UserIcon size={16} /> : <Database size={16} />}
                    {type}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Clock size={12}/> Bucket (Hours)</label>
              <input type="number" value={bucketHours} onChange={(e) => setBucketHours(Number(e.target.value))} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Independent (X)</label>
              <select value={independentVar} onChange={(e) => setIndependentVar(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-blue-500">
                {TOPIC_GROUPS.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</optgroup>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Dependent (Y)</label>
              <select value={dependentVar} onChange={(e) => setDependentVar(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-3 font-medium outline-none focus:ring-2 focus:ring-blue-500">
                {TOPIC_GROUPS.map(g => <optgroup key={g.label} label={g.label}>{g.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}</optgroup>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> Start</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 flex items-center gap-1"><Calendar size={12}/> End</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-xl p-2.5 font-medium outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        </div>

        {errorMsg && <div className="p-4 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 flex gap-2"><AlertCircle size={18}/> {errorMsg}</div>}

        <button onClick={handleRunAnalysis} disabled={isRunning} className="w-full md:w-auto px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-blue-600 transition-all flex items-center justify-center gap-2 shadow-lg">
          {isRunning ? <Calculator className="animate-spin" size={20}/> : <Play size={20} fill="currentColor"/>}
          Analyze Relationship
        </button>

        {results && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-center font-bold text-slate-800 text-lg md:text-xl px-4">{graphTitle}</h3>
            
            <div className="h-100 w-full bg-white border border-slate-100 rounded-3xl p-4 shadow-sm relative">
              {/* Equation Overlay */}
              <div className="absolute top-6 right-6 z-10 bg-white/80 backdrop-blur-sm border border-slate-100 p-2.5 rounded-xl shadow-sm">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Model Equation</p>
                <code className="text-xs font-bold text-blue-600">{results.equation}</code>
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
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }} 
                  />
                  {/* Dynamic Regression Line (Linear or Quadratic) */}
                  <Scatter 
                    data={results.regressionPoints} 
                    line={{ stroke: results.modelType === 'Quadratic' ? '#8b5cf6' : '#f87171', strokeWidth: 3 }} 
                    shape={() => null} 
                    legendType="none" 
                    tooltipType="none"
                  />
                  {/* Actual Data Points */}
                  <Scatter name="Data Points" data={plotData} fill="#3b82f6" fillOpacity={0.5} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-900 rounded-3xl p-8 text-white">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Pearson (r)</span>
                <div className="text-3xl font-black text-blue-400">{results.rValue.toFixed(3)}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">R-Squared</span>
                <div className="text-3xl font-black">{results.rSquared.toFixed(3)}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Matched Pairs</span>
                <div className="text-3xl font-black">{results.sampleSize}</div>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Best Fit Model</span>
                <div className="text-xl font-black uppercase text-slate-100 flex items-center gap-1.5 mt-1">
                   <LineChart size={16} className="text-purple-400" /> {results.modelType}
                </div>
              </div>
              <div className="col-span-full pt-6 border-t border-slate-800 mt-2">
                <p className="text-lg font-medium text-slate-200"><strong className="text-white">Analysis:</strong> {results.interpretation}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Correlation;