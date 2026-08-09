# bms-connector-java

A real, dependency-free (JDK-only) HTTP ingest service standing in for the
"vendor API" leg of the Data Hub described in
[`../docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md`](../docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md)
§5.1. Java is the realistic choice here: enterprise Building Management
System (BMS) integrations in Australian commercial buildings are commonly
Java-based, and site energy/asset data is very often exposed to downstream
systems via a REST or MQTT bridge sitting in front of the BMS's own OPC-UA
layer, rather than raw OPC-UA binary.

## What this is, honestly

- **This is a REST/JSON ingest endpoint, not a raw OPC-UA binary client.**
  Implementing the OPC-UA binary protocol (secure channel handshake, binary
  encoding) from scratch is out of scope here; instead this connector speaks
  the same flat-JSON-over-HTTP contract that a real site's BMS/OPC-UA-to-REST
  gateway (a common, real integration pattern) would use to forward
  telemetry. `POST /ingest` validates and normalises each record into the
  canonical schema shared with `data_pipeline/normalize_energy.py` and the
  C++ edge collector.
- **No external dependencies on purpose.** No Maven/Gradle, no JSON library,
  no HTTP framework — just `javac`/`java`/`jar` from the JDK
  (`com.sun.net.httpserver.HttpServer` for the server,
  `java.net.http.HttpClient` for the test client, and a small
  `MinimalJson` parser/writer scoped to flat objects). This keeps the module
  buildable with nothing beyond a JDK install.
- **Real validation, not a pass-through.** `TelemetryValidator` rejects
  missing/non-numeric fields, out-of-range SOC (%), implausible temperature
  and irradiance values, malformed timestamps, and timestamps too far in the
  future (clock-skew guard) — mirroring the "quality gate before anything
  downstream" principle in `data_pipeline/core_models.py`.
- **The end-to-end test replays real data over real HTTP.**
  `EndToEndRealDataTest` starts the actual server, POSTs 500 real, previously
  checksummed intervals from
  `../data_processed/reference_2016/{residential4_2016_normalised,konstanz_2016_weather_15min}.csv`
  (see [`../docs/REFERENCE_DATASET.md`](../docs/REFERENCE_DATASET.md)) as a
  real BMS gateway would, and reads back the server's own output CSV to
  confirm every value survived validation and persistence unchanged. It also
  exercises the duplicate-timestamp rejection (409) and malformed-payload
  rejection (400) paths.

## Build and test

Requires only a JDK (17+; developed against JDK 21). No Maven install needed.

```powershell
.\scripts\build-and-test.ps1
```

The real-data end-to-end test prints a clear "SKIPPED" message (not a
failure) if `../data_processed/reference_2016/*.csv` doesn't exist yet — run
`python ../data_pipeline/reference_backtest.py` first.

## Run the service

```powershell
java -jar build\bms-connector.jar --port 8089 --out bms_canonical_output.csv
```

```
POST /ingest   {"timestamp":"2026-08-09T06:00:00Z","site_id":"...", "grid_kw":2.5, "load_kw":8.6,
                "pv_kw":6.1, "bess_kw":0.0, "soc_pct":70.0, "temperature_c":21.4, "irradiance_wm2":540.0}
GET  /health
```

The server binds to loopback only (127.0.0.1) — this is a local ingest
endpoint; a real deployment would sit behind the site's own network boundary.
