"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";
import { NavBar, Gauge, Card, DashHeader, UrgencyBadge } from "@/components/ui";
import { computeQualityScores, computeLifeConsumed } from "@/lib/calculations";
import { KPI_DATA, DERIVED, TRIP_META, TRIP_IDS, type TripId } from "@/lib/data";

// I-11 fix: event limits normalised to per-100km for fair cross-trip comparison
function normaliseCount(count: number, tripKm: number) {
  return +(count / tripKm * 100).toFixed(1);
}

export default function QualityPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const q    = computeQualityScores(trip);
  const life = computeLifeConsumed(trip);
  const d    = DERIVED[trip];
  const meta = TRIP_META[trip];

  const gaugeColor = (score: number) =>
    score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";

  // Hard events — normalised to per 100 km (I-11 fix)
  const hardEvents = [
    { name: "Hard Braking",    count: normaliseCount(KPI_DATA.VD_09[trip], meta.distance_km), limit: 15, color: "#f59e0b", raw: KPI_DATA.VD_09[trip] },
    { name: "Hard Accel",      count: normaliseCount(KPI_DATA.VD_10[trip], meta.distance_km), limit: 8,  color: "#ef4444", raw: KPI_DATA.VD_10[trip] },
    { name: "Hard Lateral*",   count: normaliseCount(d.hard_lateral_events, meta.distance_km), limit: 12, color: "#10b981", raw: d.hard_lateral_events },
    { name: "High Yaw Rate",   count: normaliseCount(KPI_DATA.VD_11[trip], meta.distance_km), limit: 8,  color: "#f59e0b", raw: KPI_DATA.VD_11[trip] },
    { name: "ABS Events*",     count: normaliseCount(d.abs_events, meta.distance_km),          limit: 4,  color: "#f59e0b", raw: d.abs_events },
    { name: "ESP Events*",     count: normaliseCount(d.esp_events, meta.distance_km),           limit: 2,  color: "#10b981", raw: d.esp_events },
  ];

  const pressureData = [
    { name: "Front Left",  psi: d.tyre_pressure_fl },
    { name: "Front Right", psi: d.tyre_pressure_fr },
    { name: "Rear Left",   psi: d.tyre_pressure_rl },
    { name: "Rear Right",  psi: d.tyre_pressure_rr },
  ];

  const lifeData = [
    { name: "Brake Pads & Discs",  pct: life.brakePct, km: life.brakeKmEquiv, remaining: life.brakeRemaining, color: "#ef4444",  interval: 60000 },
    { name: "EPS Motor Windings",  pct: life.epsPct,   km: life.epsKmEquiv,   remaining: life.epsRemaining,   color: "#8b5cf6",  interval: 150000 },
    { name: "Tyres",               pct: life.tyrePct,  km: life.tyreKmEquiv,  remaining: life.tyreRemaining,  color: "#f59e0b",  interval: 40000 },
    { name: "Suspension Bushings", pct: life.suspPct,  km: life.suspKmEquiv,  remaining: life.suspRemaining,  color: "#06b6d4",  interval: 80000 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="QUALITY DEPARTMENT — Component Wear & Life Analysis"
          subtitle={`${meta.label} · ${meta.distance_km} km · ${meta.duration_h} h · Maruti YY8 EV Gen 3`}
          color="#10b981"
        />

        <div className="flex justify-center gap-2 mb-6">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-emerald-900/40 border-emerald-500/40 text-emerald-300" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >{t.replace("Trip", "Trip ")}</button>
          ))}
        </div>

        {/* 4 Wear Rate Gauges */}
        <Card className="mb-6">
          <div className="grid grid-cols-4 gap-6 justify-items-center">
            <Gauge value={+q.rates.brakeWearRate.toFixed(1)}   max={300} label="Brake Wear Rate"         unit="events-units/1000km" color={gaugeColor(q.brakeScore)} />
            <Gauge value={+q.rates.epsLoadRate.toFixed(1)}     max={15}  label="EPS Thermal Load Rate"   unit="AU/1000km"           color={gaugeColor(q.epsScore)} />
            <Gauge value={+q.rates.tyreStressRate.toFixed(1)}  max={60}  label="Tyre Stress Rate"        unit="AU/1000km"           color={gaugeColor(q.tyreScore)} />
            <Gauge value={+q.rates.suspFatigueRate.toFixed(1)} max={80}  label="Suspension Fatigue Rate" unit="AU/1000km"           color={gaugeColor(q.suspScore)} />
          </div>
          <div className="grid grid-cols-4 gap-6 mt-4 pt-4 border-t border-white/5 text-center">
            {[
              { label: "Brake Wear",  score: q.brakeScore },
              { label: "EPS Thermal", score: q.epsScore },
              { label: "Tyre Stress", score: q.tyreScore },
              { label: "Suspension",  score: q.suspScore },
            ].map(({ label, score }) => (
              <div key={label} className="flex items-center justify-center gap-2 flex-wrap">
                <UrgencyBadge urgency={score >= 80 ? "OK" : score >= 60 ? "MONITOR" : "ACTION"} />
                <span className="text-xs text-white/50">{label}</span>
                <span className="font-bold text-sm" style={{ color: gaugeColor(score) }}>{score}/100</span>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Hard Events — normalised per 100 km (I-11 fix) */}
          <Card>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest">Hard Event Rate — per 100 km</h3>
              <span className="text-[10px] text-white/25 font-mono">Raw count: {meta.distance_km} km trip</span>
            </div>
            <p className="text-[10px] text-amber-400/70 mb-3">* estimated values (ABS/ESP/Lateral not from CSV)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={hardEvents} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} label={{ value: "per 100 km", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <Tooltip
                  contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }}
                  formatter={(v, _n, entry) => [`${v}/100km (raw: ${entry.payload.raw})`, "Rate"]}
                />
                {hardEvents.map((e) => (
                  <ReferenceLine key={e.name} y={e.limit} stroke="rgba(255,200,0,0.4)" strokeDasharray="4 4" />
                ))}
                <Bar dataKey="count" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 10, fill: "white" }}>
                  {hardEvents.map((entry, i) => (
                    <Cell key={i} fill={entry.count >= entry.limit ? "#ef4444" : entry.count >= entry.limit * 0.7 ? "#f59e0b" : entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Tyre Pressure */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Tyre Pressure Distribution (kPa)</h3>
            <p className="text-[10px] text-amber-400/70 mb-3">⚠ Point-in-time estimates — not mean over trip (I-10)</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={pressureData} margin={{ top: 16, right: 16, bottom: 8, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis domain={[200, 280]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <ReferenceLine y={265} stroke="rgba(255,200,0,0.5)" strokeDasharray="4 4" label={{ value: "High warn 265", fill: "rgba(255,200,0,0.6)", fontSize: 9 }} />
                <ReferenceLine y={230} stroke="rgba(16,185,129,0.4)" strokeDasharray="4 4" label={{ value: "Optimal 230-255", fill: "rgba(16,185,129,0.5)", fontSize: 9 }} />
                <ReferenceLine y={220} stroke="rgba(239,68,68,0.4)" strokeDasharray="4 4" label={{ value: "Low warn 220", fill: "rgba(239,68,68,0.5)", fontSize: 9 }} />
                <Bar dataKey="psi" radius={[4, 4, 0, 0]} label={{ position: "top", fontSize: 11, fill: "white" }}>
                  {pressureData.map((entry, i) => (
                    <Cell key={i} fill={entry.psi > 265 || entry.psi < 220 ? "#ef4444" : entry.psi >= 230 && entry.psi <= 255 ? "#10b981" : "#f59e0b"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Component Life Consumed — I-03 fix applied */}
        <Card>
          <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Trip Wear Contribution — km of Component Life Consumed</h3>
          <p className="text-[10px] text-white/25 font-mono mb-4">Formula: km_consumed = trip_km × (wear_rate / baseline_rate) · pct = km_consumed / service_interval × 100</p>
          <div className="flex flex-col gap-4">
            {lifeData.map((item) => (
              <div key={item.name} className="flex items-center gap-4">
                <span className="text-xs text-white/50 w-44 shrink-0">{item.name}</span>
                <div className="flex-1 h-6 bg-white/5 rounded overflow-hidden">
                  <div
                    className="h-full rounded flex items-center px-2 transition-all duration-700"
                    style={{ width: `${Math.min(100, item.pct * 20)}%`, background: item.color + "cc", minWidth: item.pct > 0 ? "2px" : "0" }}
                  >
                    <span className="text-[10px] font-bold text-white whitespace-nowrap">
                      {item.pct.toFixed(3)}% ({item.km.toFixed(0)} km equiv.)
                    </span>
                  </div>
                </div>
                <span className="text-[10px] text-white/30 font-mono w-36 text-right">
                  ~{Math.round(item.remaining / 1000)}k km remaining
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
