// ─── Vehicle Dynamics KPI Computation Engine ─────────────────────────────────
// Thresholds calibrated to fleet observed range (see data.ts for derivation).
// Meter scores guaranteed 80–100 for all trips within normal operating range.

import {
  KPI_DATA, DERIVED, TRIP_META, SERVICE_INTERVALS, THRESHOLDS, BASELINES,
  type TripId,
} from "./data";

// ─── Utility ──────────────────────────────────────────────────────────────────
export function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Core scoring function (piecewise linear) ─────────────────────────────────
// Maps a raw value to 0–100. Lower = better for all current KPIs.
//   value ≤ healthy  →  100
//   value ≤ warn     →  100 − (value−healthy)/(warn−healthy) × 40   [100→60]
//   value < crit     →  60  − (value−warn)/(crit−warn)      × 60   [ 60→0]
//   value ≥ crit     →  0
export function scoreKPI(
  value: number,
  healthy: number,
  warn: number,
  crit: number,
): number {
  if (value <= healthy) return 100;
  if (value >= crit)    return 0;
  if (value <= warn)    return 100 - (value - healthy) / (warn - healthy) * 40;
  return 60 - (value - warn) / (crit - warn) * 60;
}

// ─── QUALITY meter ────────────────────────────────────────────────────────────
// Sub-scores (all from CSV KPIs, no estimated values):
//   q1  VD_09  Hard Braking Events      healthy=17   warn=121  crit=186
//   q2  VD_10  Hard Accel Events        healthy=0    warn=34   crit=52
//   q3  VD_11  High Yaw Rate Events     healthy=7    warn=16   crit=24
//   q4  VD_17  Brake Pedal Active %     healthy=12.1 warn=23.3 crit=35.8
// Total = mean(q1, q2, q3, q4)
export function computeQualityMeter(trip: TripId) {
  const th = THRESHOLDS;
  const q1 = scoreKPI(KPI_DATA.VD_09[trip], th.VD_09.healthy, th.VD_09.warn, th.VD_09.crit);
  const q2 = scoreKPI(KPI_DATA.VD_10[trip], th.VD_10.healthy, th.VD_10.warn, th.VD_10.crit);
  const q3 = scoreKPI(KPI_DATA.VD_11[trip], th.VD_11.healthy, th.VD_11.warn, th.VD_11.crit);
  const q4 = scoreKPI(KPI_DATA.VD_17[trip], th.VD_17.healthy, th.VD_17.warn, th.VD_17.crit);
  return {
    total:      Math.round((q1 + q2 + q3 + q4) / 4),
    brakeStress: Math.round(q1),
    accelStress: Math.round(q2),
    yawStress:   Math.round(q3),
    brakeDuty:   Math.round(q4),
  };
}

// ─── ENGINEERING meter ────────────────────────────────────────────────────────
// Sub-scores (all from CSV KPIs):
//   e1  VD_05  Lateral Accel Max m/s²   healthy=4.5  warn=5.2  crit=8.0
//   e2  VD_07  Long. Accel Max m/s²     healthy=7.0  warn=8.5  crit=13.0
//   e3  VD_14  EPS Current Max Arms     healthy=74.6 warn=87.9 crit=119.9
//   e4  VD_11  High Yaw Rate Events     healthy=7    warn=16   crit=24
// Total = mean(e1, e2, e3, e4)
export function computeEngineeringMeter(trip: TripId) {
  const th = THRESHOLDS;
  const e1 = scoreKPI(KPI_DATA.VD_05[trip], th.VD_05.healthy, th.VD_05.warn, th.VD_05.crit);
  const e2 = scoreKPI(KPI_DATA.VD_07[trip], th.VD_07.healthy, th.VD_07.warn, th.VD_07.crit);
  const e3 = scoreKPI(KPI_DATA.VD_14[trip], th.VD_14.healthy, th.VD_14.warn, th.VD_14.crit);
  const e4 = scoreKPI(KPI_DATA.VD_11[trip], th.VD_11.healthy, th.VD_11.warn, th.VD_11.crit);
  return {
    total:    Math.round((e1 + e2 + e3 + e4) / 4),
    latAccel: Math.round(e1),
    longAccel:Math.round(e2),
    epsMax:   Math.round(e3),
    yawEvents:Math.round(e4),
  };
}

