// ─── Vehicle Dynamics KPI Computation Engine ─────────────────────────────────
// All formulas documented in VD_Dashboard_Computation_Reference.docx
// Fix log: I-01, I-02, I-03, I-08, I-09, I-11, I-12 applied here.

import {
  KPI_DATA, DERIVED, TRIP_META, SERVICE_INTERVALS, THRESHOLDS, BASELINES,
  type TripId,
} from "./data";

// ─── Utility ─────────────────────────────────────────────────────────────────
export function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Piecewise Linear Scoring ─────────────────────────────────────────────────
// Maps a raw value to 0-100 (100 = best health, 0 = critical).
// For "lower is better" signals: 0 → 100, healthy → 100, warn → 60, crit → 0.
function scoreLinear(
  value: number,
  healthy: number,
  warn: number,
  crit: number,
): number {
  if (value <= healthy) return 100;
  if (value >= crit)    return 0;
  if (value <= warn)    return 100 - ((value - healthy) / (warn - healthy)) * 40; // 100→60
  return 60 - ((value - warn) / (crit - warn)) * 60;                             // 60→0
}

// ─── Wear Rate Scoring ────────────────────────────────────────────────────────
// Uses BASELINES from data.ts (I-02 fix: baseline calibrated to fleet data).
// At rate = baseline:          score = 100  (healthy)
// At rate = 2 × baseline:      score = 60   (watch)
// At rate = 3 × baseline:      score = 0    (attention)
function scoreWearRate(rate: number, baseline: number): number {
  if (rate <= baseline)           return 100;
  if (rate <= baseline * 2)       return 100 - ((rate - baseline) / baseline) * 40;
  if (rate <= baseline * 3)       return 60  - ((rate - baseline * 2) / baseline) * 60;
  return 0;
}

// ─── Wear Rate Formulas (§7.2 of reference doc) ───────────────────────────────
//
// Brake Wear Rate [events-units / 1000 km]
//   = (VD_09 × 0.5  +  VD_17 × 0.3  +  ABS_events × 1.0) / trip_km × 1000
//
// EPS Thermal Load Rate [AU / 1000 km]
//   = eps_cumulative_load / trip_km × 0.5
//
// Tyre Stress Rate [AU / 1000 km]
//   = (wheel_variance_factor + hard_lateral_events × 0.4 + lat_accel_max × 0.8) / trip_km × 1000
//   Note: wheel imbalance KPIs (VD_01-03) converted km/h → RPM (÷ 0.12) before squaring (I-07 fix)
//
// Suspension Fatigue Rate [AU / 1000 km]
//   = (VD_09 × 0.2  +  hard_lateral × 0.4  +  VD_07 × 0.3) / trip_km × 1000

export function computeWearRates(trip: TripId) {
  const d   = DERIVED[trip];
  const km  = TRIP_META[trip].distance_km;

  // Brake
  const brakeWearRate =
    (KPI_DATA.VD_09[trip] * 0.5 +
     KPI_DATA.VD_17[trip] * 0.3 +
     d.abs_events * 1.0) / km * 1000;

  // EPS thermal
  const epsLoadRate = (d.eps_cumulative_load / km) * 0.5;

  // Tyre stress — I-07 fix: convert km/h → RPM (÷ 0.12) before computing variance
  const toRPM = (v: number) => v / 0.12;
  const wv =
    (toRPM(KPI_DATA.VD_01[trip]) ** 2 +
     toRPM(KPI_DATA.VD_02[trip]) ** 2 +
     toRPM(KPI_DATA.VD_03[trip]) ** 2) / 3;
  // Normalise variance into AU: divide by (healthy_rpm)^2 so 1 AU = at healthy threshold
  const wvAU = wv / (THRESHOLDS.wheel_diff_rpm.healthy ** 2);
  const tyreStressRate =
    (wvAU * 5 + d.hard_lateral_events * 0.4 + KPI_DATA.VD_05[trip] * 0.8) / km * 1000;

  // Suspension
  const suspFatigueRate =
    (KPI_DATA.VD_09[trip] * 0.2 +
     d.hard_lateral_events * 0.4 +
     KPI_DATA.VD_07[trip] * 0.3) / km * 1000;

  return { brakeWearRate, epsLoadRate, tyreStressRate, suspFatigueRate };
}

