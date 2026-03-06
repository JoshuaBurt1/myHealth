import React, { useEffect, useState, useMemo } from 'react';
import { doc, getDoc, updateDoc, arrayRemove, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  LineChart, Line 
} from 'recharts';
import { Heart, Wind, Droplets, Zap, Gauge, RefreshCw, Thermometer, Calendar } from 'lucide-react';

type TimeRange = '24H' | '7D' | '1M' | '3M' | 'YTD' | '1Y' | 'Max';

interface DataScreenProps {
  userId: string;
  refreshTrigger?: number;
}

const DataScreen: React.FC<DataScreenProps> = ({ userId, refreshTrigger }) => {
  const [stepData, setStepData] = useState<any[]>([]);
  const [vitalsData, setVitalsData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('Max');

  const fetchAllHealthData = React.useCallback(async () => {
    if (!userId) return;
    try {
      const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
      const profileSnap = await getDoc(profileRef);
      
      if (profileSnap.exists()) {
        const p = profileSnap.data();
        const parseDate = (dateObj: any) => {
          if (!dateObj) return new Date();
          return dateObj.toDate ? dateObj.toDate() : new Date(dateObj);
        };

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

        processVital(p.hr, 'hr');
        processVital(p.rr, 'rr');
        processVital(p.spo2, 'spo2');
        processVital(p.temp, 'temp');
        processVital(p.bpSyst, 'bpSyst');
        processVital(p.bpDias, 'bpDias');

        const history = Object.values(timelineMap).sort((a: any, b: any) => a.timestamp - b.timestamp);
        setVitalsData(history);
        
        const steps = (p.steps_history || []).map((entry: any) => ({
          timestamp: parseDate(entry.dateTime).getTime(),
          val: parseFloat(entry.value) || 0,
          raw: entry 
        })).sort((a: any, b: any) => a.timestamp - b.timestamp);
        
        setStepData(steps);
      }
    } catch (err) {
      console.error("Fetch Error:", err);
    } finally {
      setLoading(false);
      setTimeout(() => setIsReady(true), 150);
    }
  }, [userId]);

  useEffect(() => {
    fetchAllHealthData();
  }, [fetchAllHealthData, refreshTrigger]);

  // Filtering Logic
  const filteredData = useMemo(() => {
    const now = new Date();
    let threshold = 0;

    switch (timeRange) {
      case '24H': threshold = now.getTime() - 24 * 60 * 60 * 1000; break;
      case '7D': threshold = now.getTime() - 7 * 24 * 60 * 60 * 1000; break;
      case '1M': threshold = now.getTime() - 30 * 24 * 60 * 60 * 1000; break;
      case '3M': threshold = now.getTime() - 90 * 24 * 60 * 60 * 1000; break;
      case 'YTD': threshold = new Date(now.getFullYear(), 0, 1).getTime(); break;
      case '1Y': threshold = now.getTime() - 365 * 24 * 60 * 60 * 1000; break;
      case 'Max': threshold = 0; break;
    }

    return {
      vitals: vitalsData.filter(d => d.timestamp >= threshold),
      steps: stepData.filter(d => d.timestamp >= threshold)
    };
  }, [vitalsData, stepData, timeRange]);

  const vitalsTicks = useMemo(() => filteredData.vitals.map(d => d.timestamp), [filteredData.vitals]);
  const stepTicks = useMemo(() => filteredData.steps.map(d => d.timestamp), [filteredData.steps]);

  // ... (handlePointClick and handleAction remain the same)

  const [selectedPoint, setSelectedPoint] = useState<{ 
    ts: number; 
    val: any; 
    fieldName: string;
    rawObject: any;
  } | null>(null);

  const handlePointClick = (data: any, fieldName: string, dataKey: string) => {
    let point = null;
    if (data && data.timestamp) {
      point = data;
    } else if (data && (data.activeTooltipIndex !== undefined || data.activePayload)) {
      const index = data.activeTooltipIndex ?? data.activePayload?.[0]?.payload?.index;
      const dataSource = fieldName === 'steps_history' ? filteredData.steps : filteredData.vitals;
      point = dataSource[index];
    }

    if (point) {
      const raw = fieldName === 'steps_history' ? point.raw : point[`${dataKey}_raw`];      
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
      fetchAllHealthData();
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
    angle: -35, 
    textAnchor: "end" as "end",
  });

  if (loading || !isReady) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 pb-32">
      {/* Time Scale Selector */}
      <div className="flex justify-start">
        <div className="inline-flex items-center bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 backdrop-blur-md">
          {(['24H', '7D', '1M', '3M', 'YTD', '1Y', 'Max'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-xs font-bold transition-all duration-200 rounded-xl ${
                timeRange === range 
                  ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-200' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {range}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 mx-2" />
          <button className="p-2 text-slate-500 hover:text-indigo-600 transition-colors">
            <Calendar size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <MetricGraph title="BLOOD PRESSURE" unit="mmHg" icon={<Gauge className="text-violet-500" />}>
          <LineChart data={filteredData.vitals} margin={{ top: 30, right: 40, left: 10, bottom: 60 }}>
            <XAxis {...rotatedXAxisProps(vitalsTicks)} />
            <Tooltip wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} itemSorter={(item) => (item.dataKey === 'bpSyst' ? -1 : 1)}/>
            <Line type="monotone" dataKey="bpSyst" name="Systolic" stroke="#8b5cf6" strokeWidth={4} connectNulls={true} dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return null;
                return (
                  <circle key={`dot-sys-${payload.timestamp}`} cx={cx} cy={cy} r={4} fill="#8b5cf6" style={{ cursor: 'pointer', pointerEvents: 'all' }} 
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      handlePointClick(payload, 'bpSyst', 'bpSyst'); 
                    }} 
                  />
                );
              }} 
              activeDot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return null;
                return (
                  <circle key={`act-sys-${payload.timestamp}`} cx={cx} cy={cy} r={8} fill="#8b5cf6" style={{ cursor: 'pointer', pointerEvents: 'all' }} 
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      handlePointClick(payload, 'bpSyst', 'bpSyst'); 
                    }} 
                  />
                );
              }}
            />
            <Line type="monotone" dataKey="bpDias" name="Diastolic" stroke="#c084fc" strokeWidth={4} connectNulls={true}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return null;
                return (
                  <circle key={`dot-dia-${payload.timestamp}`} cx={cx} cy={cy} r={4} fill="#c084fc" style={{ cursor: 'pointer', pointerEvents: 'all' }} 
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      handlePointClick(payload, 'bpDias', 'bpDias'); 
                    }} 
                  />
                );
              }} 
              activeDot={(props: any) => {
                const { cx, cy, payload } = props;
                if (cx == null || cy == null) return null;
                return (
                  <circle key={`act-dia-${payload.timestamp}`} cx={cx} cy={cy} r={8} fill="#c084fc" style={{ cursor: 'pointer', pointerEvents: 'all' }} 
                    onMouseDown={(e) => { 
                      e.stopPropagation(); 
                      handlePointClick(payload, 'bpDias', 'bpDias'); 
                    }} 
                  />
                );
              }}
            />
          </LineChart>
        </MetricGraph>

        <MetricGraph title="HEART RATE" unit="BPM" icon={<Heart className="text-red-500" />}>
          <LineChart data={filteredData.vitals} margin={{ top: 30, right: 40, left: 10, bottom: 60 }} onMouseDown={(data) => handlePointClick(data, 'hr', 'hr')} style={{ cursor:'pointer'}}>
            <XAxis {...rotatedXAxisProps(vitalsTicks)} />
            <Tooltip wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Line type="monotone" dataKey="hr" stroke="#ef4444" fill="#fee2e2" strokeWidth={4} dot={{ r: 4, fill: '#ef4444' }} connectNulls />
          </LineChart>
        </MetricGraph>

        <MetricGraph title="ACTIVITY" unit="Steps" icon={<Zap className="text-orange-500" />}>
          <BarChart data={filteredData.steps} margin={{ top: 30, right: 40, left: 10, bottom: 60 }} onMouseDown={(data) => handlePointClick(data, 'steps_history', 'val')} style={{ cursor:'pointer'}}>
            <XAxis {...rotatedXAxisProps(stepTicks)} />
            <Tooltip wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Bar dataKey="val" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
          </BarChart>
        </MetricGraph>

        <MetricGraph title="RESPIRATION" unit="Breaths/min" icon={<Wind className="text-blue-500" />}>
          <LineChart data={filteredData.vitals} margin={{ top: 30, right: 40, left: 10, bottom: 60 }} onMouseDown={(data) => handlePointClick(data, 'rr', 'rr')} style={{ cursor:'pointer'}}>
            <XAxis {...rotatedXAxisProps(vitalsTicks)} />
            <Tooltip wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Line type="monotone" dataKey="rr" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, fill: '#3b82f6' }} connectNulls />
          </LineChart>
        </MetricGraph>

        <MetricGraph title="BLOOD OXYGEN" unit="SpO2 %" icon={<Droplets className="text-emerald-500" />}>
          <LineChart data={filteredData.vitals} margin={{ top: 30, right: 40, left: 10, bottom: 60 }} onMouseDown={(data) => handlePointClick(data, 'spo2', 'spo2')} style={{ cursor:'pointer'}}>
            <XAxis {...rotatedXAxisProps(vitalsTicks)} />
            <YAxis domain={[90, 100]} hide />
            <Tooltip wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Line type="monotone" dataKey="spo2" stroke="#10b981" fill="#d1fae5" strokeWidth={4} dot={{ r: 4, fill: '#10b981' }} connectNulls />
          </LineChart>
        </MetricGraph>

        <MetricGraph title="BODY TEMP" unit="°C" icon={<Thermometer className="text-amber-500" />}>
          <LineChart data={filteredData.vitals} margin={{ top: 30, right: 40, left: 10, bottom: 60 }} onMouseDown={(data) => handlePointClick(data, 'temp', 'temp')}  style={{ cursor:'pointer'}}>
            <XAxis {...rotatedXAxisProps(vitalsTicks)} />
            <YAxis domain={[30, 43]} hide />
            <Tooltip wrapperStyle={{ pointerEvents: 'none' }} labelFormatter={(val) => new Date(val).toLocaleString()} />
            <Line type="monotone" dataKey="temp" stroke="#f59e0b" strokeWidth={4} dot={{ r: 4, fill: '#f59e0b' }} connectNulls />
          </LineChart>
        </MetricGraph>
      </div>

      {selectedPoint && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-2xl max-w-sm w-full border border-slate-100 animate-in fade-in zoom-in duration-200">
            <p className="text-slate-500 text-sm mb-6 font-medium">
              Recorded on {new Date(selectedPoint.ts).toLocaleString()}
            </p>
            <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">
              Manage {
                selectedPoint.fieldName === 'bpSyst' ? 'Systolic' : 
                selectedPoint.fieldName === 'bpDias' ? 'Diastolic' : 
                selectedPoint.fieldName === 'steps_history' ? 'Steps' :
                selectedPoint.fieldName.replace('_', ' ')
              }
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setSelectedPoint(null)}
                className="py-4 px-6 rounded-2xl bg-slate-100 text-slate-600 font-bold"
              >
                Cancel
              </button>
              <button 
                onClick={() => handleAction('delete')}
                className="py-4 px-6 rounded-2xl bg-red-50 text-red-600 font-bold hover:bg-red-100"
              >
                Delete
              </button>
            </div>

            <button 
              onClick={() => handleAction('update')}
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-indigo-600 text-white font-bold shadow-lg"
            >
              Edit Value
            </button>
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
    <div className="flex items-center justify-between mb-4">
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