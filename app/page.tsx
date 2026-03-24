"use client";
import { useState } from "react";
import {
  RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { NavBar, ScoreRing, ScoreBar, Card, DashHeader } from "@/components/ui";
import { computeTripSummary, generateSpeedProfile } from "@/lib/calculations";
import { TRIP_IDS, type TripId } from "@/lib/data";

export default function OverviewPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const s       = computeTripSummary(trip);
  const profile = generateSpeedProfile(trip);

  const radarData = [
    { axis: "Quality",       value: s.qualityScore           },
    { axis: "Brake Stress",  value: s.quality.brakeStress    },
    { axis: "Engineering",   value: s.engineeringScore       },
    { axis: "After Sales",   value: s.afterSalesScore        },
    { axis: "Yaw Stability", value: s.quality.yawStress      },
    { axis: "EPS Health",    value: s.engineering.epsMax     },
  ];

  const statusOf = (score: number) =>
    score >= 80 ? { label: "Healthy",   color: "#10b981" }
    : score >= 60 ? { label: "Watch",   color: "#f59e0b" }
    : { label: "Attention", color: "#ef4444" };

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={s.meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="VEHICLE DYNAMICS — Cross-Team Health Overview"
          subtitle={`${s.meta.label} · Score: 0–100 · All values from CSV KPIs only`}
          color="#ffffff"
        />

        {/* Trip selector */}
        <div className="flex justify-center gap-2 mb-6">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-white/10 border-white/30 text-white" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >{t.replace("Trip", "Trip ")}</button>
          ))}
        </div>

        {/* Three meter cards */}
        <div className="grid grid-cols-3 gap-6 mb-6">

          {/* QUALITY */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-emerald-400 tracking-widest uppercase font-mono">Quality</h2>
                <p className="text-xs mt-0.5" style={{ color: statusOf(s.qualityScore).color }}>
                  {statusOf(s.qualityScore).label}
                </p>
              </div>
              <ScoreRing score={s.qualityScore} label="" size={80} />
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="VD_09 Brake Events" score={s.quality.brakeStress} />
              <ScoreBar label="VD_10 Accel Events" score={s.quality.accelStress} />
              <ScoreBar label="VD_11 Yaw Events"   score={s.quality.yawStress}  />
              <ScoreBar label="VD_17 Brake Duty %"  score={s.quality.brakeDuty}  />
            </div>
            <div className="mt-1 pt-2 border-t border-white/5">
              <p className="text-[9px] text-white/20 font-mono">
                Thresholds: healthy = fleet 25th pct · warn = max×1.3 · crit = max×2.0
              </p>
            </div>
          </Card>

          {/* ENGINEERING */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-blue-400 tracking-widest uppercase font-mono">Engineering</h2>
                <p className="text-xs mt-0.5" style={{ color: statusOf(s.engineeringScore).color }}>
                  {statusOf(s.engineeringScore).label}
                </p>
              </div>
              <ScoreRing score={s.engineeringScore} label="" size={80} color="#3b82f6" />
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="VD_05 Lat Accel Max"  score={s.engineering.latAccel}  />
              <ScoreBar label="VD_07 Long Accel Max" score={s.engineering.longAccel} />
              <ScoreBar label="VD_14 EPS Curr Max"   score={s.engineering.epsMax}    />
              <ScoreBar label="VD_11 Yaw Events"     score={s.engineering.yawEvents} />
            </div>
            <div className="mt-1 pt-2 border-t border-white/5">
              <p className="text-[9px] text-white/20 font-mono">
                Thresholds: healthy = fleet 25th pct · warn = max×1.3 · crit = max×2.0
              </p>
            </div>
          </Card>

          {/* AFTER SALES */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-amber-400 tracking-widest uppercase font-mono">After Sales</h2>
                <p className="text-xs mt-0.5" style={{ color: statusOf(s.afterSalesScore).color }}>
                  {statusOf(s.afterSalesScore).label}
                </p>
              </div>
              <ScoreRing score={s.afterSalesScore} label="" size={80} color="#f59e0b" />
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="VD_09 Brake Events" score={s.afterSales.brakeEvents} />
              <ScoreBar label="VD_14 EPS Max"       score={s.afterSales.epsHealth}   />
              <ScoreBar label="VD_05 Lat Accel Max" score={s.afterSales.latStress}   />
              <ScoreBar label="VD_12 Steer Rev/min" score={s.afterSales.steerRate}   />
            </div>
            <div className="mt-1 pt-2 border-t border-white/5">
              <p className="text-[9px] text-white/20 font-mono">
                Thresholds: healthy = fleet 25th pct · warn = max×1.3 · crit = max×2.0
              </p>
            </div>
          </Card>
        </div>

        {/* Score summary strip */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {TRIP_IDS.map((t) => {
            const ts = computeTripSummary(t);
            return (
              <button key={t} onClick={() => setTrip(t)}
                className={`rounded-xl border p-3 text-left transition-all ${
                  t === trip ? "border-white/20 bg-white/5" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <p className="text-xs font-bold text-white font-mono mb-2">{ts.meta.label}</p>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { label: "Q", score: ts.qualityScore,     color: "#10b981" },
                    { label: "E", score: ts.engineeringScore, color: "#3b82f6" },
                    { label: "A", score: ts.afterSalesScore,  color: "#f59e0b" },
                  ].map(({ label, score, color }) => (
                    <div key={label} className="text-center">
                      <p className="text-[9px] font-mono" style={{ color }}>{label}</p>
                      <p className="text-sm font-bold" style={{
                        color: score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444"
                      }}>{score}</p>
                    </div>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Speed profile + radar */}
        <div className="grid grid-cols-[1fr_300px] gap-6">
          <Card>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest">
                Trip Speed &amp; Acceleration Profile
              </h3>
              <span className="text-[10px] text-amber-400/70 font-mono">
                ⚠ Illustrative — not real CAN time-series
              </span>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={profile} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                  tickFormatter={(v) => `${Number(v).toFixed(2)}h`} />
                <YAxis yAxisId="spd" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis yAxisId="acc" orientation="right" domain={[-2, 2]}
                  tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                <Line yAxisId="spd" type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="Speed (km/h)" />
                <Line yAxisId="acc" type="monotone" dataKey="accel" stroke="#f59e0b" dot={false} strokeWidth={1} name="Accel (m/s²)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">
              Health Radar
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.5)" }} />
                <Radar name="Score" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Trip meta */}
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: "Distance",  value: `${s.meta.distance_km} km`                      },
            { label: "Duration",  value: `${s.meta.duration_h} h`                         },
            { label: "Odometer",  value: `${s.meta.odometer_km.toLocaleString()} km`      },
            { label: "Trip",      value: s.meta.label                                      },
          ].map((stat) => (
            <Card key={stat.label}>
              <p className="text-xs text-white/30 font-mono uppercase tracking-wider">{stat.label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{stat.value}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
