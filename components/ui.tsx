"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/",            label: "Overview"     },
  { href: "/quality",     label: "Quality"      },
  { href: "/engineering", label: "Engineering"  },
  { href: "/aftersales",  label: "After Sales"  },
];

export function NavBar({ trip }: { trip: string }) {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1 px-6 py-3 border-b border-white/10 bg-[#0d1117]/80 backdrop-blur sticky top-0 z-50">
      <span className="font-mono text-[11px] text-emerald-400 tracking-widest mr-4 uppercase">
        VD·Analytics
      </span>
      {NAV.map((n) => (
        <Link
          key={n.href}
          href={n.href}
          className={`px-3 py-1.5 rounded text-xs font-medium tracking-wide transition-colors ${
            path === n.href
              ? "bg-white/10 text-white"
              : "text-white/40 hover:text-white/70"
          }`}
        >
          {n.label}
        </Link>
      ))}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-[11px] text-white/30 font-mono">Vehicle: Maruti YY8 EV Gen 3</span>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white/5 text-emerald-400">
          {trip}
        </span>
      </div>
    </nav>
  );
}

// ─── Score Ring (circular gauge) ───────────────────────────────────────────
export function ScoreRing({
  score,
  label,
  size = 120,
  color,
}: {
  score: number;
  label: string;
  size?: number;
  color?: string;
}) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const ringColor = color ?? (score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444");

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" style={{ transform: "rotate(-90deg)" }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={8} />
          <circle
            cx={size/2} cy={size/2} r={r} fill="none"
            stroke={ringColor} strokeWidth={8}
            strokeDasharray={`${dash} ${circ - dash}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color: ringColor }}>{score}</span>
          <span className="text-[10px] text-white/40 font-mono">/ 100</span>
        </div>
      </div>
      <span className="text-[11px] text-white/60 font-medium text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Mini gauge (semi-circle style) ────────────────────────────────────────
export function Gauge({
  value,
  max,
  label,
  unit,
  color,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
}) {
  const pct = Math.min(1, value / max);
  const angle = -90 + pct * 180; // -90° to +90°
  const r = 52;
  const cx = 68, cy = 68;
  const sweep = pct * Math.PI;
  const ex = cx + r * Math.cos(Math.PI + sweep);
  const ey = cy + r * Math.sin(Math.PI + sweep);
  const arcColor = color ?? (pct < 0.5 ? "#10b981" : pct < 0.75 ? "#f59e0b" : "#ef4444");

  const sx = cx - r;
  const sy = cy;
  const pathD = `M ${sx} ${sy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  const fillLen = pct * Math.PI * r;
  const totalLen = Math.PI * r;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-[136px] h-[80px] overflow-hidden">
        <svg width="136" height="80" viewBox="0 0 136 80">
          {/* Track */}
          <path d={pathD} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
          {/* Fill */}
          <path
            d={pathD} fill="none"
            stroke={arcColor} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${fillLen} ${totalLen}`}
          />
          {/* Needle */}
          <line
            x1={cx} y1={cy}
            x2={cx + (r - 8) * Math.cos(Math.PI + pct * Math.PI)}
            y2={cy + (r - 8) * Math.sin(Math.PI + pct * Math.PI)}
            stroke="white" strokeWidth="2" strokeLinecap="round"
          />
          <circle cx={cx} cy={cy} r="4" fill="white" />
          {/* Min / Max labels */}
          <text x="14" y="78" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">0</text>
          <text x={cx + r - 12} y="78" fontSize="9" fill="rgba(255,255,255,0.35)" fontFamily="monospace">{max}</text>
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <span className="text-2xl font-bold leading-none" style={{ color: arcColor }}>
            {value.toFixed(1)}
          </span>
          <span className="text-[9px] text-white/40 font-mono">{unit}</span>
        </div>
      </div>
      <span className="text-[10px] text-white/50 text-center mt-1 leading-tight max-w-[100px]">{label}</span>
    </div>
  );
}

// ─── Score bar ─────────────────────────────────────────────────────────────
export function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#ef4444";
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-white/50 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${score}%`, background: color }}
        />
      </div>
      <span className="text-[11px] font-bold w-8 text-right" style={{ color }}>{score}</span>
    </div>
  );
}

// ─── Urgency badge ─────────────────────────────────────────────────────────
export function UrgencyBadge({ urgency }: { urgency: string }) {
  const cfg: Record<string, { bg: string; text: string; icon: string }> = {
    OK:      { bg: "bg-emerald-900/60 border-emerald-500/40", text: "text-emerald-400", icon: "✓" },
    MONITOR: { bg: "bg-amber-900/60 border-amber-500/40",     text: "text-amber-400",   icon: "▲" },
    ACTION:  { bg: "bg-red-900/60 border-red-500/40",         text: "text-red-400",     icon: "!" },
    URGENT:  { bg: "bg-red-900/80 border-red-400/60",         text: "text-red-300",     icon: "!!" },
  };
  const c = cfg[urgency] ?? cfg.OK;
  return (
    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider ${c.bg} ${c.text}`}>
      <span>{c.icon}</span>
      <span>{urgency}</span>
    </div>
  );
}

// ─── Section header ────────────────────────────────────────────────────────
export function DashHeader({ title, subtitle, color = "#10b981" }: { title: string; subtitle: string; color?: string }) {
  return (
    <div className="text-center py-6">
      <h1 className="text-xl font-bold tracking-widest uppercase font-mono" style={{ color }}>
        {title}
      </h1>
      <p className="text-[12px] text-white/40 mt-1 font-mono">{subtitle}</p>
    </div>
  );
}

// ─── Card wrapper ──────────────────────────────────────────────────────────
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl bg-white/[0.03] border border-white/8 p-4 ${className}`}>
      {children}
    </div>
  );
}
