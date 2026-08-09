# Reference dataset: provenance, methodology and honesty notes

The 2026-08-08 business plan and feasibility summary state plainly that public-dataset
backtesting was not yet complete and no accuracy had been verified. This document,
together with `data_pipeline/reference_backtest.py` and
`data_pipeline/generate_reference_ts.py`, closes that specific gap using data that is
public, free, checksummed and reproducible today — without waiting on the written
commercial-use permission that DKASC/DKP (`data_pipeline/sources.json`, tier A,
`written_permission_required_before_commercial_training_or_redistribution`) still
requires.

This is **not** presented as the Alice Springs / DKP pilot dataset. It is a public
reference dataset used to demonstrate that the algorithms in
`data_pipeline/core_models.py` behave correctly, are bounded/calibrated, and can be
backtested end-to-end on real (non-synthetic) meter data. That is the literal TRL4 bar
in the PERIscope Commercialisation Award guidelines: *"proof of concept has been
validated. Demonstration of technical feasibility have been shown with representative
data."* The Alice Springs pilot (DKP microgrid, DKASC arrays) remains the Sprint 1–4
target described in `docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md`.

## Data sources

| Source | Publisher | Licence | What it provides | Access |
|---|---|---|---|---|
| Open Power System Data `household_data`, release 2020-04-15 | ISC Konstanz | CC-BY 4.0 | Real 15-minute cumulative smart-meter readings, 2014-12 to 2019-05, for real households and small commercial sites in Konstanz, Germany | Direct HTTPS download, no login |
| Open-Meteo Historical Weather API | Open-Meteo | CC-BY 4.0 | Hourly temperature and shortwave/direct/diffuse irradiance for Konstanz (47.6779N, 9.1732E), 2016 | Direct HTTPS, no API key |
| DCCEEW National Greenhouse Accounts Factors 2025, Table 1 | Australian Government (DCCEEW) | Public source with attribution | Northern Territory (Darwin-Katherine Interconnected System) location-based Scope 2 factor: 0.56 kg CO₂-e/kWh | Direct HTTPS download, no login |

Exact file names, byte sizes and SHA-256 checksums are recorded in
`data_processed/reference_2016/backtest_report.json` (`sources[]`) and reproduced live
on the in-product `/methodology` page. Raw files live under `data_raw/` and are treated
as read-only per the governance rules already defined for the pilot sources.

### Why OPSD and not DKP/DKASC for this record

`data_pipeline/download_public_data.py --discover-only` against the DKA Solar Centre
landing pages shows the actual file links are only reachable through an interactive
location/date-range picker (not a static, script-discoverable link) and DKP microgrid
data is explicitly gated behind written commercial-use permission. Producing a real,
non-fabricated backtest *today* required a dataset that is (a) immediately and legally
downloadable without registration, (b) real, measured telemetry (not synthetic), and
(c) physically comparable — grid import/export, PV generation, and in one case a real
behind-the-meter battery. OPSD `household_data` satisfies all three. Acquiring the
actual DKP/DKASC pilot data remains Sprint 1 in the rollout plan.

### Two real sites used

- **`residential4`** — grid import, grid export, PV, and five submetered appliance
  circuits (dishwasher, freezer, heat pump, refrigerator, washing machine, EV). No
  battery. ~100% interval coverage for calendar year 2016. Used for energy balance,
  data-quality-adjacent submetering statistics, the probabilistic load forecast, PV
  evidence, and Scope 2.
- **`industrial2`** — grid import, PV, and a real battery (`storage_charge` /
  `storage_decharge`), described in the OPSD documentation as "a business in the crafts
  sector." No submeters, no grid-export meter. ~68–86% coverage for the storage
  channels in 2016 (a genuine gap in the source, not injected). Used for the data
  quality gate and BESS evidence.

## What each module actually validates

**Energy balance.** `grid_import − grid_export + PV` is compared against itself by
construction on `residential4` (there is no independent, redundantly-metered PCC in
this public dataset). This validates that the sign-convention / unit-conversion /
residual code in `core_models.energy_balance` reproduces the meter physics correctly on
real, messy, timestamped cumulative-meter data — a legitimate pipeline-correctness
check — and is reported **separately** from *metering completeness* (how much of that
identity load the five real submeters actually explain: 65.7%), which is a genuine,
non-circular, real-world finding. A large, expected submetering gap is exactly the
"missing meter" scenario the module is designed to surface, not evidence of a fault.

**Data quality gate.** Runs `core_models.quality_flags` against the real
`industrial2` battery telemetry, which has genuine ~14–32% missingness across 2016.
Nothing is injected to look clean.

**Probabilistic load forecast.** Real target (`grid_import − grid_export + PV` for
`residential4`), a fixed, non-shuffled rolling-origin split (train 01 Jan–31 Aug,
validate 01 Sep–31 Oct [reserved], test 01 Nov–31 Dec 2016), real calendar and weather
features. A separate walk-forward backtest is run per horizon (1h/6h/12h/24h — feature
lags are anchored at time *t*, only the target is shifted forward, so there is no
leakage at any horizon). Fully real, non-circular.

**Deep learning forecaster.** A 2-layer LSTM with three quantile output heads
(pinball loss, PyTorch) trained on the identical fixed, non-shuffled split as the
probabilistic load forecast above (`data_pipeline/deep_forecast.py`) — same real
target, same train/test window, no leakage. Reported against the gradient-boosted
baseline honestly either way; on this real held-out window it happens to win on P50
MAE (0.496 kW vs. 0.598 kW) while staying inside the 85–95% coverage band (88.1%).

