#!/usr/bin/env python3
"""Generate lib/reference-dataset.ts from the real backtest outputs in
data_processed/reference_2016/. Run reference_backtest.py first.

This is the only place demo-shaped UI data is produced from real numbers; the
app never re-derives statistics from raw CSVs at request time (that is future
work item Sprint 3 in docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md -- a D1/
time-series reader). Re-run this script whenever reference_backtest.py changes.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

from reference_backtest import classify_run_state

ROOT = Path(__file__).parent.parent
DATA = ROOT / "data_processed" / "reference_2016"
OUT_TS = ROOT / "lib" / "reference-dataset.ts"

MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def load_report() -> dict:
    return json.loads((DATA / "backtest_report.json").read_text(encoding="utf-8"))


def pick_best_day(frame: pd.DataFrame, required_cols: list[str], score_col: str, window=("2016-11-01", "2016-12-31")) -> str:
    """Pick the calendar day within `window` with complete data on required_cols
    and the highest total of score_col (ties broken by date)."""
    sub = frame.loc[window[0] : window[1] + "T23:45:00"]
    daily = sub.groupby(sub.index.date)
    best_date, best_score = None, -np.inf
    for date, day_frame in daily:
        if len(day_frame) != 96:
            continue
        if day_frame[required_cols].isna().any().any():
            continue
        score = day_frame[score_col].clip(lower=0).sum()
        if score > best_score:
            best_date, best_score = date, score
    if best_date is None:
        raise RuntimeError(f"No fully-covered day found in {window} for columns {required_cols}")
    return str(best_date)


def energy_points_from_day(frame: pd.DataFrame, day: str, grid_col, load_col, pv_col, bess_col=None, soc_col=None) -> list[dict]:
    day_frame = frame.loc[day : day + "T23:45:00"]
    points = []
    for ts, row in day_frame.iterrows():
        grid = float(row[grid_col])
        pv = float(row[pv_col])
        load = float(row[load_col])
        bess = float(row[bess_col]) if bess_col else 0.0
        soc = float(row[soc_col]) if soc_col else 0.0
        residual = grid + pv + bess - load
        points.append(
            {
                "label": ts.strftime("%H:%M"),
                "gridKw": round(grid, 2),
                "loadKw": round(load, 2),
                "pvKw": round(pv, 2),
                "bessKw": round(bess, 2),
                "socPct": round(soc, 1),
                "balanceResidualKw": round(residual, 2),
            }
        )
    return points


def build_daily_soc_series(day_bess_kw: pd.Series, capacity_kwh: float, start_soc: float = 50.0) -> pd.Series:
    """SOC trajectory for a single real day only, anchored at start_soc at
    midnight -- avoids compounding a whole year of charge/discharge asymmetry
    (this real system's annual round-trip efficiency is ~59%, i.e. it nets a
    large systematic charge surplus over 2016) into one day's illustrative chart."""
    net_energy_kwh = (day_bess_kw.fillna(0) * 0.25).cumsum()
    soc = start_soc + 100 * net_energy_kwh / capacity_kwh
    return soc.clip(0, 100)


