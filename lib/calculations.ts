// ─── Vehicle Dynamics KPI Computation Engine ────────────────────────────────
// Implements scoring, wear rates, and service projections from CAN bus KPIs.
// All formulas based on the VD_Team_Dashboard_Guide methodology.

import {
  KPI_DATA, DERIVED, TRIP_META, SERVICE_INTERVALS, THRESHOLDS,
  type TripId,
} from "./data";

// ─── Piecewise Linear Scoring ──────────────────────────────────────────────
// Maps a raw value to 0-100 where 100=perfect health.
// For "lower is better" metrics, value=0 → score=100; value>=crit → score=0.
function scoreLinear(
  value: number,
  healthy: number,
  warn: number,
  crit: number,
  lowerIsBetter = true
): number {
  const v = lowerIsBetter ? value : -value;
  const h = lowerIsBetter ? healthy : -healthy;
  const w = lowerIsBetter ? warn : -warn;
  const c = lowerIsBetter ? crit : -crit;

  if (v <= h) return 100;
  if (v >= c) return 0;
  if (v <= w) return 100 - ((v - h) / (w - h)) * 40; // 100→60
  return 60 - ((v - w) / (c - w)) * 60; // 60→0
}

export function clamp(v: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, v));
}

// ─── Wear Rate Formulas (from docx §7.2) ────────────────────────────────────
//
// Brake Wear Rate [events-units / 1000 km]
//   = (hard_braking × 0.5 + brake_duty_pct × 0.3 + abs_events × 1.0) / trip_km × 1000
//
// EPS Thermal Load Rate [AU / 1000 km]
//   = eps_cumulative_load / trip_km × 0.5   (Arms·s / km × factor)
//
// Tyre Stress Rate [AU / 1000 km]
//   = (wheel_variance × 10 + hard_lateral × 0.3 + lat_accel_max × 0.5) / trip_km × 1000
//
// Suspension Fatigue Rate [AU / 1000 km]
//   = (hard_braking × 0.2 + hard_lateral × 0.4 + max_decel × 0.3) / trip_km × 1000

export function computeWearRates(trip: TripId) {
  const d = DERIVED[trip];
  const km = TRIP_META[trip].distance_km;

  const brakeWearRate =
    (KPI_DATA.VD_09[trip] * 0.5 +
      KPI_DATA.VD_17[trip] * 0.3 +
      d.abs_events * 1.0) /
    km *
    1000;

  const epsLoadRate = (d.eps_cumulative_load / km) * 0.5;

  const wheelVariance =
    (KPI_DATA.VD_01[trip] ** 2 + KPI_DATA.VD_02[trip] ** 2 + KPI_DATA.VD_03[trip] ** 2) / 3;
  const tyreStressRate =
    (wheelVariance * 10 + d.hard_lateral_events * 0.3 + KPI_DATA.VD_05[trip] * 0.5) /
    km *
    1000;

  const suspFatigueRate =
    (KPI_DATA.VD_09[trip] * 0.2 +
      d.hard_lateral_events * 0.4 +
      KPI_DATA.VD_07[trip] * 0.3) /
    km *
    1000;

  return { brakeWearRate, epsLoadRate, tyreStressRate, suspFatigueRate };
}

// ─── Wear Rate Baselines (healthy operating level) ─────────────────────────
const BASELINES = {
  brakeWearRate: 20,    // events-units/1000km
  epsLoadRate: 5,       // AU/1000km
  tyreStressRate: 15,   // AU/1000km
  suspFatigueRate: 20,  // AU/1000km
};

// Score a wear rate: baseline=100, 2× baseline=60, 3× baseline=0
function scoreWearRate(rate: number, baseline: number): number {
  if (rate <= baseline) return 100;
  if (rate <= baseline * 2) return 100 - ((rate - baseline) / baseline) * 40;
  if (rate <= baseline * 3) return 60 - ((rate - baseline * 2) / baseline) * 60;
  return 0;
}

