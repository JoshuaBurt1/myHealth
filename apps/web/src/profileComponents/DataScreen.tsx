//DataScreen.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line 
} from 'recharts';
import { 
  Heart, Wind, Droplets, Gauge, RefreshCw, Thermometer, Calendar,
  TestTube, Activity, User, Ruler, Scale, Dumbbell, Timer, PlusCircle, Footprints,
  ChevronLeft, ChevronRight, LayoutGrid, Maximize2
} from 'lucide-react';

// Standard static configurations
const SINGLE_GRAPHS = [
  // Core Vitals
  { key: 'hr', title: 'HEART RATE', unit: 'BPM', icon: <Heart className="text-red-500" />, color: '#ef4444' },
  { key: 'rr', title: 'RESPIRATION', unit: 'Breaths/min', icon: <Wind className="text-blue-500" />, color: '#3b82f6' },
  { key: 'spo2', title: 'BLOOD OXYGEN', unit: 'SpO2 %', icon: <Droplets className="text-emerald-500" />, color: '#10b981', domain: [90, 100] as [number, number] },
  { key: 'temp', title: 'BODY TEMP', unit: '°C', icon: <Thermometer className="text-amber-500" />, color: '#f59e0b', domain: [30, 43] as [number, number] },
  
  // Blood & Metabolic
  { key: 'glucose', title: 'GLUCOSE', unit: 'mg/dL', icon: <TestTube className="text-rose-500" />, color: '#f43f5e' },
  { key: 'cholesterol', title: 'CHOLESTEROL', unit: 'mg/dL', icon: <Activity className="text-yellow-500" />, color: '#eab308' },
  { key: 'ketones', title: 'KETONES', unit: 'mmol/L', icon: <TestTube className="text-purple-500" />, color: '#a855f7' },
  { key: 'uricAcid', title: 'URIC ACID', unit: 'mg/dL', icon: <Droplets className="text-cyan-500" />, color: '#06b6d4' },
  { key: 'lactate', title: 'LACTATE', unit: 'mmol/L', icon: <Activity className="text-teal-500" />, color: '#14b8a6' },
  { key: 'hemoglobin', title: 'HEMOGLOBIN', unit: 'g/dL', icon: <Droplets className="text-red-600" />, color: '#dc2626' },
  { key: 'hematocrit', title: 'HEMATOCRIT', unit: '%', icon: <Activity className="text-red-700" />, color: '#b91c1c' },
  
  // Body Measurements
  { key: 'age', title: 'AGE', unit: 'Years', icon: <User className="text-slate-500" />, color: '#64748b' },
  { key: 'height', title: 'HEIGHT', unit: 'cm', icon: <Ruler className="text-blue-400" />, color: '#60a5fa' },
  { key: 'weight', title: 'WEIGHT', unit: 'kg', icon: <Scale className="text-emerald-400" />, color: '#34d399' },
  { key: 'bmi', title: 'BMI', unit: 'kg/m²', icon: <Activity className="text-indigo-400" />, color: '#818cf8' },
  
  // Strength
  { key: 'benchPress', title: 'BENCH PRESS', unit: 'kg', icon: <Dumbbell className="text-indigo-600" />, color: '#4f46e5' },
  { key: 'squat', title: 'SQUAT', unit: 'kg', icon: <Dumbbell className="text-indigo-700" />, color: '#4338ca' },
  { key: 'deadlift', title: 'DEADLIFT', unit: 'kg', icon: <Dumbbell className="text-indigo-800" />, color: '#3730a3' },
  
  // Speed
  { key: 'speed100m', title: '100M SPRINT', unit: 'Seconds', icon: <Timer className="text-orange-500" />, color: '#f97316' },
  { key: 'speed400m', title: '400M SPRINT', unit: 'Seconds', icon: <Timer className="text-orange-600" />, color: '#ea580c' },
  { key: 'speed1Mile', title: '1 MILE RUN', unit: 'Minutes', icon: <Timer className="text-orange-700" />, color: '#c2410c' },
  { key: 'steps', title: 'Steps', unit: '', icon: <Footprints className="text-orange-800" />, color: '#9a3412' }
];

