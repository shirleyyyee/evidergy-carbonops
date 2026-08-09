import type { AlertRecord, CarbonMonth, DataQualityCheck, EnergyPoint, ForecastPoint } from "./types";

const round = (value: number, digits = 1) => Number(value.toFixed(digits));

export const site = {
  id: "dkp-demo",
  name: "Alice Springs Commercial Precinct",
  location: "Northern Territory, Australia",
  timezone: "Australia/Darwin",
  status: "Live · read-only",
  lastUpdated: "08 Aug 2026 · 14:30 ACST",
};

export const energySeries: EnergyPoint[] = Array.from({ length: 48 }, (_, index) => {
  const hour = index / 2;
  const morningPeak = 58 * Math.exp(-Math.pow(hour - 9, 2) / 5.5);
  const afternoonPeak = 82 * Math.exp(-Math.pow(hour - 15.5, 2) / 8);
  const loadKw = 112 + morningPeak + afternoonPeak + 8 * Math.sin(index * 0.9);
  const pvKw = Math.max(0, 265 * Math.sin(((hour - 6.2) / 12.2) * Math.PI));
  const bessKw = hour < 7 ? -34 : hour > 16.5 && hour < 20.5 ? 58 : hour > 11 && hour < 14 ? -42 : 0;
  const residual = 1.8 * Math.sin(index * 1.7);
  const gridKw = loadKw - pvKw - bessKw + residual;
  const socPct = Math.min(94, Math.max(18, 62 - index * bessKw * 0.0019));
  return {
    label: `${String(Math.floor(hour)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`,
    gridKw: round(gridKw),
    loadKw: round(loadKw),
    pvKw: round(pvKw),
    bessKw: round(bessKw),
    socPct: round(socPct),
    balanceResidualKw: round(residual),
  };
});

export const forecastSeries: ForecastPoint[] = Array.from({ length: 24 }, (_, index) => {
  const hour = index + 1;
  const p50 = 158 + 52 * Math.sin(((hour - 6) / 24) * Math.PI * 2) + (hour > 14 && hour < 19 ? 48 : 0);
  const spread = 20 + index * 0.65;
  return {
    label: `${String((14 + hour) % 24).padStart(2, "0")}:00`,
    p05: round(Math.max(45, p50 - spread)),
    p50: round(p50),
    p95: round(p50 + spread),
    actual: index < 7 ? round(p50 + 7 * Math.sin(index)) : undefined,
  };
});

export const alerts: AlertRecord[] = [
  {
    id: "ALT-2418",
    asset: "PV Array 04",
    title: "Weather-adjusted underperformance",
    detail: "Output remains below the calibrated P05 baseline across 9 consecutive intervals.",
    severity: "critical",
    status: "open",
    startedAt: "Today · 10:15",
    duration: "4h 15m",
    impactKwh: 84.6,
    confidence: 0.91,
    evidence: ["Irradiance stable", "Peer arrays normal", "Data quality passed"],
  },
  {
    id: "ALT-2412",
    asset: "BESS-01",
    title: "SOC–power inconsistency",
    detail: "SOC increased during a measured discharge interval. Check PCS sign convention or telemetry lag.",
    severity: "warning",
    status: "investigating",
    startedAt: "Today · 08:40",
    duration: "25m",
    impactKwh: 0,
    confidence: 0.78,
    evidence: ["3 interval mismatch", "Meter stream complete", "No OEM alarm available"],
  },
  {
    id: "ALT-2399",
    asset: "PCC Meter",
    title: "Energy balance residual elevated",
    detail: "Residual exceeded the site-calibrated 3% tolerance for 4 intervals.",
    severity: "warning",
    status: "open",
    startedAt: "Yesterday · 16:20",
    duration: "20m",
    impactKwh: 0,
    confidence: 0.73,
    evidence: ["Timestamp aligned", "PV meter complete", "Possible auxiliary load"],
  },
  {
    id: "ALT-2374",
    asset: "Weather Station",
    title: "Irradiance channel frozen",
    detail: "Repeated identical readings detected; PV health alerts were suppressed for this interval.",
    severity: "info",
    status: "resolved",
    startedAt: "06 Aug · 12:05",
    duration: "35m",
    impactKwh: 0,
    confidence: 0.98,
    evidence: ["7 duplicate values", "Adjacent temperature changed", "Automatic suppression applied"],
  },
];

export const qualityChecks: DataQualityCheck[] = [
  { name: "Timeline completeness", status: "pass", score: 99.6, affected: "11 of 2,880 rows", evidence: "All gaps flagged; no silent interpolation" },
  { name: "Duplicate timestamps", status: "pass", score: 100, affected: "0 rows", evidence: "Unique site + channel + timestamp" },
  { name: "Frozen sensors", status: "warn", score: 96.8, affected: "Irradiance · 35m", evidence: "7 repeated intervals on 06 Aug" },
  { name: "Physical range", status: "pass", score: 99.9, affected: "2 rows", evidence: "SOC values outside 0–100 quarantined" },
  { name: "Energy balance", status: "warn", score: 95.4, affected: "132 intervals", evidence: "Residual >3% of site load" },
  { name: "Sign convention", status: "pass", score: 100, affected: "0 channels", evidence: "Grid import positive; BESS discharge positive" },
];

export const carbonMonths: CarbonMonth[] = [
  { month: "Feb", gridMwh: 78, pvMwh: 42, emissionsTco2e: 41.3, avoidedTco2e: 22.3 },
  { month: "Mar", gridMwh: 74, pvMwh: 47, emissionsTco2e: 39.2, avoidedTco2e: 24.9 },
  { month: "Apr", gridMwh: 69, pvMwh: 45, emissionsTco2e: 36.6, avoidedTco2e: 23.9 },
  { month: "May", gridMwh: 76, pvMwh: 39, emissionsTco2e: 40.3, avoidedTco2e: 20.7 },
  { month: "Jun", gridMwh: 81, pvMwh: 34, emissionsTco2e: 42.9, avoidedTco2e: 18.0 },
  { month: "Jul", gridMwh: 79, pvMwh: 36, emissionsTco2e: 41.9, avoidedTco2e: 19.1 },
];

export const pvArrays = [
  { name: "Array 01", capacityKw: 88, health: 98, actualKw: 74, expectedKw: 76, status: "Normal" },
  { name: "Array 02", capacityKw: 92, health: 96, actualKw: 76, expectedKw: 80, status: "Normal" },
  { name: "Array 03", capacityKw: 86, health: 93, actualKw: 68, expectedKw: 74, status: "Watch" },
  { name: "Array 04", capacityKw: 84, health: 68, actualKw: 46, expectedKw: 72, status: "Investigate" },
];

export const modelCards = [
  { name: "SITE-LOAD-QRF", version: "v0.8.3", metric: "90% coverage", value: "91.2%", status: "Calibrated" },
  { name: "PV-WEATHER-BASELINE", version: "v0.6.1", metric: "Known-event recall", value: "84.0%", status: "Pilot" },
  { name: "BESS-CONSISTENCY", version: "v0.4.5", metric: "Expert explainability", value: "86.7%", status: "Pilot" },
];
