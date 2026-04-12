// compareUtils.ts
export const VITAL_KEY_MAP: Record<string, string> = {
  'Systolic BP': 'bpSyst',
  'Diastolic BP': 'bpDias',
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

export const DIET_KEY_MAP: Record<string, string> = {
  'Calories': 'calories',
  'Carbohydrates': 'carbs',
  'Protein': 'protein',
  'Fat': 'fat',
  'Sodium': 'sodium',
  'Fiber': 'fiber'
};

export const STRENGTH_KEY_MAP: Record<string, string> = {
  'Squat': 'squat',
  'Front Squat': 'frontSquat',
  'Overhead Squat': 'overheadSquat',
  'Deadlift': 'deadlift',
  'Power Clean': 'powerClean',
  'Clean and Jerk': 'cleanAndJerk',
  'Snatch': 'snatch',
  'Bench Press': 'benchPress',
  'Incline Press': 'inclinePress',
  'Overhead Press': 'overheadPress',
  'Pull-ups': 'pull-ups',
  'Dips': 'dips',
  'Barbell Forward Lunge': 'bbForwardLunge',
  'Barbell Reverse Lunge': 'bbReverseLunge',
  'Barbell Tricep Extension': 'bbTriExt',
  'Barbell Bicep Curl': 'bbBicepCurl',
  'Dumbbell Forward Lunge': 'dbForwardLunge',
  'Dumbbell Reverse Lunge': 'dbReverseLunge',
  'Dumbbell Press': 'dbPress',
  'Dumbbell Incline Press': 'dbInclinePress',
  'Dumbbell Overhead Press': 'dbOverheadPress',
  'Dumbbell Tricep Extension': 'dbTriExt',
  'Dumbbell Bicep Curl': 'dbBicepCurl',
};

export const SPEED_KEY_MAP: Record<string, string> = {
  '100m': 'speed100m',
  '400m': 'speed400m',
  '1 mile': 'speed1Mile',
  '10k': 'speed10k',
  'Half Marathon': 'halfMarathon',
  'Marathon': 'marathon',
  'bike 400m': 'bike400m',
  'bike 1 mile': 'bike1Mile',
  'rowing machine 400m': 'row400m',
  'rowing machine 1 mile': 'row1Mile',
};

export const PLYO_KEY_MAP: Record<string, string> = {
  'Box Jump': 'boxJump',
  'Broad Jump': 'broadJump',
  'Burpees': 'burpees',
  'Depth Jumps': 'depthJump',
  'Clap Push-ups': 'clapPushUp',
  'Vertical Leap': 'verticalLeap'
};

export const ENDURANCE_KEY_MAP: Record<string, string> = {
  'Push-ups': 'pushUp',
  'Single Leg Squat': 'pistolSquat',
  'Air Squat': 'airSquat',
  'Plank': 'plank',
  'Bear Crawl': 'bearCrawl',
  'Hollow Body Hold': 'hollowHold',
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
  'Steps' : 'steps',
  'Worlds Greatest Stretch': 'worldsGreatestStretch',
  '90/90 Hip Switch': 'hip9090Switch',
  'Thoracic Rotations': 'tSpineRotation',
  'Deep Squat Hold': 'deepSquatHold',
  'Ankle Dorsiflexion': 'ankleDorsiflexion',
  'Cossack Squat': 'cossackSquat',
  'Inchworms': 'inchworms',
  'Shoulder Pass-Throughs': 'shoulderPassThrough'
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