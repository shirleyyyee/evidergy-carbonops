import assert from "node:assert/strict";
import test from "node:test";
import { buildSeasonalQuantileForecast, calculateDataQualityScore, calculateEnergyBalance, calculateScope2, diagnoseBess } from "../lib/analytics.ts";
import type { EnergyPoint } from "../lib/types.ts";

test("energy balance follows the documented sign convention", () => {
  const result = calculateEnergyBalance({ gridKw: 60, pvKw: 80, bessKw: 20, loadKw: 160 });
  assert.equal(result.residualKw, 0);
  assert.equal(result.withinTolerance, true);
});

test("probabilistic forecast preserves quantile ordering", () => {
  const forecast = buildSeasonalQuantileForecast([100, 110, 105, 130, 125, 140], 12);
  for (const point of forecast) assert.ok(point.p05 <= point.p50 && point.p50 <= point.p95);
});

test("quality score penalises explicit issues", () => {
  assert.equal(calculateDataQualityScore({ expectedRows: 100, observedRows: 98, duplicateRows: 1, frozenRows: 1, outOfRangeRows: 0 }), 96);
});

test("Scope 2 converts kg to tonnes reproducibly", () => {
  assert.deepEqual(calculateScope2(1000, 0.53), { kgCo2e: 530, tCo2e: 0.53 });
});

test("BESS diagnostic catches SOC rising during discharge", () => {
  const base = { label: "00:00", gridKw: 0, loadKw: 0, pvKw: 0, balanceResidualKw: 0 };
  const points: EnergyPoint[] = [{ ...base, bessKw: 0, socPct: 50 }, { ...base, label: "00:30", bessKw: 20, socPct: 52 }];
  assert.equal(diagnoseBess(points).inconsistentIntervals, 1);
});