// ─── Service Distance Projection ─────────────────────────────────────────────
// Estimates km remaining until service is recommended.
//
// wear_factor     = max(0.5, observed_rate / baseline_rate)
// adj_interval    = nominal_service_interval / wear_factor
// km_remaining    = max(0, adj_interval − km_since_last_service)
//
// Using km_since_last_service (not total odometer) because service intervals
// reset at each service event. When real service history is unavailable, the
// odometer is used as a conservative proxy.

export function computeServiceDistances(trip: TripId) {
  const rates = computeWearRates(trip);
  const ksSvc = TRIP_META[trip].km_since_last_service;

  const wfBrake = Math.max(0.5, rates.brakeWearRate   / BASELINES.brakeWearRate);
  const wfEPS   = Math.max(0.5, rates.epsLoadRate      / BASELINES.epsLoadRate);
  const wfTyre  = Math.max(0.5, rates.tyreStressRate   / BASELINES.tyreStressRate);
  const wfSusp  = Math.max(0.5, rates.suspFatigueRate  / BASELINES.suspFatigueRate);

  const adjBrake = SERVICE_INTERVALS.brake_pads          / wfBrake;
  const adjEPS   = SERVICE_INTERVALS.eps_motor_windings  / wfEPS;
  const adjTyre  = SERVICE_INTERVALS.tyres               / wfTyre;
  const adjSusp  = SERVICE_INTERVALS.suspension_bushings / wfSusp;

  // Steering: driven by reversal rate relative to healthy threshold
  const wfSteer = Math.max(0.5,
    (KPI_DATA.VD_12[trip] / THRESHOLDS.steering_reversal.healthy) * 0.8);
  const adjSteer = SERVICE_INTERVALS.steering_rack_cv / wfSteer;

  // Drivetrain: driven by hard accel events + motor RPM utilisation
  const motorUtil = DERIVED[trip].motor_rpm_max / 10_000;
  const wfDrive = Math.max(0.5,
    motorUtil * 0.6 + (KPI_DATA.VD_10[trip] / 20) * 0.4);
  const adjDrive = SERVICE_INTERVALS.drivetrain_mounts / wfDrive;

  return {
    brakePads:        Math.max(0, Math.round(adjBrake - ksSvc)),
    epsWindings:      Math.max(0, Math.round(adjEPS   - ksSvc)),
    tyres:            Math.max(0, Math.round(adjTyre  - ksSvc)),
    suspBushings:     Math.max(0, Math.round(adjSusp  - ksSvc)),
    steeringRackCV:   Math.max(0, Math.round(adjSteer - ksSvc)),
    drivetrainMounts: Math.max(0, Math.round(adjDrive - ksSvc)),
  };
}

// ─── Component Life Consumed (I-03 fix: corrected dimensional formula) ────────
//
// CORRECT formula:
//   intensity    = wear_rate / baseline_rate
//   km_consumed  = trip_km × intensity          (km of life consumed this trip)
//   pct          = km_consumed / interval × 100
//
// The previous code had: (rate / (baseline * 1000)) × km × 100 / interval × 100
// which was dimensionally wrong (extra ×1000, double ×100).

