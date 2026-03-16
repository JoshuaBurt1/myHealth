import {
  Heart, Wind, Droplets, Thermometer, TestTube, Activity,
  User, Ruler, Scale, Dumbbell, Timer, Footprints
} from 'lucide-react';

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

export const VITAL_ADDONS = Object.keys(VITAL_KEY_MAP);
export const STRENGTH_LIST = Object.keys(STRENGTH_KEY_MAP);
export const SPEED_LIST = Object.keys(SPEED_KEY_MAP);

export const SINGLE_GRAPHS = [
  // Core Vitals
  { key: 'hr', title: 'HEART RATE', unit: 'BPM', icon: <Heart className="text-red-500" />, color: '#ef4444' },
  { key: 'rr', title: 'RESPIRATION RATE', unit: 'Breaths/min', icon: <Wind className="text-blue-500" />, color: '#3b82f6' },
  { key: 'spo2', title: 'OXYGEN SATURATION', unit: 'SpO2 %', icon: <Droplets className="text-emerald-500" />, color: '#10b981', domain: [90, 100] as [number, number] },
  { key: 'temp', title: 'BODY TEMPERATURE', unit: '°C', icon: <Thermometer className="text-amber-500" />, color: '#f59e0b', domain: [30, 43] as [number, number] },
  
  // Blood & Metabolic
  { key: 'glucose', title: 'GLUCOSE', unit: 'mg/dL', icon: <TestTube className="text-rose-500" />, color: '#f43f5e' },
  { key: 'cholesterol', title: 'CHOLESTEROL', unit: 'mg/dL', icon: <Activity className="text-yellow-500" />, color: '#eab308' },
  { key: 'ketones', title: 'KETONES', unit: 'mmol/L', icon: <TestTube className="text-purple-500" />, color: '#a855f7' },
  { key: 'uricAcid', title: 'URIC ACID', unit: 'mg/dL', icon: <Droplets className="text-cyan-500" />, color: '#06b6d4' },
  { key: 'lactate', title: 'LACTATE', unit: 'mmol/L', icon: <Activity className="text-teal-500" />, color: '#14b8a6' },
  { key: 'hemoglobin', title: 'HEMOGLOBIN', unit: 'g/dL', icon: <Droplets className="text-red-600" />, color: '#dc2626' },
  { key: 'hematocrit', title: 'HEMATOCRIT', unit: '%', icon: <Activity className="text-red-700" />, color: '#b91c1c' },
  
  // Body Measurements
  { key: 'age', title: 'AGE', unit: 'Years', icon: <User className="text-slate-500" />, color: '#64748b' },
  { key: 'height', title: 'HEIGHT', unit: 'cm', icon: <Ruler className="text-blue-400" />, color: '#60a5fa' },
  { key: 'weight', title: 'WEIGHT', unit: 'kg', icon: <Scale className="text-emerald-400" />, color: '#34d399' },
  { key: 'bmi', title: 'BMI', unit: 'kg/m²', icon: <Activity className="text-indigo-400" />, color: '#818cf8' },
  
  // Strength
  { key: 'benchPress', title: 'BENCH PRESS', unit: 'kg', icon: <Dumbbell className="text-indigo-600" />, color: '#4f46e5' },
  { key: 'squat', title: 'SQUAT', unit: 'kg', icon: <Dumbbell className="text-indigo-700" />, color: '#4338ca' },
  { key: 'deadlift', title: 'DEADLIFT', unit: 'kg', icon: <Dumbbell className="text-indigo-800" />, color: '#3730a3' },
  
  // Speed
  { key: 'speed100m', title: '100M SPRINT', unit: 'Seconds', icon: <Timer className="text-orange-500" />, color: '#f97316' },
  { key: 'speed400m', title: '400M SPRINT', unit: 'Seconds', icon: <Timer className="text-orange-600" />, color: '#ea580c' },
  { key: 'speed1Mile', title: '1 MILE RUN', unit: 'Minutes', icon: <Timer className="text-orange-700" />, color: '#c2410c' },
  { key: 'steps', title: 'Steps', unit: '', icon: <Footprints className="text-orange-800" />, color: '#9a3412' }
];

// Helper to reliably fetch standard units 
export const getStandardUnit = (key: string): string => {
  const graph = SINGLE_GRAPHS.find(g => g.key === key);
  return graph ? graph.unit : '';
};