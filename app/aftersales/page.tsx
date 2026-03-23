"use client";
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
  ResponsiveContainer, Cell,
} from "recharts";
import { NavBar, Card, DashHeader, UrgencyBadge } from "@/components/ui";
import { computeAfterSales, type Urgency } from "@/lib/calculations";
import { SERVICE_INTERVALS, TRIP_META, TRIP_IDS, type TripId } from "@/lib/data";

const URGENCY_CONFIG: Record<Urgency, { border: string; headerBg: string }> = {
  OK:      { border: "border-emerald-500/40", headerBg: "bg-emerald-900/50" },
  MONITOR: { border: "border-amber-500/40",   headerBg: "bg-amber-900/50"   },
  ACTION:  { border: "border-red-500/40",     headerBg: "bg-red-900/50"     },
  URGENT:  { border: "border-red-400/60",     headerBg: "bg-red-800/60"     },
};

const KM_COLOR = (km: number, interval: number) => {
  const pct = km / interval;
  return pct > 0.5 ? "#10b981" : pct > 0.25 ? "#f59e0b" : "#ef4444";
};

function fmtKm(km: number) {
  if (km === 0) return "OVERDUE";
  if (km >= 1000) return `~${(Math.round(km / 500) * 500).toLocaleString()} km`;
  return `${km} km`;
}

interface ServiceCardProps {
  title: string;
  data: ReturnType<typeof computeAfterSales>[keyof ReturnType<typeof computeAfterSales>];
  interval: number;
}

function ServiceCard({ title, data, interval }: ServiceCardProps) {
  const cfg   = URGENCY_CONFIG[data.urgency];
  const color = KM_COLOR(data.kmRemaining, interval);
  return (
    <div className={`rounded-xl border ${cfg.border} bg-white/[0.02] overflow-hidden`}>
      <div className={`flex items-center justify-between px-4 py-2.5 ${cfg.headerBg}`}>
        <span className="text-xs font-bold text-white tracking-wide">{title}</span>
        <UrgencyBadge urgency={data.urgency} />
      </div>
      <div className="px-4 py-3">
        <div className="text-center mb-2">
          <p className="text-[10px] text-white/40 font-mono uppercase">Service in:</p>
          <p className="text-2xl font-bold mt-0.5" style={{ color }}>{fmtKm(data.kmRemaining)}</p>
          <p className="text-[10px] text-white/50 mt-1">{data.action}</p>
        </div>
        <div className="border-t border-white/5 pt-2 mt-2 flex flex-col gap-1">
          {data.bullets.map((b, i) => (
            <p key={i} className="text-[10px] text-white/40">• {b}</p>
          ))}
        </div>
        {/* mini progress bar: km consumed / interval */}
        <div className="mt-2 h-1 bg-white/5 rounded overflow-hidden">
          <div className="h-full rounded" style={{
            width: `${Math.min(100, (1 - data.kmRemaining / interval) * 100)}%`,
            background: color,
          }} />
        </div>
        <p className="text-[9px] text-white/25 font-mono mt-1 text-right">
          {((1 - data.kmRemaining / interval) * 100).toFixed(1)}% of {(interval/1000).toFixed(0)}k km interval used
        </p>
      </div>
    </div>
  );
}

