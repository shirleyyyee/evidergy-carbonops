# Evidergy CarbonOps MVP

Repository: https://github.com/shirleyyyee/evidergy-carbonops · Live technical validation record (GitHub Pages, no login required): https://shirleyyyee.github.io/evidergy-carbonops/

Evidence-first, read-only microgrid intelligence for Australian commercial precincts. The MVP implements sign-in-gated product routes, nine operator workspaces, protected JSON/CSV APIs, a D1 audit trail, public-data acquisition helpers and reference analytics for energy balance, probabilistic forecasting, PV/BESS evidence and Scope 2 — **backtested end-to-end on a real, checksummed public dataset** (see `docs/REFERENCE_DATASET.md`), not synthetic demo data.

The system spans four languages, each matched to a real component of the Data Hub
architecture in `docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md` §5.1, not added for
variety: TypeScript/React for the product application, Python for the data pipeline
and ML models, C++ for a field-gateway edge collector, and Java for a BMS/OPC-UA
ingest connector. See `docs/site/index.html` for a self-contained, GitHub-Pages-ready
summary of all of it.

## Product routes

- `/` — public product introduction and sign-in
- `/dashboard` — Grid / Load / PV / BESS / SOC overview
- `/data-quality` — completeness, duplicates, frozen sensors, signs and balance
- `/pv-health` — weather-adjusted baseline, peer comparison and estimated loss
- `/bess-health` — SOC–power consistency, throughput, efficiency and peak shaving
- `/forecast` — P05 / P50 / P95 forecast and rolling-backtest metrics
- `/carbon-ledger` — versioned factor, Scope 2 ledger and CSV export
- `/alerts` — evidence and human-confirmed audit actions
- `/reports` — LLM-generated operations report (Claude API), privacy-preserving by design (see below)
- `/settings` — site conventions, thresholds and licence register
- `/methodology` — live technical validation record: real data provenance, checksums and backtest metrics

## Local workflow

Use Node 22+ and the package manager lockfile included with the project.

```powershell
pnpm install
pnpm run dev
pnpm run db:generate
pnpm run build
pnpm test
```

### Signing in locally

Production pages and APIs require dispatch-owned Sign in with ChatGPT identity, which
only exists inside the platform-hosted environment. To sign in and click through the
whole product on a developer machine, enable the local credential login instead:

1. Copy the three lines below into a `.dev.vars` file at the project root (already
   gitignored via `.env*`) — this is the standard local-dev variable file read by the
   Cloudflare Vite plugin/Miniflare that this project runs on; plain shell/`process.env`
   variables are **not** visible inside the Workers runtime, only `.dev.vars` (dev) or
   real Worker `vars`/secrets (deployed) are.

   ```
   EVIDERGY_LOCAL_LOGIN=1
   EVIDERGY_LOCAL_LOGIN_SECRET=<any random string>
   EVIDERGY_LOCAL_LOGIN_PASSWORD=<pick a password>
   ```

2. `pnpm run dev`, then open `http://localhost:3000/login` and sign in as `operator`
   or `reviewer` with the password you chose. This flow is local-only by design — see
   `lib/local-auth.ts` for the exact production safeguards (it refuses to run under
   `NODE_ENV=production` unless explicitly overridden, and is a completely separate
   code path from the platform Sign in with ChatGPT flow used in the real deployment).

Without `.dev.vars`, `getProductUser()` falls back to a fixed named demo user in
development (unchanged from before) or requires real platform identity in production.
D1 is declared as `DB` in `.openai/hosting.json`.

## Data pipeline

### Reference backtest (real public data, run today, no permissions needed)

```powershell
python data_pipeline/reference_backtest.py       # real OPSD + Open-Meteo + DCCEEW data -> data_processed/reference_2016/backtest_report.json
python data_pipeline/generate_reference_ts.py    # backtest_report.json -> lib/reference-dataset.ts (consumed by every product page)
```

See `docs/REFERENCE_DATASET.md` for full provenance, methodology, honesty notes about
what is and isn't independently validated, and the current results table.

### Pilot data (Alice Springs / DKP — Sprint 1, requires written permission)

Review every linked licence before downloading. The CLI flag records review; it does not grant additional rights.

```powershell
python data_pipeline/download_public_data.py --discover-only --accept-licence-review
python data_pipeline/download_public_data.py --source dkp_microgrid --source nga_factors_2025 --accept-licence-review
python data_pipeline/normalize_energy.py data_raw/input.csv data_processed/site.csv --mapping metadata/dkp_mapping.json --site-id dkp-demo --timezone Australia/Darwin --grid-positive import --bess-positive discharge
```

See `docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md` for the full system specification, rollout sequence, acceptance gates and production-hardening backlog.

### Deep-learning forecaster (Python, PyTorch)

A 2-layer LSTM with three quantile output heads (pinball loss), trained and evaluated
on the **identical fixed real split** as the gradient-boosted baseline in
`core_models.py` — same train/test window, no shuffling — so the comparison is honest
either way.

```powershell
python data_pipeline/deep_forecast.py
```

Writes `data_processed/reference_2016/deep_lstm_forecast.pt` and
`deep_lstm_test_predictions.csv`, and updates the `deep_learning_forecast` module in
`backtest_report.json` (surfaced on `/methodology` and in `docs/site/index.html`).

### C++ edge collector — Modbus TCP / SunSpec (edge-collector-cpp/)

Standards-conformant Modbus TCP (MBAP) framing and CRC-16/MODBUS, plus a locally
documented SunSpec-style typed-register decoder, for a field/SCADA-gateway collector.
Validated end-to-end against the same real, checksummed 2016 reference dataset used
throughout the rest of the project (`tools/encode_fixture` builds a real Modbus
fixture from it; `tests/test_end_to_end_real_fixture.cpp` decodes it back and checks
against the source CSV within quantization tolerance).

```powershell
cmake -S edge-collector-cpp -B edge-collector-cpp/build -G Ninja
cmake --build edge-collector-cpp/build
ctest --test-dir edge-collector-cpp/build
```

See `edge-collector-cpp/README.md` for scope notes — no live hardware, no vendor-
official register map.

### Java BMS/OPC-UA connector (bms-connector-java/)

A dependency-free JDK-only REST/JSON ingest gateway standing in for a BMS/OPC-UA-to-
REST bridge (`com.sun.net.httpserver.HttpServer`, loopback-only, no Maven/Gradle).
Validated end-to-end by replaying 500 real intervals from the same reference dataset
over real HTTP, including duplicate (409) and malformed-payload (400) rejection.

```powershell
powershell bms-connector-java/scripts/build-and-test.ps1
```

See `bms-connector-java/README.md` for scope notes — this is a REST gateway, not a
raw OPC-UA binary protocol implementation.

### LLM-generated reports (privacy-preserving)

`/reports` calls the Claude API (`claude-opus-5`) server-side to write a narrative
operations summary — but only from an explicit **allowlist of already-aggregated,
already-public figures** (dashboard stats, quality scores, forecast metrics, evidence
summaries, carbon totals). Raw per-interval telemetry (`energySeries`, `bessSeries`)
is never included in the request; see `buildReportPayload()` in
`lib/report-generation.ts` for the exact allowlist, and the response echoes the exact
keys sent (`payloadKeys`) so the boundary is auditable, not just claimed. Requires
`ANTHROPIC_API_KEY` — without it, the endpoint returns `not_configured` rather than a
fake report.

### Static, no-login site (docs/site/index.html)

A single self-contained HTML file — same content as the technical validation record,
plus the C++/Java/deep-learning summary above — with no build step and no server,
suitable for GitHub Pages or opening directly from disk.
