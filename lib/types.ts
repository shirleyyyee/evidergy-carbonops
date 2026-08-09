export type Severity = "critical" | "warning" | "info";

export type EnergyPoint = {
  label: string;
  gridKw: number;
  loadKw: number;
  pvKw: number;
  bessKw: number;
  socPct: number;
  balanceResidualKw: number;
};

export type ForecastPoint = {
  label: string;
  p05: number;
  p50: number;
  p95: number;
  actual?: number;
};

export type AlertRecord = {
  id: string;
  asset: string;
  title: string;
  detail: string;
  severity: Severity;
  status: "open" | "investigating" | "resolved";
  startedAt: string;
  duration: string;
  impactKwh: number;
  confidence: number;
  evidence: string[];
};

export type CarbonMonth = {
  month: string;
  gridMwh: number;
  pvMwh: number;
  emissionsTco2e: number;
  avoidedTco2e: number;
};

export type DataQualityCheck = {
  name: string;
  status: "pass" | "warn" | "fail";
  score: number;
  affected: string;
  evidence: string;
};
