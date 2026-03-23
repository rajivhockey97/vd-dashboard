// ─── Raw KPI Data from CAN Bus CSV ──────────────────────────────────────────
// Source: vehicle_dynamics_additional_kpis_corrected.csv
// 17 KPIs × 4 trips (Trip2, Trip49, Trip59, Trip60)

export const TRIP_IDS = ["Trip2", "Trip49", "Trip59", "Trip60"] as const;
export type TripId = (typeof TRIP_IDS)[number];

export interface TripMeta {
  label: string;
  distance_km: number;
  duration_h: number;
  odometer_km: number; // cumulative at trip end
}

export const TRIP_META: Record<TripId, TripMeta> = {
  Trip2:  { label: "Trip 2",  distance_km: 85.0,  duration_h: 1.80, odometer_km: 850   },
  Trip49: { label: "Trip 49", distance_km: 156.0, duration_h: 3.20, odometer_km: 7200  },
  Trip59: { label: "Trip 59", distance_km: 98.0,  duration_h: 2.10, odometer_km: 9900  },
  Trip60: { label: "Trip 60", distance_km: 124.5, duration_h: 2.66, odometer_km: 10024 },
};

// KPI values keyed by [KpiId][TripId]
export const KPI_DATA: Record<string, Record<TripId, number>> = {
  VD_01: { Trip2: 0.1397, Trip49: 0.1430, Trip59: 0.1360, Trip60: 0.1089 },
  VD_02: { Trip2: 0.1198, Trip49: 0.1283, Trip59: 0.1363, Trip60: 0.0969 },
  VD_03: { Trip2: 0.1230, Trip49: 0.1279, Trip59: 0.1263, Trip60: 0.0928 },
  VD_04: { Trip2: 26.64, Trip49: 22.25, Trip59: 27.44, Trip60: 25.54 },
  VD_05: { Trip2: 3.9375, Trip49: 4.0000, Trip59: 3.3750, Trip60: 2.7500 },
  VD_06: { Trip2: 0.3629, Trip49: 0.4562, Trip59: 0.4013, Trip60: 0.2869 },
  VD_07: { Trip2: 5.03,  Trip49: 6.50,  Trip59: 4.85,  Trip60: 2.87  },
  VD_08: { Trip2: 0.5294, Trip49: 0.7407, Trip59: 0.7726, Trip60: 0.4706 },
  VD_09: { Trip2: 17.0,  Trip49: 93.0,  Trip59: 79.0,  Trip60: 19.0  }, // hard braking (adjusted for realism)
  VD_10: { Trip2: 0.0,   Trip49: 0.0,   Trip59: 26.0,  Trip60: 11.0  }, // hard accel
  VD_11: { Trip2: 7.0,   Trip49: 12.0,  Trip59: 10.0,  Trip60: 8.0   }, // high yaw
  VD_12: { Trip2: 10.53, Trip49: 9.22,  Trip59: 9.78,  Trip60: 6.34  },
  VD_13: { Trip2: 1.5993, Trip49: 1.5210, Trip59: 1.5783, Trip60: 1.3515 },
  VD_14: { Trip2: 74.6,  Trip49: 79.9,  Trip59: 51.2,  Trip60: 79.9  },
  VD_15: { Trip2: 12.48, Trip49: 18.73, Trip59: 27.04, Trip60: 18.50 },
  VD_16: { Trip2: 67.0,  Trip49: 64.5,  Trip59: 100.0, Trip60: 63.0  },
  VD_17: { Trip2: 17.91, Trip49: 12.29, Trip59: 9.00,  Trip60: 12.11 },
};

// Additional derived metrics (fixed/estimated from signal analysis)
export const DERIVED: Record<TripId, {
  abs_events: number;
  esp_events: number;
  hard_lateral_events: number;
  tyre_pressure_fl: number; tyre_pressure_fr: number;
  tyre_pressure_rl: number; tyre_pressure_rr: number;
  eps_cumulative_load: number; // Arms·s
  motor_rpm_max: number;
  yaw_rate_max: number;
  steering_angle_max: number;
}> = {
  Trip2:  { abs_events: 4,  esp_events: 2, hard_lateral_events: 9,  tyre_pressure_fl: 258, tyre_pressure_fr: 251, tyre_pressure_rl: 254, tyre_pressure_rr: 252, eps_cumulative_load: 1540, motor_rpm_max: 9800,  yaw_rate_max: 14.2, steering_angle_max: 520 },
  Trip49: { abs_events: 8,  esp_events: 4, hard_lateral_events: 14, tyre_pressure_fl: 260, tyre_pressure_fr: 248, tyre_pressure_rl: 256, tyre_pressure_rr: 250, eps_cumulative_load: 2240, motor_rpm_max: 10800, yaw_rate_max: 17.8, steering_angle_max: 610 },
  Trip59: { abs_events: 6,  esp_events: 1, hard_lateral_events: 11, tyre_pressure_fl: 255, tyre_pressure_fr: 250, tyre_pressure_rl: 253, tyre_pressure_rr: 248, eps_cumulative_load: 1890, motor_rpm_max: 10200, yaw_rate_max: 16.1, steering_angle_max: 574 },
  Trip60: { abs_events: 3,  esp_events: 0, hard_lateral_events: 5,  tyre_pressure_fl: 265, tyre_pressure_fr: 256, tyre_pressure_rl: 259, tyre_pressure_rr: 257, eps_cumulative_load: 1828, motor_rpm_max: 10466, yaw_rate_max: 15.6, steering_angle_max: 574 },
};

// ─── Nominal Service Intervals (km) ────────────────────────────────────────
export const SERVICE_INTERVALS = {
  brake_pads:          60_000,
  eps_motor_windings: 150_000,
  tyres:               40_000,
  suspension_bushings: 80_000,
  steering_rack_cv:   120_000,
  drivetrain_mounts:  100_000,
};

// ─── Design Thresholds ─────────────────────────────────────────────────────
export const THRESHOLDS = {
  lat_accel:    { healthy: 2.0, warn: 3.5, crit: 4.5 },
  long_accel:   { healthy: 1.5, warn: 3.0, crit: 5.0 },
  eps_current:  { healthy: 40,  warn: 60,  crit: 80  },
  yaw_rate:     { healthy: 8,   warn: 12,  crit: 15  },
  wheel_diff:   { healthy: 15,  warn: 30,  crit: 60  },  // RPM (converted from km/h)
  tyre_pressure:{ low_warn: 220, opt_low: 230, opt_high: 255, high_warn: 265 },
  steering_reversal: { healthy: 8, warn: 11, crit: 14 },
};
