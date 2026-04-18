// InterventionGraph.tsx
import React, { useMemo } from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid
} from 'recharts';

interface InterventionGraphProps {
  data: Record<string, any>;
  metricKey: string;
  title: string;
  onPointClick?: (point: any) => void; 
}

export const InterventionGraph: React.FC<InterventionGraphProps> = ({ 
  data, 
  metricKey, 
  title,
  onPointClick 
}) => {

  const plotData = useMemo(() => {
    if (!data || !data[metricKey] || !Array.isArray(data[metricKey])) return [];
    
    return data[metricKey]
      .map((entry: any) => {
        const val = typeof entry.value === 'string' ? parseFloat(entry.value) : entry.value;
        const timeSource = entry.dateTime || entry.date || entry.timestamp;
        const ts = new Date(timeSource).getTime();
        return { value: val, timestamp: ts };
      })
      .filter((d: any) => !isNaN(d.value) && !isNaN(d.timestamp))
      .sort((a: any, b: any) => a.timestamp - b.timestamp);
  }, [data, metricKey]);

  if (plotData.length === 0) {
    return <div className="text-xs text-slate-400 italic p-4 text-center">No data available for this metric.</div>;
  }

  const formatDateTime = (tickItem: any) => {
    const d = new Date(tickItem);
    return d.toLocaleString([], { month: 'short', day: 'numeric' });
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-[10px] p-2 rounded shadow-lg">
          <p className="font-bold">{new Date(data.timestamp).toLocaleString()}</p>
          <p className="text-blue-300 font-mono mt-1">Value: {data.value}</p>
          {onPointClick && <p className="text-slate-400 mt-1 italic">Click point to select date</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-48 w-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-2 p-2 relative">
      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-2 mb-1">{title}</div>
      <ResponsiveContainer width="99%" height="85%" debounce={50}>
        <LineChart 
          data={plotData} 
          margin={{ top: 5, right: 10, left: -20, bottom: 0 }}
          onClick={(e: any) => {
            //console.log("Recharts Raw Event:", e);
            
            if (e && e.activePayload && e.activePayload.length > 0) {
              onPointClick?.(e.activePayload[0].payload);
            } 
            else if (e && typeof e.activeTooltipIndex !== 'undefined') {
              const clickedData = plotData[e.activeTooltipIndex];
              onPointClick?.(clickedData);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="timestamp" 
            type="number" 
            scale="time" 
            domain={['dataMin', 'dataMax']} 
            tickFormatter={formatDateTime}
            fontSize={9}
            tickLine={false}
            axisLine={false}
            stroke="#94a3b8"
          />
          <YAxis 
            domain={['auto', 'auto']} 
            axisLine={false} 
            tickLine={false} 
            fontSize={9}
            stroke="#94a3b8"
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ strokeDasharray: '3 3' }}
            trigger="hover" 
          />
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#3b82f6" 
            strokeWidth={2} 
            dot={{ 
                r: 5, 
                fill: "#3b82f6", 
                strokeWidth: 2, 
                stroke: "#fff", 
                cursor: "pointer" 
            }}
            activeDot={{ 
                r: 7, 
                fill: "#2563eb", 
                strokeWidth: 0, 
                cursor: "pointer" 
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};