**Edge collector (C++) and BMS connector (Java).** Neither introduces new
statistical claims — both are validated by round-tripping the *same* real 2016
reference telemetry used throughout this document (Modbus-encoded and decoded for
the C++ collector; replayed over real HTTP for the Java connector) and checking the
decoded/ingested values against the source CSV within quantization/encoding
tolerance. See `edge-collector-cpp/README.md` and `bms-connector-java/README.md` for
scope notes.

**PV evidence.** The weather-adjusted P05/P50/P95 baseline is fit on real Konstanz
irradiance/temperature and real PV output, restricted to real daytime intervals (solar
elevation > 3°; night is deterministically zero, not a distributional tail, and
including it collapses the extreme-quantile fit — verified empirically). Because this
public release carries no labelled outage events, detection recall and false-positive
rate are measured by injecting synthetic, clearly-logged outage windows (fixed random
seed) into real held-out PV output — a standard fault-injection validation technique,
not a claim of real labelled incidents.

**BESS evidence.** OPSD publishes real charge/discharge energy, not an OEM SOC signal.
An indicative "charge-tracking index" is derived from real telemetry and a data-driven
capacity estimate (99th-percentile 24h net-throughput range). The deadband is
calibrated to this real system's own power range (0.2 kW; its 99th-percentile power is
~1.4 kW — the spec's illustrative 2 kW deadband would exclude nearly all real activity
at this scale). The consistency-rule detection logic is validated the same way as PV:
synthetic sign-flip telemetry corruption injected into real active intervals, recall
and false-positive rate measured against clean real intervals.

**Scope 2.** Real monthly grid-import kWh (`residential4`, 2016) × the real, published
NT (DKIS) location-based factor. 100% recompute consistency is the documented BP
acceptance target for this check (a determinism check on the calculation chain), not a
statistical claim.

## Results (see `/methodology` in the running app or `backtest_report.json` for the
authoritative, regenerable numbers)

| Check | Result | BP target |
|---|---|---|
| Energy balance identity | 100% | ≥95% |
| Metering completeness (real submeters) | 65.7% | — (diagnostic, not a gate) |
| Data quality — real missingness (industrial2 storage) | 31.6% | — (genuine, reported) |
| Load forecast, 1h horizon — P90 coverage | 86.5% (1h) / 96.9% (6h) / 93.9% (12h) / 77.8% (24h) | 85–95% |
| Deep learning (LSTM) forecast — P50 MAE / P90 coverage | 0.496 kW / 88.1% (baseline: 0.598 kW / 86.5%) | beats baseline on MAE, in 85–95% band |
| PV known-event recall (fault-injected) | 88.0% | ≥80% |
| PV false-positive rate (clean real intervals) | 2.08% | — |
| BESS injected-fault recall | 82.5% | ≥80% (spec target is "expert-explainable" mismatch rate; this is a recall proxy) |
| BESS round-trip efficiency (real, full year) | 58.7% | — (real, not adjusted for standby losses) |
| Scope 2 recompute consistency | 100% | 100% |

The 24-hour forecast horizon (77.8% coverage) is **below** the 85–95% target. This is
reported here rather than hidden, and is a concrete, scoped item for the real-pilot
phase (more/better long-horizon features, or a wider calibration band at 24h).

## Reproducing this record

```powershell
cd code
python data_pipeline/reference_backtest.py       # downloads nothing; reads data_raw/, writes data_processed/reference_2016/
python data_pipeline/deep_forecast.py            # trains/evaluates the LSTM on the same real fixed split, updates backtest_report.json
python data_pipeline/generate_reference_ts.py    # writes lib/reference-dataset.ts from the report above
pnpm run build && pnpm test                      # confirms the app still builds and passes with the regenerated data
```

The C++ and Java modules validate independently against the same real data (see
their own READMEs for exact commands):

```powershell
cmake -S edge-collector-cpp -B edge-collector-cpp/build -G Ninja && cmake --build edge-collector-cpp/build && ctest --test-dir edge-collector-cpp/build
powershell bms-connector-java/scripts/build-and-test.ps1
```

Re-running `reference_backtest.py` is deterministic (fixed random seed for all
fault-injection steps) given the same input files. The input files themselves are
re-downloadable with `curl` from the URLs recorded in
`backtest_report.json["sources"]`; their SHA-256 checksums are recorded there so a
re-download can be verified byte-for-byte.

## Explicit limitations

1. This is a public reference dataset, not the Alice Springs / DKP pilot data — that
   still requires written commercial-use permission (see `data_pipeline/sources.json`).
2. The energy-balance "pass rate" validates the sign-convention/unit-conversion code
   path against the meter identity; no independent redundant metering exists in this
   public dataset to test against.
3. PV and BESS known-event recall are measured via synthetic fault injection into real
   held-out telemetry, not real labelled incident reports.
4. The BESS state-of-charge series is an indicative charge-tracking index, not an OEM
   SOC signal.
5. The 24-hour forecast horizon is below the BP coverage target in this backtest.
6. `residential4` and `industrial2` are a real household and a real small commercial
   site, not an Australian commercial precinct at the scale the product ultimately
   targets — the point of this record is methodology validation on real data, not a
   claim of pilot-scale results.
