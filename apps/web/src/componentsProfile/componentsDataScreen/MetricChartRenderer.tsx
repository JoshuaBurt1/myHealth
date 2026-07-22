// MetricChartRenderer.tsx
import React, { useState } from 'react';
import { 
  XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine
} from 'recharts';
import { Gauge, PlusCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { STRENGTH_LIST, SPEED_LIST, BP_THRESHOLDS, DIET_TYPES_MAP, type MetricThresholds } from '../profileConstants';

const CUSTOM_COLORS = ['#ec4899', '#0ea5e9', '#84cc16', '#f59e0b', '#8b5cf6', '#14b8a6', '#f43f5e', '#6366f1'];

export const MetricGraph = ({ title, unit, unitToggle, icon, children, percentageDisplay, alertType, isAggregated, customLabel, fractionsDisplay }: any) => {
  const bgClass = alertType === 'critical' 
    ? 'bg-red-50/50 border-red-100' 
    : alertType === 'warning' 
      ? 'bg-yellow-50/50 border-yellow-100' 
      : 'bg-white border-slate-100';

  return (
    <div className={`${bgClass} p-6 rounded-[2.5rem] border shadow-sm flex flex-col min-w-0 w-full h-full transition-colors duration-500`}>
      <div className="flex items-center justify-between mb-4 w-full">
        <div className="flex items-center gap-3 w-full">
          <div className="bg-white/50 p-3 rounded-2xl shadow-sm">{icon}</div>
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between w-full">
              <h3 className="text-sm font-black text-slate-900 tracking-widest uppercase">{title}</h3>
              <div className="flex items-center gap-2">
                {customLabel}
                {percentageDisplay}
              </div>
            </div>

            <div className="flex items-center justify-between mt-1 w-full">
              <div className="flex flex-col w-full">
                <div className="flex items-center w-full">
                  {unitToggle ? (
                    unitToggle
                  ) : (
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{unit}</p>
                  )}
                </div>
                {fractionsDisplay}
              </div>
              {isAggregated && (
                <span className="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter h-fit shrink-0 ml-2">
                  Aggregated by day
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 w-full h-full min-h-0 pointer-events-auto">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

interface MetricChartRendererProps {
  graph: any;
  filteredData: any[];
  onPointClick: (point: any, fieldName: string, dataKey: string) => void;
  reportData?: Record<string, number[]>;
  activeAlerts?: any[];
  aggregatedKeys?: string[];
  tdeeResult?: number;
  selectedDiet?: string;
}

export const MetricChartRenderer: React.FC<MetricChartRendererProps> = ({ 
  graph, 
  filteredData, 
  onPointClick,
  reportData = {},
  activeAlerts = [],
  aggregatedKeys = [],
  tdeeResult,
  selectedDiet
}) => {
  const [isConverted, setIsConverted] = useState(false);
  const [viewMode, setViewMode] = useState<'1rm' | 'load' | 'both'>('both');

  if (!graph) return null;

  const dataKey = graph.type === 'standard' ? graph.config.key : graph.type === 'custom' ? graph.m.key : null;
  const rawUnit = (graph.type === 'standard' ? graph.config.unit : graph.type === 'custom' ? graph.m.unit : '') || '';

  // 1. Normalize unit once
  const unitClean = rawUnit.toLowerCase();

  // 2. Use the pre-existing lists from constants for O(1) or direct array checks
  const isSpeed = SPEED_LIST.includes(dataKey) || unitClean === 'sec' || unitClean === 's';
  const isStrength = STRENGTH_LIST.includes(dataKey) || unitClean === 'kg';

  // 3. Check for presence of totalLoad
  const hasTotalLoad = dataKey && filteredData?.some(d => d[`${dataKey}_totalLoad`] != null);

  const displayUnit = isStrength && isConverted ? 'lbs' : isSpeed && isConverted ? 'mm:ss' : rawUnit;

  const formatValue = (val: any) => {
    if (val == null) return val;
    const num = Number(val);
    if (isNaN(num)) return val;

    if (isSpeed && isConverted) {
      const m = Math.floor(num / 60);
      const s = Math.floor(num % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    }
    if (isStrength && isConverted) {
      return (num * 2.20462).toFixed(1);
    }
    return Number.isInteger(num) ? num.toString() : num.toFixed(1);
  };

  const getAlertType = (key: string) => {
    const relevantAlerts = activeAlerts.filter(a => a.metricKeys?.includes(key));
    if (relevantAlerts.some(a => a.type === 'critical')) return 'critical';
    if (relevantAlerts.some(a => a.type === 'warning')) return 'warning';
    return undefined;
  };

  const renderThresholdLines = (
    thresholds?: MetricThresholds, 
    labelPrefix: string = '', 
    opacity: number = 0.7,
    yAxisId: string = "left"
  ) => {
    if (!thresholds) return null;
    
    const CRIT_COLOR = "#ef4444";
    const WARN_COLOR = "#eab308";

    return (
      <>
        {thresholds.criticalHigh && (
          <ReferenceLine 
            yAxisId={yAxisId}
            y={thresholds.criticalHigh} 
            stroke={CRIT_COLOR} 
            strokeDasharray="4 4" 
            strokeWidth={1} 
            strokeOpacity={opacity} 
            style={{ pointerEvents: 'none' }}
            label={{ 
              position: 'insideBottomLeft', 
              value: `${labelPrefix}Crit Max`, 
              fill: CRIT_COLOR, 
              fontSize: 10, 
              fontWeight: 'bold',
              fillOpacity: opacity
            }} 
          />
        )}
        {thresholds.warningHigh && (
          <ReferenceLine 
            yAxisId={yAxisId}
            y={thresholds.warningHigh} 
            stroke={WARN_COLOR} 
            strokeDasharray="4 4" 
            strokeWidth={1} 
            strokeOpacity={opacity} 
            style={{ pointerEvents: 'none' }}
            label={{ 
              position: 'insideBottomLeft', 
              value: `${labelPrefix}Warn Max`, 
              fill: WARN_COLOR, 
              fontSize: 10, 
              fontWeight: 'bold',
              fillOpacity: opacity
            }} 
          />
        )}
        {thresholds.warningLow && (
          <ReferenceLine 
            yAxisId={yAxisId}
            y={thresholds.warningLow} 
            stroke={WARN_COLOR} 
            strokeDasharray="4 4" 
            strokeWidth={1} 
            strokeOpacity={opacity} 
            style={{ pointerEvents: 'none' }}
            label={{ 
              position: 'insideBottomLeft', 
              value: `${labelPrefix}Warn Min`, 
              fill: WARN_COLOR, 
              fontSize: 10, 
              fontWeight: 'bold',
              fillOpacity: opacity
            }} 
          />
        )}
        {thresholds.criticalLow && (
          <ReferenceLine 
            yAxisId={yAxisId}
            y={thresholds.criticalLow} 
            stroke={CRIT_COLOR} 
            strokeDasharray="4 4" 
            strokeWidth={1} 
            strokeOpacity={opacity} 
            style={{ pointerEvents: 'none' }}
            label={{ 
              position: 'insideBottomLeft', 
              value: `${labelPrefix}Crit Min`, 
              fill: CRIT_COLOR, 
              fontSize: 10, 
              fontWeight: 'bold',
              fillOpacity: opacity
            }} 
          />
        )}
      </>
    );
  };

  const getTrendDetails = (val: number, checkSpeed: boolean) => {
    if (val === 0) return { Icon: TrendingUp, color: "text-slate-400" };
    const isPositiveChange = val > 0;
    const Icon = isPositiveChange ? TrendingUp : TrendingDown;
    const color = checkSpeed 
      ? (isPositiveChange ? "text-red-500" : "text-emerald-500")
      : (isPositiveChange ? "text-emerald-500" : "text-red-500");

    return { Icon, color };
  };

  const renderPercentage = (key: string) => {
    // Total and Last values are only supposed to show for exercises
    if (!isStrength && !isSpeed) return null;

    const data = reportData[key];
    if (!data || data.length < 2) return null;
    
    const lastChange = data[0];
    const totalChange = data[1];

    const lastTrend = getTrendDetails(lastChange, isSpeed);
    const totalTrend = getTrendDetails(totalChange, isSpeed);

    return (
      <div className="flex flex-col items-end">
        <div className={`flex items-center gap-1 ${totalTrend.color}`}>
          <totalTrend.Icon size={14} />
          <span className="text-[12px] font-black tracking-tight">
            TOTAL {totalChange > 0 ? '+' : ''}{totalChange}%
          </span>
        </div>
        <div className={`flex items-center gap-1 ${lastTrend.color}`}>
          <lastTrend.Icon size={14} />
          <span className="text-[12px] font-black tracking-tight">
            LAST {lastChange > 0 ? '+' : ''}{lastChange}%
          </span>
        </div>
      </div>
    );
  };

  const renderBPPercentages = () => {
    const syst = reportData['bpSyst'];
    const dias = reportData['bpDias'];
    
    const renderBPGroup = (data: number[], label: string) => {
      if (!data || data.length < 2) return null;
      const last = getTrendDetails(data[0], true); 
      const total = getTrendDetails(data[1], true);

      return (
        <div className="flex flex-col items-end border-l border-slate-100 pl-3 first:border-0 first:pl-0">
          <div className={`flex items-center gap-1 ${total.color}`}>
            <total.Icon size={10} />
            <span className="text-[9px] font-black tracking-tighter">{label} TOTAL {data[1] > 0 ? '+' : ''}{data[1]}%</span>
          </div>
          <div className={`flex items-center gap-1 ${last.color}`}>
            <last.Icon size={10} />
            <span className="text-[9px] font-black tracking-tighter">{label} LAST {data[0] > 0 ? '+' : ''}{data[0]}%</span>
          </div>
        </div>
      );
    };
    
    if ((!syst || syst.length < 2) && (!dias || dias.length < 2)) return null;
    
    return (
      <div className="flex items-center gap-3">
        {syst && renderBPGroup(syst, 'SYS')}
        {dias && renderBPGroup(dias, 'DIA')}
      </div>
    );
  };

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

  const renderToggle = () => {
    if (!isSpeed && !isStrength && !hasTotalLoad) return null;
    
    const label1 = isSpeed ? 'SEC' : 'KG';
    const label2 = isSpeed ? 'MM:SS' : 'LBS';
    
    return (
      <div className="flex items-center justify-between w-full grow">
        {/* Far Left: Unit Toggle */}
        {(isSpeed || isStrength) ? (
          <button
            onClick={(e) => { e.stopPropagation(); setIsConverted(!isConverted); }}
            className="flex items-center bg-slate-100 rounded-full p-0.5 text-[9px] font-black text-slate-500 border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors pointer-events-auto shrink-0"
          >
            <span className={`px-2 py-0.5 rounded-full transition-all ${!isConverted ? 'bg-white shadow-sm text-slate-900' : ''}`}>
              {label1}
            </span>
            <span className={`px-2 py-0.5 rounded-full transition-all ${isConverted ? 'bg-white shadow-sm text-slate-900' : ''}`}>
              {label2}
            </span>
          </button>
        ) : <div />}

        {/* Far Right: Mode Toggle */}
        {hasTotalLoad && (
          <div className="flex items-center bg-slate-100 rounded-full p-0.5 text-[9px] font-black text-slate-500 border border-slate-200 pointer-events-auto shrink-0 ml-auto">
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('1rm'); }}
              className={`px-2 py-0.5 rounded-full transition-all ${viewMode === '1rm' ? 'bg-white shadow-sm text-slate-900' : 'hover:text-slate-700 cursor-pointer'}`}
            >
              1RM
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('load'); }}
              className={`px-2 py-0.5 rounded-full transition-all ${viewMode === 'load' ? 'bg-white shadow-sm text-slate-900' : 'hover:text-slate-700 cursor-pointer'}`}
            >
              LOAD
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setViewMode('both'); }}
              className={`px-2 py-0.5 rounded-full transition-all ${viewMode === 'both' ? 'bg-white shadow-sm text-slate-900' : 'hover:text-slate-700 cursor-pointer'}`}
            >
              BOTH
            </button>
          </div>
        )}
      </div>
    );
  };

  // Calculate PR / 1RM
  const validValues = dataKey ? filteredData.map(d => Number(d[dataKey])).filter(n => !isNaN(n) && n > 0) : [];
  let bestValue: number | null = null;
  let bestLabel = '';
  
  if (validValues.length > 0) {
    if (isStrength) {
      bestValue = Math.max(...validValues);
      bestLabel = 'PR';
    } else if (isSpeed) {
      bestValue = Math.min(...validValues);
      bestLabel = 'PR';
    }
  }

  const renderBestValueLine = () => {
    if (bestValue === null) return null;
    const formattedBest = formatValue(bestValue);
    return (
      <ReferenceLine 
        yAxisId="left"
        y={bestValue} 
        stroke="#8b5cf6" 
        strokeDasharray="4 4" 
        strokeWidth={1.5} 
        strokeOpacity={0.8}
        style={{ pointerEvents: 'none' }}
        label={{ 
          position: 'insideBottomLeft', 
          value: `${bestLabel} = ${formattedBest} ${displayUnit}`,
          fill: '#8b5cf6', 
          fontSize: 10, 
          fontWeight: 'bold',
          fillOpacity: 0.8
        }} 
      />
    );
  };

  if (graph.type === 'bp') {
    const bpAlert = getAlertType('bpSyst') || getAlertType('bpDias');
    return (
      <MetricGraph 
        key="bp" 
        title="BLOOD PRESSURE" 
        unit="mmHg" 
        icon={<Gauge className="text-violet-500" />}
        alertType={bpAlert}
        percentageDisplay={renderBPPercentages()}
      >
        <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis {...rotatedXAxisProps} />
          <YAxis yAxisId="left" domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={(val) => Number.isInteger(val) ? val.toString() : val.toFixed(1)} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          <Tooltip 
            cursor={false} 
            wrapperStyle={{ pointerEvents: 'none' }} 
            labelFormatter={(val) => new Date(val).toLocaleString()} 
            formatter={(value: any, name: any) => [`${value} mmHg`, String(name || '')]}
            itemSorter={(item) => (item.dataKey === 'bpSyst' ? -1 : 1)}
          />
          {renderThresholdLines(BP_THRESHOLDS.systolic, 'SYS ', 0.8, "left")}
          {renderThresholdLines(BP_THRESHOLDS.diastolic, 'DIA ', 0.25, "left")}
          <Line 
            yAxisId="left"
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
            yAxisId="left"
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
    const alertType = getAlertType(config.key);
    const domain = config.domain || ['auto', 'auto'];

    const today = new Date();
    const todayData = filteredData.filter(d => {
      if (!d.timestamp) return false;
      const dDate = new Date(d.timestamp);
      return dDate.getDate() === today.getDate() &&
             dDate.getMonth() === today.getMonth() &&
             dDate.getFullYear() === today.getFullYear() &&
             d[config.key] != null;
    });

    const currentAmount = todayData.reduce((sum, d) => sum + Number(d[config.key]), 0);
    const currentDisplay = Number.isInteger(currentAmount) ? currentAmount : Number(currentAmount.toFixed(1));

    let dietThresholds: { min?: number; max?: number } | null = null;
    const isMacro = ['carbs', 'protein', 'fat'].includes(config.key);
    const isMicro = ['sodium', 'potassium', 'phosphorus'].includes(config.key);

    if (selectedDiet && DIET_TYPES_MAP[selectedDiet]) {
      const diet = DIET_TYPES_MAP[selectedDiet];

      if (isMacro && tdeeResult && diet[config.key]) {
        const calPerGram = config.key === 'fat' ? 9 : 4;
        dietThresholds = {
          min: (tdeeResult * diet[config.key].min) / calPerGram,
          max: (tdeeResult * diet[config.key].max) / calPerGram
        };
      } else if (isMicro && diet[config.key]) {
        dietThresholds = {
          max: diet[config.key].max,
          min: diet[config.key].min
        };
      }
    }

    let customLabelElement = null;
    let fractionsDisplay = null;

    if (config.key === 'calories') {
      let labelText = "no data on current day";
      let labelColor = "bg-slate-100 text-slate-500";
      let LabelIcon = null;

      if (todayData.length > 0) {
        if (tdeeResult) {
          if (tdeeResult > currentAmount) {
            labelText = "losing weight";
            labelColor = "text-red-500"; 
            LabelIcon = TrendingDown;            
          } else if (tdeeResult < currentAmount) {
            labelText = "gaining weight";
            labelColor = "text-emerald-500";
            LabelIcon = TrendingUp;                    
          } else {
             labelText = "maintaining weight";
             labelColor = "text-blue-500";
          }

          fractionsDisplay = (
            <div className="flex flex-col gap-0.5 mt-2">
              <span className="text-[12px] font-bold text-slate-500">
                {currentDisplay} / {tdeeResult.toFixed(0)} {config.unit}
              </span>
            </div>
          );
        }
      }

      customLabelElement = (
        <span className={`flex items-center gap-1 text-[12px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter ${labelColor}`}>
          {LabelIcon && <LabelIcon size={10} />}
          {labelText}
        </span>
      );
    } else if ((isMacro || isMicro) && dietThresholds && todayData.length > 0) {
      let labelText = "within diet req";
      let labelColor = "text-blue-500";
      let LabelIcon = null;

      if (dietThresholds.min !== undefined && currentAmount < dietThresholds.min) {
        labelText = "under diet req";
        labelColor = "text-red-500";
        LabelIcon = TrendingDown;
      } else if (dietThresholds.max !== undefined && currentAmount > dietThresholds.max) {
        labelText = "above diet req";
        labelColor = "text-emerald-500";
        LabelIcon = TrendingUp;
      }

      customLabelElement = (
        <span className={`flex items-center gap-1 text-[12px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter ${labelColor}`}>
          {LabelIcon && <LabelIcon size={10} />}
          {labelText}
        </span>
      );
    }

    if (['carbs', 'protein', 'fat'].includes(config.key) && dietThresholds && todayData.length > 0) {
      fractionsDisplay = (
        <div className="flex flex-col gap-0.5 mt-2">
          {dietThresholds.min && (
            <span className="text-[10px] font-bold text-blue-500">
              Min: {currentDisplay} / {dietThresholds.min.toFixed(0)} {config.unit}
            </span>
          )}
          {dietThresholds.max && (
            <span className="text-[10px] font-bold text-blue-500">
              Max: {currentDisplay} / {dietThresholds.max.toFixed(0)} {config.unit}
            </span>
          )}
        </div>
      );
    }

    return (
      <MetricGraph 
        key={config.key} 
        title={config.title} 
        unit={displayUnit} 
        unitToggle={renderToggle()}
        icon={config.icon}
        alertType={alertType}
        percentageDisplay={renderPercentage(config.key)}
        isAggregated={aggregatedKeys.includes(config.key)}
        customLabel={customLabelElement}
        fractionsDisplay={fractionsDisplay}
      >
        <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis {...rotatedXAxisProps} />
          
          <YAxis yAxisId="left" hide={viewMode === 'load'} domain={domain} axisLine={false} tickLine={false} tickFormatter={formatValue} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          {hasTotalLoad && (
            <YAxis yAxisId="right" orientation="right" hide={viewMode === '1rm'} domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={formatValue} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          )}

          <Tooltip 
            cursor={false} 
            wrapperStyle={{ pointerEvents: 'none' }} 
            labelFormatter={(val) => new Date(val).toLocaleString()}
            formatter={(value: any, name: any) => {
              const nameStr = String(name || '');
              const isLoad = nameStr.includes('totalLoad');
              const label = isLoad ? 'Total Load' : config.title;
              return [`${formatValue(value)} ${displayUnit}`, label];
            }}
          />
          {renderThresholdLines(config.thresholds, '', 0.7, "left")}
          
          {dietThresholds?.max && (
            <ReferenceLine 
              yAxisId="left"
              y={dietThresholds.max} 
              stroke="#3b82f6"
              strokeDasharray="4 4" 
              strokeWidth={1.5} 
              strokeOpacity={0.6}
              style={{ pointerEvents: 'none' }}
              label={{ 
                position: 'insideBottomLeft', 
                value: `${selectedDiet} Max`, 
                fill: '#3b82f6', 
                fontSize: 10, 
                fontWeight: 'bold',
                fillOpacity: 0.8
              }} 
            />
          )}
          {dietThresholds?.min && (
            <ReferenceLine 
              yAxisId="left"
              y={dietThresholds.min} 
              stroke="#3b82f6"
              strokeDasharray="4 4" 
              strokeWidth={1.5} 
              strokeOpacity={0.6}
              style={{ pointerEvents: 'none' }}
              label={{ 
                position: 'insideBottomLeft', 
                value: `${selectedDiet} Min`, 
                fill: '#3b82f6', 
                fontSize: 10, 
                fontWeight: 'bold',
                fillOpacity: 0.8
              }} 
            />
          )}

          {config.key === 'calories' && tdeeResult && tdeeResult > 0 && (
            <ReferenceLine 
              yAxisId="left"
              y={tdeeResult} 
              stroke={config.color}
              strokeDasharray="4 4" 
              strokeWidth={2} 
              strokeOpacity={0.8}
              style={{ pointerEvents: 'none' }}
              label={{ 
                position: 'insideBottomLeft', 
                value: 'Maintenance', 
                fill: config.color, 
                fontSize: 10, 
                fontWeight: 'bold',
                fillOpacity: 0.8
              }} 
            />
          )}

          {/* --- ADD BEST VALUE LINE HERE --- */}
          {renderBestValueLine()}
          
          {/* --- SWAPPED ORDER: totalLoad rendered FIRST so it goes underneath --- */}
          {hasTotalLoad && (viewMode === 'load' || viewMode === 'both') && (
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey={`${config.key}_totalLoad`} 
              stroke="#94a3b8" 
              strokeWidth={3}
              strokeDasharray="4 4"
              connectNulls 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps("#94a3b8", `${config.key}_totalLoad`)}
              activeDot={(props: any) => renderCustomActiveDot(props, "#94a3b8", `${config.key}_totalLoad`)}
            />
          )}

          {/* --- SWAPPED ORDER: main value rendered LAST so it sits on top --- */}
          {(viewMode === '1rm' || viewMode === 'both') && (
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey={config.key} 
              stroke={config.color} 
              strokeWidth={3} 
              connectNulls 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps(config.color, config.key)}
              activeDot={(props: any) => renderCustomActiveDot(props, config.color, config.key)}
            />
          )}
        </LineChart>
      </MetricGraph>
    );
  }

  if (graph.type === 'custom') {
    const { m, index } = graph;
    const alertType = getAlertType(m.key);
    const customColor = CUSTOM_COLORS[index % CUSTOM_COLORS.length];

    return (
      <MetricGraph 
        key={m.key} 
        title={m.name.toUpperCase()} 
        unit={displayUnit}
        unitToggle={renderToggle()}
        icon={<PlusCircle style={{ color: customColor }} />}
        alertType={alertType}
        percentageDisplay={renderPercentage(m.key)}
        isAggregated={aggregatedKeys.includes(m.key)}
      >
        <LineChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
          <XAxis {...rotatedXAxisProps} />
          
          <YAxis yAxisId="left" hide={viewMode === 'load'} domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={formatValue} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          {hasTotalLoad && (
            <YAxis yAxisId="right" orientation="right" hide={viewMode === '1rm'} domain={['auto', 'auto']} axisLine={false} tickLine={false} tickFormatter={formatValue} width={40} style={{ fontSize: '11px', fill: '#94a3b8', fontWeight: 'bold' }} />
          )}

          <Tooltip 
            cursor={false} 
            wrapperStyle={{ pointerEvents: 'none' }} 
            labelFormatter={(val) => new Date(val).toLocaleString()}
            formatter={(value: any, name: any) => {
              const nameStr = String(name || '');
              const isLoad = nameStr.includes('totalLoad');
              const label = isLoad ? 'Total Load' : m.name.toUpperCase();
              return [`${formatValue(value)} ${displayUnit}`, label];
            }}
          />

          {/* --- ADD BEST VALUE LINE HERE --- */}
          {renderBestValueLine()}
          
          {/* --- SWAPPED ORDER: totalLoad rendered FIRST so it goes underneath --- */}
          {hasTotalLoad && (viewMode === 'load' || viewMode === 'both') && (
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey={`${m.key}_totalLoad`} 
              stroke="#94a3b8" 
              strokeWidth={3} 
              strokeDasharray="4 4"
              connectNulls 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps("#94a3b8", `${m.key}_totalLoad`)}
              activeDot={(props: any) => renderCustomActiveDot(props, "#94a3b8", `${m.key}_totalLoad`)}
            />
          )}

          {/* --- SWAPPED ORDER: main value rendered LAST so it sits on top --- */}
          {(viewMode === '1rm' || viewMode === 'both') && (
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey={m.key} 
              stroke={customColor} 
              strokeWidth={3} 
              connectNulls 
              style={{ pointerEvents: 'none' }} 
              dot={commonDotProps(customColor, m.key)}
              activeDot={(props: any) => renderCustomActiveDot(props, customColor, m.key)}
            />
          )}
        </LineChart>
      </MetricGraph>
    );
  }

  return null;
};