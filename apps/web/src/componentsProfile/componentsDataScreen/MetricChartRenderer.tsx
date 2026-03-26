// src/components/MetricChartRenderer.tsx
import React from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';
import { Gauge, PlusCircle } from 'lucide-react';

const CUSTOM_COLORS = ['#ec4899', '#0ea5e9', '#84cc16', '#f59e0b', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];

export const MetricGraph = ({ title, unit, icon, children }: any) => (
  <div 
    className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col min-w-0 w-full h-full"
    // Removed fixed height style to allow parent control
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
    {/* This wrapper MUST be h-full for ResponsiveContainer to work */}
    <div className="flex-1 w-full h-full min-h-0 pointer-events-auto">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

interface MetricChartRendererProps {
  graph: any;
  filteredData: any[];
  onPointClick: (point: any, fieldName: string, dataKey: string) => void;
}

export const MetricChartRenderer: React.FC<MetricChartRendererProps> = ({ 
  graph, 
  filteredData, 
  onPointClick 
}) => {
  if (!graph) return null;

  const formatDateTime = (tickItem: any) => {
    const d = new Date(tickItem);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const rotatedXAxisProps = {
    dataKey: "timestamp",
    type: "number" as const,
    scale: "time" as const,
    domain: ['auto', 'auto'] as [any, any],
    tickFormatter: formatDateTime,
    minTickGap: 30, 
    fontSize: 9,
    fontWeight: "bold",
    axisLine: false,
    tickLine: false,
    dy: 15, 
    angle: -45, 
    textAnchor: "end" as "end",
  };

  const renderCustomActiveDot = (props: any, color: string, dataKey: string) => {
    const { cx, cy, payload } = props;
    return (
      <g 
        key={`act-${dataKey}-${payload.timestamp}`} 
        style={{ cursor: 'pointer', outline: 'none' }}
        onClick={() => onPointClick(payload, dataKey, dataKey)}
      >
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#fff" strokeWidth={2} />
      </g>
    );
  };

  const commonDotProps = (color: string, key: string) => ({
    r: 5,
    fill: color,
    style: { cursor: 'pointer', pointerEvents: 'all' as const },
    onClick: (props: any) => onPointClick(props.payload, key, key)
  });

  if (graph.type === 'bp') {
    return (
      <MetricGraph key="bp" title="BLOOD PRESSURE" unit="mmHg" icon={<Gauge className="text-violet-500" />}>
        <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis {...rotatedXAxisProps} />
          <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          <Tooltip 
            cursor={false} 
            wrapperStyle={{ pointerEvents: 'none' }} 
            labelFormatter={(val) => new Date(val).toLocaleString()} 
            formatter={(value: any, name: any) => [`${value} mmHg`, String(name || '')]}
            itemSorter={(item) => (item.dataKey === 'bpSyst' ? -1 : 1)}
          />
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
    const domain = config.domain || ['auto', 'auto'];

    return (
      <MetricGraph key={config.key} title={config.title} unit={config.unit} icon={config.icon}>
        <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis {...rotatedXAxisProps} />
          <YAxis domain={domain} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          <Tooltip 
            cursor={false} 
            wrapperStyle={{ pointerEvents: 'none' }} 
            labelFormatter={(val) => new Date(val).toLocaleString()}
            formatter={(value: any) => [`${value ?? ''} ${config.unit}`, config.title]} 
          />
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

    return (
      <MetricGraph key={m.key} title={m.name.toUpperCase()} unit={m.unit} icon={<PlusCircle style={{ color: customColor }} />}>
        <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis {...rotatedXAxisProps} />
          <YAxis domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          <Tooltip 
            cursor={false} 
            wrapperStyle={{ pointerEvents: 'none' }} 
            labelFormatter={(val) => new Date(val).toLocaleString()}
            formatter={(value: any) => [`${value ?? ''} ${m.unit}`, m.name.toUpperCase()]} 
          />
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
    );
  }

  return null;
};