// ─── Service Distance Projection ───────────────────────────────────────────
// Estimates km remaining until service is recommended.
// Remaining = (nominal_interval - current_odometer) / wear_factor
// where wear_factor = current_rate / baseline_rate (capped at 0.5 min)
export function computeServiceDistances(trip: TripId) {
  const rates = computeWearRates(trip);
  const odo = TRIP_META[trip].odometer_km;

  const wfBrake = Math.max(0.5, rates.brakeWearRate / BASELINES.brakeWearRate);
  const wfEPS   = Math.max(0.5, rates.epsLoadRate   / BASELINES.epsLoadRate);
  const wfTyre  = Math.max(0.5, rates.tyreStressRate / BASELINES.tyreStressRate);
  const wfSusp  = Math.max(0.5, rates.suspFatigueRate / BASELINES.suspFatigueRate);

  // Wear-adjusted effective service intervals
  const adjBrake = SERVICE_INTERVALS.brake_pads         / wfBrake;
  const adjEPS   = SERVICE_INTERVALS.eps_motor_windings / wfEPS;
  const adjTyre  = SERVICE_INTERVALS.tyres              / wfTyre;
  const adjSusp  = SERVICE_INTERVALS.suspension_bushings/ wfSusp;

  // Steering: driven by EPS + steering reversal rate
  const steerLoad = KPI_DATA.VD_12[trip] / THRESHOLDS.steering_reversal.healthy;
  const wfSteer = Math.max(0.5, steerLoad * 0.8);
  const adjSteer = SERVICE_INTERVALS.steering_rack_cv / wfSteer;

  // Drivetrain: driven by hard accel + motor RPM utilisation
  const motorUtil = DERIVED[trip].motor_rpm_max / 10_000;
  const wfDrive = Math.max(0.5, (motorUtil * 0.6 + KPI_DATA.VD_10[trip] / 30 * 0.4));
  const adjDrive = SERVICE_INTERVALS.drivetrain_mounts / wfDrive;

  return {
    brakePads:        Math.max(0, Math.round(adjBrake - odo)),
    epsWindings:      Math.max(0, Math.round(adjEPS   - odo)),
    tyres:            Math.max(0, Math.round(adjTyre  - odo)),
    suspBushings:     Math.max(0, Math.round(adjSusp  - odo)),
    steeringRackCV:   Math.max(0, Math.round(adjSteer - odo)),
    drivetrainMounts: Math.max(0, Math.round(adjDrive - odo)),
  };
}

// ─── Service Life Consumed (% per trip) ────────────────────────────────────
export function computeLifeConsumed(trip: TripId) {
  const rates = computeWearRates(trip);
  const km = TRIP_META[trip].distance_km;

  const brakePct      = (rates.brakeWearRate / (BASELINES.brakeWearRate * 1000)) * km * 100 / SERVICE_INTERVALS.brake_pads * 100;
  const epsPct        = (rates.epsLoadRate   / (BASELINES.epsLoadRate   * 1000)) * km * 100 / SERVICE_INTERVALS.eps_motor_windings * 100;
  const tyrePct       = (rates.tyreStressRate/ (BASELINES.tyreStressRate* 1000)) * km * 100 / SERVICE_INTERVALS.tyres * 100;
  const suspPct       = (rates.suspFatigueRate/(BASELINES.suspFatigueRate*1000)) * km * 100 / SERVICE_INTERVALS.suspension_bushings * 100;

  // km equivalent consumed
  const brakeKmEquiv  = SERVICE_INTERVALS.brake_pads          * (brakePct / 100);
  const epsKmEquiv    = SERVICE_INTERVALS.eps_motor_windings   * (epsPct   / 100);
  const tyreKmEquiv   = SERVICE_INTERVALS.tyres                * (tyrePct  / 100);
  const suspKmEquiv   = SERVICE_INTERVALS.suspension_bushings  * (suspPct  / 100);

  return {
    brakePct, epsPct, tyrePct, suspPct,
    brakeKmEquiv, epsKmEquiv, tyreKmEquiv, suspKmEquiv,
  };
}

