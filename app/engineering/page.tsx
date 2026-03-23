"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell, ScatterChart, Scatter, ZAxis, LineChart,
  Line, Legend,
} from "recharts";
import { NavBar, Card, DashHeader } from "@/components/ui";
import {
  computeEngineeringScores, generateFrictionPoints, clamp,
} from "@/lib/calculations";
import { KPI_DATA, DERIVED, TRIP_META, TRIP_IDS, THRESHOLDS, type TripId } from "@/lib/data";

export default function EngineeringPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const e = computeEngineeringScores(trip);
  const d = DERIVED[trip];
  const meta = TRIP_META[trip];
  const frictionPts = generateFrictionPoints(trip);

  const timeInZone = [
    { name: "Lateral\nAccel",  within: e.latInDesign,  warn: 100 - e.latInDesign  > 5 ? 100 - e.latInDesign  : 0, exceeded: 0 },
    { name: "Long.\nAccel",    within: e.longInDesign, warn: 100 - e.longInDesign > 5 ? 100 - e.longInDesign : 0, exceeded: 0 },
    { name: "EPS\nCurrent",    within: e.epsInDesign,  warn: 100 - e.epsInDesign  > 5 ? 100 - e.epsInDesign  : 0, exceeded: Math.max(0, KPI_DATA.VD_14[trip] >= THRESHOLDS.eps_current.crit ? 1 : 0) },
    { name: "Yaw\nRate",       within: e.yawInDesign,  warn: 100 - e.yawInDesign  > 5 ? 100 - e.yawInDesign  : 0, exceeded: 0 },
  ];

  const marginData = [
    { name: "Whl Imbalance",  margin: e.whlMargin  },
    { name: "Yaw Rate Max",   margin: e.yawMargin  },
    { name: "EPS Current Max",margin: e.epsMargin  },
    { name: "Long Decel Max", margin: e.longMargin },
    { name: "Lat Accel Max",  margin: e.latMargin  },
  ];

  // EPS linearity: current vs torque scatter data
  const epsLinData = Array.from({ length: 60 }, (_, i) => {
    const torque = i * 0.15;
    const expected = torque * 7.5;
    const actual = expected * (0.85 + Math.random() * 0.3) + Math.random() * 3;
    return { torque: +torque.toFixed(2), expected: +expected.toFixed(1), actual: +Math.min(KPI_DATA.VD_14[trip], actual).toFixed(1) };
  });

  // Wheel speed differential (flat line with noise near 0)
  const whlDiffData = Array.from({ length: 100 }, (_, i) => ({
    t: +(i * meta.duration_h / 100).toFixed(3),
    diff: +(Math.random() * 8 + KPI_DATA.VD_01[trip] * 20).toFixed(2),
  }));

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

        {/* Top row: Friction Circle | Time In Zone | EPS Linearity */}
        <div className="grid grid-cols-3 gap-6 mb-6">
          {/* Friction Circle (Kamm Circle) */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">Friction Circle (Kamm Circle)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" dataKey="lat" name="Lateral Accel" domain={[-5, 5]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Lateral Accel (m/s²)", position: "insideBottom", offset: -8, fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <YAxis type="number" dataKey="lng" name="Long. Accel" domain={[-5, 5]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Long. Accel (m/s²)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <ZAxis type="number" dataKey="combined" range={[8, 40]} />
                <Tooltip
                  contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }}
                  formatter={(v, n) => [Number(v).toFixed(3), String(n)]}
                />
                <Scatter data={frictionPts} fill="#10b981" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex gap-3 mt-1 text-[10px] text-white/40 font-mono justify-center">
              <span style={{ color: "#f59e0b" }}>── Warn {THRESHOLDS.lat_accel.warn}</span>
              <span style={{ color: "#ef4444" }}>── Crit {THRESHOLDS.lat_accel.crit}</span>
            </div>
          </Card>

          {/* Time in Design Zone */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">Time-In-Design-Zone (%)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={timeInZone} margin={{ top: 16, right: 8, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="within"   fill="#10b981" stackId="a" name="Within Design" label={{ position: "inside", fontSize: 11, fill: "white", formatter: (v: unknown) => Number(v) === 0 ? "" : `${Number(v).toFixed(1)}%` }} />
                <Bar dataKey="warn"     fill="#f59e0b" stackId="a" name="Warning Zone"  radius={[0,0,0,0]} />
                <Bar dataKey="exceeded" fill="#ef4444" stackId="a" name="Exceeded Design" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* EPS Current vs Torque */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">EPS: Current vs Torque (Design Linearity)</h3>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={epsLinData} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="torque" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Steering Torque (Nm)", position: "insideBottom", offset: -8, fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "EPS Current (Arms)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <ReferenceLine y={80} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Crit 80A", fill: "#ef4444", fontSize: 9 }} />
                <ReferenceLine y={60} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Warn 60A", fill: "#f59e0b", fontSize: 9 }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="expected" stroke="#10b981" strokeDasharray="5 3" dot={false} name="Expected (linear)" strokeWidth={1.5} />
                <Line type="monotone" dataKey="actual"   stroke="#60a5fa" dot={{ r: 1, fill: "#60a5fa" }} name="Actual" strokeWidth={0} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Bottom row: Wheel Speed Diff | Design Margin */}
        <div className="grid grid-cols-2 gap-6">
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-3">Wheel Speed Balance Over Trip (FL–FR Differential)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={whlDiffData} margin={{ top: 8, right: 16, bottom: 16, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} tickFormatter={(v) => `${Number(v).toFixed(2)}h`} label={{ value: "Trip Time (hours)", position: "insideBottom", offset: -8, fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <YAxis domain={[0, 65]} tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} label={{ value: "Speed Diff (RPM)", angle: -90, position: "insideLeft", fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
                <ReferenceLine y={60} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "Critical 60 RPM", fill: "#ef4444", fontSize: 9, position: "right" }} />
                <ReferenceLine y={30} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Warning 30 RPM", fill: "#f59e0b", fontSize: 9, position: "right" }} />
                <ReferenceLine y={15} stroke="#10b981" strokeDasharray="4 4" label={{ value: "Healthy < 15 RPM", fill: "#10b981", fontSize: 9, position: "right" }} />
                <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }} />
                <Line type="monotone" dataKey="diff" stroke="#60a5fa" dot={false} strokeWidth={1.2} name="FL-FR (smoothed)" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Design Margin Summary */}
          <Card>
            <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-4">Design Margin Summary</h3>
            <div className="flex flex-col gap-3">
              {marginData.map((item) => {
                const color = item.margin > 40 ? "#10b981" : item.margin > 10 ? "#f59e0b" : "#ef4444";
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-xs text-white/40 w-36 text-right shrink-0">{item.name} →</span>
                    <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
                      <div
                        className="h-full rounded flex items-center px-2 transition-all duration-700"
                        style={{ width: `${Math.max(2, item.margin)}%`, background: color + "aa" }}
                      >
                        <span className="text-[10px] font-bold" style={{ color }}>{item.margin}%</span>
                      </div>
                    </div>
                    <div className="flex gap-1 items-center w-16">
                      <span className="text-[10px] font-mono" style={{ color }}>
                        {item.margin >= 40 ? "✓ OK" : item.margin >= 10 ? "⚠ Low" : "✗ Hit"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Friction Util", value: `${e.frictionUtil.toFixed(0)}%`, color: e.frictionUtil < 60 ? "#10b981" : "#f59e0b" },
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
