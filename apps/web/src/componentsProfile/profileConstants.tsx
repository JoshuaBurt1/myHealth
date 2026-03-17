import {
  Heart, Wind, Droplets, Thermometer, TestTube, Activity,
  User, Ruler, Scale, Dumbbell, Timer, Footprints,
  // Physio Icons
  ChevronUp, Shield, Accessibility, Anchor, Fingerprint, Target, ArrowLeftRight, Zap, Move,
  // Yoga Icons
  Sun, Sword, Moon, TreePine, Bird, Triangle, Bed,
  // Mobility Icons
  Globe, RefreshCw, RotateCcw, ArrowDown, MoveDown, Split, Bug, Repeat
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

export const VITAL_LIST = Object.keys(VITAL_KEY_MAP);
export const STRENGTH_LIST = Object.keys(STRENGTH_KEY_MAP);
export const SPEED_LIST = Object.keys(SPEED_KEY_MAP);
export const PHYSIO_LIST = Object.keys(PHYSIO_KEY_MAP);
export const YOGA_LIST = Object.keys(YOGA_KEY_MAP);
export const MOBILITY_LIST = Object.keys(MOBILITY_KEY_MAP);

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
  { key: 'steps', title: 'Steps', unit: 'steps', icon: <Footprints className="text-orange-800" />, color: '#9a3412' },

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
  { key: 'proneYtw', title: 'PRONE Y-T-W', unit: 'Reps', icon: <Move className="text-indigo-600" />, color: '#4f46e5' },

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
  { key: 'shoulderPassThrough', title: 'SHOULDER PASS-THROUGHS', unit: 'Reps', icon: <Repeat className="text-green-700" />, color: '#15803d' }
];

// Helper to reliably fetch standard units 
export const getStandardUnit = (key: string): string => {
  const graph = SINGLE_GRAPHS.find(g => g.key === key);
  return graph ? graph.unit : '';
};