// ─── Quality Dashboard Scores ──────────────────────────────────────────────
export function computeQualityScores(trip: TripId) {
  const rates = computeWearRates(trip);

  const brakeScore = scoreWearRate(rates.brakeWearRate, BASELINES.brakeWearRate);
  const epsScore   = scoreWearRate(rates.epsLoadRate,   BASELINES.epsLoadRate);
  const tyreScore  = scoreWearRate(rates.tyreStressRate,BASELINES.tyreStressRate);
  const suspScore  = scoreWearRate(rates.suspFatigueRate,BASELINES.suspFatigueRate);

  const overall = Math.round((brakeScore + epsScore + tyreScore + suspScore) / 4);

  return {
    brakeScore: Math.round(brakeScore),
    epsScore:   Math.round(epsScore),
    tyreScore:  Math.round(tyreScore),
    suspScore:  Math.round(suspScore),
    overall,
    rates,
  };
}

// ─── Engineering Dashboard Scores ──────────────────────────────────────────
// Time-in-design-zone: approximated from max values vs thresholds.
// % within design = max(0, min(100, (crit - max) / (crit - 0) × 100))
export function computeEngineeringScores(trip: TripId) {
  const latMax  = KPI_DATA.VD_05[trip];
  const longMax = KPI_DATA.VD_07[trip];
  const epsMax  = KPI_DATA.VD_14[trip];
  const yawMax  = DERIVED[trip].yaw_rate_max;

  // % time within design zone (estimated from peak vs envelope)
  // If peak is at warn level, ~5% time is near that zone → ~95% within
  const latInDesign  = clamp(Math.round(100 - Math.max(0, latMax  - THRESHOLDS.lat_accel.healthy)  / (THRESHOLDS.lat_accel.crit  - THRESHOLDS.lat_accel.healthy)  * 20), 0, 100);
  const longInDesign = clamp(Math.round(100 - Math.max(0, longMax - THRESHOLDS.long_accel.healthy) / (THRESHOLDS.long_accel.crit - THRESHOLDS.long_accel.healthy) * 20), 0, 100);
  const epsInDesign  = clamp(Math.round(100 - Math.max(0, epsMax  - THRESHOLDS.eps_current.healthy) / (THRESHOLDS.eps_current.crit - THRESHOLDS.eps_current.healthy) * 20), 0, 100);
  const yawInDesign  = clamp(Math.round(100 - Math.max(0, yawMax  - THRESHOLDS.yaw_rate.healthy)   / (THRESHOLDS.yaw_rate.crit  - THRESHOLDS.yaw_rate.healthy)   * 20), 0, 100);

  // Design margin: (critical - observed_max) / critical × 100
  const latMargin  = Math.round(clamp((THRESHOLDS.lat_accel.crit  - latMax)  / THRESHOLDS.lat_accel.crit  * 100, 0, 100));
  const longMargin = Math.round(clamp((THRESHOLDS.long_accel.crit - longMax) / THRESHOLDS.long_accel.crit * 100, 0, 100));
  const epsMargin  = Math.round(clamp((THRESHOLDS.eps_current.crit - epsMax) / THRESHOLDS.eps_current.crit * 100, 0, 100));
  const yawMargin  = Math.round(clamp((THRESHOLDS.yaw_rate.crit   - yawMax)  / THRESHOLDS.yaw_rate.crit   * 100, 0, 100));
  const whlMargin  = Math.round(clamp((THRESHOLDS.wheel_diff.crit - KPI_DATA.VD_01[trip] * 100) / THRESHOLDS.wheel_diff.crit * 100, 0, 100));

  // Friction circle: combined accel as fraction of Kamm circle limit
  const frictionUtil = Math.sqrt(latMax ** 2 + longMax ** 2) / THRESHOLDS.lat_accel.crit * 100;

  // Individual scores
  const latScore  = scoreLinear(latMax,  THRESHOLDS.lat_accel.healthy,  THRESHOLDS.lat_accel.warn,  THRESHOLDS.lat_accel.crit);
  const longScore = scoreLinear(longMax, THRESHOLDS.long_accel.healthy, THRESHOLDS.long_accel.warn, THRESHOLDS.long_accel.crit);
  const epsScore  = scoreLinear(epsMax,  THRESHOLDS.eps_current.healthy, THRESHOLDS.eps_current.warn, THRESHOLDS.eps_current.crit);
  const yawScore  = scoreLinear(yawMax,  THRESHOLDS.yaw_rate.healthy,    THRESHOLDS.yaw_rate.warn,    THRESHOLDS.yaw_rate.crit);

  const overall = Math.round((latScore + longScore + epsScore + yawScore) / 4);

  return {
    latScore: Math.round(latScore), longScore: Math.round(longScore),
    epsScore: Math.round(epsScore), yawScore: Math.round(yawScore),
    overall,
    latInDesign, longInDesign, epsInDesign, yawInDesign,
    latMargin, longMargin, epsMargin, yawMargin, whlMargin,
    frictionUtil,
    // EPS linearity data points: current vs torque sample
    epsLinearitySlope: KPI_DATA.VD_13[trip] / Math.max(1, KPI_DATA.VD_12[trip] * 0.5),
  };
}

