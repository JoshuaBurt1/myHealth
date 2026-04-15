// profileConstants.tsx
import {
  Heart, Wind, Droplets, Thermometer, TestTube, Activity,
  User, Ruler, Scale, Dumbbell, Timer, Footprints,
  ChevronUp, Shield, Accessibility, Anchor, Fingerprint, Target, ArrowLeftRight, Zap, Move,
  Sun, Sword, Moon, TreePine, Bird, Triangle, Bed, Clock, MessageSquare, BatteryLow,
  Globe, RefreshCw, RotateCcw, ArrowDown, MoveDown, Split, Bug, Repeat,
  Pizza, Drumstick, Salad, Waves, GlassWater, Stars, Eye
} from 'lucide-react';

export interface MetricThresholds {
  warningHigh?: number;
  warningLow?: number;
  criticalHigh?: number;
  criticalLow?: number;
}

export const BP_THRESHOLDS = {
  systolic: { warningHigh: 130, warningLow: 90, criticalHigh: 180, criticalLow: 70 } as MetricThresholds,
  diastolic: { warningHigh: 84, warningLow: 60, criticalHigh: 120, criticalLow: 40 } as MetricThresholds
};

export const VITAL_KEY_MAP: Record<string, string> = {
  'Systolic BP': 'bpSyst',
  'Diastolic BP': 'bpDias',
  'Heart Rate': 'hr',
  'O2 Saturation': 'spo2',
  'Resp. Rate': 'rr',
  'Temp': 'temp'
};

export const BLOODTEST_KEY_MAP: Record<string, string> = {
  'Glucose': 'glucose',
  'Cholesterol': 'cholesterol',
  'Ketones': 'ketones',
  'Uric Acid': 'uricAcid',
  'Lactate': 'lactate',
  'Hemoglobin': 'hemoglobin',
  'Hematocrit': 'hematocrit'
};

export const SYMPTOM_KEY_MAP: Record<string, string> = {
  'Nausea': 'nausea',
  'Pain': 'pain',
  'Last bowel movement': 'lastBm',
  'Cough': 'cough',
  'Fatigue': 'fatigue',
  'Dizziness': 'dizziness',
  'Shortness of Breath': 'dyspnea'
};

export const DIET_TYPES_MAP: Record<string, any> = {
  'Food Guide': {
    carbs: { min: 0.45, max: 0.65 },
    fat: { min: 0.20, max: 0.35 },
    protein: { min: 0.10, max: 0.35 }
  },
  'Mediterranean': {
    carbs: { min: 0.40, max: 0.50 },
    fat: { min: 0.30, max: 0.40 },
    protein: { min: 0.15, max: 0.20 }
  },
  'High-Protein Fitness': {
    carbs: { min: 0.20, max: 0.40 },
    fat: { min: 0.20, max: 0.30 },
    protein: { min: 0.30, max: 0.50 }
  },
  'Keto': {
    carbs: { min: 0.05, max: 0.10 },
    fat: { min: 0.70, max: 0.80 },
    protein: { min: 0.15, max: 0.25 }
  },
  'DASH': {
    carbs: { min: 0.50, max: 0.60 },
    fat: { min: 0.20, max: 0.30 },
    protein: { min: 0.15, max: 0.20 },
    sodium: { max: 2300 }
  },
  'Kidney Health': {
    carbs: { min: 0.45, max: 0.60 },
    fat: { min: 0.25, max: 0.35 },
    protein: { min: 0.10, max: 0.20 },
    sodium: { max: 2000 },
    potassium: { max: 2000 },
    phosphorus: { max: 1000 }
  }
};

export const DIET_KEY_MAP: Record<string, string> = {
  'Calories': 'calories',
  'Carbohydrates': 'carbs',
  'Protein': 'protein',
  'Fat': 'fat',
  'Saturated Fat': 'sat_fat',
  'Trans Fat': 'trans_fat',
  'Sugar': 'sugar',
  'Cholesterol': 'diet_cholesterol',
  'Sodium': 'sodium',
  'Fiber': 'fiber'
};

