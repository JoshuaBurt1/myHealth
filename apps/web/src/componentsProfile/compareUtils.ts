export const VITAL_KEY_MAP: Record<string, string> = {
  'Systolic BP (mmHg)': 'bpSyst',
  'Diastolic BP (mmHg)': 'bpDias',
  'Heart Rate': 'hr',
  'O2 Saturation': 'spo2',
  'Resp. Rate': 'rr',
  'Temp': 'temp',
  'Glucose': 'glucose',
  'Cholesterol': 'cholesterol',
  'Ketones': 'ketones',
  'Uric Acid': 'uricAcid',
  'Lactate': 'lactate',
  'Hemoglobin': 'hemoglobin',
  'Hematocrit': 'hematocrit'
};

export const STRENGTH_KEY_MAP: Record<string, string> = {
  'Bench Press': 'benchPress',
  'Squat': 'squat',
  'Deadlift': 'deadlift'
};

export const SPEED_KEY_MAP: Record<string, string> = {
  '100m': 'speed100m',
  '400m': 'speed400m',
  '1 mile': 'speed1Mile',
  'Steps' : 'steps'
};

export const PHYSIO_KEY_MAP: Record<string, string> = {
  'Shoulder External Rotation': 'shoulderExtRot',
  'Tibialis Raise': 'tibialisRaise',
  'Copenhagen Plank': 'copenhagenPlank',
  'Pistol Squat (Assisted)': 'assistedPistolSquat',
  'Single-Leg RDL': 'singleLegRdl',
  'Towel Scrunches': 'towelScrunches',
  'Serratus Punch': 'serratusPunch',
  'Pallof Press': 'pallofPress',
  'Nerve Glides': 'nerveGlides',
  'Prone Y-T-W': 'proneYtw'
};

export const YOGA_KEY_MAP: Record<string, string> = {
  'Downward Dog': 'downwardDog',
  'Warrior I': 'warrior1',
  'Warrior II': 'warrior2',
  'Cobra Pose': 'cobraPose',
  'Childs Pose': 'childsPose',
  'Tree Pose': 'treePose',
  'Pigeon Pose': 'pigeonPose',
  'Triangle Pose': 'trianglePose',
  'Crow Pose': 'crowPose',
  'Savasana': 'savasana'
};

export const MOBILITY_KEY_MAP: Record<string, string> = {
  'Worlds Greatest Stretch': 'worldsGreatestStretch',
  '90/90 Hip Switch': 'hip9090Switch',
  'Thoracic Rotations': 'tSpineRotation',
  'Deep Squat Hold': 'deepSquatHold',
  'Ankle Dorsiflexion': 'ankleDorsiflexion',
  'Cossack Squat': 'cossackSquat',
  'Inchworms': 'inchworms',
  'Shoulder Pass-Throughs': 'shoulderPassThrough'
};

export const EXERCISE_KEY_MAP = {
  ...STRENGTH_KEY_MAP,
  ...SPEED_KEY_MAP,
  ...PHYSIO_KEY_MAP,
  ...YOGA_KEY_MAP,
  ...MOBILITY_KEY_MAP
};

// --- Interfaces ---
export interface MetricComparison {
  userId: string;
  displayName: string;
  recentValue: number | null;
  avgValue: number | null;
  recentZScore: number | null;
  avgZScore: number | null;
  recentPercentile: number | null;
  avgPercentile: number | null;
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

// --- Math Helpers ---
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
  if (sd === 0) return 0; // If everyone has the exact same score, Z is 0
  return (val - meanVal) / sd;
};

export const calcPercentile = (arr: number[], val: number) => {
  if (arr.length <= 1) return 50; 
  const below = arr.filter(v => v < val).length;
  const equal = arr.filter(v => v === val).length;
  // Standard fractional ranking percentile
  return ((below + (0.5 * equal)) / arr.length) * 100; 
};

/**
 * Robust extractor for user_data fields which might be an array of numbers, 
 * an array of objects { value, date }, or just a single scalar number.
 */
export const extractValues = (data: any, key: string): number[] => {
  const val = data?.[key];
  if (Array.isArray(val)) {
    return val.map(v => typeof v === 'object' ? v.value : v).filter(v => typeof v === 'number');
  } else if (typeof val === 'number') {
    return [val];
  }
  return [];
};