export default function AfterSalesPage() {
  const [trip, setTrip] = useState<TripId>("Trip60");
  const as   = computeAfterSales(trip);
  const meta = TRIP_META[trip];

  const timelineData = [
    { name: "Brake System",    km: as.brake.kmRemaining,      interval: SERVICE_INTERVALS.brake_pads },
    { name: "EPS Motor",       km: as.eps.kmRemaining,        interval: SERVICE_INTERVALS.eps_motor_windings },
    { name: "Tyres & Align.",  km: as.tyres.kmRemaining,      interval: SERVICE_INTERVALS.tyres },
    { name: "Suspension",      km: as.suspension.kmRemaining, interval: SERVICE_INTERVALS.suspension_bushings },
    { name: "Steering",        km: as.steering.kmRemaining,   interval: SERVICE_INTERVALS.steering_rack_cv },
    { name: "Drivetrain",      km: as.drivetrain.kmRemaining, interval: SERVICE_INTERVALS.drivetrain_mounts },
  ].sort((a, b) => a.km - b.km);

  return (
    <div className="min-h-screen bg-[#0a0e17]">
      <NavBar trip={meta.label} />
      <div className="max-w-[1400px] mx-auto px-6 pb-12">
        <DashHeader
          title="AFTER SALES DEPARTMENT — Service Recommendations"
          subtitle={`Vehicle: Maruti YY8 EV Gen 3 · Odometer: ~${meta.odometer_km.toLocaleString()} km · ${meta.label}`}
          color="#f59e0b"
        />

        <div className="flex justify-center gap-2 mb-2">
          {TRIP_IDS.map((t) => (
            <button key={t} onClick={() => setTrip(t)}
              className={`px-4 py-1.5 rounded-full text-xs font-mono font-medium border transition-all ${
                t === trip ? "bg-amber-900/40 border-amber-500/40 text-amber-300" : "border-white/10 text-white/30 hover:text-white/60"
              }`}
            >{t.replace("Trip", "Trip ")}</button>
          ))}
        </div>

        {/* I-12 fix label */}
        <p className="text-center text-[10px] text-white/25 font-mono mb-4">
          Urgency: OK &gt; 50% · MONITOR &gt; 25% · ACTION &gt; 10% · URGENT ≤ 10% of nominal service interval remaining
        </p>

        <div className="grid grid-cols-3 gap-4 mb-4">
          <ServiceCard title="Brake System"        data={as.brake}      interval={SERVICE_INTERVALS.brake_pads} />
          <ServiceCard title="EPS Motor"           data={as.eps}        interval={SERVICE_INTERVALS.eps_motor_windings} />
          <ServiceCard title="Tyres & Alignment"   data={as.tyres}      interval={SERVICE_INTERVALS.tyres} />
        </div>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <ServiceCard title="Suspension Bushings"      data={as.suspension}  interval={SERVICE_INTERVALS.suspension_bushings} />
          <ServiceCard title="Steering Rack & CV Joints" data={as.steering}   interval={SERVICE_INTERVALS.steering_rack_cv} />
          <ServiceCard title="Drivetrain / Motor Mounts" data={as.drivetrain} interval={SERVICE_INTERVALS.drivetrain_mounts} />
        </div>

        <Card>
          <h3 className="text-xs text-white/40 font-mono uppercase tracking-widest mb-1">Service Planning Timeline (km from current odometer)</h3>
          <p className="text-[10px] text-white/25 mb-4 font-mono">Sorted by urgency · shorter bar = sooner action needed</p>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={timelineData} layout="vertical" margin={{ top: 4, right: 90, bottom: 20, left: 115 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
              <XAxis type="number" domain={[0, 150000]} tick={{ fontSize: 10, fill: "rgba(255,255,255,0.4)" }}
                tickFormatter={(v) => v >= 1000 ? `${v / 1000}k` : `${v}`}
                label={{ value: "km until service recommended (from current odometer)", position: "insideBottom", offset: -12, fill: "rgba(255,255,255,0.3)", fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.6)" }} width={110} />
              <ReferenceLine x={15000} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "15k (Action)", fill: "#ef4444", fontSize: 9, position: "top" }} />
              <ReferenceLine x={30000} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "30k (Monitor)", fill: "#f59e0b", fontSize: 9, position: "top" }} />
              <Tooltip contentStyle={{ background: "#1a1f2e", border: "1px solid rgba(255,255,255,0.1)", fontSize: 11, borderRadius: 8 }}
                formatter={(v) => [`~${Number(v).toLocaleString()} km`, "Service in"]} />
              <Bar dataKey="km" radius={[0, 4, 4, 0]}
                label={{ position: "right", fontSize: 10, fill: "rgba(255,255,255,0.7)", formatter: (v: unknown) => `~${Math.round(Number(v) / 1000)}k km` }}>
                {timelineData.map((entry, i) => (
                  <Cell key={i} fill={KM_COLOR(entry.km, entry.interval) + "bb"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