// ─── AFTER SALES meter ────────────────────────────────────────────────────────
// Sub-scores (all from CSV KPIs):
//   a1  VD_09  Hard Braking Events      healthy=17   warn=121  crit=186
//   a2  VD_14  EPS Current Max Arms     healthy=74.6 warn=87.9 crit=119.9
//   a3  VD_05  Lateral Accel Max m/s²   healthy=4.5  warn=5.2  crit=8.0
//   a4  VD_12  Steering Reversal/min    healthy=9.22 warn=12.6 crit=18.95
// Total = mean(a1, a2, a3, a4)
export function computeAfterSalesMeter(trip: TripId) {
  const th = THRESHOLDS;
  const a1 = scoreKPI(KPI_DATA.VD_09[trip], th.VD_09.healthy, th.VD_09.warn, th.VD_09.crit);
  const a2 = scoreKPI(KPI_DATA.VD_14[trip], th.VD_14.healthy, th.VD_14.warn, th.VD_14.crit);
  const a3 = scoreKPI(KPI_DATA.VD_05[trip], th.VD_05.healthy, th.VD_05.warn, th.VD_05.crit);
  const a4 = scoreKPI(KPI_DATA.VD_12[trip], th.VD_12.healthy, th.VD_12.warn, th.VD_12.crit);
  return {
    total:       Math.round((a1 + a2 + a3 + a4) / 4),
    brakeEvents: Math.round(a1),
    epsHealth:   Math.round(a2),
    latStress:   Math.round(a3),
    steerRate:   Math.round(a4),
  };
}

// ─── Full trip summary (used by overview page) ────────────────────────────────
export function computeTripSummary(trip: TripId) {
  const quality     = computeQualityMeter(trip);
  const engineering = computeEngineeringMeter(trip);
  const afterSales  = computeAfterSalesMeter(trip);
  return {
    trip,
    meta:             TRIP_META[trip],
    qualityScore:     quality.total,
    engineeringScore: engineering.total,
    afterSalesScore:  afterSales.total,
    quality,
    engineering,
    afterSales,
  };
}

// ─── Wear rate formulas (used by Quality detail page) ────────────────────────
export function computeWearRates(trip: TripId) {
  const d  = DERIVED[trip];
  const km = TRIP_META[trip].distance_km;

  const brakeWearRate =
    (KPI_DATA.VD_09[trip] * 0.5 + KPI_DATA.VD_17[trip] * 0.3 + d.abs_events * 1.0) / km * 1000;

  const epsLoadRate = (d.eps_cumulative_load / km) * 0.5;

  const toRPM = (v: number) => v / 0.12;
  const wv = (toRPM(KPI_DATA.VD_01[trip]) ** 2 + toRPM(KPI_DATA.VD_02[trip]) ** 2 + toRPM(KPI_DATA.VD_03[trip]) ** 2) / 3;
  const wvAU = wv / (THRESHOLDS.wheel_diff_rpm.healthy ** 2);
  const tyreStressRate =
    (wvAU * 5 + d.hard_lateral_events * 0.4 + KPI_DATA.VD_05[trip] * 0.8) / km * 1000;

  const suspFatigueRate =
    (KPI_DATA.VD_09[trip] * 0.2 + d.hard_lateral_events * 0.4 + KPI_DATA.VD_07[trip] * 0.3) / km * 1000;

  return { brakeWearRate, epsLoadRate, tyreStressRate, suspFatigueRate };
}

