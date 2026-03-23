"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";
import { NavBar, Card, DashHeader, UrgencyBadge } from "@/components/ui";
import { computeAfterSales, type Urgency } from "@/lib/calculations";
import { TRIP_META, TRIP_IDS, type TripId } from "@/lib/data";

const URGENCY_CONFIG: Record<Urgency, { border: string; headerBg: string; icon: string }> = {
  OK:      { border: "border-emerald-500/40", headerBg: "bg-emerald-900/50", icon: "✓" },
  MONITOR: { border: "border-amber-500/40",   headerBg: "bg-amber-900/50",   icon: "▲" },
  ACTION:  { border: "border-red-500/40",     headerBg: "bg-red-900/50",     icon: "!" },
  URGENT:  { border: "border-red-400/60",     headerBg: "bg-red-800/60",     icon: "!!" },
};

const KM_COLOR = (km: number) => km > 30_000 ? "#10b981" : km > 15_000 ? "#f59e0b" : "#ef4444";

interface ServiceCardProps {
  title: string;
  data: ReturnType<typeof computeAfterSales>[keyof ReturnType<typeof computeAfterSales>];
}

function ServiceCard({ title, data }: ServiceCardProps) {
  const cfg = URGENCY_CONFIG[data.urgency];
  const km = data.kmRemaining;
  const color = KM_COLOR(km);
  return (
    <div className={`rounded-xl border ${cfg.border} bg-white/[0.02] overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.headerBg}`}>
        <span className="text-xs font-bold text-white tracking-wide">{title}</span>
        <UrgencyBadge urgency={data.urgency} />
      </div>
      <div className="px-4 py-3">
        <div className="text-center mb-2">
          <p className="text-[10px] text-white/40 font-mono uppercase">Service in:</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color }}>
            ~{km >= 1000 ? `${Math.round(km / 1000) * 1000}`.replace(/(\d)(?=(\d{3})+$)/g, "$1,") : km} km
          </p>
          <p className="text-[10px] text-white/50 mt-1">{data.action}</p>
        </div>
        <div className="border-t border-white/5 pt-2 mt-2 flex flex-col gap-1">
          {data.bullets.map((b, i) => (
            <p key={i} className="text-[10px] text-white/40">• {b}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AfterSalesPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const as = computeAfterSales(trip);
  const meta = TRIP_META[trip];

  const timelineData = [
    { name: "Brake System",   km: as.brake.kmRemaining,      color: KM_COLOR(as.brake.kmRemaining) },
    { name: "EPS Motor",      km: as.eps.kmRemaining,        color: KM_COLOR(as.eps.kmRemaining) },
    { name: "Tyres & Align.", km: as.tyres.kmRemaining,      color: KM_COLOR(as.tyres.kmRemaining) },
    { name: "Suspension",     km: as.suspension.kmRemaining, color: KM_COLOR(as.suspension.kmRemaining) },
    { name: "Steering",       km: as.steering.kmRemaining,   color: KM_COLOR(as.steering.kmRemaining) },
    { name: "Drivetrain",     km: as.drivetrain.kmRemaining, color: KM_COLOR(as.drivetrain.kmRemaining) },
  ].sort((a, b) => a.km - b.km);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="AFTER SALES DEPARTMENT — Service Recommendations"
          subtitle={`Vehicle: Maruti YY8 EV Gen 3 · Current Odometer: ~${meta.odometer_km.toLocaleString()} km (this trip) · ${meta.label}`}
          color="#f59e0b"
        />

        <div className="flex justify-center gap-2 mb-6">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-amber-900/40 border-amber-500/40 text-amber-300" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >{t.replace("Trip", "Trip ")}</button>
          ))}
        </div>

        {/* Service Cards — row 1 */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <ServiceCard title="Brake System"    data={as.brake}      />
          <ServiceCard title="EPS Motor"       data={as.eps}        />
          <ServiceCard title="Tyres & Alignment" data={as.tyres}    />
        </div>
        {/* Service Cards — row 2 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <ServiceCard title="Suspension Bushings"   data={as.suspension} />
          <ServiceCard title="Steering Rack & CV Joints" data={as.steering} />
          <ServiceCard title="Drivetrain / Motor Mounts" data={as.drivetrain} />
        </div>

        {/* Service Planning Timeline */}
        <Card>
          <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Service Planning Timeline (km from current odometer)</h3>
          <p className="text-[10px] text-white/25 mb-4 font-mono">Lower = sooner action needed</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={timelineData}
              layout="vertical"
              margin={{ top: 4, right: 80, bottom: 8, left: 110 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100000]}
                tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : `${v}`}
                label={{ value: "km until Service recommended (from current odometer)", position: "insideBottom", offset: -4, fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
              />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }} width={105} />
              <ReferenceLine x={10000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "10k", fill: "#ef4444", fontSize: 9, position: "top" }} />
              <ReferenceLine x={25000} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "25k", fill: "#f59e0b", fontSize: 9, position: "top" }} />
              <Tooltip
                contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }}
                formatter={(v) => [`~${Number(v).toLocaleString()} km`, "Service in"]}
              />
              <Bar dataKey="km" radius={[0, 4, 4, 0]} label={{ position: "right", fontSize: 10, fill: "rgba(255,255,255,0.7)", formatter: (v: unknown) => { const n = Number(v); return `~${Math.round(n / 1000)}k km`; } }}>
                {timelineData.map((entry, i) => (
                  <Cell key={i} fill={entry.color + "bb"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