export function computeLifeConsumed(trip: TripId) {
  const rates = computeWearRates(trip);
  const km    = TRIP_META[trip].distance_km;

  const brakeIntensity = rates.brakeWearRate  / BASELINES.brakeWearRate;
  const epsIntensity   = rates.epsLoadRate     / BASELINES.epsLoadRate;
  const tyreIntensity  = rates.tyreStressRate  / BASELINES.tyreStressRate;
  const suspIntensity  = rates.suspFatigueRate / BASELINES.suspFatigueRate;

  const brakeKmEquiv = km * brakeIntensity;
  const epsKmEquiv   = km * epsIntensity;
  const tyreKmEquiv  = km * tyreIntensity;
  const suspKmEquiv  = km * suspIntensity;

  const brakePct = brakeKmEquiv / SERVICE_INTERVALS.brake_pads          * 100;
  const epsPct   = epsKmEquiv   / SERVICE_INTERVALS.eps_motor_windings   * 100;
  const tyrePct  = tyreKmEquiv  / SERVICE_INTERVALS.tyres                * 100;
  const suspPct  = suspKmEquiv  / SERVICE_INTERVALS.suspension_bushings  * 100;

  const brakeRemaining = SERVICE_INTERVALS.brake_pads         - TRIP_META[trip].km_since_last_service * brakeIntensity;
  const epsRemaining   = SERVICE_INTERVALS.eps_motor_windings - TRIP_META[trip].km_since_last_service * epsIntensity;
  const tyreRemaining  = SERVICE_INTERVALS.tyres              - TRIP_META[trip].km_since_last_service * tyreIntensity;
  const suspRemaining  = SERVICE_INTERVALS.suspension_bushings- TRIP_META[trip].km_since_last_service * suspIntensity;

  return {
    brakePct, epsPct, tyrePct, suspPct,
    brakeKmEquiv, epsKmEquiv, tyreKmEquiv, suspKmEquiv,
    brakeRemaining: Math.max(0, Math.round(brakeRemaining)),
    epsRemaining:   Math.max(0, Math.round(epsRemaining)),
    tyreRemaining:  Math.max(0, Math.round(tyreRemaining)),
    suspRemaining:  Math.max(0, Math.round(suspRemaining)),
  };
}

// ─── Quality Dashboard Scores ─────────────────────────────────────────────────
export function computeQualityScores(trip: TripId) {
  const rates = computeWearRates(trip);

  const brakeScore = Math.round(scoreWearRate(rates.brakeWearRate,  BASELINES.brakeWearRate));
  const epsScore   = Math.round(scoreWearRate(rates.epsLoadRate,    BASELINES.epsLoadRate));
  const tyreScore  = Math.round(scoreWearRate(rates.tyreStressRate, BASELINES.tyreStressRate));
  const suspScore  = Math.round(scoreWearRate(rates.suspFatigueRate,BASELINES.suspFatigueRate));

  const overall = Math.round((brakeScore + epsScore + tyreScore + suspScore) / 4);

  return { brakeScore, epsScore, tyreScore, suspScore, overall, rates };
}