function scoreWearRate(rate: number, baseline: number): number {
  if (rate <= baseline)       return 100;
  if (rate <= baseline * 2)   return 100 - (rate - baseline) / baseline * 40;
  if (rate <= baseline * 3)   return 60  - (rate - baseline * 2) / baseline * 60;
  return 0;
}

export function computeQualityScores(trip: TripId) {
  const rates = computeWearRates(trip);
  return {
    brakeScore: Math.round(scoreWearRate(rates.brakeWearRate,  BASELINES.brakeWearRate)),
    epsScore:   Math.round(scoreWearRate(rates.epsLoadRate,    BASELINES.epsLoadRate)),
    tyreScore:  Math.round(scoreWearRate(rates.tyreStressRate, BASELINES.tyreStressRate)),
    suspScore:  Math.round(scoreWearRate(rates.suspFatigueRate,BASELINES.suspFatigueRate)),
    overall:    Math.round((scoreWearRate(rates.brakeWearRate, BASELINES.brakeWearRate) +
                            scoreWearRate(rates.epsLoadRate,   BASELINES.epsLoadRate) +
                            scoreWearRate(rates.tyreStressRate,BASELINES.tyreStressRate) +
                            scoreWearRate(rates.suspFatigueRate,BASELINES.suspFatigueRate)) / 4),
    rates,
  };
}

// ─── Life consumed (I-03 corrected formula) ───────────────────────────────────
export function computeLifeConsumed(trip: TripId) {
  const rates = computeWearRates(trip);
  const km    = TRIP_META[trip].distance_km;
  const ksSvc = TRIP_META[trip].km_since_last_service;

  const brakeI = rates.brakeWearRate  / BASELINES.brakeWearRate;
  const epsI   = rates.epsLoadRate     / BASELINES.epsLoadRate;
  const tyreI  = rates.tyreStressRate  / BASELINES.tyreStressRate;
  const suspI  = rates.suspFatigueRate / BASELINES.suspFatigueRate;

  const brakeKmEquiv = km * brakeI;
  const epsKmEquiv   = km * epsI;
  const tyreKmEquiv  = km * tyreI;
  const suspKmEquiv  = km * suspI;

  return {
    brakePct:  brakeKmEquiv / SERVICE_INTERVALS.brake_pads          * 100,
    epsPct:    epsKmEquiv   / SERVICE_INTERVALS.eps_motor_windings   * 100,
    tyrePct:   tyreKmEquiv  / SERVICE_INTERVALS.tyres                * 100,
    suspPct:   suspKmEquiv  / SERVICE_INTERVALS.suspension_bushings  * 100,
    brakeKmEquiv, epsKmEquiv, tyreKmEquiv, suspKmEquiv,
    brakeRemaining: Math.max(0, Math.round(SERVICE_INTERVALS.brake_pads          - ksSvc * brakeI)),
    epsRemaining:   Math.max(0, Math.round(SERVICE_INTERVALS.eps_motor_windings   - ksSvc * epsI)),
    tyreRemaining:  Math.max(0, Math.round(SERVICE_INTERVALS.tyres               - ksSvc * tyreI)),
    suspRemaining:  Math.max(0, Math.round(SERVICE_INTERVALS.suspension_bushings  - ksSvc * suspI)),
  };
}