// Vibrant palette for dynamically fetched custom metrics
const CUSTOM_COLORS = ['#ec4899', '#0ea5e9', '#84cc16', '#f59e0b', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];

type TimeRange = '24H' | '7D' | '1M' | '3M' | 'YTD' | '1Y' | 'Max';

interface CustomMetric {
  key: string;
  name: string;
  unit: string;
}

interface DataScreenProps {
  userId: string;
  refreshTrigger?: number;
  isMe: boolean;
  hiddenOther: string[];
}

// Helpers for specific data scaling and isolated X-Axis rendering
const getTicksForMetric = (data: any[], dataKey: string) => {
  return data.filter(d => d[dataKey] != null).map(d => d.timestamp);
};

const getMinMaxForMetric = (data: any[], dataKey: string, providedDomain?: [number, number]) => {
  if (providedDomain) return { domain: providedDomain, ticks: providedDomain };
  const values = data.map(d => d[dataKey]).filter(v => v != null);
  if (values.length === 0) return { domain: [0, 100], ticks: [0, 100] };
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return { domain: [min > 0 ? 0 : min, max + 10], ticks: [min > 0 ? 0 : min, max + 10] };
  }
  return { domain: [min, max], ticks: [min, max] };
};

const toDateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};

const DataScreen: React.FC<DataScreenProps> = ({ 
  userId, 
  isMe, 
  hiddenOther
}) => {
  const [vitalsData, setVitalsData] = useState<any[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('7D');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [reductionFactor, setReductionFactor] = useState(1.0);
  
  // View states
  const [showAll, setShowAll] = useState(false);
  const [currentGraphIndex, setCurrentGraphIndex] = useState(0);

  const handleOpenDatePicker = () => {
    if (!customStart) setCustomStart(toDateTimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    if (!customEnd) setCustomEnd(toDateTimeLocal(new Date()));
    setShowDatePicker(true);
  };

  useEffect(() => {
    if (!userId) return;

    const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
    
    // Set up the real-time listener
    const unsubscribe = onSnapshot(profileRef, (profileSnap) => {
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        const parseDate = (dateObj: any) => {
          if (!dateObj) return new Date();
          return dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
        };

        const standardKeys = new Set([
          ...SINGLE_GRAPHS.map(g => g.key.toLowerCase()),
          'bpsyst',
          'bpdias'
        ]);

        const dynamicMetrics: CustomMetric[] = [
          ...(p.customVitalsDefinitions || []),
          ...(p.customWorkoutsDefinitions || [])
        ].filter(m => !standardKeys.has(m.key.toLowerCase()));

        setCustomMetrics(dynamicMetrics);

        const timelineMap: { [key: number]: any } = {};
        const processVital = (array: any[], key: string) => {
          (array || []).forEach((entry) => {
            if (!entry.dateTime) return;
            const ts = parseDate(entry.dateTime).getTime();
            if (!timelineMap[ts]) timelineMap[ts] = { timestamp: ts };
            let val = parseFloat(entry.value);
            if (isNaN(val)) return;
            timelineMap[ts][key] = val;
            timelineMap[ts][`${key}_raw`] = entry; 
          });
        };

        const allKeys = [
          'bpSyst', 'bpDias',
          ...SINGLE_GRAPHS.map(g => g.key),
          ...dynamicMetrics.map(m => m.key)
        ];

        allKeys.forEach(key => processVital(p[key], key));

        const history = Object.values(timelineMap).sort((a: any, b: any) => a.timestamp - b.timestamp);
        setVitalsData(history);
      } else {
        setVitalsData([]);
      }
      
      setLoading(false);
      setTimeout(() => setIsReady(true), 150);
      
    }, (err) => {
      console.error("DataScreen Snapshot Error:", err);
      setLoading(false);
    });

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [userId]);

  const hasData = (key: string) => {
    return vitalsData.some(d => d[key] !== undefined && d[key] !== null);
  };

  // Pre-calculate visible graphs
  const visibleGraphs = useMemo(() => {
    const graphs = [];

    // Blood Pressure comes first if it exists
    if ((hasData('bpSyst') || hasData('bpDias')) && (isMe || (!hiddenOther.includes('bpSyst') && !hiddenOther.includes('bpDias')))) {
      graphs.push({ type: 'bp', id: 'bp' });
    }

    // Standard Variables
    SINGLE_GRAPHS.forEach(config => {
      if (hasData(config.key) && (isMe || !hiddenOther.includes(config.key))) {
        graphs.push({ type: 'standard', id: config.key, config });
      }
    });

    // Custom Dynamic Graphs
    customMetrics.forEach((m, index) => {
      if (hasData(m.key) && (isMe || !hiddenOther.includes(m.key))) {
        graphs.push({ type: 'custom', id: m.key, m, index });
      }
    });

    return graphs;
  }, [vitalsData, isMe, hiddenOther, customMetrics]);

  // Handle out of bounds when data changes
  useEffect(() => {
    if (visibleGraphs.length > 0 && currentGraphIndex >= visibleGraphs.length) {
      setCurrentGraphIndex(0);
    }
  }, [visibleGraphs, currentGraphIndex]);

  const filteredData = useMemo(() => {
    let result = [...vitalsData];
    const now = new Date();
    let threshold = 0;
    let intervalMs = 0;

    // 1. Determine Date Range & Base Interval
    if (customStart && customEnd) {
      threshold = new Date(customStart).getTime();
      const endTs = new Date(customEnd).getTime();
      result = result.filter(d => d.timestamp >= threshold && d.timestamp <= endTs);
      intervalMs = 24 * 60 * 60 * 1000; 
    } else {
      switch (timeRange) {
        case '24H': threshold = now.getTime() - 86400000; intervalMs = 3600000; break;
        case '7D':  threshold = now.getTime() - 604800000; intervalMs = 21600000; break;
        case '1M':  threshold = now.getTime() - 2592000000; intervalMs = 86400000; break;
        case '3M':  threshold = now.getTime() - 7776000000; intervalMs = 72 * 60 * 60 * 1000; break;
        case 'YTD': threshold = new Date(now.getFullYear(), 0, 1).getTime(); intervalMs = 288 * 60 * 60 * 1000; break;
        case '1Y':  threshold = now.getTime() - 31536000000; intervalMs = 288 * 60 * 60 * 1000; break;
        case 'Max': 
          threshold = 0; 
          if (result.length > 0) {
            const range = result[result.length - 1].timestamp - result[0].timestamp;
            intervalMs = range / 30;
          }
          break;
      }
      result = result.filter(d => d.timestamp >= threshold);
    }

    // APPLY SLIDER: Modify the interval based on reductionFactor
    // If factor is 0, we return raw results.
    const adjustedInterval = intervalMs * reductionFactor;

    if (adjustedInterval <= 0 || result.length <= 1 || reductionFactor <= 0.05) return result;

    // 2. Metric-Independent Bucketing
    const buckets: { [key: number]: any } = {};
    
    result.forEach(point => {
      const bucketKey = Math.floor(point.timestamp / adjustedInterval) * adjustedInterval;

      if (!buckets[bucketKey]) {
        buckets[bucketKey] = { timestamp: bucketKey };
      }

      Object.keys(point).forEach(key => {
        if (key === 'timestamp' || key.endsWith('_raw')) return;
        const val = point[key];
        if (buckets[bucketKey][key] === undefined || val > buckets[bucketKey][key]) {
          buckets[bucketKey][key] = val;
          buckets[bucketKey][`${key}_raw`] = point[`${key}_raw`];
        }
      });
    });

    return Object.values(buckets).sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [vitalsData, timeRange, customStart, customEnd, reductionFactor]);

  const [selectedPoint, setSelectedPoint] = useState<{ 
    ts: number; 
    val: any; 
    fieldName: string;
    rawObject: any;
  } | null>(null);

  const handlePointClick = (point: any, fieldName: string, dataKey: string) => {
    if (!isMe || !point) return; 

    const raw = point[`${dataKey}_raw`];      
    if (raw) {
      setSelectedPoint({ 
        ts: point.timestamp, 
        val: point[dataKey], 
        fieldName: fieldName,
        rawObject: raw
      });
    }
  };

  const handleAction = async (action: 'delete' | 'update') => {
    if (!selectedPoint || !auth.currentUser) return;
    const user = auth.currentUser;
    const profileRef = doc(db, 'users', user.uid, 'profile', 'user_data');

    try {
      await updateDoc(profileRef, {
        [selectedPoint.fieldName]: arrayRemove(selectedPoint.rawObject)
      });

      if (action === 'update') {
        const newValue = prompt("Enter new value:", selectedPoint.val);
        if (newValue !== null && newValue !== "") {
          await updateDoc(profileRef, {
            [selectedPoint.fieldName]: arrayUnion({
              ...selectedPoint.rawObject,
              value: String(newValue)
            })
          });
        }
      }

      setSelectedPoint(null);
    } catch (err) {
      console.error("Firebase Sync Error:", err);
    }
  };

  const formatDateTime = (tickItem: any) => {
    const d = new Date(tickItem);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const rotatedXAxisProps = (ticks: number[]) => ({
    dataKey: "timestamp",
    type: "number" as const,
    scale: "time" as const,
    domain: ['auto', 'auto'] as [any, any],
    ticks: ticks,
    tickFormatter: formatDateTime,
    fontSize: 9,
    fontWeight: "bold",
    axisLine: false,
    tickLine: false,
    dy: 15, 
    angle: -45, 
    textAnchor: "end" as "end",
  });

  const getModalTitle = (fieldName: string) => {
    const matchedGraph = SINGLE_GRAPHS.find(g => g.key === fieldName);
    if (matchedGraph) return matchedGraph.title;
    const matchedCustom = customMetrics.find(m => m.key === fieldName);
    if (matchedCustom) return matchedCustom.name.toUpperCase();
    if (fieldName === 'bpSyst') return 'Systolic';
    if (fieldName === 'bpDias') return 'Diastolic';
    return fieldName.replace('_', ' ');
  };

  const renderCustomActiveDot = (props: any, color: string, dataKey: string) => {
    const { cx, cy, payload } = props;
    return (
      <g 
        key={`act-${dataKey}-${payload.timestamp}`} 
        style={{ cursor: 'pointer', outline: 'none' }}
        onClick={() => handlePointClick(payload, dataKey, dataKey)}
      >
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
      </g>
    );
  };

  const commonDotProps = (color: string, key: string) => ({
    r: 5,
    fill: color,
    style: { cursor: 'pointer', pointerEvents: 'all' as const },
    onClick: (props: any) => handlePointClick(props.payload, key, key)
  });

  // Navigation handlers
  const handleNextGraph = () => {
    setCurrentGraphIndex((prev) => (prev + 1) % visibleGraphs.length);
  };

  const handlePrevGraph = () => {
    setCurrentGraphIndex((prev) => (prev - 1 + visibleGraphs.length) % visibleGraphs.length);
  };

  // Graph render function
  const renderGraphComponent = (graph: any) => {
    if (!graph) return null;

    if (graph.type === 'bp') {
      const bpTicksX = filteredData.filter(d => d.bpSyst != null || d.bpDias != null).map(d => d.timestamp);
      const bpSystMinMax = getMinMaxForMetric(filteredData, 'bpSyst');
      const bpDiasMinMax = getMinMaxForMetric(filteredData, 'bpDias');
      const overallMin = Math.min(bpSystMinMax.domain[0], bpDiasMinMax.domain[0]);
      const overallMax = Math.max(bpSystMinMax.domain[1], bpDiasMinMax.domain[1]);
      const bpTicksY = [overallMin, overallMax];

      return (
        <MetricGraph key="bp" title="BLOOD PRESSURE" unit="mmHg" icon={<Gauge className="text-violet-500" />}>
          <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <XAxis {...rotatedXAxisProps(bpTicksX)} />
            <YAxis domain={[overallMin, overallMax]} ticks={bpTicksY} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
            <Tooltip cursor={false} wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} itemSorter={(item) => (item.dataKey === 'bpSyst' ? -1 : 1)}/>
            
            <Line 
              type="monotone" 
              dataKey="bpSyst" 
              name="Systolic" 
              stroke="#8b5cf6" 
              strokeWidth={3} 
              connectNulls={true} 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps("#8b5cf6", "bpSyst")}
              activeDot={(props: any) => renderCustomActiveDot(props, "#8b5cf6", "bpSyst")}
            />
            <Line 
              type="monotone" 
              dataKey="bpDias" 
              name="Diastolic" 
              stroke="#c084fc" 
              strokeWidth={3} 
              connectNulls={true}
              style={{ pointerEvents: 'none' }}
              dot={commonDotProps("#c084fc", "bpDias")}
              activeDot={(props: any) => renderCustomActiveDot(props, "#c084fc", "bpDias")}
            />
          </LineChart>
        </MetricGraph>
      );
    }

    if (graph.type === 'standard') {
      const { config } = graph;
      const metricTicksX = getTicksForMetric(filteredData, config.key);
      const { domain, ticks: ticksY } = getMinMaxForMetric(filteredData, config.key, config.domain);

      return (
        <MetricGraph key={config.key} title={config.title} unit={config.unit} icon={config.icon}>
          <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <XAxis {...rotatedXAxisProps(metricTicksX)} />
            <YAxis domain={domain} ticks={ticksY} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
            <Tooltip cursor={false} wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Line 
              type="monotone" 
              dataKey={config.key} 
              stroke={config.color} 
              strokeWidth={3} 
              connectNulls 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps(config.color, config.key)}
              activeDot={(props: any) => renderCustomActiveDot(props, config.color, config.key)}
            />
          </LineChart>
        </MetricGraph>
      );
    }

    if (graph.type === 'custom') {
      const { m, index } = graph;
      const customColor = CUSTOM_COLORS[index % CUSTOM_COLORS.length];
      const metricTicksX = getTicksForMetric(filteredData, m.key);
      const { domain, ticks: ticksY } = getMinMaxForMetric(filteredData, m.key);

      return (
        <MetricGraph key={m.key} title={m.name.toUpperCase()} unit={m.unit} icon={<PlusCircle style={{ color: customColor }} />}>
          <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
            <XAxis {...rotatedXAxisProps(metricTicksX)} />
            <YAxis domain={domain} ticks={ticksY} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
            <Tooltip cursor={false} wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Line 
              type="monotone" 
              dataKey={m.key} 
              stroke={customColor} 
              strokeWidth={3} 
              connectNulls 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps(customColor, m.key)}
              activeDot={(props: any) => renderCustomActiveDot(props, customColor, m.key)}
            />
          </LineChart>
        </MetricGraph>
      )
    }

    return null;
  };

  if (loading || !isReady) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-10">
      {/* Top Controls: Toggle View and Time Range */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        {/* Top Controls: Vertical Stack */}
        <div className="flex flex-col items-start gap-4 mb-2 w-full">
          {/* Row 1: Time Range Selector */}
          <div className="flex items-center w-full max-w-full overflow-x-auto whitespace-nowrap bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 backdrop-blur-md no-scrollbar">
            {(['24H', '7D', '1M', '3M', 'YTD', '1Y', 'Max'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => {
                  setTimeRange(range);
                  setCustomStart('');
                  setCustomEnd('');
                }}
                className={`flex-1 shrink-0 py-2 font-bold transition-all duration-200 rounded-xl
                  text-[clamp(9px,2vw,12px)] 
                  px-[clamp(8px,1.5vw,16px)]
                  ${timeRange === range && !customStart
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                    : 'text-slate-500 hover:text-slate-800'
                  }`}
              >
                {range}
              </button>
            ))}
            
            <div className="shrink-0 w-px h-4 bg-slate-200 mx-1 sm:mx-2" />
            
            <button 
              onClick={handleOpenDatePicker}
              className={`shrink-0 p-2 transition-colors ${customStart ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-600'}`}
            >
              <Calendar 
                strokeWidth={2.5} 
                className="w-[clamp(14px,2vw,16px)] h-[clamp(14px,2vw,16px)]" 
              />
            </button>
          </div>

          {/* Row 2: View Toggle Button & Interval Slider */}
          <div className="flex flex-wrap items-center gap-4 w-full">
            <button 
              onClick={() => setShowAll(!showAll)}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-indigo-600 font-bold text-sm border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 transition-colors shrink-0"
            >
              {showAll ? <Maximize2 size={16} /> : <LayoutGrid size={16} />}
              {showAll ? 'Show Single Graph' : 'Show All Graphs'}
            </button>

            {/* Slider Control */}
            <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 min-w-50 max-w-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Detail
              </span>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={reductionFactor}
                onChange={(e) => setReductionFactor(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600"
              />
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                Summary
              </span>
            </div>
          </div>
        </div>
      </div>

      {visibleGraphs.length === 0 ? (
        <div className="text-center text-slate-400 py-12 font-medium">
          No metrics to display.
        </div>
      ) : (
        <div className={showAll ? "grid grid-cols-1 gap-8" : "relative"}>
          
          {/* Multiple Graphs View */}
          {showAll && visibleGraphs.map(graph => renderGraphComponent(graph))}

          {/* Single Graph Carousel View */}
          {!showAll && (
            <div className="relative flex items-center group">
              {/* Left Circular Scroll Button */}
              {visibleGraphs.length > 1 && (
                <button 
                  onClick={handlePrevGraph} 
                  className="absolute -left-3 md:-left-6 z-10 p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:scale-105 active:scale-95 transition-all"
                >
                  <ChevronLeft size={24} />
                </button>
              )}

              <div className="w-full flex-1">
                {renderGraphComponent(visibleGraphs[currentGraphIndex])}
              </div>

              {/* Right Circular Scroll Button */}
              {visibleGraphs.length > 1 && (
                <button 
                  onClick={handleNextGraph} 
                  className="absolute -right-3 md:-right-6 z-10 p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:scale-105 active:scale-95 transition-all"
                >
                  <ChevronRight size={24} />
                </button>
              )}
            </div>
          )}

        </div>
      )}

      {/* Editing Modal */}
      {selectedPoint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 isolate">
          <div 
            className="absolute inset-0" 
            onClick={() => setSelectedPoint(null)} 
          />

          <div className="relative bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100 animate-in fade-in zoom-in duration-200">
            <p className="text-slate-500 text-sm mb-6 font-medium">
              Recorded on {new Date(selectedPoint.ts).toLocaleString()}
            </p>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">
              Manage {getModalTitle(selectedPoint.fieldName)}
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setSelectedPoint(null)}
                className="py-4 px-6 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleAction('delete')}
                className="py-4 px-6 rounded-2xl bg-red-50 text-red-600 font-bold hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            </div>

            <button 
              onClick={() => handleAction('update')}
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all"
            >
              Edit Value
            </button>
          </div>
        </div>
      )}

      {/* Date Range Picker Modal */}
      {showDatePicker && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0" onClick={() => setShowDatePicker(false)} />
          <div className="relative bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100 animate-in fade-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">Select Custom Range</h3>
            
            <div className="space-y-4 mb-8">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Start Date & Time</label>
                <input 
                  type="datetime-local"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase ml-2 mb-1 block">End Date & Time</label>
                <input 
                  type="datetime-local"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => {
                  setCustomStart('');
                  setCustomEnd('');
                  setShowDatePicker(false);
                }}
                className="py-4 px-6 rounded-2xl bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 transition-colors"
              >
                Reset
              </button>
              <button 
                onClick={() => setShowDatePicker(false)}
                className="py-4 px-6 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg hover:bg-indigo-700 active:scale-[0.98] transition-all"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const MetricGraph = ({ title, unit, icon, children }: any) => (
  <div 
    className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-w-0"
    style={{ height: '450px' }} 
  >
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <div className="bg-slate-50 p-3 rounded-2xl">{icon}</div>
        <div>
          <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase">{title}</h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase">{unit}</p>
        </div>
      </div>
    </div>
    <div className="flex-1 w-full min-h-0 pointer-events-auto">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

export default DataScreen;