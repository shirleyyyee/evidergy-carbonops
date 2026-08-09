// Deterministic round-trip checks for the SunSpec point-decoding engine:
// encode a known value into raw registers by hand, decode it back, and
// confirm the engineering value matches -- fully self-contained (the encode
// math is simple enough to hand-verify), no external reference needed.
#include <cmath>
#include <cstdio>
#include <vector>

#include "modbus_frame.hpp"
#include "sunspec_point.hpp"

using namespace periscope::sunspec;

namespace {
int failures = 0;
void check(bool condition, const char* what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what);
    ++failures;
  }
}
double approx_equal(double a, double b, double tol = 1e-6) { return std::fabs(a - b) < tol; }
}  // namespace

int main() {
  // uint16, no scale factor.
  {
    std::vector<uint16_t> regs = {654};
    PointDef p{"soc_pct", PointType::kUint16, 0, std::nullopt, 0.1};
    check(approx_equal(decode_engineering_value(regs, p), 65.4), "uint16 x0.1 scale decodes 654 -> 65.4");
  }

  // int16, negative value (temperature below zero).
  {
    int16_t raw = -55;  // -5.5 C
    std::vector<uint16_t> regs = {static_cast<uint16_t>(raw)};
    PointDef p{"temperature_c", PointType::kInt16, 0, std::nullopt, 0.1};
    check(approx_equal(decode_engineering_value(regs, p), -5.5), "int16 negative x0.1 decodes -55 -> -5.5");
  }

  // int32 (two registers, big-endian-of-registers) with a SunSpec scale
  // factor register and an additional fixed unit conversion (W -> kW).
  {
    int32_t raw_watts = -4200;  // charging at 4.2 kW
    uint16_t hi = static_cast<uint16_t>((static_cast<uint32_t>(raw_watts) >> 16) & 0xFFFF);
    uint16_t lo = static_cast<uint16_t>(static_cast<uint32_t>(raw_watts) & 0xFFFF);
    std::vector<uint16_t> regs = {0 /*sf=0*/, hi, lo};
    PointDef sf{"sf", PointType::kScaleFactor, 0, std::nullopt, 1.0};
    PointDef p{"bess_kw", PointType::kInt32, 1, size_t{0}, 0.001};
    check(approx_equal(decode_engineering_value(regs, p), -4.2), "int32 negative W with sf=0, x0.001 -> -4.2 kW");
  }

  // Scale factor of -2 (common SunSpec pattern: raw integer x 10^-2).
  {
    std::vector<uint16_t> regs = {static_cast<uint16_t>(static_cast<int16_t>(-2)), 12345};
    PointDef p{"value", PointType::kUint16, 1, size_t{0}, 1.0};
    check(approx_equal(decode_engineering_value(regs, p), 123.45), "uint16 raw=12345, sf=-2 -> 123.45");
  }

  // acc32 / uint32 combine, no sign.
  {
    std::vector<uint16_t> regs = {0x0001, 0x86A0};  // 0x000186A0 = 100000
    PointDef p{"acc", PointType::kAcc32, 0, std::nullopt, 1.0};
    check(approx_equal(decode_engineering_value(regs, p), 100000.0), "uint32/acc32 combine decodes 0x000186A0 -> 100000");
  }

  // Full periscope_point_map() round trip through actual register encoding
  // (exercises the exact offsets/types the collector uses in production).
  {
    std::vector<uint16_t> regs;
    auto encode_i32 = [](int32_t v) {
      return std::pair<uint16_t, uint16_t>{
          static_cast<uint16_t>((static_cast<uint32_t>(v) >> 16) & 0xFFFF),
          static_cast<uint16_t>(static_cast<uint32_t>(v) & 0xFFFF)};
    };
    auto [grid_hi, grid_lo] = encode_i32(2500);   // 2.5 kW import
    auto [pv_hi, pv_lo] = encode_i32(6100);       // 6.1 kW generation
    auto [bess_hi, bess_lo] = encode_i32(-1800);  // 1.8 kW charge
    regs = {0, grid_hi, grid_lo, pv_hi, pv_lo, bess_hi, bess_lo,
            700 /*70.0% soc*/, static_cast<uint16_t>(static_cast<int16_t>(214)) /*21.4C*/,
            0, 1700000000u & 0xFFFF};
    regs[9] = static_cast<uint16_t>((1700000000u >> 16) & 0xFFFF);
    regs[10] = static_cast<uint16_t>(1700000000u & 0xFFFF);

    for (const auto& point : periscope_point_map()) {
      if (point.type == PointType::kScaleFactor) continue;
      double v = decode_engineering_value(regs, point);
      if (point.name == "grid_kw") check(approx_equal(v, 2.5), "point map grid_kw -> 2.5");
      if (point.name == "pv_kw") check(approx_equal(v, 6.1), "point map pv_kw -> 6.1");
      if (point.name == "bess_kw") check(approx_equal(v, -1.8), "point map bess_kw -> -1.8");
      if (point.name == "soc_pct") check(approx_equal(v, 70.0), "point map soc_pct -> 70.0");
      if (point.name == "temperature_c") check(approx_equal(v, 21.4), "point map temperature_c -> 21.4");
      if (point.name == "unix_timestamp") check(approx_equal(v, 1700000000.0), "point map unix_timestamp round trip");
    }
  }

  if (failures == 0) {
    std::printf("test_sunspec_decode: all checks passed\n");
    return 0;
  }
  std::fprintf(stderr, "test_sunspec_decode: %d check(s) failed\n", failures);
  return 1;
}