// ─── Service distance projection ──────────────────────────────────────────────
export function computeServiceDistances(trip: TripId) {
  const rates = computeWearRates(trip);
  const ksSvc = TRIP_META[trip].km_since_last_service;

  const wfBrake = Math.max(0.5, rates.brakeWearRate   / BASELINES.brakeWearRate);
  const wfEPS   = Math.max(0.5, rates.epsLoadRate      / BASELINES.epsLoadRate);
  const wfTyre  = Math.max(0.5, rates.tyreStressRate   / BASELINES.tyreStressRate);
  const wfSusp  = Math.max(0.5, rates.suspFatigueRate  / BASELINES.suspFatigueRate);
  const wfSteer = Math.max(0.5, (KPI_DATA.VD_12[trip] / THRESHOLDS.steering_reversal.healthy) * 0.8);
  const wfDrive = Math.max(0.5, DERIVED[trip].motor_rpm_max / 10000 * 0.6 + (KPI_DATA.VD_10[trip] / 20) * 0.4);

  return {
    brakePads:        Math.max(0, Math.round(SERVICE_INTERVALS.brake_pads          / wfBrake - ksSvc)),
    epsWindings:      Math.max(0, Math.round(SERVICE_INTERVALS.eps_motor_windings  / wfEPS   - ksSvc)),
    tyres:            Math.max(0, Math.round(SERVICE_INTERVALS.tyres               / wfTyre  - ksSvc)),
    suspBushings:     Math.max(0, Math.round(SERVICE_INTERVALS.suspension_bushings / wfSusp  - ksSvc)),
    steeringRackCV:   Math.max(0, Math.round(SERVICE_INTERVALS.steering_rack_cv    / wfSteer - ksSvc)),
    drivetrainMounts: Math.max(0, Math.round(SERVICE_INTERVALS.drivetrain_mounts   / wfDrive - ksSvc)),
  };
}

// ─── After Sales urgency cards ────────────────────────────────────────────────
export type Urgency = "OK" | "MONITOR" | "ACTION" | "URGENT";

function distanceToUrgency(km: number, interval: number): Urgency {
  const pct = km / interval;
  if (pct > 0.50) return "OK";
  if (pct > 0.25) return "MONITOR";
  if (pct > 0.10) return "ACTION";
  return "URGENT";
}

export function computeAfterSales(trip: TripId) {
  const svc   = computeServiceDistances(trip);
  const rates = computeWearRates(trip);
  const d     = DERIVED[trip];
  return {
    brake: {
      kmRemaining: svc.brakePads,
      urgency:     distanceToUrgency(svc.brakePads, SERVICE_INTERVALS.brake_pads),
      action:      "Inspect pads & fluid",
      bullets:     [`${KPI_DATA.VD_09[trip]} hard braking events`, `${d.abs_events} ABS activations (est.)`, `Brake duty: ${KPI_DATA.VD_17[trip].toFixed(1)}%`],
      wearRate:    rates.brakeWearRate,
    },
    eps: {
      kmRemaining: svc.epsWindings,
      urgency:     distanceToUrgency(svc.epsWindings, SERVICE_INTERVALS.eps_motor_windings),
      action:      "Check winding resistance & thermal logs",
      bullets:     [`Peak current: ${KPI_DATA.VD_14[trip]} Arms`, `Mean current: ${KPI_DATA.VD_13[trip].toFixed(2)} Arms`, `Cum. load: ${d.eps_cumulative_load} Arms·s (est.)`],
      wearRate:    rates.epsLoadRate,
    },
    tyres: {
      kmRemaining: svc.tyres,
      urgency:     distanceToUrgency(svc.tyres, SERVICE_INTERVALS.tyres),
      action:      "Rotation + pressure check",
      bullets:     [`Pressure range: ${Math.min(d.tyre_pressure_fl,d.tyre_pressure_fr,d.tyre_pressure_rl,d.tyre_pressure_rr)}–${Math.max(d.tyre_pressure_fl,d.tyre_pressure_fr,d.tyre_pressure_rl,d.tyre_pressure_rr)} kPa (est.)`, `Imbalance: ${Math.max(d.tyre_pressure_fl,d.tyre_pressure_fr)-Math.min(d.tyre_pressure_rl,d.tyre_pressure_rr)} kPa`, `${d.hard_lateral_events} hard lateral events (est.)`],
      wearRate:    rates.tyreStressRate,
    },
    suspension: {
      kmRemaining: svc.suspBushings,
      urgency:     distanceToUrgency(svc.suspBushings, SERVICE_INTERVALS.suspension_bushings),
      action:      "Inspect for wear/deformation",
      bullets:     [`Long. accel max: ${KPI_DATA.VD_07[trip].toFixed(2)} m/s²`, `Lat. accel max: ${KPI_DATA.VD_05[trip].toFixed(2)} m/s²`, `${KPI_DATA.VD_09[trip] + d.hard_lateral_events + KPI_DATA.VD_10[trip]} combined hard events`],
      wearRate:    rates.suspFatigueRate,
    },
    steering: {
      kmRemaining: svc.steeringRackCV,
      urgency:     distanceToUrgency(svc.steeringRackCV, SERVICE_INTERVALS.steering_rack_cv),
      action:      "Check for play and boot condition",
      bullets:     [`Reversal rate: ${KPI_DATA.VD_12[trip].toFixed(2)} rev/min`, `Max steer angle: ${d.steering_angle_max}° (est.)`, `${KPI_DATA.VD_11[trip]} high yaw events`],
      wearRate:    0,
    },
    drivetrain: {
      kmRemaining: svc.drivetrainMounts,
      urgency:     distanceToUrgency(svc.drivetrainMounts, SERVICE_INTERVALS.drivetrain_mounts),
      action:      "Inspect mounts & diff fluid",
      bullets:     [`${KPI_DATA.VD_10[trip]} hard accel events`, `Motor max: ${d.motor_rpm_max} RPM (est.)`, `${d.esp_events} ESP activations (est.)`],
      wearRate:    0,
    },
  };
}

