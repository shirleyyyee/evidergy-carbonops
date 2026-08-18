#include "sunspec_point.hpp"

#include <cmath>
#include <stdexcept>

namespace evidergy::sunspec {

namespace {

uint16_t reg_at(const std::vector<uint16_t>& registers, size_t offset) {
  if (offset >= registers.size()) {
    throw std::out_of_range("register offset beyond decoded block");
  }
  return registers[offset];
}

int16_t as_int16(uint16_t raw) {
  return static_cast<int16_t>(raw);
}

uint32_t combine_u32(uint16_t high, uint16_t low) {
  return (static_cast<uint32_t>(high) << 16) | static_cast<uint32_t>(low);
}

}  // namespace

int64_t read_raw(const std::vector<uint16_t>& registers, const PointDef& point) {
  switch (point.type) {
    case PointType::kUint16:
      return static_cast<int64_t>(reg_at(registers, point.register_offset));
    case PointType::kInt16:
    case PointType::kScaleFactor:
      return static_cast<int64_t>(as_int16(reg_at(registers, point.register_offset)));
    case PointType::kUint32:
    case PointType::kAcc32: {
      uint32_t combined = combine_u32(reg_at(registers, point.register_offset),
                                       reg_at(registers, point.register_offset + 1));
      return static_cast<int64_t>(combined);
    }
    case PointType::kInt32: {
      uint32_t combined = combine_u32(reg_at(registers, point.register_offset),
                                       reg_at(registers, point.register_offset + 1));
      return static_cast<int64_t>(static_cast<int32_t>(combined));
    }
  }
  throw std::logic_error("unreachable point type");
}

double decode_engineering_value(const std::vector<uint16_t>& registers,
                                 const PointDef& point) {
  const int64_t raw = read_raw(registers, point);
  double scaled = static_cast<double>(raw);
  if (point.scale_factor_offset.has_value()) {
    PointDef sf{"sf", PointType::kScaleFactor, *point.scale_factor_offset, std::nullopt, 1.0};
    const int64_t sf_raw = read_raw(registers, sf);
    scaled *= std::pow(10.0, static_cast<double>(sf_raw));
  }
  return scaled * point.unit_scale;
}

std::vector<PointDef> evidergy_point_map() {
  // Offsets chosen for this collector's own 11-register block. Grid/PV/BESS
  // power carry a shared power scale factor (register 0) and decode to Watts
  // per SunSpec convention; unit_scale=0.001 converts directly to the
  // canonical schema's kW. SOC is pre-scaled 0-1000 = 0.0-100.0% (common
  // inverter practice, no separate scale factor). The trailing uint32 is this
  // collector's own site-clock field (Unix seconds) -- Modbus itself carries
  // no timestamp, so the poller's clock (or, when replaying a fixture, the
  // fixture's embedded clock) must supply one.
  return {
      {"power_scale_factor", PointType::kScaleFactor, 0, std::nullopt, 1.0},
      {"grid_kw", PointType::kInt32, 1, size_t{0}, 0.001},
      {"pv_kw", PointType::kInt32, 3, size_t{0}, 0.001},
      {"bess_kw", PointType::kInt32, 5, size_t{0}, 0.001},
      {"soc_pct", PointType::kUint16, 7, std::nullopt, 0.1},
      {"temperature_c", PointType::kInt16, 8, std::nullopt, 0.1},
      {"unix_timestamp", PointType::kUint32, 9, std::nullopt, 1.0},
  };
}

}  // namespace evidergy::sunspec
