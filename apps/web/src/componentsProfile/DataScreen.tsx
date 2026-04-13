// DataScreen.tsx
import React, { useEffect, useState, useMemo } from 'react';
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { 
  RefreshCw, Calendar, ChevronLeft, ChevronRight, LayoutGrid, Maximize2
} from 'lucide-react';
import { SINGLE_GRAPHS } from '../componentsProfile/profileConstants';
import { MetricChartRenderer } from './componentsDataScreen/MetricChartRenderer';
import { ActiveAlerts } from './componentsDataScreen/ActiveAlerts';
import { userActiveAlerts } from './userActiveAlerts';

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
  onExportAlerts?: (alerts: any[]) => void;
  onExportAlertLastMs?: (activeAlertLast: number | null) => void;
  onExportSeverity?: (severity: 'critical' | 'info') => void;
}

const toDateTimeLocal = (date: Date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().slice(0, 16);
};

const DIET_METRICS = ['calories', 'carbs', 'protein', 'fat', 'sodium', 'fiber'];

const aggregateDataByDay = (data: any[], metricsToAggregate: string[]) => {
  const dailyAggregates: Record<string, any> = {};
  const remainingData: any[] = [];

  data.forEach(point => {
    const date = new Date(point.timestamp);
    const dateKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    
    const pointWithoutAggregated = { ...point };
    
    metricsToAggregate.forEach(metric => {
      if (point[metric] !== undefined) {
        if (!dailyAggregates[dateKey]) {
          dailyAggregates[dateKey] = {
            timestamp: new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime(),
          };
        }
        
        // Sum the values for diet metrics (per day)
        dailyAggregates[dateKey][metric] = (dailyAggregates[dateKey][metric] || 0) + Number(point[metric]);
        
        if (point[`${metric}_raw`]) {
          dailyAggregates[dateKey][`${metric}_raw`] = point[`${metric}_raw`];
        }

        delete pointWithoutAggregated[metric];
        delete pointWithoutAggregated[`${metric}_raw`];
      }
    });

    // keep other metrics that do not require aggregation (like vitals and exercises)
    const remainingKeys = Object.keys(pointWithoutAggregated).filter(k => k !== 'timestamp' && !k.endsWith('_raw'));
    if (remainingKeys.length > 0) {
      remainingData.push(pointWithoutAggregated);
    }
  });

  return [...remainingData, ...Object.values(dailyAggregates)].sort((a, b) => a.timestamp - b.timestamp);
};

