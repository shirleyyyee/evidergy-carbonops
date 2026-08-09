# periscope-edge-collector (C++)

A real Modbus TCP framing + SunSpec-style register decoding layer for the
"Data Hub" connector described in
[`../docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md`](../docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md)
§5.1 ("连接 NEM12、CSV、SCADA、Modbus、SunSpec 和厂商 API"). C++ is the
realistic choice here: field/edge gateways that poll Modbus/SunSpec devices
at high frequency are commonly implemented in C++ for performance and
portability to constrained embedded Linux hardware.

## What this is, honestly

- **Modbus framing** (`include/modbus_frame.hpp`): a real, standards-conformant
  implementation of Modbus TCP (MBAP header) framing and Modbus RTU
  CRC-16/MODBUS, from the public Modbus specifications.
- **SunSpec point decoding** (`include/sunspec_point.hpp`): implements the
  real SunSpec *encoding rules* (typed registers + a paired scale-factor
  register, `value = raw * 10^scale_factor`). It does **not** claim to be a
  byte-exact copy of any single vendor's official SunSpec model register
  table — real Modbus/SunSpec commissioning always involves configuring a
  device-specific register map from the vendor's documentation, because base
  addresses vary by device even when the point encoding is SunSpec-conformant.
  `periscope_point_map()` is this collector's own documented, locally
  configured map.
- **No live hardware**: this build reads a byte stream (a file today; a TCP
  socket in a real deployment) rather than opening a live Modbus connection,
  because no site hardware is available to this project yet. The decode path
  is identical either way.
- **The test fixture is real data, not fabricated**: `tools/encode_fixture`
  re-encodes real, previously-checksummed intervals from
  `../data_processed/reference_2016/{industrial2_2016_normalised,konstanz_2016_weather_15min}.csv`
  (see [`../docs/REFERENCE_DATASET.md`](../docs/REFERENCE_DATASET.md)) into
  Modbus TCP frames. `tests/test_end_to_end_real_fixture.cpp` decodes them
  back and asserts every value matches the original real CSV row within the
  resolution this collector encodes at (1 W, 0.1 °C) — proving the protocol
  layer does not corrupt real telemetry.

## Build and test

Requires CMake 3.20+ and a C++17 compiler (tested with both MinGW-w64 GCC and
LLVM/clang on Windows; any standard-conformant compiler on Linux/macOS works).

```powershell
cmake -S . -B build -G Ninja
cmake --build build
cd build; ctest --output-on-failure
```

The end-to-end real-fixture test is skipped (with a clear CMake warning, not
a hard failure) if `../data_processed/reference_2016/*.csv` doesn't exist yet
— run `python ../data_pipeline/reference_backtest.py` first.

## Run the collector

```powershell
build\periscope-edge-collector.exe build\real_site_modbus_stream.bin output.csv periscope-edge-demo
```

Prints throughput stats (frames/s, registers/s) to stderr and writes the
canonical CSV schema (matching `data_pipeline/normalize_energy.py`) to
`output.csv`.