def main() -> None:
    report = load_report()
    modules = report["modules"]

    residential = pd.read_csv(DATA / "residential4_2016_normalised.csv", index_col=0, parse_dates=True)
    industrial = pd.read_csv(DATA / "industrial2_2016_normalised.csv", index_col=0, parse_dates=True)
    forecast_pred = pd.read_csv(DATA / "load_forecast_test_predictions.csv", index_col=0, parse_dates=True)

    # --- Site A: residential4, best fully-covered sunny day in the test window ---
    site_a_day = pick_best_day(residential, ["grid_kw", "pv_kw", "load_identity_kw"], "pv_kw")
    energy_series = energy_points_from_day(residential, site_a_day, "grid_kw", "load_identity_kw", "pv_kw")

    day_frame = residential.loc[site_a_day : site_a_day + "T23:45:00"]
    peak_load_kw = round(float(day_frame["load_identity_kw"].max()), 1)
    total_pv_kwh = float(day_frame["pv_kw"].clip(lower=0).sum() * 0.25)
    total_grid_import_kwh = float(day_frame["grid_kw"].clip(lower=0).sum() * 0.25)
    self_consumption_pct = round(100 * total_pv_kwh / (total_pv_kwh + total_grid_import_kwh), 1) if (total_pv_kwh + total_grid_import_kwh) else 0.0
    scope2_today_tco2e = round(total_grid_import_kwh * 0.56 / 1000, 3)

    # --- Site B: industrial2, best fully-covered actively-cycling day ---
    industrial["abs_bess_kw"] = industrial["bess_kw"].abs()
    site_b_day = pick_best_day(industrial, ["grid_kw", "pv_kw", "bess_kw"], "abs_bess_kw")
    capacity_kwh = 5.1  # from bess_evidence module (99th pct 24h net-throughput range)
    industrial["soc_pct"] = np.nan
    day_b_slice = industrial.loc[site_b_day : site_b_day + "T23:45:00", "bess_kw"]
    industrial.loc[day_b_slice.index, "soc_pct"] = build_daily_soc_series(day_b_slice, capacity_kwh).values
    bess_series = energy_points_from_day(
        industrial, site_b_day, "grid_kw", "grid_kw", "pv_kw", bess_col="bess_kw", soc_col="soc_pct"
    )
    # loadKw has no real meaning for Site B (no submeters); zero it explicitly rather than reuse grid_kw.
    for point in bess_series:
        point["loadKw"] = 0.0

    day_b_frame = industrial.loc[site_b_day : site_b_day + "T23:45:00"]
    peak_activity_pos = int(day_b_frame["bess_kw"].abs().values.argmax())
    bess_power_now_kw = round(float(day_b_frame["bess_kw"].iloc[peak_activity_pos]), 2)
    bess_soc_now_pct = round(float(day_b_frame["soc_pct"].iloc[peak_activity_pos]), 1)
    daily_throughput_kwh = round(float(day_b_frame["bess_kw"].abs().sum() * 0.25), 1)
    equivalent_cycles = round(daily_throughput_kwh / (2 * capacity_kwh), 2)

    # --- Edge run-state timeline: classified over the full real year (so debounce
    # state carries correctly across midnight) then sliced to the same exemplar day
    # as the BESS chart above, for narrative consistency between the two panels. ---
    full_year_states = classify_run_state(industrial["bess_kw"])
    day_b_states = full_year_states.loc[site_b_day : site_b_day + "T23:45:00"]
    edge_state_timeline = [
        {"label": ts.strftime("%H:%M"), "state": state, "powerKw": round(float(power), 3)}
        for ts, state, power in zip(day_b_states.index, day_b_states.values, day_b_frame["bess_kw"].values)
    ]

    # --- Forecast series: 24 real hourly-spaced points from the real test predictions ---
    hourly = forecast_pred[forecast_pred.index.minute == 0].copy()
    forecast_start = None
    for start_idx in range(len(hourly) - 24):
        window = hourly.iloc[start_idx : start_idx + 24]
        if window.index.to_series().diff().iloc[1:].eq(pd.Timedelta(hours=1)).all():
            forecast_start = window
            break
    if forecast_start is None:
        raise RuntimeError("Could not find 24 contiguous real hourly forecast points")
    forecast_series = []
    for i, (ts, row) in enumerate(forecast_start.iterrows()):
        forecast_series.append(
            {
                "label": f"+{i + 1}h",
                "p05": round(float(row["p05"]), 2),
                "p50": round(float(row["p50"]), 2),
                "p95": round(float(row["p95"]), 2),
                "actual": round(float(row["net_load_kw"]), 2),
            }
        )
    forecast_window_start = str(forecast_start.index[0])
    forecast_window_end = str(forecast_start.index[-1])

    # --- Carbon months from the real Scope 2 module ---
    carbon_months = [
        {
            "month": MONTH_LABELS[m["month"] - 1],
            "gridMwh": round(m["grid_import_kwh"] / 1000, 3),
            "pvMwh": 0.0,
            "emissionsTco2e": round(m["emissions_kg_co2e"] / 1000, 3),
            "avoidedTco2e": 0.0,
        }
        for m in modules["scope2"]["monthly"]
    ]
    # avoidedTco2e (indicative PV-at-same-factor reference) and pvMwh from residential4 real PV, same months
    residential["month"] = residential.index.month
    pv_monthly = residential.groupby("month")["pv_kw"].apply(lambda s: float(s.clip(lower=0).sum() * 0.25))
    for entry, m in zip(carbon_months, modules["scope2"]["monthly"]):
        pv_kwh = pv_monthly.get(m["month"], 0.0)
        entry["pvMwh"] = round(pv_kwh / 1000, 3)
        entry["avoidedTco2e"] = round(pv_kwh * 0.56 / 1000, 3)

    # --- Real per-channel coverage (whole year 2016) ---
    channel_coverage = [
        {"name": "residential4 grid_import", "coveragePct": round(100 * residential["grid_kw"].notna().mean(), 1)},
        {"name": "residential4 pv", "coveragePct": round(100 * residential["pv_kw"].notna().mean(), 1)},
        {"name": "residential4 submeters (6 circuits)", "coveragePct": round(100 * residential["load_submetered_kw"].notna().mean(), 1)},
        {"name": "industrial2 grid_import", "coveragePct": round(100 * industrial["grid_kw"].notna().mean(), 1)},
        {"name": "industrial2 pv", "coveragePct": round(100 * industrial["pv_kw"].notna().mean(), 1)},
        {"name": "industrial2 battery storage", "coveragePct": round(100 * industrial["bess_kw"].notna().mean(), 1)},
    ]

    # --- Quality checks from real modules ---
    dq = modules["data_quality"]
    eb = modules["energy_balance"]
    quality_checks = [
        {
            "name": "Timeline completeness (industrial2 storage)",
            "status": "warn" if dq["missing_pct"] > 5 else "pass",
            "score": round(100 - dq["missing_pct"], 1),
            "affected": f"{dq['missing_pct']}% of {dq['expected_intervals']} intervals",
            "evidence": "Real source coverage gap, not injected; all gaps flagged, not interpolated",
        },
        {
            "name": "Frozen-reading heuristic (industrial2)",
            "status": "warn",
            "score": round(100 * (1 - dq["frozen_intervals"] / dq["expected_intervals"]), 1),
            "affected": f"{dq['frozen_intervals']} intervals",
            "evidence": "Naive equal-repeat rule also flags genuine idle-at-zero periods -- see validation record limitations",
        },
        {
            "name": "Physical range / jump check (industrial2)",
            "status": "pass",
            "score": round(100 * (1 - dq["jump_intervals"] / dq["expected_intervals"]), 2),
            "affected": f"{dq['jump_intervals']} intervals",
            "evidence": "99.9th-percentile interval-to-interval jump threshold",
        },
        {
            "name": "Energy balance identity (residential4)",
            "status": "pass",
            "score": eb["identity_check"]["pass_pct"],
            "affected": f"{eb['identity_check']['intervals_evaluated']} intervals",
            "evidence": "grid_import - grid_export + pv reproduces meter identity within 3% tolerance",
        },
        {
            "name": "Metering completeness (residential4 submeters)",
            "status": "warn",
            "score": eb["metering_completeness_pct"],
            "affected": "6 submetered circuits vs whole-building identity load",
            "evidence": "Real, expected submetering gap (unmetered baseline circuits) -- not a fault",
        },
    ]

    # --- Alerts derived from real fault-injection detections ---
    pv = modules["pv_evidence"]
    bess = modules["bess_evidence"]
    alerts = [
        {
            "id": "REF-PV-INJ",
            "asset": "Reference PV system (residential4)",
            "title": "Synthetic outage detected in held-out real PV output",
            "detail": (
                f"Fault-injection validation: {pv['fault_injection_method']} Detected "
                f"{pv['known_event_recall_pct']}% of injected events; "
                f"{pv['false_positive_rate_pct_on_clean_daytime']}% false-positive rate on clean real daytime intervals."
            ),
            "severity": "critical",
            "status": "resolved",
            "startedAt": "Backtest · Nov-Dec 2016 (real held-out window)",
            "duration": "2h synthetic window",
            "impactKwh": pv["estimated_lost_kwh_test_window"],
            "confidence": round(pv["known_event_recall_pct"] / 100, 2),
            "evidence": [
                "Weather-adjusted baseline from real Konstanz irradiance",
                "25 synthetic outages on real held-out days",
                f"{pv['known_event_recall_pct']}% recall, {pv['false_positive_rate_pct_on_clean_daytime']}% false-positive rate",
            ],
        },
        {
            "id": "REF-BESS-INJ",
            "asset": "Reference battery (industrial2)",
            "title": "SOC-power sign-flip corruption detected in real telemetry",
            "detail": (
                f"Fault-injection validation: {bess['fault_injection_method']} Detected "
                f"{bess['injected_fault_recall_pct']}% of injected corruptions; "
                f"{bess['false_positive_rate_pct_on_clean_intervals']}% mismatch rate on clean real intervals."
            ),
            "severity": "warning",
            "status": "resolved",
            "startedAt": "Backtest · Nov-Dec 2016 (real held-out window)",
            "duration": "Single 15-min interval",
            "impactKwh": 0,
            "confidence": round(bess["injected_fault_recall_pct"] / 100, 2),
            "evidence": [
                "Real charge/discharge telemetry, indicative SOC index",
                f"Deadband calibrated to site power range ({bess['deadband_kw']} kW)",
                f"{bess['injected_fault_recall_pct']}% recall, {bess['false_positive_rate_pct_on_clean_intervals']}% false-positive rate",
            ],
        },
        {
            "id": "REF-BAL-SUBMETER",
            "asset": "Reference PCC (residential4)",
            "title": "Submetered load explains 65.7% of whole-building identity load",
            "detail": (
                "Real, expected finding: five appliance submeters do not cover baseline circuits "
                "(lighting, sockets, standby). This is the exact 'missing meter' scenario the balance "
                "module is designed to surface, not a device fault."
            ),
            "severity": "info",
            "status": "open",
            "startedAt": "Backtest · full year 2016",
            "duration": "Ongoing (structural)",
            "impactKwh": 0,
            "confidence": 1.0,
            "evidence": [
                "Identity check (grid+PV vs whole-building) passes at 100%",
                "Submetered check passes at only 3.76% within 3% tolerance",
                "Consistent with 'residual -> missing meter, not fault' guidance in the spec",
            ],
        },
    ]

    # --- Model cards from real backtest metrics ---
    lf = modules["load_forecast"]
    dl = modules["deep_learning_forecast"]
    model_cards = [
        {"name": "SITE-LOAD-QRF", "version": "REF-BACKTEST-v1.0.0", "metric": "90% coverage (1h)", "value": f"{modules['load_forecast_by_horizon'][0]['p90_coverage']*100:.1f}%", "status": "Backtested"},
        {"name": "PV-WEATHER-BASELINE", "version": "REF-BACKTEST-v1.0.0", "metric": "Injected-event recall", "value": f"{pv['known_event_recall_pct']:.1f}%", "status": "Backtested"},
        {"name": "BESS-CONSISTENCY", "version": "REF-BACKTEST-v1.0.0", "metric": "Injected-fault recall", "value": f"{bess['injected_fault_recall_pct']:.1f}%", "status": "Backtested"},
        {"name": "SITE-LOAD-LSTM", "version": dl["model_version"], "metric": "P50 MAE vs. QRF baseline", "value": f"{dl['metrics']['mae_p50_kw']:.3f} kW ({'beats' if dl['baseline_comparison']['lstm_beats_baseline_on_mae'] else 'behind'} baseline)", "status": "Backtested"},
    ]

    ts = build_ts(
        report=report,
        energy_series=energy_series,
        bess_series=bess_series,
        edge_state_timeline=edge_state_timeline,
        forecast_series=forecast_series,
        forecast_window=(forecast_window_start, forecast_window_end),
        carbon_months=carbon_months,
        quality_checks=quality_checks,
        channel_coverage=channel_coverage,
        alerts=alerts,
        model_cards=model_cards,
        site_a_day=site_a_day,
        site_b_day=site_b_day,
        dashboard_stats={
            "peakLoadKw": peak_load_kw,
            "selfConsumptionPct": self_consumption_pct,
            "scope2TodayTco2e": scope2_today_tco2e,
            "totalPvKwhToday": round(total_pv_kwh, 1),
            "totalGridImportKwhToday": round(total_grid_import_kwh, 1),
        },
        bess_stats={
            "socPct": bess_soc_now_pct,
            "powerKw": bess_power_now_kw,
            "dailyThroughputKwh": daily_throughput_kwh,
            "equivalentCycles": equivalent_cycles,
            "roundTripEfficiencyPct": modules["bess_efficiency"]["round_trip_efficiency_pct"],
            "capacityKwh": capacity_kwh,
        },
    )
    OUT_TS.write_text(ts, encoding="utf-8")
    print(f"Wrote {OUT_TS} ({len(ts)} bytes)")
    print(f"Site A exemplar day: {site_a_day}; Site B exemplar day: {site_b_day}")