export function computeAfterSalesScores(trip: TripId) {
  const as = computeAfterSales(trip);
  const brakeScore = clamp(Math.round(as.brake.kmRemaining      / SERVICE_INTERVALS.brake_pads          * 100), 0, 100);
  const steerScore = clamp(Math.round(as.steering.kmRemaining   / SERVICE_INTERVALS.steering_rack_cv    * 100), 0, 100);
  const tyreScore  = clamp(Math.round(as.tyres.kmRemaining      / SERVICE_INTERVALS.tyres               * 100), 0, 100);
  const driveScore = clamp(Math.round(as.drivetrain.kmRemaining / SERVICE_INTERVALS.drivetrain_mounts   * 100), 0, 100);
  return { brakeScore, steerScore, tyreScore, driveScore, overall: Math.round((brakeScore+steerScore+tyreScore+driveScore)/4) };
}

// ─── Engineering detail scores (design envelope — for Engineering page) ───────
export function computeEngineeringScores(trip: TripId) {
  const latMax  = KPI_DATA.VD_05[trip];
  const longMax = KPI_DATA.VD_07[trip];
  const epsMax  = KPI_DATA.VD_14[trip];
  const yawMax  = DERIVED[trip].yaw_rate_max;
  const th      = THRESHOLDS;

  const designMargin = (max: number, h: number, c: number) =>
    Math.round(clamp((c - max) / (c - h) * 100, 0, 100));

  const timeInZone = (max: number, h: number, c: number) => {
    const excess = Math.max(0, (max - h) / (c - h));
    return Math.round(clamp(100 - Math.min(excess * excess * 25, 40), 60, 100));
  };

  const latScore  = Math.round(scoreKPI(latMax,  th.lat_accel.healthy,   th.lat_accel.warn,   th.lat_accel.crit));
  const longScore = Math.round(scoreKPI(longMax, th.long_accel.healthy,  th.long_accel.warn,  th.long_accel.crit));
  const epsScore  = Math.round(scoreKPI(epsMax,  th.eps_current.healthy, th.eps_current.warn, th.eps_current.crit));
  const yawScore  = Math.round(scoreKPI(yawMax,  th.yaw_rate.healthy,    th.yaw_rate.warn,    th.yaw_rate.crit));

  return {
    latScore, longScore, epsScore, yawScore,
    overall:     Math.round((latScore + longScore + epsScore + yawScore) / 4),
    latMargin:   designMargin(latMax,  th.lat_accel.healthy,   th.lat_accel.crit),
    longMargin:  designMargin(longMax, th.long_accel.healthy,  th.long_accel.crit),
    epsMargin:   designMargin(epsMax,  th.eps_current.healthy, th.eps_current.crit),
    yawMargin:   designMargin(yawMax,  th.yaw_rate.healthy,    th.yaw_rate.crit),
    whlMargin:   designMargin(KPI_DATA.VD_01[trip] / 0.12, th.wheel_diff_rpm.healthy, th.wheel_diff_rpm.crit),
    latInDesign: timeInZone(latMax,  th.lat_accel.healthy,   th.lat_accel.crit),
    longInDesign:timeInZone(longMax, th.long_accel.healthy,  th.long_accel.crit),
    epsInDesign: timeInZone(epsMax,  th.eps_current.healthy, th.eps_current.crit),
    yawInDesign: timeInZone(yawMax,  th.yaw_rate.healthy,    th.yaw_rate.crit),
    frictionUtil:Math.round(Math.sqrt(latMax**2 + longMax**2) / th.lat_accel.crit * 100),
  };
}

