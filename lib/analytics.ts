import type { EnergyPoint, ForecastPoint } from "./types";

export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const remainder = position - base;
  const next = sorted[base + 1];
  return next === undefined
    ? sorted[base]
    : sorted[base] + remainder * (next - sorted[base]);
}

export function calculateEnergyBalance(point: Pick<EnergyPoint, "gridKw" | "pvKw" | "bessKw" | "loadKw">) {
  const residualKw = point.gridKw + point.pvKw + point.bessKw - point.loadKw;
  const scale = Math.max(Math.abs(point.loadKw), 1);
  return {
    residualKw,
    residualPct: (residualKw / scale) * 100,
    withinTolerance: Math.abs(residualKw / scale) <= 0.03,
  };
}

export function buildSeasonalQuantileForecast(history: number[], horizon: number): ForecastPoint[] {
  const recent = history.slice(-Math.min(history.length, 48));
  const residuals = recent.slice(1).map((value, index) => value - recent[index]);
  const lowError = quantile(residuals, 0.05);
  const highError = quantile(residuals, 0.95);
  return Array.from({ length: horizon }, (_, index) => {
    const seasonal = recent[index % recent.length] ?? recent.at(-1) ?? 0;
    const uncertainty = 1 + index / Math.max(horizon, 1);
    return {
      label: `+${index + 1}h`,
      p05: Math.max(0, seasonal + lowError * uncertainty - 12),
      p50: seasonal,
      p95: seasonal + highError * uncertainty + 12,
    };
  });
}

export function calculateDataQualityScore(input: {
  expectedRows: number;
  observedRows: number;
  duplicateRows: number;
  frozenRows: number;
  outOfRangeRows: number;
}) {
  const missing = Math.max(0, input.expectedRows - input.observedRows);
  const issues = missing + input.duplicateRows + input.frozenRows + input.outOfRangeRows;
  return Math.max(0, Math.round(100 * (1 - issues / Math.max(input.expectedRows, 1))));
}

export function calculateScope2(gridImportKwh: number, factorKgCo2ePerKwh: number) {
  return {
    kgCo2e: gridImportKwh * factorKgCo2ePerKwh,
    tCo2e: (gridImportKwh * factorKgCo2ePerKwh) / 1000,
  };
}

export function diagnoseBess(points: EnergyPoint[]) {
  let inconsistentIntervals = 0;
  let throughputKwh = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const socDelta = current.socPct - previous.socPct;
    throughputKwh += Math.abs(current.bessKw) * 0.5;
    const expectedDirection = current.bessKw > 2 ? -1 : current.bessKw < -2 ? 1 : 0;
    if (expectedDirection !== 0 && Math.sign(socDelta) !== expectedDirection) {
      inconsistentIntervals += 1;
    }
  }
  return { inconsistentIntervals, throughputKwh };
}

export function estimatePvLoss(actualKw: number[], expectedKw: number[], intervalHours = 0.5) {
  return actualKw.reduce(
    (sum, value, index) => sum + Math.max(0, (expectedKw[index] ?? value) - value) * intervalHours,
    0,
  );
}
