import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { CompareData, CategoryComparison } from '../compareUtils';

// --- KEY MAPS & LOGIC ---
const LOWER_IS_BETTER_METRICS = new Set([
  'bpSyst', 'bpDias', 'hr', 'rr', 'temp', 'glucose', 'cholesterol', 'uricAcid', 'lactate',
  'speed100m', 'speed400m', 'speed1Mile'
]);

const VITAL_KEYS = new Set(['bpSyst', 'bpDias', 'hr', 'spo2', 'rr', 'temp']);
const BLOOD_TEST_KEYS = new Set(['glucose', 'cholesterol', 'ketones', 'uricAcid', 'lactate', 'hemoglobin', 'hematocrit']);
const STRENGTH_KEYS = new Set(['benchPress', 'squat', 'deadlift']);
const SPEED_KEYS = new Set(['speed100m', 'speed400m', 'speed1Mile', 'steps']);
const PHYSIO_KEYS = new Set(['shoulderExtRot', 'tibialisRaise', 'copenhagenPlank', 'assistedPistolSquat', 'singleLegRdl', 'towelScrunches', 'serratusPunch', 'pallofPress', 'nerveGlides', 'proneYtw']);
const YOGA_KEYS = new Set(['downwardDog', 'warrior1', 'warrior2', 'cobraPose', 'childsPose', 'treePose', 'pigeonPose', 'trianglePose', 'crowPose', 'savasana']);
const MOBILITY_KEYS = new Set(['worldsGreatestStretch', 'hip9090Switch', 'tSpineRotation', 'deepSquatHold', 'ankleDorsiflexion', 'cossackSquat', 'inchworms', 'shoulderPassThrough']);

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
      { title: 'Speed & Endurance', data: filterActiveTrends(data.exercises, SPEED_KEYS) },
      { title: 'Physiotherapy', data: filterActiveTrends(data.exercises, PHYSIO_KEYS) },
      { title: 'Yoga', data: filterActiveTrends(data.exercises, YOGA_KEYS) },
      { title: 'Mobility', data: filterActiveTrends(data.exercises, MOBILITY_KEYS) },
      { title: 'Standard Vitals', data: filterActiveTrends(data.vitals, VITAL_KEYS) },
      { title: 'Blood Tests', data: filterActiveTrends(data.vitals, BLOOD_TEST_KEYS) },
    ].filter(cat => cat.data.length > 0);
  }, [data]);

  const renderMetricTrend = (category: CategoryComparison) => {
    const isLowerBetter = LOWER_IS_BETTER_METRICS.has(category.metricKey);

    const sortedMembers = [...category.members]
      .filter(m => m.trendDelta !== null)
      .sort((a, b) => (b.trendDelta as number) - (a.trendDelta as number));

    if (sortedMembers.length === 0) return null;

    return (
      <div key={category.metricKey} className="mb-6 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm">
        <h4 className="font-bold text-slate-800 mb-4 uppercase tracking-wider text-xs">{category.metricName}</h4>
        <div className="space-y-3">
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
                    Z: {member.trendZScore !== null ? member.trendZScore.toFixed(2) : 'N/A'}
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
      <div className="mb-8 p-4 bg-purple-50 rounded-2xl border border-purple-100">
        <p className="text-sm text-purple-800 leading-relaxed">
          <strong>Trend Delta & Momentum:</strong> Measures your most recent velocity (Latest Entry minus Previous Entry) 
          and compares it against the group's average rate of change. Colors indicate if the direction of the trend is generally positive or negative for health metrics.
        </p>
      </div>

      {/* Stack blocks vertically inside the grid to manage spatial filling */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4 items-start">
        {processedCats.map((cat) => (
          <div key={cat.title} className="w-full">
            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
              <TrendingUp className="text-purple-500" /> {cat.title} Momentum
            </h3>
            {cat.data.map(renderMetricTrend)}
          </div>
        ))}
      </div>
    </div>
  );
};