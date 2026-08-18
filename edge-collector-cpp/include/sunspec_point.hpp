// A general-purpose decoder for the SunSpec point-encoding rules: typed
// register values (int16/uint16/int32/uint32/acc32/string) combined with a
// paired scale-factor register (engineering_value = raw * 10^scale_factor).
// These encoding rules are the real, public SunSpec Information Model
// convention.
//
// Honesty note: this is NOT a byte-exact reproduction of any single vendor's
// official SunSpec model register table (e.g. "model 103 register 40072").
// Real Modbus/SunSpec commissioning always involves configuring a
// device-specific register map from the vendor's documentation, because base
// addresses and model instance offsets vary by device even when the point
// *encoding* is SunSpec-conformant. The point map below (see
// evidergy_point_map()) is our own documented, locally-configured map for
// this collector, not a copy of an official model layout.
#pragma once

#include <cstdint>
#include <optional>
#include <string>
#include <vector>

namespace evidergy::sunspec {

enum class PointType { kUint16, kInt16, kUint32, kInt32, kAcc32, kScaleFactor };

struct PointDef {
  std::string name;         // canonical field name, e.g. "pv_kw"
  PointType type;
  size_t register_offset;   // offset within the register block, 0-based
  std::optional<size_t> scale_factor_offset;  // offset of the paired sunssf register, if any
  double unit_scale = 1.0;  // extra fixed multiplier (e.g. W -> kW = 0.001)
};

// Reads a raw (unscaled) integer value for `point` out of `registers`.
int64_t read_raw(const std::vector<uint16_t>& registers, const PointDef& point);

// Reads and applies the SunSpec scale-factor + unit_scale, returning the
// engineering-unit value.
double decode_engineering_value(const std::vector<uint16_t>& registers,
                                 const PointDef& point);

// This collector's own documented, locally-configured register map (see the
// honesty note above). Offsets are 0-based into a single contiguous
// holding-register read.
std::vector<PointDef> evidergy_point_map();

}  // namespace evidergy::sunspec
