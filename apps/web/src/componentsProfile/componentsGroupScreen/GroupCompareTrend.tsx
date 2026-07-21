import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { CompareData, CategoryComparison } from '../compareUtils';
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

// KEY MAPS
const VITAL_KEYS = new Set(Object.values(VITAL_KEY_MAP));
const BLOODTEST_KEYS = new Set(Object.values(BLOODTEST_KEY_MAP));
const SYMPTOM_KEYS = new Set(Object.values(SYMPTOM_KEY_MAP));
const DIET_KEYS = new Set(Object.values(DIET_KEY_MAP));
const MICRONUTRIENT_KEYS = new Set(Object.values(MICRONUTRIENT_KEY_MAP));
const STRENGTH_KEYS = new Set(Object.values(STRENGTH_KEY_MAP));
const SPEED_KEYS = new Set(Object.values(SPEED_KEY_MAP));
const PLYO_KEYS = new Set(Object.values(PLYO_KEY_MAP));
const ENDURANCE_KEYS = new Set(Object.values(ENDURANCE_KEY_MAP));
const YOGA_KEYS = new Set(Object.values(YOGA_KEY_MAP));
const MOBILITY_KEYS = new Set(Object.values(MOBILITY_KEY_MAP));
const PHYSIO_KEYS = new Set(Object.values(PHYSIO_KEY_MAP));

const LOWER_IS_BETTER_METRICS = new Set([
  ...SPEED_KEYS,
  SYMPTOM_KEY_MAP.PAIN,
  SYMPTOM_KEY_MAP.NAUSEA,
]);

interface Props {
  data: CompareData;
}

export const GroupCompareTrend: React.FC<Props> = ({ data }) => {
  const processedCats = useMemo(() => {
    const filterActiveTrends = (source: CategoryComparison[], keySet: Set<string>) => {
      return source
        .filter(metric => keySet.has(metric.metricKey))
        .filter(metric => metric.members.some(m => m.trendDelta !== null));
    };

    return [
      { title: 'Strength', data: filterActiveTrends(data.exercises, STRENGTH_KEYS) },
      { title: 'Speed', data: filterActiveTrends(data.exercises, SPEED_KEYS) },
      { title: 'Plyometrics', data: filterActiveTrends(data.exercises, PLYO_KEYS) },
      { title: 'Endurance', data: filterActiveTrends(data.exercises, ENDURANCE_KEYS) },
      { title: 'Physiotherapy', data: filterActiveTrends(data.exercises, PHYSIO_KEYS) },
      { title: 'Yoga', data: filterActiveTrends(data.exercises, YOGA_KEYS) },
      { title: 'Mobility', data: filterActiveTrends(data.exercises, MOBILITY_KEYS) },
      { title: 'Standard Vitals', data: filterActiveTrends(data.vitals, VITAL_KEYS) },
      { title: 'Blood Tests', data: filterActiveTrends(data.vitals, BLOODTEST_KEYS) },
      { title: 'Macronutrients', data: filterActiveTrends(data.vitals, DIET_KEYS) },
      { title: 'Micronutrients', data: filterActiveTrends(data.vitals, MICRONUTRIENT_KEYS) },
      { title: 'Symptoms', data: filterActiveTrends(data.vitals, SYMPTOM_KEYS) },
    ].filter(cat => cat.data.length > 0);
  }, [data]);

  const renderMetricTrend = (category: CategoryComparison) => {
    const isLowerBetter = LOWER_IS_BETTER_METRICS.has(category.metricKey);

    const sortedMembers = [...category.members]
      .filter(m => m.trendDelta !== null)
      .sort((a, b) => (b.trendDelta as number) - (a.trendDelta as number));

    if (sortedMembers.length === 0) return null;

    return (
      <div 
        key={category.metricKey} 
        className="mb-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm break-inside-avoid"
      >
        <h4 className="font-bold text-slate-800 mb-2 uppercase tracking-wider text-xs">
          {category.metricName}
        </h4>
        <div className="space-y-1.5">
          {sortedMembers.map((member) => {
            const delta = member.trendDelta as number;
            const isPositive = delta > 0;
            const isNegative = delta < 0;
            
            let trendColorClass = 'text-slate-500';
            if (isPositive) {
               trendColorClass = isLowerBetter ? 'text-rose-600' : 'text-emerald-600';
            } else if (isNegative) {
               trendColorClass = isLowerBetter ? 'text-emerald-600' : 'text-rose-600';
            }
            
            return (
              <div key={member.userId} className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{member.displayName}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400 w-16 text-right">
                    Z: {member.trendZScore !== null ? member.trendZScore.toFixed(2) : '0.00'}
                  </span>
                  <div className={`flex items-center gap-1 w-20 justify-end font-bold text-sm ${trendColorClass}`}>
                    {isPositive ? <TrendingUp size={14} /> : isNegative ? <TrendingDown size={14} /> : <Minus size={14} />}
                    {delta > 0 ? '+' : ''}{delta.toFixed(1)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="mb-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
        <p className="text-sm text-purple-800 leading-relaxed">
          <strong>Trend Delta & Momentum:</strong> Measures your most recent velocity 
          (Latest Entry vs. Previous Entry) and compares it against the group's average rate of change. 
          Colors reflect whether the movement is generally beneficial for that specific metric.
        </p>
      </div>

      <div className="columns-1 lg:columns-2 gap-x-8">
        {processedCats.map((cat) => (
          <div key={cat.title} className="w-full break-inside-avoid mb-6">
            <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
              <TrendingUp className="text-purple-500" /> {cat.title} Momentum
            </h3>
            {cat.data.map(renderMetricTrend)}
          </div>
        ))}
      </div>
    </div>
  );
};