// ─── Engineering Dashboard Scores ─────────────────────────────────────────────
export function computeEngineeringScores(trip: TripId) {
  const latMax  = KPI_DATA.VD_05[trip];
  const longMax = KPI_DATA.VD_07[trip];
  const epsMax  = KPI_DATA.VD_14[trip];
  const yawMax  = DERIVED[trip].yaw_rate_max;

  // ── I-09 fix: design margin = (crit - max) / (crit - healthy) × 100 ──────
  // This measures how much of the warning-to-critical band remains unused.
  const designMargin = (max: number, healthy: number, crit: number) =>
    Math.round(clamp((crit - max) / (crit - healthy) * 100, 0, 100));

  const latMargin  = designMargin(latMax,  THRESHOLDS.lat_accel.healthy,   THRESHOLDS.lat_accel.crit);
  const longMargin = designMargin(longMax, THRESHOLDS.long_accel.healthy,  THRESHOLDS.long_accel.crit);
  const epsMargin  = designMargin(epsMax,  THRESHOLDS.eps_current.healthy, THRESHOLDS.eps_current.crit);
  const yawMargin  = designMargin(yawMax,  THRESHOLDS.yaw_rate.healthy,    THRESHOLDS.yaw_rate.crit);

  // Wheel speed imbalance margin — convert VD_01 km/h → RPM first (I-07 fix)
  const whlRPM    = KPI_DATA.VD_01[trip] / 0.12;
  const whlMargin = designMargin(whlRPM, THRESHOLDS.wheel_diff_rpm.healthy, THRESHOLDS.wheel_diff_rpm.crit);

  // ── I-08 fix: time-in-design-zone estimation ────────────────────────────
  // Approximation: exceedance time scales as (excess_ratio)^2 × 25%.
  // At peak = healthy  → 0% exceedance → 100% in-zone.
  // At peak = critical → 25% exceedance → 75% in-zone.
  // This is an approximation — real values need per-sample CAN counting.
  const timeInZone = (max: number, healthy: number, crit: number) => {
    const excess = Math.max(0, (max - healthy) / (crit - healthy));
    const exceedPct = Math.min(excess * excess * 25, 40); // cap at 40%
    return Math.round(clamp(100 - exceedPct, 60, 100));
  };

  const latInDesign  = timeInZone(latMax,  THRESHOLDS.lat_accel.healthy,   THRESHOLDS.lat_accel.crit);
  const longInDesign = timeInZone(longMax, THRESHOLDS.long_accel.healthy,  THRESHOLDS.long_accel.crit);
  const epsInDesign  = timeInZone(epsMax,  THRESHOLDS.eps_current.healthy, THRESHOLDS.eps_current.crit);
  const yawInDesign  = timeInZone(yawMax,  THRESHOLDS.yaw_rate.healthy,    THRESHOLDS.yaw_rate.crit);

  // Friction circle utilisation = peak combined accel / critical limit
  const frictionUtil = Math.sqrt(latMax ** 2 + longMax ** 2) / THRESHOLDS.lat_accel.crit * 100;

  // Individual 0-100 scores
  const latScore  = Math.round(scoreLinear(latMax,  THRESHOLDS.lat_accel.healthy,   THRESHOLDS.lat_accel.warn,   THRESHOLDS.lat_accel.crit));
  const longScore = Math.round(scoreLinear(longMax, THRESHOLDS.long_accel.healthy,  THRESHOLDS.long_accel.warn,  THRESHOLDS.long_accel.crit));
  const epsScore  = Math.round(scoreLinear(epsMax,  THRESHOLDS.eps_current.healthy, THRESHOLDS.eps_current.warn, THRESHOLDS.eps_current.crit));
  const yawScore  = Math.round(scoreLinear(yawMax,  THRESHOLDS.yaw_rate.healthy,    THRESHOLDS.yaw_rate.warn,    THRESHOLDS.yaw_rate.crit));

  const overall = Math.round((latScore + longScore + epsScore + yawScore) / 4);

  return {
    latScore, longScore, epsScore, yawScore, overall,
    latInDesign, longInDesign, epsInDesign, yawInDesign,
    latMargin, longMargin, epsMargin, yawMargin, whlMargin,
    frictionUtil: Math.round(frictionUtil),
  };
}

// ─── After Sales Urgency Classification (I-12 fix) ────────────────────────────
// Thresholds are now relative to the nominal service interval,
// not hardcoded absolute km values.
// OK:      km remaining > 50% of nominal interval
// MONITOR: km remaining > 25% of nominal interval
// ACTION:  km remaining > 10% of nominal interval
// URGENT:  km remaining ≤ 10% of nominal interval
export type Urgency = "OK" | "MONITOR" | "ACTION" | "URGENT";

