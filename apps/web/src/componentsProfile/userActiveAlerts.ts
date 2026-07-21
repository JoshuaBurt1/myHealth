// componentsProfile/componentsGroupScreen/userActiveAlerts.ts
// Ideally the threshold values are not hard coded and are obtained from population data alone
import { useMemo } from 'react';
import { getThresholds, getStandardUnit } from './profileConstants';

export interface Alert {
  id: string;
  metricKeys: string[];
  timestamp: Date | null;
  type: 'warning' | 'critical';
  title: string;
  metricText: string;
  reasoning: string;
  trends: string[];
}

export interface StatResult {
  current: number;
  timestamp: Date | null;
  z: number;
  trend: 'up' | 'down' | 'flat';
  valString: string;
}

export const safeDate = (d: any): Date | null => {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate(); 
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

const CONDITION_NAMES: Record<string, { high: string, low: string, name: string }> = {
  hr: { high: 'Tachycardia', low: 'Bradycardia', name: 'Heart Rate' },
  rr: { high: 'Tachypnea', low: 'Bradypnea', name: 'Respiration Rate' },
  spo2: { high: 'Hyperoxia', low: 'Hypoxia', name: 'SpO2' },
  temp: { high: 'Hyperthermia', low: 'Hypothermia', name: 'Temperature' },
  glucose: { high: 'Hyperglycemia', low: 'Hypoglycemia', name: 'Glucose' },
  bpSyst: { high: 'Systolic Hypertension', low: 'Systolic Hypotension', name: 'Systolic BP' },
  bpDias: { high: 'Diastolic Hypertension', low: 'Diastolic Hypotension', name: 'Diastolic BP' },
  ketones: { high: 'Hyperketonemia', low: 'Hypoketonemia', name: 'Ketones' },
  //uricAcid: { high: 'Hyperuricemia', low: 'Hypouricemia', name: 'Uric Acid' },
  hemoglobin: { high: 'Polycythemia', low: 'Anemia', name: 'Hemoglobin' }
};

export const userActiveAlerts = (dataStream: any[]) => {
  return useMemo(() => {
    if (!dataStream || dataStream.length === 0) return [];

    const alerts: Alert[] = [];

    const calcStats = (key: string): StatResult | null => {
      const validPoints = dataStream
        .filter(d => !isNaN(Number(d[key])) && (d.dateTime || d.timestamp))
        .map(d => ({ 
          val: Number(d[key]), 
          time: safeDate(d.dateTime || d.timestamp) 
        }));

      if (validPoints.length === 0) return null;
      
      const latest = validPoints[validPoints.length - 1];
      const vals = validPoints.map(p => p.val);
      
      if (vals.length < 2) return { 
        current: latest.val, 
        timestamp: latest.time, 
        z: 0, trend: 'flat', 
        valString: latest.val.toFixed(1) 
      };

      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const stdDev = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length) || 1;
      const z = (latest.val - mean) / stdDev;
      
      let trend: 'up' | 'down' | 'flat' = 'flat';
      if (latest.val > mean * 1.05) trend = 'up';
      if (latest.val < mean * 0.95) trend = 'down';

      return { current: latest.val, timestamp: latest.time, z, trend, valString: latest.val.toFixed(1) };
    };

    //'uricAcid'
    const keysToProcess = ['temp', 'hr', 'rr', 'glucose', 'ketones', 'bpSyst', 'bpDias', 'hemoglobin', 'spo2'];
    const stats: Record<string, StatResult | null> = {};
    keysToProcess.forEach(k => { stats[k] = calcStats(k); });

    //uricAcid: uric
    const { temp, hr, rr, glucose: glu, ketones: ket, bpSyst, bpDias, hemoglobin: hgb, spo2 } = stats;

    // Track metrics that triggered a multi-vital disease
    const triggeredSyndromes = new Set<string>();

    // 1. SIRS / Sepsis Risk
    if (temp && hr && rr) {
      const tThresh = getThresholds('temp');
      const hrThresh = getThresholds('hr');
      const rrThresh = getThresholds('rr');

      if (tThresh?.warningHigh && hrThresh?.warningHigh && rrThresh?.warningHigh) {
        if (temp.current > tThresh.warningHigh && hr.current > hrThresh.warningHigh && rr.current > rrThresh.warningHigh) {
          const bpThresh = getThresholds('bpSyst');
          const isSepsis = bpSyst && bpThresh?.warningLow && bpSyst.current < bpThresh.warningLow;

          alerts.push({
            id: isSepsis ? 'sepsis-critical' : 'sirs-critical',
            metricKeys: isSepsis ? ['temp', 'hr', 'rr', 'bpSyst'] : ['temp', 'hr', 'rr'],
            timestamp: temp.timestamp,
            type: 'critical',
            title: isSepsis ? 'Possible Sepsis Detected' : 'SIRS / Infection Alert',
            metricText: `Temp: ${temp.valString}°C | HR: ${hr.valString} bpm | RR: ${rr.valString}`,
            reasoning: isSepsis 
              ? "Critical systemic infection symptoms compounded by hypotensive blood pressure. Seek emergency care." 
              : "High confidence of systemic inflammatory response (SIRS) or infection based on elevated temp, HR, and RR.",
            trends: [temp.trend, hr.trend, rr.trend]
          });
          
          triggeredSyndromes.add('temp'); triggeredSyndromes.add('hr'); triggeredSyndromes.add('rr');
          if (isSepsis) triggeredSyndromes.add('bpSyst');
        }
      }
    }

    // Diabetic Ketoacidosis (DKA)
    if (glu && ket) {
      const gluThresh = getThresholds('glucose');
      const ketThresh = getThresholds('ketones');
      
      if (gluThresh?.criticalHigh && ketThresh?.criticalHigh) {
        if (glu.current > gluThresh.criticalHigh && ket.current > ketThresh.criticalHigh) {
          alerts.push({
            id: 'dka-critical',
            metricKeys: ['glucose', 'ketones'],
            type: 'critical',
            timestamp: glu.timestamp,
            title: 'DKA Risk Detected',
            metricText: `Glucose: ${glu.valString} mg/dL | Ketones: ${ket.valString} mmol/L`,
            reasoning: "Critical levels of glucose and ketones detected. High risk of metabolic acidosis; seek emergency care immediately.",
            trends: [glu.trend, ket.trend]
          });
          triggeredSyndromes.add('glucose'); triggeredSyndromes.add('ketones');
        }
      }
    }

    // Hypovolemic Shock / Internal Bleeding
    if (bpSyst && bpDias && hr && hgb) {
      const bpThresh = getThresholds('bpSyst');
      if (bpThresh?.warningLow && bpSyst.current < bpThresh.warningLow && hr.z > 3 && hgb.z < -2) {
        alerts.push({
          id: 'shock-critical',
          metricKeys: ['bpSyst', 'bpDias', 'hr', 'hemoglobin'],
          type: 'critical',
          timestamp: bpSyst.timestamp,
          title: 'Hypovolemic Shock Risk',
          metricText: `BP: ${bpSyst.valString}/${bpDias?.valString} | HR Z: ${hr.z.toFixed(1)} | Hgb Z: ${hgb.z.toFixed(1)}`,
          reasoning: "Blood pressure is dropping while heart rate is spiking. Combined with low hemoglobin, this indicates acute fluid or blood loss.",
          trends: [bpSyst.trend, hr.trend, hgb.trend]
        });
        triggeredSyndromes.add('bpSyst'); triggeredSyndromes.add('hr'); triggeredSyndromes.add('hemoglobin');
      }
    }

    // Acute Respiratory Distress
    if (spo2 && rr) {
      const spo2Thresh = getThresholds('spo2');
      const rrThresh = getThresholds('rr');
      
      if (spo2Thresh?.criticalLow && rrThresh?.criticalHigh && rrThresh?.criticalLow) {
        if (spo2.current <= spo2Thresh.criticalLow && (rr.current >= rrThresh.criticalHigh || rr.current <= rrThresh.criticalLow)) {
          alerts.push({
            id: 'ards-critical',
            metricKeys: ['spo2', 'rr'],
            type: 'critical',
            timestamp: spo2.timestamp,
            title: 'Acute Respiratory Distress',
            metricText: `SpO2: ${spo2.valString}% | RR: ${rr.valString} breaths/min`,
            reasoning: "Severe hypoxia combined with abnormal respiration rates indicates failing respiratory compensation.",
            trends: [spo2.trend, rr.trend]
          });
          triggeredSyndromes.add('spo2'); triggeredSyndromes.add('rr');
        }
      }
    }

    // Hypoglycemic Emergency
    if (glu && hr) {
      const gluThresh = getThresholds('glucose');
      const hrThresh = getThresholds('hr');
      if (gluThresh?.criticalLow && hrThresh?.warningHigh) {
        if (glu.current <= gluThresh.criticalLow && hr.current >= hrThresh.warningHigh) {
          alerts.push({
            id: 'hypoglycemic-emergency',
            metricKeys: ['glucose', 'hr'],
            type: 'critical',
            timestamp: glu.timestamp,
            title: 'Severe Hypoglycemia with Compensatory Tachycardia',
            metricText: `Glucose: ${glu.valString} mg/dL | HR: ${hr.valString} bpm`,
            reasoning: "Critically low blood sugar triggering a rapid heart rate response. Consume fast-acting carbohydrates immediately.",
            trends: [glu.trend, hr.trend]
          });
          triggeredSyndromes.add('glucose'); triggeredSyndromes.add('hr');
        }
      }
    }

    // 2. SINGULAR VITAL SIGN CONDITIONS
    Object.entries(stats).forEach(([key, stat]) => {
      if (!stat) return;
      const thresh = getThresholds(key);
      if (!thresh) return;

      const unit = getStandardUnit(key);
      const names = CONDITION_NAMES[key] || { high: `High ${key}`, low: `Low ${key}`, name: key };

      let triggeredLevel: 'critical' | 'warning' | null = null;
      let triggeredTitle = '';
      let triggeredReason = '';

      if (thresh.criticalHigh !== undefined && stat.current >= thresh.criticalHigh) {
        triggeredLevel = 'critical';
        triggeredTitle = `Critical ${names.high}`;
        triggeredReason = `${names.name} reached a critical high of ${stat.valString} ${unit}. Immediate medical attention is recommended.`;
      } 
      else if (thresh.criticalLow !== undefined && stat.current <= thresh.criticalLow) {
        triggeredLevel = 'critical';
        triggeredTitle = `Critical ${names.low}`;
        triggeredReason = `${names.name} dropped to a critical low of ${stat.valString} ${unit}. Immediate medical attention is recommended.`;
      } 
      else if (thresh.warningHigh !== undefined && stat.current >= thresh.warningHigh) {
        triggeredLevel = 'warning';
        triggeredTitle = names.high;
        triggeredReason = `${names.name} is elevated at ${stat.valString} ${unit}. Monitor closely for symptoms.`;
      } 
      else if (thresh.warningLow !== undefined && stat.current <= thresh.warningLow) {
        triggeredLevel = 'warning';
        triggeredTitle = names.low;
        triggeredReason = `${names.name} is low at ${stat.valString} ${unit}. Monitor closely for symptoms.`;
      }
      if (!triggeredLevel && stat.z < -3 && key === 'spo2') {
        triggeredLevel = 'critical';
        triggeredTitle = `Sudden Drop in ${names.name}`;
        triggeredReason = `${names.name} dropped drastically below your moving baseline (Z-Score: ${stat.z.toFixed(1)}).`;
      }
      if (triggeredLevel && !triggeredSyndromes.has(key)) {
        alerts.push({
          id: `isolated-${key}-${triggeredLevel}`,
          metricKeys: [key],
          type: triggeredLevel,
          timestamp: stat.timestamp,
          title: triggeredTitle,
          metricText: `${key.toUpperCase()}: ${stat.valString} ${unit}`,
          reasoning: triggeredReason,
          trends: [stat.trend]
        });
      }
    });

    return alerts;
  }, [dataStream]);
};