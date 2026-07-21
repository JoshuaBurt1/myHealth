// compareUtils.ts

// Interfaces
export interface MetricComparison {
  userId: string;
  displayName: string;
  recentValue: number | null;
  avgValue: number | null;
  recentZScore: number | null;
  avgZScore: number | null;
  recentVsAvgZScore: number | null;
  trendDelta: number | null; 
  trendZScore: number | null; 
  allTimeHigh: number | null;
  allTimeHighDate: string | null;
  allTimeLow: number | null;
  allTimeLowDate: string | null;
}

export interface CategoryComparison {
  metricName: string;
  metricKey: string;
  members: MetricComparison[];
}

export interface CompareData {
  vitals: CategoryComparison[];
  exercises: CategoryComparison[];
}

export const calcMean = (arr: number[]) => {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
};

export const calcStdDev = (arr: number[], meanVal: number) => {
  if (arr.length <= 1) return 0;
  const variance = arr.reduce((a, b) => a + Math.pow(b - meanVal, 2), 0) / (arr.length - 1);
  return Math.sqrt(variance);
};

export const calcZScore = (val: number, meanVal: number, sd: number) => {
  if (sd === 0) return 0; 
  return (val - meanVal) / sd;
};

/**
 * Extracts data values for distribution calculations
 */
export const extractValues = (data: any, key: string): number[] => {
  const val = data?.[key];
  if (Array.isArray(val)) {
    return val
      .map(v => {
        const rawValue = typeof v === 'object' ? v.value : v;
        return parseFloat(rawValue);
      })
      .filter(v => !isNaN(v) && typeof v === 'number');
  } else if (val !== undefined && val !== null) {
    const num = parseFloat(val);
    return isNaN(num) ? [] : [num];
  }
  return [];
};

/**
 * Extracts  data values and associated dates for All-Time records
 */
export const extractDetailedValues = (data: any, key: string): { value: number, date?: string }[] => {
  const val = data?.[key];
  if (Array.isArray(val)) {
    return val
      .map(v => {
        const rawValue = typeof v === 'object' ? v.value : v;
        const date = typeof v === 'object' ? v.date : undefined;
        return { value: parseFloat(rawValue), date };
      })
      .filter(v => !isNaN(v.value) && typeof v.value === 'number');
  } else if (val !== undefined && val !== null) {
    const num = parseFloat(val);
    return isNaN(num) ? [] : [{ value: num }];
  }
  return [];
};