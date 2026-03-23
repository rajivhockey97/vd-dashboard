# Vehicle Dynamics Analytics Dashboard

A production-grade, dark-themed analytics dashboard for the **Maruti YY8 EV Gen 3** platform. Built from 10 Hz CAN bus signal data, it serves three operational teams — **Quality**, **Engineering**, and **After Sales** — each with a purpose-built view plus a cross-team overview.

## 📊 Dashboards

| Route | Team | Purpose |
|-------|------|---------|
| `/` | Cross-Team | Health overview radar, trip speed profile, team score cards |
| `/quality` | Quality Dept | Wear rate gauges, hard event counts, tyre pressure, component life consumed |
| `/engineering` | Engineering Dept | Friction circle (Kamm), design envelope compliance, EPS linearity, design margins |
| `/aftersales` | After Sales Dept | Service urgency cards, km-to-next-service, planning timeline Gantt |

## 🧮 KPI Methodology

### Wear Rate Formulas
```
Brake Wear Rate     = (hard_braking × 0.5 + brake_duty% × 0.3 + ABS × 1.0) / km × 1000
EPS Thermal Rate    = cumulative_load / km × 0.5
Tyre Stress Rate    = (wheel_var × 10 + hard_lat × 0.3 + lat_max × 0.5) / km × 1000
Suspension Fatigue  = (hard_brake × 0.2 + hard_lat × 0.4 + max_decel × 0.3) / km × 1000
```

### Service Distance Projection
```
wear_factor         = max(0.5, rate / baseline_rate)
service_distance_km = nominal_interval / wear_factor - odometer
```

## 🚀 Deploy to Vercel

### Option A — Vercel CLI
```bash
npm install -g vercel
vercel login
vercel --prod
```

### Option B — GitHub Import
1. Push this repo to GitHub
2. Go to vercel.com/new → Import repository
3. Framework: Next.js (auto-detected)
4. No env vars needed
5. Click Deploy

## Running Locally
```bash
npm install && npm run dev
```