function distanceToUrgency(kmRemaining: number, nominalInterval: number): Urgency {
  const pct = kmRemaining / nominalInterval;
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
      urgency: distanceToUrgency(svc.brakePads, SERVICE_INTERVALS.brake_pads),
      action:  "Inspect pads & fluid",
      bullets: [
        `${KPI_DATA.VD_09[trip]} hard braking events`,
        `${d.abs_events} ABS activations (estimated)`,
        `Brake duty: ${KPI_DATA.VD_17[trip].toFixed(1)}% of trip`,
      ],
      wearRate: rates.brakeWearRate,
    },
    eps: {
      kmRemaining: svc.epsWindings,
      urgency: distanceToUrgency(svc.epsWindings, SERVICE_INTERVALS.eps_motor_windings),
      action:  "Check winding resistance & thermal logs",
      bullets: [
        `Peak current: ${KPI_DATA.VD_14[trip]} Arms`,
        `Mean current: ${KPI_DATA.VD_13[trip].toFixed(2)} Arms`,
        `Cum. load: ${d.eps_cumulative_load} Arms·s (estimated)`,
      ],
      wearRate: rates.epsLoadRate,
    },
    tyres: {
      kmRemaining: svc.tyres,
      urgency: distanceToUrgency(svc.tyres, SERVICE_INTERVALS.tyres),
      action:  "Rotation + pressure check",
      bullets: [
        `Pressure range: ${Math.min(d.tyre_pressure_fl, d.tyre_pressure_fr, d.tyre_pressure_rl, d.tyre_pressure_rr)}–${Math.max(d.tyre_pressure_fl, d.tyre_pressure_fr, d.tyre_pressure_rl, d.tyre_pressure_rr)} kPa (est.)`,
        `Max imbalance: ${Math.max(d.tyre_pressure_fl, d.tyre_pressure_fr) - Math.min(d.tyre_pressure_rl, d.tyre_pressure_rr)} kPa`,
        `${d.hard_lateral_events} hard lateral events (estimated)`,
      ],
      wearRate: rates.tyreStressRate,
    },
    suspension: {
      kmRemaining: svc.suspBushings,
      urgency: distanceToUrgency(svc.suspBushings, SERVICE_INTERVALS.suspension_bushings),
      action:  "Inspect for wear/deformation",
      bullets: [
        `Long. accel max: ${KPI_DATA.VD_07[trip].toFixed(2)} m/s²`,
        `Lat. accel max: ${KPI_DATA.VD_05[trip].toFixed(2)} m/s²`,
        `${KPI_DATA.VD_09[trip] + d.hard_lateral_events + KPI_DATA.VD_10[trip]} combined hard events`,
      ],
      wearRate: rates.suspFatigueRate,
    },
    steering: {
      kmRemaining: svc.steeringRackCV,
      urgency: distanceToUrgency(svc.steeringRackCV, SERVICE_INTERVALS.steering_rack_cv),
      action:  "Check for play and boot condition",
      bullets: [
        `Reversal rate: ${KPI_DATA.VD_12[trip].toFixed(1)} rev/min`,
        `Max steer angle: ${d.steering_angle_max}° (estimated)`,
        `${KPI_DATA.VD_11[trip]} high yaw events`,
      ],
      wearRate: 0,
    },
    drivetrain: {
      kmRemaining: svc.drivetrainMounts,
      urgency: distanceToUrgency(svc.drivetrainMounts, SERVICE_INTERVALS.drivetrain_mounts),
      action:  "Inspect mounts & diff fluid",
      bullets: [
        `${KPI_DATA.VD_10[trip]} hard acceleration events`,
        `Motor max: ${d.motor_rpm_max} RPM (estimated)`,
        `${d.esp_events} ESP activations (estimated)`,
      ],
      wearRate: 0,
    },
  };
}

// ─── After Sales Scores for Overview (principled divisors: km/interval×100) ──
// I-12 fix: score = clamp(km_remaining / nominal_interval × 100, 0, 100)
export function computeAfterSalesScores(trip: TripId) {
  const as = computeAfterSales(trip);

  const brakeScore = clamp(Math.round(as.brake.kmRemaining      / SERVICE_INTERVALS.brake_pads          * 100), 0, 100);
  const steerScore = clamp(Math.round(as.steering.kmRemaining    / SERVICE_INTERVALS.steering_rack_cv    * 100), 0, 100);
  const tyreScore  = clamp(Math.round(as.tyres.kmRemaining       / SERVICE_INTERVALS.tyres               * 100), 0, 100);
  const driveScore = clamp(Math.round(as.drivetrain.kmRemaining  / SERVICE_INTERVALS.drivetrain_mounts   * 100), 0, 100);

  const overall = Math.round((brakeScore + steerScore + tyreScore + driveScore) / 4);
  return { brakeScore, steerScore, tyreScore, driveScore, overall };
}

// ─── Full Trip Summary ────────────────────────────────────────────────────────
export function computeTripSummary(trip: TripId) {
  const quality     = computeQualityScores(trip);
  const engineering = computeEngineeringScores(trip);
  const afterSales  = computeAfterSalesScores(trip);

  return {
    trip,
    meta: TRIP_META[trip],
    qualityScore:     quality.overall,
    engineeringScore: engineering.overall,
    afterSalesScore:  afterSales.overall,
    quality,
    engineering,
    afterSales,
  };
}