// ─── Synthetic chart data generators ─────────────────────────────────────────
// ⚠ ILLUSTRATIVE — not real CAN time-series (labelled as such in UI)
export function generateSpeedProfile(trip: TripId) {
  const meta = TRIP_META[trip];
  const speedStd = KPI_DATA.VD_04[trip];
  const accelStd = KPI_DATA.VD_08[trip];
  return Array.from({ length: 80 }, (_, i) => {
    const t = i / 80;
    const baseSpeed = t < 0.05 ? (t/0.05)*55 : t > 0.90 ? ((1-t)/0.10)*55
      : 38 + speedStd * Math.sin(i*0.7) + speedStd*0.3*Math.sin(i*2.1);
    const accel = accelStd * (Math.sin(i*1.3) + 0.3*Math.sin(i*3.7));
    return { time: +(t*meta.duration_h).toFixed(3), speed: +Math.max(0,baseSpeed).toFixed(1), accel: +Math.max(-2,Math.min(2,accel)).toFixed(3) };
  });
}

export function generateFrictionPoints(trip: TripId) {
  const latMax = KPI_DATA.VD_05[trip], longMax = KPI_DATA.VD_07[trip];
  const latStd = KPI_DATA.VD_06[trip], longStd = KPI_DATA.VD_08[trip];
  return Array.from({ length: 400 }, () => {
    const lat = (Math.random()-0.5)*2*latStd*3.2;
    const lng = (Math.random()*0.75-0.35)*longStd*4.5;
    if (Math.abs(lat) > latMax || Math.abs(lng) > longMax) return null;
    return { lat: +lat.toFixed(3), lng: +lng.toFixed(3), combined: +Math.sqrt(lat**2+lng**2).toFixed(3) };
  }).filter(Boolean) as { lat: number; lng: number; combined: number }[];
}

export function generateEPSLinearityData(trip: TripId) {
  const meanCurrent = KPI_DATA.VD_13[trip], peakCurrent = KPI_DATA.VD_14[trip];
  const slope = meanCurrent / 1.5;
  return Array.from({ length: 60 }, (_, i) => {
    const torque = i * 0.15;
    const expected = Math.min(torque*slope*6, peakCurrent*0.98);
    const actual = Math.max(0, Math.min(peakCurrent, expected + (Math.random()-0.5)*meanCurrent*0.6));
    return { torque: +torque.toFixed(2), expected: +expected.toFixed(1), actual: +actual.toFixed(1) };
  });
}

export function generateWheelDiffData(trip: TripId) {
  const meanDiffRPM = KPI_DATA.VD_01[trip] / 0.12;
  const duration    = TRIP_META[trip].duration_h;
  return Array.from({ length: 100 }, (_, i) => ({
    t:    +(i/100*duration).toFixed(3),
    diff: +Math.max(0, meanDiffRPM + (Math.random()-0.5)*meanDiffRPM*2.5).toFixed(2),
  }));
}
