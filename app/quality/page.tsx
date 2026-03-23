"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";
import { NavBar, Gauge, Card, DashHeader, UrgencyBadge } from "@/components/ui";
import { computeQualityScores, computeLifeConsumed, computeWearRates } from "@/lib/calculations";
import { KPI_DATA, DERIVED, TRIP_META, TRIP_IDS, type TripId } from "@/lib/data";

export default function QualityPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const q = computeQualityScores(trip);
  const life = computeLifeConsumed(trip);
  const d = DERIVED[trip];
  const meta = TRIP_META[trip];

  const hardEvents = [
    { name: "Hard Braking\n(< -1.5 m/s²)",  count: KPI_DATA.VD_09[trip], limit: 20,  color: "#f59e0b" },
    { name: "Hard Accel\n(> +1.5 m/s²)",    count: KPI_DATA.VD_10[trip], limit: 10,  color: "#ef4444" },
    { name: "Hard Lateral\n(> 2.0 m/s²)",   count: d.hard_lateral_events,limit: 15, color: "#10b981" },
    { name: "High Yaw Rate\n(> 8°/s)",       count: KPI_DATA.VD_11[trip], limit: 10, color: "#f59e0b" },
    { name: "ABS\nActivations",              count: d.abs_events,          limit: 5,  color: "#f59e0b" },
    { name: "ESP\nActivations",              count: d.esp_events,          limit: 3,  color: "#10b981" },
  ];

  const pressureData = [
    { name: "Front Left",  psi: d.tyre_pressure_fl },
    { name: "Front Right", psi: d.tyre_pressure_fr },
    { name: "Rear Left",   psi: d.tyre_pressure_rl },
    { name: "Rear Right",  psi: d.tyre_pressure_rr },
  ];

  const lifeData = [
    { name: "Brake Pads & Discs",  pct: life.brakePct, km: life.brakeKmEquiv,  color: "#ef4444",  total: 60000 },
    { name: "EPS Motor Windings",  pct: life.epsPct,   km: life.epsKmEquiv,    color: "#8b5cf6",  total: 150000 },
    { name: "Tyres",               pct: life.tyrePct,  km: life.tyreKmEquiv,   color: "#f59e0b",  total: 40000 },
    { name: "Suspension Bushings", pct: life.suspPct,  km: life.suspKmEquiv,   color: "#06b6d4",  total: 80000 },
  ];

  const gaugeColor = (score: number) =>
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="QUALITY DEPARTMENT — Component Wear & Life Analysis"
          subtitle={`${meta.label} · ${meta.distance_km} km · ${meta.duration_h} h · Maruti YY8 EV Gen 3`}
          color="#10b981"
        />

        {/* Trip selector */}
        <div className="flex justify-center gap-2 mb-6">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-emerald-900/40 border-emerald-500/40 text-emerald-300" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >
              {t.replace("Trip", "Trip ")}
            </button>
          ))}
        </div>

        {/* 4 Wear Rate Gauges */}
        <Card className="mb-6">
          <div className="grid grid-cols-4 gap-6 justify-items-center">
            <div className="flex flex-col items-center gap-2">
              <Gauge value={q.rates.brakeWearRate} max={200} label="Brake Wear Rate" unit="events-units/1000km" color={gaugeColor(q.brakeScore)} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Gauge value={q.rates.epsLoadRate} max={12} label="EPS Thermal Load Rate" unit="AU/1000km" color={gaugeColor(q.epsScore)} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Gauge value={q.rates.tyreStressRate} max={50} label="Tyre Stress Rate" unit="AU/1000km" color={gaugeColor(q.tyreScore)} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <Gauge value={q.rates.suspFatigueRate} max={100} label="Suspension Fatigue Rate" unit="AU/1000km" color={gaugeColor(q.suspScore)} />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6 mt-4 pt-4 border-t border-white/5">
            {[
              { label: "Brake Wear", score: q.brakeScore },
              { label: "EPS Thermal", score: q.epsScore },
              { label: "Tyre Stress", score: q.tyreScore },
              { label: "Suspension", score: q.suspScore },
            ].map(({ label, score }) => (
              <div key={label} className="flex items-center justify-center gap-2">
                <UrgencyBadge urgency={score >= 80 ? "OK" : score >= 60 ? "MONITOR" : "ACTION"} />
                <span className="text-xs text-white/50">{label}</span>
                <span className="font-bold text-sm" style={{ color: gaugeColor(score) }}>{score}/100</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Hard Events Bar Chart */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">Hard Event Count — This Trip</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={hardEvents} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                {hardEvents.map((e) => (
                  <ReferenceLine key={e.name} y={e.limit} stroke="rgba(255,200,0,0.4)" strokeDasharray="4 4" />
                ))}
                <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, fill: "white" }}>
                  {hardEvents.map((entry, i) => (
                    <Cell key={i} fill={entry.count >= entry.limit ? "#ef4444" : entry.count >= entry.limit * 0.7 ? "#f59e0b" : entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Tyre Pressure */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">Tyre Pressure Distribution (kPa)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={pressureData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis domain={[200, 280]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <ReferenceLine y={255} stroke="rgba(255,200,0,0.5)" strokeDasharray="4 4" label={{ value: "High warn 265", fill: "rgba(255,200,0,0.6)", fontSize: 9 }} />
                <ReferenceLine y={230} stroke="rgba(255,200,0,0.3)" strokeDasharray="4 4" label={{ value: "Optimal 230-255", fill: "rgba(255,200,0,0.4)", fontSize: 9 }} />
                <ReferenceLine y={220} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: "Low warn 220", fill: "rgba(239,68,68,0.5)", fontSize: 9 }} />
                <Bar dataKey="psi" fill="#f59e0b" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, fill: "white" }}>
                  {pressureData.map((entry, i) => (
                    <Cell key={i} fill={entry.psi > 265 || entry.psi < 220 ? "#ef4444" : entry.psi >= 230 && entry.psi <= 255 ? "#10b981" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Component Life Consumed */}
        <Card>
          <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">Trip Wear Contribution — km of Component Life Consumed</h3>
          <div className="flex flex-col gap-4">
            {lifeData.map((item) => (
              <div key={item.name} className="flex items-center gap-4">
                <span className="text-xs text-white/50 w-44 shrink-0">{item.name}</span>
                <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden relative">
                  <div
                    className="h-full rounded flex items-center px-2 transition-all duration-700"
                    style={{ width: `${Math.min(100, item.pct * 5)}%`, background: item.color + "cc" }}
                  >
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                      {item.pct.toFixed(2)}% of service life ({item.km.toFixed(1)} km equiv.)
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-white/30 font-mono w-32 text-right">
                  ~{Math.round((item.total - item.km) / 1000)}k km remaining
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