const DataScreen: React.FC<DataScreenProps> = ({ 
  userId, 
  isMe, 
  hiddenOther,
  onExportAlerts,
  onExportAlertLastMs,
  onExportSeverity
}) => {
  const [dataOwnerId, setDataOwnerId] = useState<string | null>(null);
  const [vitalsData, setVitalsData] = useState<any[]>([]);
  const [customMetrics, setCustomMetrics] = useState<CustomMetric[]>([]);
  const [reportData, setReportData] = useState<Record<string, number[]>>({});
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

  // notifications
  const notifications = userActiveAlerts(vitalsData);
  const [lastProcessedAlertId, setLastProcessedAlertId] = useState<string | null>(null);

  // Derive the highest severity level (disease alert notification color)
  const maxAlertSeverity = useMemo(() => {
    if (notifications.length === 0) return 'info';
    return notifications.some(a => a.type === 'critical') ? 'critical' : 'info';
  }, [notifications]);

  useEffect(() => {
    if (onExportAlerts) {
      onExportAlerts(notifications);
    }
    if (onExportSeverity) {
      onExportSeverity(maxAlertSeverity);
    }
  }, [notifications, maxAlertSeverity, onExportAlerts]);

  // effect to sync the alert timestamp to the DB
  useEffect(() => {
    if (!isMe || notifications.length === 0 || !userId || dataOwnerId !== userId) return;

    const latestAlert = notifications[notifications.length - 1];
    
    if (latestAlert.id !== lastProcessedAlertId) {
      const currentUid = auth.currentUser?.uid;
      const profileRef = doc(db, 'users', currentUid || userId, 'profile', 'user_data');
      
      const syncAlertTimestamp = async () => {
        try {
          await updateDoc(profileRef, {
            activeAlert_last: serverTimestamp()
          });
          setLastProcessedAlertId(latestAlert.id);
        } catch (err) {
          console.error("Failed to update alert timestamp:", err);
        }
      };

      syncAlertTimestamp();
    }
  }, [notifications, isMe, userId, lastProcessedAlertId, dataOwnerId]);

  const handleOpenDatePicker = () => {
    if (!customStart) setCustomStart(toDateTimeLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
    if (!customEnd) setCustomEnd(toDateTimeLocal(new Date()));
    setShowDatePicker(true);
  };

  // Extract data & alertLastMs to ProfileScreen
  useEffect(() => {
    if (!userId) return;

    setVitalsData([]);
    setDataOwnerId(null);
    setLastProcessedAlertId(null);

    const profileRef = doc(db, 'users', userId, 'profile', 'user_data');
    
    const unsubscribe = onSnapshot(profileRef, (profileSnap) => {
      if (profileSnap.exists()) {
        const p = profileSnap.data();

        const newReportData: Record<string, number[]> = {};
        
        Object.keys(p).forEach(key => {
          if (key.startsWith('change_')) {
            const metricData = p[key];
            const cleanKey = key.replace('change_', '');

            if (Array.isArray(metricData) && metricData.length > 0) {
              newReportData[cleanKey] = metricData;
            }
          }
        });

        setReportData(newReportData);
        
        let alertLastMs = null;
        if (p.activeAlert_last) {
          alertLastMs = p.activeAlert_last?.toDate 
            ? p.activeAlert_last.toDate().getTime() 
            : new Date(p.activeAlert_last).getTime();
        }
        
        if (onExportAlertLastMs) {
          onExportAlertLastMs(alertLastMs);
        }

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

        allKeys.forEach(targetKey => {
          const actualKey = Object.keys(p).find(k => k.toLowerCase() === targetKey.toLowerCase());
          if (actualKey && p[actualKey]) {
            processVital(p[actualKey], targetKey);
          }
        });

        const history = Object.values(timelineMap).sort((a: any, b: any) => a.timestamp - b.timestamp);
        setVitalsData(history);
        setDataOwnerId(userId);
      } else {
        setVitalsData([]);
      }
      
      setLoading(false);
      setTimeout(() => setIsReady(true), 150);
      
    }, (err) => {
      console.error("DataScreen Snapshot Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId, onExportAlertLastMs]);

  const hasData = (key: string) => {
    return vitalsData.some(d => d[key] !== undefined && d[key] !== null);
  };

  const visibleGraphs = useMemo(() => {
    const graphs = [];

    if ((hasData('bpSyst') || hasData('bpDias')) && (isMe || (!hiddenOther.includes('bpSyst') && !hiddenOther.includes('bpDias')))) {
      graphs.push({ type: 'bp', id: 'bp' });
    }

    SINGLE_GRAPHS.forEach(config => {
      if (hasData(config.key) && (isMe || !hiddenOther.includes(config.key))) {
        graphs.push({ type: 'standard', id: config.key, config });
      }
    });

    customMetrics.forEach((m, index) => {
      if (hasData(m.key) && (isMe || !hiddenOther.includes(m.key))) {
        graphs.push({ type: 'custom', id: m.key, m, index });
      }
    });

    return graphs;
  }, [vitalsData, isMe, hiddenOther, customMetrics]);

  useEffect(() => {
    if (visibleGraphs.length > 0 && currentGraphIndex >= visibleGraphs.length) {
      setCurrentGraphIndex(0);
    }
  }, [visibleGraphs, currentGraphIndex]);

  // Data sent to ActiveAlerts.tsx 
  const filteredData = useMemo(() => {
    let result = [...vitalsData];
    const now = new Date();
    let threshold = 0;

    // Date range filter
    if (customStart && customEnd) {
      threshold = new Date(customStart).getTime();
      const endTs = new Date(customEnd).getTime();
      result = result.filter(d => d.timestamp >= threshold && d.timestamp <= endTs);
    } else {
      switch (timeRange) {
        case '24H': threshold = now.getTime() - 86400000; break;
        case '7D':  threshold = now.getTime() - 604800000; break;
        case '1M':  threshold = now.getTime() - 2592000000; break;
        case '3M':  threshold = now.getTime() - 7776000000; break;
        case 'YTD': threshold = new Date(now.getFullYear(), 0, 1).getTime(); break;
        case '1Y':  threshold = now.getTime() - 31536000000; break;
        case 'Max': threshold = 0; break;
      }
      result = result.filter(d => d.timestamp >= threshold);
    }

    // Aggregate diet metrics
    result = aggregateDataByDay(result, DIET_METRICS);

    const uniqueMap: { [key: number]: any } = {};
    result.forEach(point => {
      if (!uniqueMap[point.timestamp]) {
        uniqueMap[point.timestamp] = { ...point };
      } else {
        Object.assign(uniqueMap[point.timestamp], point);
      }
    });
    result = Object.values(uniqueMap).sort((a: any, b: any) => a.timestamp - b.timestamp);

    if (result.length <= 1 || reductionFactor <= 0.05) return result;

    // Remove the last point from the reduction pool to guarantee its visibility
    const lastActualPoint = result[result.length - 1];
    const reductionPool = result.slice(0, -1);

    const timeSpan = lastActualPoint.timestamp - result[0].timestamp;
    const targetPoints = Math.max(10, Math.floor(result.length * (1 - reductionFactor)));
    const adjustedInterval = timeSpan / targetPoints;

    const bucketsData: { [key: number]: any[] } = {};
    
    // Bucket only the preceding points
    reductionPool.forEach(point => {
      const bucketKey = Math.floor(point.timestamp / adjustedInterval) * adjustedInterval;
      if (!bucketsData[bucketKey]) bucketsData[bucketKey] = [];
      bucketsData[bucketKey].push(point);
    });

    const bucketedResults = Object.keys(bucketsData).map(key => {
      const points = bucketsData[Number(key)];
      if (points.length === 1) return points[0];

      const representativePoint: any = {}; 
      const allKeysInBucket = new Set<string>();
      
      points.forEach(p => {
        Object.keys(p).forEach(k => {
          if (typeof p[k] === 'number' && k !== 'timestamp') allKeysInBucket.add(k);
        });
      });

      const sourcePointForMetric: Record<string, any> = {};
      const sortedKeys = Array.from(allKeysInBucket).sort((a, b) => {
        if (a === 'bpSyst') return -1;
        if (b === 'bpSyst') return 1;
        return 0;
      });

      let latestTimestampInBucket = 0;
      sortedKeys.forEach(mKey => {
        const validPoints = points.filter(p => p[mKey] !== undefined);
        if (validPoints.length === 0) return;

        let selectedPoint;
        if (mKey === 'bpDias' && sourcePointForMetric['bpSyst']?.bpDias !== undefined) {
          selectedPoint = sourcePointForMetric['bpSyst'];
        } else {
          const avg = validPoints.reduce((a, b) => a + (b[mKey] as number), 0) / validPoints.length;
          selectedPoint = validPoints.reduce((prev, curr) => 
            Math.abs((curr[mKey] as number) - avg) > Math.abs((prev[mKey] as number) - avg) ? curr : prev
          );
        }

        representativePoint[mKey] = selectedPoint[mKey];
        if (selectedPoint.timestamp > latestTimestampInBucket) {
          latestTimestampInBucket = selectedPoint.timestamp;
        }
        if (selectedPoint[`${mKey}_raw`]) {
          representativePoint[`${mKey}_raw`] = selectedPoint[`${mKey}_raw`];
        }
      });

      representativePoint.timestamp = latestTimestampInBucket || Number(key);
      return representativePoint;
    });

    // Merge the buckets and the last point
    return [...bucketedResults, lastActualPoint].sort((a, b) => a.timestamp - b.timestamp);

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
      if (action === 'delete') {
        await updateDoc(profileRef, {
          [selectedPoint.fieldName]: arrayRemove(selectedPoint.rawObject)
        });
      } else if (action === 'update') {
        const newValue = prompt("Enter new value:", selectedPoint.val);
        
        if (newValue !== null && newValue !== "") {
          await updateDoc(profileRef, {
            [selectedPoint.fieldName]: arrayRemove(selectedPoint.rawObject)
          });

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

  const getModalTitle = (fieldName: string) => {
    const matchedGraph = SINGLE_GRAPHS.find(g => g.key === fieldName);
    if (matchedGraph) return matchedGraph.title;
    const matchedCustom = customMetrics.find(m => m.key === fieldName);
    if (matchedCustom) return matchedCustom.name.toUpperCase();
    if (fieldName === 'bpSyst') return 'Systolic';
    if (fieldName === 'bpDias') return 'Diastolic';
    return fieldName.replace('_', ' ');
  };

  const handleNextGraph = () => {
    setCurrentGraphIndex((prev) => (prev + 1) % visibleGraphs.length);
  };

  const handlePrevGraph = () => {
    setCurrentGraphIndex((prev) => (prev - 1 + visibleGraphs.length) % visibleGraphs.length);
  };

  if (loading || !isReady) return (
    <div className="h-screen flex items-center justify-center bg-slate-50">
      <RefreshCw className="animate-spin text-indigo-600" size={32} />
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-8 pb-10">      
      <ActiveAlerts 
      alerts={notifications} 
      className="hidden lg:flex" 
    />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex flex-col items-start gap-4 mb-2 w-full">
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

          <div className="flex flex-nowrap items-center gap-2 md:gap-4 w-full">
            <button 
              onClick={() => setShowAll(!showAll)}
              className="relative inline-flex items-center justify-center gap-2 px-3 md:px-5 py-2.5 bg-white text-indigo-600 font-bold text-xs md:text-sm border border-slate-200 shadow-sm rounded-xl hover:bg-slate-50 transition-colors shrink-0 overflow-hidden"
            >
              <div className="invisible flex items-center gap-2">
                <LayoutGrid size={16} />
                <span className="whitespace-nowrap">All Graphs</span>
              </div>
              <div className="absolute inset-0 flex items-center justify-center gap-2">
                {showAll ? <Maximize2 size={16} /> : <LayoutGrid size={16} />}
                <span className="whitespace-nowrap">
                  {showAll ? 'Single' : 'All Graphs'}
                </span>
              </div>
            </button>
            <div className="flex items-center gap-2 md:gap-3 bg-white px-3 md:px-4 py-2 rounded-xl border border-slate-200 shadow-sm flex-1 min-w-0">
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Detail</span>
              <input 
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={reductionFactor}
                onChange={(e) => setReductionFactor(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 min-w-0"
              />
              <span className="text-[9px] md:text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Summary</span>
            </div>
          </div>
        </div>
      </div>

      {visibleGraphs.length === 0 ? (
        <div className="text-center text-slate-400 py-12 font-medium">
          No metrics to display.
        </div>
      ) : (
        <div className={showAll ? "grid grid-cols-1 gap-8 w-full" : "relative w-full"}>
          
        {showAll && visibleGraphs.map((graph, idx) => (
          <div key={idx} className="w-full h-125"> 
            <MetricChartRenderer 
              graph={graph} 
              filteredData={filteredData} 
              onPointClick={handlePointClick}
              reportData={reportData}
              activeAlerts={notifications}
            />
          </div>
        ))}

        {!showAll && (
          <div className="relative flex items-center group w-full h-125"> 
            {visibleGraphs.length > 1 && (
              <button 
                onClick={handlePrevGraph} 
                className="absolute -left-3 md:-left-6 z-10 p-3 bg-white rounded-full shadow-lg border border-slate-200 text-slate-400 hover:text-indigo-600 hover:scale-105 active:scale-95 transition-all"
              >
                <ChevronLeft size={24} />
              </button>
            )}

            <div className="w-full h-full">
              <MetricChartRenderer 
                graph={visibleGraphs[currentGraphIndex]} 
                filteredData={filteredData} 
                onPointClick={handlePointClick} 
                reportData={reportData}
                activeAlerts={notifications}
              />
            </div>

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

      {selectedPoint && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 isolate">
          <div className="absolute inset-0" onClick={() => setSelectedPoint(null)} />
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

export default DataScreen;