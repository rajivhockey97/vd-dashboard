"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, LineChart, Line,
} from "recharts";
import { NavBar, Card, DashHeader } from "@/components/ui";
import {
  computeEngineeringScores,
  generateFrictionPoints,
  generateEPSLinearityData,
  generateWheelDiffData,
  clamp,
} from "@/lib/calculations";
import { KPI_DATA, DERIVED, TRIP_META, TRIP_IDS, THRESHOLDS, type TripId } from "@/lib/data";

export default function EngineeringPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const e           = computeEngineeringScores(trip);
  const meta        = TRIP_META[trip];
  const frictionPts = generateFrictionPoints(trip);
  const epsLinData  = generateEPSLinearityData(trip);
  const whlDiffData = generateWheelDiffData(trip);

  const timeInZone = [
    { name: "Lateral\nAccel",  within: e.latInDesign,  warn: clamp(100 - e.latInDesign,  0, 15), exceeded: 0 },
    { name: "Long.\nAccel",    within: e.longInDesign, warn: clamp(100 - e.longInDesign, 0, 15), exceeded: 0 },
    { name: "EPS\nCurrent",    within: e.epsInDesign,  warn: clamp(100 - e.epsInDesign,  0, 15), exceeded: Math.max(0, KPI_DATA.VD_14[trip] >= 80 ? 1 : 0) },
    { name: "Yaw\nRate",       within: e.yawInDesign,  warn: clamp(100 - e.yawInDesign,  0, 25), exceeded: DERIVED[trip].yaw_rate_max > THRESHOLDS.yaw_rate.crit ? 5 : 0 },
  ];

  // I-09 fix: margins now use (crit-max)/(crit-healthy) × 100
  const marginData = [
    { name: "Whl Imbalance",   margin: e.whlMargin  },
    { name: "Yaw Rate Max",    margin: e.yawMargin  },
    { name: "EPS Current Max", margin: e.epsMargin  },
    { name: "Long Decel Max",  margin: e.longMargin },
    { name: "Lat Accel Max",   margin: e.latMargin  },
  ];

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="ENGINEERING DEPARTMENT — Design Envelope Compliance"
          subtitle={`${meta.label} · ${meta.distance_km} km · Real-World vs Design Intent · 10 Hz CAN Data`}
          color="#3b82f6"
        />

        <div className="flex justify-center gap-2 mb-6">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-blue-900/40 border-blue-500/40 text-blue-300" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >{t.replace("Trip", "Trip ")}</button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Friction Circle */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest">Friction Circle (Kamm Circle)</h3>
            <p className="text-[10px] text-amber-400/70 mt-0.5 mb-2">⚠ Estimated distribution — not real paired CAN samples (I-05)</p>
            <ResponsiveContainer width="100%" height={240}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="lat" name="Lateral Accel" domain={[-4.5, 4.5]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Lat (m/s²)", position: "insideBottom", offset: -8, fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <YAxis type="number" dataKey="lng" name="Long. Accel"   domain={[-5, 5]}   tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Long (m/s²)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <ZAxis type="number" dataKey="combined" range={[6, 35]} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }}
                  formatter={(v, n) => [Number(v).toFixed(3), String(n)]} />
                <Scatter data={frictionPts} fill="#10b981" fillOpacity={0.55} />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-1 text-[10px] text-white/40 font-mono justify-center">
              <span style={{ color: "#f59e0b" }}>── Warn {THRESHOLDS.lat_accel.warn} m/s²</span>
              <span style={{ color: "#ef4444" }}>── Crit {THRESHOLDS.lat_accel.crit} m/s²</span>
            </div>
          </Card>

          {/* Time in Design Zone — I-08 fix */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest">Time-In-Design-Zone (%)</h3>
            <p className="text-[10px] text-amber-400/70 mt-0.5 mb-2">⚠ Peak-based approximation — requires per-sample CAN count for exact values (I-08)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={timeInZone} margin={{ top: 16, right: 8, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="within"   fill="#10b981" stackId="a" name="Within Design" label={{ position: "inside", fontSize: 11, fill: "white", formatter: (v: unknown) => Number(v) === 0 ? "" : `${Number(v).toFixed(1)}%` }} />
                <Bar dataKey="warn"     fill="#f59e0b" stackId="a" name="Warning Zone"  radius={[0, 0, 0, 0]} />
                <Bar dataKey="exceeded" fill="#ef4444" stackId="a" name="Exceeded"      radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* EPS Linearity — I-06 fix labelled */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest">EPS: Current vs Torque</h3>
            <p className="text-[10px] text-amber-400/70 mt-0.5 mb-2">⚠ Estimated — requires paired EPSCtrlCrr vs EPSTrqSnsrVl CAN samples (I-06)</p>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={epsLinData} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="torque" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Torque (Nm)", position: "insideBottom", offset: -8, fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <YAxis domain={[0, 90]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Current (Arms)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Crit 80A", fill: "#ef4444", fontSize: 9 }} />
                <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Warn 60A", fill: "#f59e0b", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="expected" stroke="#10b981" strokeDasharray="5 3" dot={false} name="Expected (linear)" strokeWidth={1.5} />
                <Line type="monotone" dataKey="actual"   stroke="#60a5fa" dot={{ r: 1.5, fill: "#60a5fa" }} name="Actual (est.)" strokeWidth={0} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Wheel Speed Diff — I-07 fix: correct RPM conversion, labelled */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest">Wheel Speed Balance (FL–FR Differential)</h3>
            <p className="text-[10px] text-amber-400/70 mt-0.5 mb-2">⚠ Estimated — VD_01 (km/h) converted to RPM via ÷ 0.12. Requires WhlSpdFL/FR time-series (I-07)</p>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={whlDiffData} margin={{ top: 8, right: 60, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} tickFormatter={(v) => `${Number(v).toFixed(2)}h`} label={{ value: "Trip Time (hours)", position: "insideBottom", offset: -10, fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <YAxis domain={[0, 65]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Speed Diff (RPM)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 9 }} />
                <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Crit 60 RPM", fill: "#ef4444", fontSize: 9, position: "right" }} />
                <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Warn 30 RPM", fill: "#f59e0b", fontSize: 9, position: "right" }} />
                <ReferenceLine y={15} stroke="#10b981" strokeDasharray="4 4" label={{ value: "OK <15 RPM",  fill: "#10b981", fontSize: 9, position: "right" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="diff" stroke="#60a5fa" dot={false} strokeWidth={1.2} name="FL-FR (est. RPM)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Design Margin — I-09 fix: correct formula */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Design Margin Summary</h3>
            <p className="text-[10px] text-white/25 font-mono mb-4">Formula: (crit - max) / (crit - healthy) × 100  [I-09 fix]</p>
            <div className="flex flex-col gap-3">
              {marginData.map((item) => {
                const color = item.margin > 50 ? "#10b981" : item.margin > 20 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-white/40 w-36 text-right shrink-0">{item.name} →</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                      <div className="h-full rounded flex items-center px-2 transition-all duration-700"
                        style={{ width: `${Math.max(2, item.margin)}%`, background: color + "aa" }}>
                        <span className="text-[10px] font-bold" style={{ color }}>{item.margin}%</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono w-16" style={{ color }}>
                      {item.margin >= 50 ? "OK" : item.margin >= 20 ? "Watch" : "Critical"}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Friction Util", value: `${e.frictionUtil}%`,   color: e.frictionUtil < 70 ? "#10b981" : "#f59e0b" },
                { label: "EPS Score",     value: `${e.epsScore}/100`,     color: e.epsScore >= 80 ? "#10b981" : "#ef4444" },
                { label: "Overall",       value: `${e.overall}/100`,      color: e.overall >= 70 ? "#10b981" : "#f59e0b" },
              ].map(({ label, value, color }) => (
                <div key={label} className="bg-white/5 rounded p-2">
                  <p className="text-[9px] text-white/30 uppercase font-mono">{label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color }}>{value}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