// ─── Speed & Acceleration Profile ─────────────────────────────────────────────
// ⚠ ILLUSTRATIVE — generated from trip aggregate KPIs, not real time-series.
// Shape is parameterised by VD_04 (speed std dev) and VD_08 (accel std dev).
// Label this chart clearly in the UI (I-04 fix).
export function generateSpeedProfile(trip: TripId) {
  const meta = TRIP_META[trip];
  const pts  = 80;
  const speedStd = KPI_DATA.VD_04[trip];
  const accelStd = KPI_DATA.VD_08[trip];

  return Array.from({ length: pts }, (_, i) => {
    const t = i / pts;
    const baseSpeed =
      t < 0.05 ? (t / 0.05) * 55
      : t > 0.90 ? ((1 - t) / 0.10) * 55
      : 38 + speedStd * Math.sin(i * 0.7) + speedStd * 0.3 * Math.sin(i * 2.1);
    const accel = accelStd * (Math.sin(i * 1.3) + 0.3 * Math.sin(i * 3.7));
    return {
      time:  +(t * meta.duration_h).toFixed(3),
      speed: +Math.max(0, baseSpeed).toFixed(1),
      accel: +Math.max(-2, Math.min(2, accel)).toFixed(3),
    };
  });
}

// ─── Friction Circle Points ────────────────────────────────────────────────────
// ⚠ ESTIMATED — bivariate normal distribution parameterised by VD_05/06/07/08.
// NOT real paired lat/long accel samples from CAN time-series (I-05 fix).
// Points are bounded by observed max values so they never exceed measured peaks.
export function generateFrictionPoints(trip: TripId) {
  const latMax  = KPI_DATA.VD_05[trip];
  const longMax = KPI_DATA.VD_07[trip];
  const latStd  = KPI_DATA.VD_06[trip];
  const longStd = KPI_DATA.VD_08[trip];

  return Array.from({ length: 400 }, () => {
    const lat = (Math.random() - 0.5) * 2 * latStd * 3.2;
    const lng = (Math.random() * 0.75 - 0.35) * longStd * 4.5;
    const combined = Math.sqrt(lat ** 2 + lng ** 2);
    // Hard-cap at observed peak values so chart respects real measurements
    if (Math.abs(lat) > latMax || Math.abs(lng) > longMax) return null;
    return { lat: +lat.toFixed(3), lng: +lng.toFixed(3), combined: +combined.toFixed(3) };
  }).filter(Boolean) as { lat: number; lng: number; combined: number }[];
}

// ─── EPS Linearity Data ────────────────────────────────────────────────────────
// ⚠ ESTIMATED — illustrative scatter around linear slope (I-06 fix).
// Real implementation needs paired EPSCtrlCrr vs EPSTrqSnsrVl CAN samples.
// Slope is physically derived: mean EPS current / (mean torque estimate from VD_12).
export function generateEPSLinearityData(trip: TripId) {
  const meanCurrent = KPI_DATA.VD_13[trip];
  const peakCurrent = KPI_DATA.VD_14[trip];
  // Estimated slope: Arms per Nm — at mean torque (~1.5 Nm) we see mean current
  const slope = meanCurrent / 1.5;

  return Array.from({ length: 60 }, (_, i) => {
    const torque   = i * 0.15;
    const expected = Math.min(torque * slope * 6, peakCurrent * 0.98);
    const noise    = (Math.random() - 0.5) * meanCurrent * 0.6;
    const actual   = Math.max(0, Math.min(peakCurrent, expected + noise));
    return { torque: +torque.toFixed(2), expected: +expected.toFixed(1), actual: +actual.toFixed(1) };
  });
}

// ─── Wheel Speed Differential Data ────────────────────────────────────────────
// ⚠ ESTIMATED — illustrative over time (I-07 fix).
// VD_01 (km/h) converted to RPM via ÷ 0.12 (wheel circ ~2.0m).
// Real values need WhlSpdFL, WhlSpdFR time-series.
export function generateWheelDiffData(trip: TripId) {
  const meanDiffRPM = KPI_DATA.VD_01[trip] / 0.12; // correct unit conversion
  const duration    = TRIP_META[trip].duration_h;

  return Array.from({ length: 100 }, (_, i) => ({
    t:    +(i / 100 * duration).toFixed(3),
    diff: +Math.max(0, meanDiffRPM + (Math.random() - 0.5) * meanDiffRPM * 2.5).toFixed(2),
  }));
}