// ─── After Sales Urgency ───────────────────────────────────────────────────
export type Urgency = "OK" | "MONITOR" | "ACTION" | "URGENT";

function distanceToUrgency(km: number): Urgency {
  if (km > 30_000) return "OK";
  if (km > 15_000) return "MONITOR";
  if (km > 5_000)  return "ACTION";
  return "URGENT";
}

export function computeAfterSales(trip: TripId) {
  const svc = computeServiceDistances(trip);
  const rates = computeWearRates(trip);
  const d = DERIVED[trip];

  return {
    brake: {
      kmRemaining: svc.brakePads,
      urgency: distanceToUrgency(svc.brakePads),
      action: "Inspect pads & fluid",
      bullets: [
        `${KPI_DATA.VD_09[trip]} hard braking events`,
        `${d.abs_events} ABS activations`,
        `Brake duty: ${KPI_DATA.VD_17[trip].toFixed(1)}% of trip`,
      ],
      wearRate: rates.brakeWearRate,
    },
    eps: {
      kmRemaining: svc.epsWindings,
      urgency: distanceToUrgency(svc.epsWindings),
      action: "Check winding resistance & thermal logs",
      bullets: [
        `Peak current: ${KPI_DATA.VD_14[trip]} Arms`,
        `Mean current: ${KPI_DATA.VD_13[trip].toFixed(2)} Arms`,
        `Cum. load: ${d.eps_cumulative_load} Arms·s`,
      ],
      wearRate: rates.epsLoadRate,
    },
    tyres: {
      kmRemaining: svc.tyres,
      urgency: distanceToUrgency(svc.tyres),
      action: "Rotation + pressure check",
      bullets: [
        `Pressure range: ${Math.min(d.tyre_pressure_fl,d.tyre_pressure_fr,d.tyre_pressure_rl,d.tyre_pressure_rr)}–${Math.max(d.tyre_pressure_fl,d.tyre_pressure_fr,d.tyre_pressure_rl,d.tyre_pressure_rr)} kPa`,
        `Imbalance: ${(Math.max(d.tyre_pressure_fl,d.tyre_pressure_fr)-Math.min(d.tyre_pressure_rl,d.tyre_pressure_rr))} kPa`,
        `${d.hard_lateral_events} hard lateral events`,
      ],
      wearRate: rates.tyreStressRate,
    },
    suspension: {
      kmRemaining: svc.suspBushings,
      urgency: distanceToUrgency(svc.suspBushings),
      action: "Inspect for wear/deformation",
      bullets: [
        `Long. decel max: ${KPI_DATA.VD_07[trip].toFixed(2)} m/s²`,
        `Lat. accel max: ${KPI_DATA.VD_05[trip].toFixed(2)} m/s²`,
        `${KPI_DATA.VD_09[trip] + d.hard_lateral_events + KPI_DATA.VD_10[trip]} combined hard events`,
      ],
      wearRate: rates.suspFatigueRate,
    },
    steering: {
      kmRemaining: svc.steeringRackCV,
      urgency: distanceToUrgency(svc.steeringRackCV),
      action: "Check for play and boot condition",
      bullets: [
        `Reversal rate: ${KPI_DATA.VD_12[trip].toFixed(1)}/min`,
        `Max steer angle: ${DERIVED[trip].steering_angle_max}°`,
        `${KPI_DATA.VD_11[trip]} high yaw events`,
      ],
      wearRate: 0,
    },
    drivetrain: {
      kmRemaining: svc.drivetrainMounts,
      urgency: distanceToUrgency(svc.drivetrainMounts),
      action: "Inspect mounts & diff fluid",
      bullets: [
        `${KPI_DATA.VD_10[trip]} hard acceleration events`,
        `Motor max: ${DERIVED[trip].motor_rpm_max} RPM`,
        `${d.esp_events} ESP activations`,
      ],
      wearRate: 0,
    },
  };
}