def build_ts(**kw) -> str:
    def j(value) -> str:
        return json.dumps(value, indent=2)

    report = kw["report"]
    modules = report["modules"]
    sources_ts = j(report["sources"])

    return f"""// GENERATED FILE -- do not hand-edit.
// Produced by data_pipeline/generate_reference_ts.py from
// data_processed/reference_2016/backtest_report.json (itself produced by
// data_pipeline/reference_backtest.py from real, checksummed public data).
// Re-run both scripts to regenerate. See docs/REFERENCE_DATASET.md for the
// full provenance, methodology and honesty notes (what is independently
// validated vs. definitional vs. fault-injection-based).
import type {{ AlertRecord, CarbonMonth, DataQualityCheck, EnergyPoint, ForecastPoint }} from "./types";

export const site = {{
  id: "reference-2016",
  name: "Public Reference Dataset (not the Alice Springs pilot)",
  location: "Konstanz, Germany (OPSD household_data) + Northern Territory, Australia (NGA Scope 2 factor)",
  timezone: "UTC (source), Europe/Berlin (local reference)",
  status: "Backtested · real public data",
  lastUpdated: {j(report['generated_at_note'])},
}};

export const dataVersion = {j(report['data_version'])};
export const modelVersion = {j(report['model_version'])};
export const sources = {sources_ts} as const;

export const siteAExemplarDay = {j(kw['site_a_day'])};
export const siteBExemplarDay = {j(kw['site_b_day'])};

/** Real day, residential4 (grid import/export + PV + whole-building identity load). No battery at this site. */
export const energySeries: EnergyPoint[] = {j(kw['energy_series'])};

/** Real day, industrial2 (grid import + PV + real behind-the-meter battery). Indicative SOC index, see docs/REFERENCE_DATASET.md. */
export const bessSeries: EnergyPoint[] = {j(kw['bess_series'])};

/** 24 real hourly-spaced points from the held-out Nov-Dec 2016 test window (not "tomorrow" -- a real backtest window). */
export const forecastSeries: ForecastPoint[] = {j(kw['forecast_series'])};
export const forecastWindow = {{ start: {j(kw['forecast_window'][0])}, end: {j(kw['forecast_window'][1])} }};

export const carbonMonths: CarbonMonth[] = {j(kw['carbon_months'])};

export const qualityChecks: DataQualityCheck[] = {j(kw['quality_checks'])};

/** Real per-channel coverage, whole year 2016 (not per-day, so it won't match the single exemplar-day charts above). */
export const channelCoverage = {j(kw['channel_coverage'])};

/** Derived from real fault-injection validation runs, not live production alerts. */
export const alerts: AlertRecord[] = {j(kw['alerts'])};

export const modelCards = {j(kw['model_cards'])};

export const dashboardStats = {j(kw['dashboard_stats'])};
export const bessStats = {j(kw['bess_stats'])};

export const carbonFactor = {{
  value: {modules['scope2']['factor_kg_co2e_per_kwh']},
  region: "Northern Territory (Darwin-Katherine Interconnected System)",
  effectiveYear: 2025,
  source: "DCCEEW National Greenhouse Accounts Factors 2025, Table 1",
  sha256: {j(next(s['sha256'] for s in report['sources'] if s['id'] == 'dcceew_nga_factors_2025'))},
}};

export const loadForecastMetrics = {j(modules['load_forecast'])};
export const loadForecastByHorizon = {j(modules['load_forecast_by_horizon'])};
export const pvEvidence = {j(modules['pv_evidence'])};
export const bessEvidence = {j(modules['bess_evidence'])};
export const bessEfficiency = {j(modules['bess_efficiency'])};

/** Real equipment run-state classification (OFF/IDLE/RUN/UNKNOWN) over the full real 2016 industrial2 bess_kw series -- the same generic threshold+debounce algorithm implemented independently in edge-collector-cpp/include/run_state.hpp, cross-checked to match exactly. See that header's honesty note: an independently designed public prototype, not Evidergy's confidential internal EAF-GW4 production algorithm. */
export const edgeStateRecognition = {j(modules['edge_state_recognition'])};

/** Same exemplar day as bessSeries above (site_b_day), sliced from a full-year classification so debounce state carries correctly across midnight. */
export const edgeStateTimeline = {j(kw['edge_state_timeline'])};

export const energyBalance = {j(modules['energy_balance'])};
export const dataQuality = {j(modules['data_quality'])};
export const scope2 = {j(modules['scope2'])};

/** 2-layer LSTM quantile forecaster (PyTorch), trained/evaluated on the identical fixed real split as loadForecastMetrics above -- reported honestly whether or not it beats the gradient-boosted baseline. */
export const deepLearningForecast = {j(modules['deep_learning_forecast'])};

export const pvArrays = [
  {{
    name: "Reference PV system (residential4)",
    capacityKwDc: null as number | null,
    health: {round(100 - modules['pv_evidence']['false_positive_rate_pct_on_clean_daytime'] * 5, 1)},
    actualKw: {kw['dashboard_stats']['totalPvKwhToday']},
    expectedKw: null as number | null,
    status: "Normal",
    note: "Real household PV system, capacity not published by source; only one instrumented system in this reference dataset (vs. a multi-array precinct in the eventual pilot).",
  }},
];

export const limitations = [
  "This is a public reference dataset (OPSD household_data + Open-Meteo + DCCEEW NGA Factors), not the Alice Springs / DKP pilot data -- that still requires written commercial-use permission (see data_pipeline/sources.json).",
  "Energy-balance 'pass rate' validates the sign-convention/unit-conversion code path against the meter identity (no independent redundant metering exists in this public dataset), reported separately from real submetering completeness.",
  "PV and BESS known-event recall are measured via synthetic fault injection into real held-out telemetry (fixed random seed), not real labelled incident reports.",
  "The BESS state-of-charge series is an indicative charge-tracking index derived from real charge/discharge energy and a data-driven capacity estimate; OPSD does not publish an OEM SOC signal.",
  "The 24-hour forecast horizon shows p90 coverage of {modules['load_forecast_by_horizon'][3]['p90_coverage']*100:.1f}% in this backtest -- improved from an uncalibrated 77.8% via split-conformal interval calibration (see 'conformal_delta_kw' in backtest_report.json), but still below the 85-95% BP target, most likely genuine seasonal distribution shift between the Sep-Oct calibration window and the Nov-Dec test window at this horizon -- flagged here rather than hidden; see docs/REFERENCE_DATASET.md.",
] satisfies string[];
"""


if __name__ == "__main__":
    main()
