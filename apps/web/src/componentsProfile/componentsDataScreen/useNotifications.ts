// src/hooks/useNotifications.ts
import { useMemo } from 'react';

// Exported so DataScreen can use it for parsing Firebase timestamps
export const safeDate = (d: any): Date | null => {
  if (!d) return null;
  if (typeof d.toDate === 'function') return d.toDate(); 
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? null : parsed;
};

export const useNotifications = (dataStream: any[]) => {
  return useMemo(() => {
    if (!dataStream || dataStream.length === 0) return [];

    const alerts: any[] = [];

    const calcStats = (key: string) => {
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
      
      let trend = 'flat';
      if (latest.val > mean * 1.05) trend = 'up';
      if (latest.val < mean * 0.95) trend = 'down';

      return { current: latest.val, timestamp: latest.time, z, trend, valString: latest.val.toFixed(1) };
    };

    const temp = calcStats('temp');
    const hr = calcStats('hr');
    //const rr = calcStats('rr');
    const glu = calcStats('glucose');
    const ket = calcStats('ketones');
    const bpSyst = calcStats('bpSyst');
    const bpDias = calcStats('bpDias');
    const hgb = calcStats('hemoglobin');
    const spo2 = calcStats('spo2');
    const uric = calcStats('uricAcid');

    // 1. Viral/Bacterial Infection (SIRS)
    if (temp && hr) {
      if ((temp.current > 38.5 && hr.z > 2) || temp.current > 39.5) {
        alerts.push({
          id: 'sirs-critical',
          timestamp: temp.timestamp,
          type: 'critical',
          title: 'SIRS / Infection Alert',
          metricText: `Temp: ${temp.valString}°C (Z: ${temp.z.toFixed(1)}) | HR: ${hr.valString} bpm (Z: ${hr.z.toFixed(1)})`,
          reasoning: "High confidence of infection: both temperature and heart rate are significantly elevated.",
          trends: [temp.trend, hr.trend]
        });
      } else if (temp.current > 38.5) {
        alerts.push({
          id: 'hyperthermia-warn',
          timestamp: temp.timestamp,
          type: 'warning',
          title: 'Isolated High Temperature',
          metricText: `Temp: ${temp.valString}°C | HR: ${hr.valString} bpm (Stable)`,
          reasoning: "Temperature is high, but your heart rate remains stable. This could be due to external heat or early-stage fever.",
          trends: [temp.trend]
        });
      }
    }

    // 2. Diabetic Ketoacidosis (DKA)
    if (glu && ket) {
      if (glu.current > 250 && ket.current > 1.6) {
        alerts.push({
          id: 'dka',
          type: 'critical',
          timestamp: glu.timestamp,
          title: 'DKA Risk Detected',
          metricText: `Glucose: ${glu.valString} mg/dL | Ketones: ${ket.valString} mmol/L`,
          reasoning: "Critical levels of glucose and ketones detected. High risk of metabolic acidosis; seek emergency care immediately.",
          trends: [glu.trend, ket.trend]
        });
      }
    }

    // 3. Hypovolemic Shock / Internal Bleeding
    if (bpSyst && bpDias && hr && hgb) {
      if ((bpSyst.current < 90 || bpDias.current < 60) && hr.z > 3 && hgb.z < -2) {
        alerts.push({
          id: 'shock',
          type: 'critical',
          timestamp: bpSyst.timestamp,
          title: 'Hypovolemic Alert',
          metricText: `BP: ${bpSyst.valString}/${bpDias.valString} | HR Z-Score: ${hr.z.toFixed(1)} | Hgb Z-Score: ${hgb.z.toFixed(1)}`,
          reasoning: "Blood pressure is dropping while heart rate is spiking. This divergence, combined with low hemoglobin, suggests acute fluid or blood loss.",
          trends: [bpSyst.trend, hr.trend, hgb.trend]
        });
      }
    }

    // 4. Pulmonary Distress / Hypoxia
    if (spo2) {
      if (spo2.current < 92 || spo2.z < -3) {
        alerts.push({
          id: 'hypoxia',
          type: 'critical',
          timestamp: spo2.timestamp,
          title: 'Pulmonary Distress',
          metricText: `SpO2: ${spo2.valString}% ${spo2.z < -3 ? `(Z-Score: ${spo2.z.toFixed(1)})` : '(Threshold Breach)'}`,
          reasoning: "Oxygen saturation has dropped significantly below your baseline. Monitor respiratory rate and ensure clear airways.",
          trends: [spo2.trend]
        });
      } else if (spo2.z < -2) {
        alerts.push({
          id: 'hypoxia-warn',
          type: 'warning',
          timestamp: spo2.timestamp,
          title: 'Decreasing Oxygen',
          metricText: `SpO2 Z-Score: ${spo2.z.toFixed(1)}`,
          reasoning: "Oxygen saturation is trending slightly below normal levels.",
          trends: [spo2.trend]
        });
      }
    }

    // 5. Hypertensive Crisis (Stroke Risk)
    if (bpSyst && bpDias) {
      if (bpSyst.current > 180 || bpDias.current > 120) {
        alerts.push({
          id: 'hypertension',
          type: 'critical',
          timestamp: bpSyst.timestamp,
          title: 'Hypertensive Crisis',
          metricText: `Moving Maximum BP: ${bpSyst.valString}/${bpDias.valString} mmHg`,
          reasoning: "Blood pressure has reached critical levels. High risk of immediate organ damage or stroke.",
          trends: [bpSyst.trend]
        });
      }
    }

    // 6. Gout / Hyperuricemia
    if (uric) {
      if (uric.current > 7.0) {
        alerts.push({
          id: 'gout',
          type: 'critical',
          timestamp: uric.timestamp,
          title: 'Hyperuricemia Risk',
          metricText: `Uric Acid: ${uric.valString} mg/dL`,
          reasoning: "Uric acid levels are above the saturation point (6.8 mg/dL), increasing the risk of crystal formation and joint pain (Gout).",
          trends: [uric.trend]
        });
      }
    }

    return alerts;
  }, [dataStream]);
};