// ─── After Sales Component Scores (for overview) ───────────────────────────
export function computeAfterSalesScores(trip: TripId) {
  const as = computeAfterSales(trip);
  const score = (km: number) => clamp(Math.round(km / 1000), 0, 100);

  const brakeScore   = clamp(Math.round(as.brake.kmRemaining      / 600),   0, 100);
  const steerScore   = clamp(Math.round(as.steering.kmRemaining    / 1200),  0, 100);
  const tyreScore    = clamp(Math.round(as.tyres.kmRemaining       / 400),   0, 100);
  const driveScore   = clamp(Math.round(as.drivetrain.kmRemaining  / 1000),  0, 100);

  const overall = Math.round((brakeScore + steerScore + tyreScore + driveScore) / 4);

  return { brakeScore, steerScore, tyreScore, driveScore, overall };
}

// ─── Full Trip Summary ──────────────────────────────────────────────────────
export function computeTripSummary(trip: TripId) {
  const quality    = computeQualityScores(trip);
  const engineering = computeEngineeringScores(trip);
  const afterSales  = computeAfterSalesScores(trip);

  return {
    trip,
    meta: TRIP_META[trip],
    qualityScore:      quality.overall,
    engineeringScore:  engineering.overall,
    afterSalesScore:   afterSales.overall,
    quality,
    engineering,
    afterSales,
  };
}

// ─── Speed & Accel Profile (synthetic from KPI aggregates) ─────────────────
// Generates a plausible time-series profile for the trip overview chart.
export function generateSpeedProfile(trip: TripId) {
  const meta = TRIP_META[trip];
  const points = 80;
  const dt = meta.duration_h / points;
  const speedStd = KPI_DATA.VD_04[trip];
  const accelStd = KPI_DATA.VD_08[trip];

  // Simple speed profile: ramp-up, cruise, variation, ramp-down
  return Array.from({ length: points }, (_, i) => {
    const t = i / points;
    const baseSpeed =
      t < 0.05 ? t / 0.05 * 60
      : t > 0.9  ? (1 - t) / 0.1 * 60
      : 40 + speedStd * Math.sin(i * 0.7) + speedStd * 0.3 * Math.sin(i * 2.1);
    const accel = accelStd * (Math.sin(i * 1.3) + 0.3 * Math.sin(i * 3.7));
    return { time: +(t * meta.duration_h).toFixed(3), speed: +Math.max(0, baseSpeed).toFixed(1), accel: +accel.toFixed(3) };
  });
}

// ─── Friction Circle Points (synthetic from lat/long accel KPIs) ───────────
export function generateFrictionPoints(trip: TripId) {
  const latMax  = KPI_DATA.VD_05[trip];
  const longMax = KPI_DATA.VD_07[trip];
  const latStd  = KPI_DATA.VD_06[trip];
  const longStd = KPI_DATA.VD_08[trip];
  const n = 400;

  return Array.from({ length: n }, (_, i) => {
    // Bivariate normal, biased toward braking (negative long accel)
    const lat  = (Math.random() - 0.5) * 2 * latStd  * 3;
    const lng  = (Math.random() * 0.7 - 0.3) * longStd * 5;
    const combined = Math.sqrt(lat ** 2 + lng ** 2);
    return { lat: +lat.toFixed(3), lng: +lng.toFixed(3), combined: +combined.toFixed(3) };
  }).filter(p => Math.sqrt(p.lat**2 + p.lng**2) < 4.8);
}
