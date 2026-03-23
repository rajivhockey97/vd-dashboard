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
  const s = computeTripSummary(trip);
  const profile = generateSpeedProfile(trip);

  const radarData = [
    { axis: "Quality",        value: s.qualityScore    },
    { axis: "Lat. Dynamics",  value: s.engineering.latScore   },
    { axis: "Engineering",    value: s.engineeringScore       },
    { axis: "After Sales",    value: s.afterSalesScore        },
    { axis: "Yaw Stability",  value: s.engineering.yawScore   },
    { axis: "EPS Health",     value: s.engineering.epsScore   },
  ];

  const statusOf = (score: number) =>
    score >= 80 ? { label: "Healthy", color: "#10b981" }
    : score >= 60 ? { label: "Watch", color: "#f59e0b" }
    : { label: "Attention", color: "#ef4444" };

  const qSt = statusOf(s.qualityScore);
  const eSt = statusOf(s.engineeringScore);
  const aSt = statusOf(s.afterSalesScore);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={s.meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="VEHICLE DYNAMICS — Cross-Team Health Overview"
          subtitle={`${s.meta.label} · All three team signals at a glance · Score: 0-100`}
          color="#ffffff"
        />
        <div className="flex justify-center gap-2 mb-6">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-white/10 border-white/30 text-white" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >
              {t.replace("Trip", "Trip ")}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-6 mb-6">
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-emerald-400 tracking-widest uppercase font-mono">Quality</h2>
                <p className="text-xs mt-0.5" style={{ color: qSt.color }}>{qSt.label}</p>
              </div>
              <ScoreRing score={s.qualityScore} label="" size={80} />
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="Brake Wear"  score={s.quality.brakeScore} />
              <ScoreBar label="Tyre Stress" score={s.quality.tyreScore}  />
              <ScoreBar label="EPS Thermal" score={s.quality.epsScore}   />
              <ScoreBar label="Suspension"  score={s.quality.suspScore}  />
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-blue-400 tracking-widest uppercase font-mono">Engineering</h2>
                <p className="text-xs mt-0.5" style={{ color: eSt.color }}>{eSt.label}</p>
              </div>
              <ScoreRing score={s.engineeringScore} label="" size={80} color="#3b82f6" />
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="Lateral Accel"  score={s.engineering.latScore}  />
              <ScoreBar label="Long. Dynamics" score={s.engineering.longScore} />
              <ScoreBar label="EPS Current"    score={s.engineering.epsScore}  />
              <ScoreBar label="Yaw Rate"       score={s.engineering.yawScore}  />
            </div>
          </Card>
          <Card className="flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-sm font-bold text-amber-400 tracking-widest uppercase font-mono">After Sales</h2>
                <p className="text-xs mt-0.5" style={{ color: aSt.color }}>{aSt.label}</p>
              </div>
              <ScoreRing score={s.afterSalesScore} label="" size={80} color="#f59e0b" />
            </div>
            <div className="flex flex-col gap-2">
              <ScoreBar label="Brake System"  score={s.afterSales.brakeScore}  />
              <ScoreBar label="Steering"      score={s.afterSales.steerScore}  />
              <ScoreBar label="Tyre Pressure" score={s.afterSales.tyreScore}   />
              <ScoreBar label="Drivetrain"    score={s.afterSales.driveScore}  />
            </div>
          </Card>
        </div>
        <div className="grid grid-cols-[1fr_300px] gap-6">
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">Trip Speed &amp; Acceleration Profile</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={profile} margin={{ top: 4, right: 24, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} tickFormatter={(v) => `${Number(v).toFixed(2)}h`} />
                <YAxis yAxisId="spd" stroke="rgba(255,255,255,0.2)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis yAxisId="acc" orientation="right" stroke="rgba(255,255,255,0.1)" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.3)" }} domain={[-2, 2]} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.5)" }} />
                <Line yAxisId="spd" type="monotone" dataKey="speed" stroke="#3b82f6" dot={false} strokeWidth={1.5} name="Speed (km/h)" />
                <Line yAxisId="acc" type="monotone" dataKey="accel" stroke="#f59e0b" dot={false} strokeWidth={1} name="Long. Accel (m/s^2)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">Health Radar</h3>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="axis" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.5)" }} />
                <Radar name="Score" dataKey="value" stroke="#10b981" fill="#10b981" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-6">
          {[
            { label: "Distance",  value: `${s.meta.distance_km} km` },
            { label: "Duration",  value: `${s.meta.duration_h} h`   },
            { label: "Odometer",  value: `${s.meta.odometer_km.toLocaleString()} km` },
            { label: "Trip",      value: s.meta.label               },
          ].map((stat) => (
            <Card key={stat.label} className="flex items-center gap-3">
              <div>
                <p className="text-xs text-white/30 font-mono uppercase tracking-wider">{stat.label}</p>
                <p className="text-sm font-bold text-white">{stat.value}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