export const MICRONUTRIENT_KEY_MAP: Record<string, string> = {
  // Minerals
  'Calcium': 'calcium',
  'Iron': 'iron',
  'Magnesium': 'magnesium',
  'Potassium': 'potassium',
  'Zinc': 'zinc',
  'Phosphorus': 'phosphorus',
  'Copper': 'copper',
  'Manganese': 'manganese',
  // Vitamins
  'Vitamin A': 'vit_a',
  'Vitamin C': 'vit_c',
  'Vitamin D': 'vit_d',
  'Vitamin E': 'vit_e',
  'Vitamin K': 'vit_k',
  'Vitamin B1 (Thiamin)': 'vit_b1',
  'Vitamin B2 (Riboflavin)': 'vit_b2',
  'Vitamin B3 (Niacin)': 'vit_b3',
  'Vitamin B6': 'vit_b6',
  'Vitamin B12': 'vit_b12',
  'Folate': 'folate',
  'Biotin': 'biotin',
  // Performance
  'Caffeine': 'caffeine',
  'Creatine': 'creatine',
  'Alcohol': 'alcohol',
  'Omega-3': 'omega_3',
  'Water': 'water_intake'
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
  'Bike 400m': 'bike400m',
  'Bike 1 mile': 'bike1Mile',
  'Rowing machine 400m': 'row400m',
  'Rowing machine 1 mile': 'row1Mile',
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

export const VITAL_LIST = Object.keys(VITAL_KEY_MAP);
export const DIET_LIST = Object.keys(DIET_KEY_MAP);
export const STRENGTH_LIST = Object.keys(STRENGTH_KEY_MAP);
export const SPEED_LIST = Object.keys(SPEED_KEY_MAP);
export const PLYO_LIST = Object.keys(PLYO_KEY_MAP);
export const ENDURANCE_LIST = Object.keys(ENDURANCE_KEY_MAP);
export const YOGA_LIST = Object.keys(YOGA_KEY_MAP);
export const MOBILITY_LIST = Object.keys(MOBILITY_KEY_MAP);
export const PHYSIO_LIST = Object.keys(PHYSIO_KEY_MAP);

export const SINGLE_GRAPHS = [
  // Core Vitals
  { key: 'hr', title: 'HEART RATE', unit: 'BPM', icon: <Heart className="text-red-500" />, color: '#ef4444', thresholds: { warningHigh: 100, warningLow: 50, criticalHigh: 120, criticalLow: 40 } as MetricThresholds },
  { key: 'rr', title: 'RESPIRATION RATE', unit: 'Breaths/min', icon: <Wind className="text-blue-500" />, color: '#3b82f6', thresholds: { warningHigh: 22, warningLow: 12, criticalHigh: 26, criticalLow: 8 } as MetricThresholds },
  { key: 'spo2', title: 'OXYGEN SATURATION', unit: '%', icon: <Droplets className="text-emerald-500" />, color: '#10b981', domain: [90, 100] as [number, number], thresholds: { warningLow: 95, criticalLow: 92 } as MetricThresholds },
  { key: 'temp', title: 'BODY TEMPERATURE', unit: '°C', icon: <Thermometer className="text-amber-500" />, color: '#f59e0b', domain: [30, 43] as [number, number], thresholds: { warningHigh: 38.5, warningLow: 35.0, criticalHigh: 40, criticalLow: 34.0 } as MetricThresholds },
  
  // Blood & Metabolic
  { key: 'glucose', title: 'GLUCOSE', unit: 'mmol/L', icon: <TestTube className="text-rose-500" />, color: '#f43f5e', thresholds: { warningHigh: 7.2, warningLow: 3.9, criticalHigh: 10, criticalLow: 3.5 } as MetricThresholds },
  { key: 'cholesterol', title: 'CHOLESTEROL', unit: 'mg/dL', icon: <Activity className="text-yellow-500" />, color: '#eab308' },
  { key: 'ketones', title: 'KETONES', unit: 'mmol/L', icon: <TestTube className="text-purple-500" />, color: '#a855f7', thresholds: { warningHigh: 0.6, criticalHigh: 1.6 } as MetricThresholds },
  { key: 'uricAcid', title: 'URIC ACID', unit: 'mg/dL', icon: <Droplets className="text-cyan-500" />, color: '#06b6d4', thresholds: { warningHigh: 6.8, criticalHigh: 7.0 } as MetricThresholds },
  { key: 'lactate', title: 'LACTATE', unit: 'mmol/L', icon: <Activity className="text-teal-500" />, color: '#14b8a6' },
  { key: 'hemoglobin', title: 'HEMOGLOBIN', unit: 'g/dL', icon: <Droplets className="text-red-600" />, color: '#dc2626', thresholds: { warningLow: 12.0, criticalLow: 7.0 } as MetricThresholds },
  { key: 'hematocrit', title: 'HEMATOCRIT', unit: '%', icon: <Activity className="text-red-700" />, color: '#b91c1c' },

  // Symptoms & GI
  { key: 'nausea', 
    title: 'NAUSEA', 
    unit: '/10', 
    icon: <Droplets className="text-lime-500" />, 
    color: '#84cc16', 
    domain: [0, 10] as [number, number], 
    thresholds: { warningHigh: 4, criticalHigh: 7 } as MetricThresholds 
  },
  { 
    key: 'pain', 
    title: 'PAIN LEVEL', 
    unit: '/10', 
    icon: <Zap className="text-orange-500" />, 
    color: '#f97316', 
    domain: [0, 10] as [number, number], 
    thresholds: { warningHigh: 5, criticalHigh: 8 } as MetricThresholds 
  },
  { 
    key: 'lastBm', 
    title: 'LAST BOWEL MOVEMENT', 
    unit: 'Time', 
    icon: <Clock className="text-slate-500" />, 
    color: '#64748b' 
  },
  { 
    key: 'cough', 
    title: 'COUGH INTENSITY', 
    unit: '/10', 
    icon: <MessageSquare className="text-slate-400" />, 
    color: '#94a3b8', 
    domain: [0, 10] as [number, number],
    thresholds: { warningHigh: 4, criticalHigh: 7 } as MetricThresholds 
  },
  { 
    key: 'fatigue', 
    title: 'FATIGUE', 
    unit: '/10', 
    icon: <BatteryLow className="text-indigo-500" />, 
    color: '#6366f1', 
    domain: [0, 10] as [number, number],
    thresholds: { warningHigh: 6, criticalHigh: 8 } as MetricThresholds 
  },
  { 
    key: 'dizziness', 
    title: 'DIZZINESS', 
    unit: '/10', 
    icon: <RefreshCw className="text-violet-500" />, 
    color: '#8b5cf6', 
    domain: [0, 10] as [number, number],
    thresholds: { warningHigh: 4, criticalHigh: 7 } as MetricThresholds 
  },
  { 
    key: 'dyspnea', 
    title: 'SHORTNESS OF BREATH', 
    unit: '/10', 
    icon: <Wind className="text-sky-500" />, 
    color: '#0ea5e9', 
    domain: [0, 10] as [number, number],
    thresholds: { warningHigh: 4, criticalHigh: 6 } as MetricThresholds 
  },
  
  // Diet & Nutrition
  { key: 'calories', title: 'CALORIES', unit: 'kcal', icon: <Scale className="text-orange-500" />, color: '#f97316' },
  { key: 'carbs', title: 'CARBOHYDRATES', unit: 'g', icon: <Pizza className="text-yellow-600" />, color: '#ca8a04' },
  { key: 'protein', title: 'PROTEIN', unit: 'g', icon: <Drumstick className="text-rose-700" />, color: '#be123c' },
  { key: 'fat', title: 'TOTAL FAT', unit: 'g', icon: <Droplets className="text-amber-500" />, color: '#f59e0b' },
  { key: 'sodium', title: 'SODIUM', unit: 'mg', icon: <Waves className="text-blue-400" />, color: '#60a5fa', thresholds: { warningHigh: 2300, criticalHigh: 3400 } as MetricThresholds },
  { key: 'fiber', title: 'FIBER', unit: 'g', icon: <Salad className="text-emerald-600" />, color: '#059669', thresholds: { warningLow: 25, criticalLow: 15 } as MetricThresholds },
  { key: 'sugar', title: 'SUGAR', unit: 'g', icon: <Pizza className="text-pink-500" />, color: '#ec4899', thresholds: { warningHigh: 50, criticalHigh: 100 } as MetricThresholds },
  { key: 'sat_fat', title: 'SATURATED FAT', unit: 'g', icon: <Droplets className="text-red-500" />, color: '#ef4444', thresholds: { warningHigh: 20, criticalHigh: 30 } as MetricThresholds },
  { key: 'trans_fat', title: 'TRANS FAT', unit: 'g', icon: <Activity className="text-red-700" />, color: '#b91c1c', thresholds: { warningHigh: 0, criticalHigh: 2 } as MetricThresholds },
  { key: 'diet_cholesterol', title: 'CHOLESTEROL', unit: 'mg', icon: <Activity className="text-yellow-600" />, color: '#ca8a04', thresholds: { warningHigh: 300 } as MetricThresholds },

  // Minerals (mg)
  { key: 'calcium', title: 'CALCIUM', unit: 'mg', icon: <Shield className="text-slate-400" />, color: '#94a3b8', thresholds: { warningLow: 1000, criticalLow: 700, warningHigh: 2500 } as MetricThresholds },
  { key: 'iron', title: 'IRON', unit: 'mg', icon: <Anchor className="text-stone-500" />, color: '#78716c', thresholds: { warningLow: 8, criticalLow: 5, warningHigh: 45 } as MetricThresholds },
  { key: 'magnesium', title: 'MAGNESIUM', unit: 'mg', icon: <Zap className="text-indigo-400" />, color: '#818cf8', thresholds: { warningLow: 310, criticalLow: 200, warningHigh: 400 } as MetricThresholds },
  { key: 'potassium', title: 'POTASSIUM', unit: 'mg', icon: <Waves className="text-orange-400" />, color: '#fb923c', thresholds: { warningLow: 3400, criticalLow: 2500 } as MetricThresholds },
  { key: 'zinc', title: 'ZINC', unit: 'mg', icon: <Shield className="text-blue-300" />, color: '#93c5fd', thresholds: { warningLow: 8, warningHigh: 40 } as MetricThresholds },
  { key: 'phosphorus', title: 'PHOSPHORUS', unit: 'mg', icon: <Activity className="text-purple-400" />, color: '#c084fc' },
  { key: 'copper', title: 'COPPER', unit: 'mg', icon: <Shield className="text-orange-300" />, color: '#fdba74' },
  { key: 'manganese', title: 'MANGANESE', unit: 'mg', icon: <Shield className="text-teal-300" />, color: '#5eead4' },
  
  // Vitamins (mcg)
  { key: 'vit_a', title: 'VITAMIN A', unit: 'mcg', icon: <Eye className="text-emerald-500" />, color: '#10b981', thresholds: { warningLow: 700, warningHigh: 3000 } as MetricThresholds },
  { key: 'vit_d', title: 'VITAMIN D', unit: 'mcg', icon: <Sun className="text-yellow-400" />, color: '#facc15', thresholds: { warningLow: 15, criticalLow: 10, warningHigh: 100 } as MetricThresholds },
  { key: 'vit_k', title: 'VITAMIN K', unit: 'mcg', icon: <Droplets className="text-green-600" />, color: '#16a34a', thresholds: { warningLow: 90 } as MetricThresholds },
  { key: 'vit_b12', title: 'VITAMIN B12', unit: 'mcg', icon: <Zap className="text-pink-500" />, color: '#ec4899', thresholds: { warningLow: 2.4 } as MetricThresholds },
  { key: 'folate', title: 'FOLATE', unit: 'mcg', icon: <Salad className="text-green-500" />, color: '#22c55e', thresholds: { warningLow: 400, criticalLow: 200 } as MetricThresholds },
  { key: 'biotin', title: 'BIOTIN', unit: 'mcg', icon: <Stars className="text-fuchsia-400" />, color: '#e879f9', thresholds: { warningLow: 30 } as MetricThresholds },

  // Vitamins (mg)
  { key: 'vit_c', title: 'VITAMIN C', unit: 'mg', icon: <Zap className="text-orange-500" />, color: '#f97316', thresholds: { warningLow: 75, warningHigh: 2000 } as MetricThresholds },
  { key: 'vit_e', title: 'VITAMIN E', unit: 'mg', icon: <Shield className="text-yellow-600" />, color: '#ca8a04', thresholds: { warningLow: 15, warningHigh: 1000 } as MetricThresholds },
  { key: 'vit_b1', title: 'VITAMIN B1', unit: 'mg', icon: <Activity className="text-blue-500" />, color: '#3b82f6' },
  { key: 'vit_b2', title: 'VITAMIN B2', unit: 'mg', icon: <Activity className="text-cyan-500" />, color: '#06b6d4' },
  { key: 'vit_b3', title: 'VITAMIN B3', unit: 'mg', icon: <Activity className="text-teal-500" />, color: '#14b8a6', thresholds: { warningHigh: 35 } as MetricThresholds },
  { key: 'vit_b6', title: 'VITAMIN B6', unit: 'mg', icon: <Zap className="text-indigo-500" />, color: '#6366f1', thresholds: { warningHigh: 100 } as MetricThresholds },

  // Performance & Others
  { key: 'caffeine', title: 'CAFFEINE', unit: 'mg', icon: <Zap className="text-amber-700" />, color: '#b45309', thresholds: { warningHigh: 400, criticalHigh: 600 } as MetricThresholds },
  { key: 'creatine', title: 'CREATINE', unit: 'g', icon: <Dumbbell className="text-slate-500" />, color: '#64748b' },
  { key: 'omega_3', title: 'OMEGA-3', unit: 'g', icon: <Waves className="text-cyan-600" />, color: '#0891b2', thresholds: { warningLow: 1.1 } as MetricThresholds },
  { key: 'alcohol', title: 'ALCOHOL', unit: 'units', icon: <GlassWater className="text-red-400" />, color: '#f87171', thresholds: { warningHigh: 2, criticalHigh: 4 } as MetricThresholds },
  { key: 'water_intake', title: 'WATER', unit: 'ml', icon: <Droplets className="text-blue-500" />, color: '#3b82f6', thresholds: { warningLow: 2000, criticalLow: 1000 } as MetricThresholds },

  // Body Measurements
  { key: 'age', title: 'AGE', unit: 'Years', icon: <User className="text-slate-500" />, color: '#64748b' },
  { key: 'height', title: 'HEIGHT', unit: 'cm', icon: <Ruler className="text-blue-400" />, color: '#60a5fa' },
  { key: 'weight', title: 'WEIGHT', unit: 'kg', icon: <Scale className="text-emerald-400" />, color: '#34d399' },
  
  // Strength
  { key: 'benchPress', title: 'BENCH PRESS', unit: 'kg', icon: <Dumbbell className="text-indigo-600" />, color: '#4f46e5' },
  { key: 'inclinePress', title: 'INCLINE PRESS', unit: 'kg', icon: <Dumbbell className="text-indigo-600" />, color: '#4f46e5' },
  { key: 'overheadPress', title: 'OVERHEAD PRESS', unit: 'kg', icon: <Dumbbell className="text-indigo-600" />, color: '#4f46e5' },
  { key: 'squat', title: 'SQUAT', unit: 'kg', icon: <Dumbbell className="text-indigo-700" />, color: '#4338ca' },
  { key: 'frontSquat', title: 'FRONT SQUAT', unit: 'kg', icon: <Dumbbell className="text-indigo-700" />, color: '#4338ca' },
  { key: 'overheadSquat', title: 'OVERHEAD SQUAT', unit: 'kg', icon: <Dumbbell className="text-indigo-700" />, color: '#4338ca' },
  { key: 'deadlift', title: 'DEADLIFT', unit: 'kg', icon: <Dumbbell className="text-indigo-800" />, color: '#3730a3' },
  { key: 'pull-ups', title: 'PULL-UPS', unit: 'kg', icon: <Activity className="text-slate-600" />, color: '#475569' },
  { key: 'dips', title: 'DIPS', unit: 'kg', icon: <Activity className="text-slate-600" />, color: '#475569' },
  
  // Olympic / Explosive Lifts
  { key: 'powerClean', title: 'POWER CLEAN', unit: 'kg', icon: <Zap className="text-amber-500" />, color: '#f59e0b' },
  { key: 'cleanAndJerk', title: 'CLEAN AND JERK', unit: 'kg', icon: <Zap className="text-amber-600" />, color: '#d97706' },
  { key: 'snatch', title: 'SNATCH', unit: 'kg', icon: <Zap className="text-amber-700" />, color: '#b45309' },
  
  // Barbell Accessories
  { key: 'bbForwardLunge', title: 'BARBELL FORWARD LUNGE', unit: 'kg', icon: <Dumbbell className="text-indigo-500" />, color: '#6366f1' },
  { key: 'bbReverseLunge', title: 'BARBELL REVERSE LUNGE', unit: 'kg', icon: <Dumbbell className="text-indigo-500" />, color: '#6366f1' },
  { key: 'bbTriExt', title: 'BARBELL TRICEP EXTENSION', unit: 'kg', icon: <Dumbbell className="text-indigo-400" />, color: '#818cf8' },
  { key: 'bbBicepCurl', title: 'BARBELL BICEP CURL', unit: 'kg', icon: <Dumbbell className="text-indigo-400" />, color: '#818cf8' },
  
  // Dumbbell Accessories
  { key: 'dbForwardLunge', title: 'DUMBBELL FORWARD LUNGE', unit: 'kg', icon: <Dumbbell className="text-blue-600" />, color: '#2563eb' },
  { key: 'dbReverseLunge', title: 'DUMBBELL REVERSE LUNGE', unit: 'kg', icon: <Dumbbell className="text-blue-600" />, color: '#2563eb' },
  { key: 'dbPress', title: 'DUMBBELL PRESS', unit: 'kg', icon: <Dumbbell className="text-blue-500" />, color: '#3b82f6' },
  { key: 'dbInclinePress', title: 'DUMBBELL INCLINE PRESS', unit: 'kg', icon: <Dumbbell className="text-blue-500" />, color: '#3b82f6' },
  { key: 'dbOverheadPress', title: 'DUMBBELL OVERHEAD PRESS', unit: 'kg', icon: <Dumbbell className="text-blue-500" />, color: '#3b82f6' },
  { key: 'dbTriExt', title: 'DUMBBELL TRICEP EXTENSION', unit: 'kg', icon: <Dumbbell className="text-blue-400" />, color: '#60a5fa' },
  { key: 'dbBicepCurl', title: 'DUMBBELL BICEP CURL', unit: 'kg', icon: <Dumbbell className="text-blue-400" />, color: '#60a5fa' },
  
  // Speed
  { key: 'speed100m', title: '100M SPRINT', unit: 'Seconds', icon: <Timer className="text-orange-500" />, color: '#f97316' },
  { key: 'speed400m', title: '400M SPRINT', unit: 'Seconds', icon: <Timer className="text-orange-600" />, color: '#ea580c' },
  { key: 'speed1Mile', title: '1 MILE RUN', unit: 'Minutes', icon: <Timer className="text-orange-700" />, color: '#c2410c' },
  { key: 'speed10k', title: '10K RUN', unit: 'Minutes', icon: <Activity className="text-orange-800" />, color: '#9a3412' },
  { key: 'halfMarathon', title: 'HALF MARATHON', unit: 'Hours', icon: <Activity className="text-red-800" />, color: '#991b1b' },
  { key: 'marathon', title: 'MARATHON', unit: 'Hours', icon: <Activity className="text-red-900" />, color: '#7f1d1d' },
  
  // Cycling
  { key: 'bike400m', title: 'BIKE 400M', unit: 'Seconds', icon: <Zap className="text-lime-500" />, color: '#84cc16' },
  { key: 'bike1Mile', title: 'BIKE 1 MILE', unit: 'Seconds', icon: <Zap className="text-lime-600" />, color: '#65a30d' },
  
  // Rowing
  { key: 'row400m', title: 'ROW 400M', unit: 'Seconds', icon: <Anchor className="text-blue-500" />, color: '#3b82f6' },
  { key: 'row1Mile', title: 'ROW 1 MILE', unit: 'Seconds', icon: <Anchor className="text-blue-600" />, color: '#2563eb' },

  // Plyometrics
  { key: 'boxJump', title: 'BOX JUMP', unit: 'cm', icon: <ChevronUp className="text-amber-400" />, color: '#fbbf24' },
  { key: 'broadJump', title: 'BROAD JUMP', unit: 'cm', icon: <ArrowLeftRight className="text-amber-500" />, color: '#f59e0b' },
  { key: 'verticalLeap', title: 'VERTICAL LEAP', unit: 'cm', icon: <Zap className="text-amber-300" />, color: '#fcd34d' },
  { key: 'burpees', title: 'BURPEES', unit: 'Reps', icon: <Activity className="text-amber-600" />, color: '#d97706' },
  { key: 'clapPushUp', title: 'CLAP PUSH-UP', unit: 'Reps', icon: <Zap className="text-amber-500" />, color: '#f59e0b' },

  // ENDURANCE
  { key: 'steps', title: 'Steps', unit: 'steps', icon: <Footprints className="text-cyan-500" />, color: '#0891b2' },
  { key: 'pushUp', title: 'PUSH-UPS', unit: 'Reps', icon: <User className="text-rose-500" />, color: '#f43f5e' },
  { key: 'pistolSquat', title: 'SINGLE LEG SQUAT', unit: 'Reps', icon: <Accessibility className="text-rose-600" />, color: '#e11d48' },
  { key: 'airSquat', title: 'AIR SQUAT', unit: 'Reps', icon: <Move className="text-rose-400" />, color: '#fb7185' },
  { key: 'plank', title: 'PLANK', unit: 'Seconds', icon: <Timer className="text-slate-600" />, color: '#475569' },
  { key: 'hollowHold', title: 'HOLLOW BODY HOLD', unit: 'Seconds', icon: <Target className="text-rose-700" />, color: '#be123c' },

  // Yoga
  { key: 'downwardDog', title: 'DOWNWARD DOG', unit: 'Seconds', icon: <Sun className="text-violet-500" />, color: '#8b5cf6' },
  { key: 'warrior1', title: 'WARRIOR I', unit: 'Seconds', icon: <Sword className="text-violet-600" />, color: '#7c3aed' },
  { key: 'warrior2', title: 'WARRIOR II', unit: 'Seconds', icon: <Sword className="text-violet-700" />, color: '#6d28d2' },
  { key: 'cobraPose', title: 'COBRA POSE', unit: 'Seconds', icon: <Zap className="text-purple-500" />, color: '#a855f7' },
  { key: 'childsPose', title: 'CHILDS POSE', unit: 'Seconds', icon: <Moon className="text-purple-400" />, color: '#c084fc' },
  { key: 'treePose', title: 'TREE POSE', unit: 'Seconds', icon: <TreePine className="text-fuchsia-500" />, color: '#d946ef' },
  { key: 'pigeonPose', title: 'PIGEON POSE', unit: 'Seconds', icon: <Bird className="text-fuchsia-600" />, color: '#c026d3' },
  { key: 'trianglePose', title: 'TRIANGLE POSE', unit: 'Seconds', icon: <Triangle className="text-pink-500" />, color: '#ec4899' },
  { key: 'crowPose', title: 'CROW POSE', unit: 'Seconds', icon: <Bird className="text-pink-600" />, color: '#db2777' },
  { key: 'savasana', title: 'SAVASANA', unit: 'Minutes', icon: <Bed className="text-slate-400" />, color: '#94a3b8' },

  // Mobility
  { key: 'worldsGreatestStretch', title: "WORLD'S GREATEST STRETCH", unit: 'Reps', icon: <Globe className="text-emerald-600" />, color: '#059669' },
  { key: 'hip9090Switch', title: '90/90 HIP SWITCH', unit: 'Reps', icon: <RefreshCw className="text-emerald-700" />, color: '#047857' },
  { key: 'tSpineRotation', title: 'THORACIC ROTATIONS', unit: 'Reps', icon: <RotateCcw className="text-teal-600" />, color: '#0d9488' },
  { key: 'deepSquatHold', title: 'DEEP SQUAT HOLD', unit: 'Minutes', icon: <ArrowDown className="text-teal-700" />, color: '#0f766e' },
  { key: 'ankleDorsiflexion', title: 'ANKLE DORSIFLEXION', unit: 'cm', icon: <MoveDown className="text-lime-600" />, color: '#65a30d' },
  { key: 'cossackSquat', title: 'COSSACK SQUAT', unit: 'Reps', icon: <Split className="text-lime-700" />, color: '#4d7c0f' },
  { key: 'inchworms', title: 'INCHWORMS', unit: 'Reps', icon: <Bug className="text-green-600" />, color: '#16a34a' },
  { key: 'shoulderPassThrough', title: 'SHOULDER PASS-THROUGHS', unit: 'Reps', icon: <Repeat className="text-green-700" />, color: '#15803d' },

  // Physiotherapy
  { key: 'shoulderExtRot', title: 'SHOULDER EXT. ROTATION', unit: 'Reps', icon: <Activity className="text-cyan-600" />, color: '#0891b2' },
  { key: 'tibialisRaise', title: 'TIBIALIS RAISE', unit: 'Reps', icon: <ChevronUp className="text-cyan-600" />, color: '#0891b2' },
  { key: 'copenhagenPlank', title: 'COPENHAGEN PLANK', unit: 'Seconds', icon: <Shield className="text-cyan-700" />, color: '#0e7490' },
  { key: 'assistedPistolSquat', title: 'ASSISTED PISTOL SQUAT', unit: 'Reps', icon: <Accessibility className="text-cyan-700" />, color: '#0e7490' },
  { key: 'singleLegRdl', title: 'SINGLE-LEG RDL', unit: 'Reps', icon: <Anchor className="text-cyan-800" />, color: '#155e75' },
  { key: 'towelScrunches', title: 'TOWEL SCRUNCHES', unit: 'Reps', icon: <Fingerprint className="text-blue-600" />, color: '#2563eb' },
  { key: 'serratusPunch', title: 'SERRATUS PUNCH', unit: 'Reps', icon: <Target className="text-blue-700" />, color: '#1d4ed8' },
  { key: 'pallofPress', title: 'PALLOF PRESS', unit: 'Reps', icon: <ArrowLeftRight className="text-blue-800" />, color: '#1e40af' },
  { key: 'nerveGlides', title: 'NERVE GLIDES', unit: 'Reps', icon: <Zap className="text-indigo-500" />, color: '#6366f1' },
  { key: 'proneYtw', title: 'PRONE Y-T-W', unit: 'Reps', icon: <Move className="text-indigo-600" />, color: '#4f46e5' }
];

export const getStandardUnit = (key: string): string => {
  if (key === 'bpSyst' || key === 'bpDias') return 'mmHg';
  const graph = SINGLE_GRAPHS.find(g => g.key === key);
  return graph ? graph.unit : '';
};


export const getThresholds = (key: string): MetricThresholds | undefined => {
  if (key === 'bpSyst') return BP_THRESHOLDS.systolic;
  if (key === 'bpDias') return BP_THRESHOLDS.diastolic;
  const graph = SINGLE_GRAPHS.find(g => g.key === key);
  return graph?.thresholds;
};