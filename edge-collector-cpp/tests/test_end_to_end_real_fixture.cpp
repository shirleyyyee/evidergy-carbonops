// The integrity test that matters most for this module: decode the real-data
// fixture (built by tools/encode_fixture from the checksummed Evidergy
// reference dataset) and confirm every decoded value matches the original
// real CSV row it was encoded from, within floating-point rounding
// tolerance. This is what proves the Modbus/SunSpec encode-decode round trip
// does not silently corrupt real telemetry.
#include <cmath>
#include <cstdio>
#include <fstream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

#include "modbus_frame.hpp"
#include "sunspec_point.hpp"

using evidergy::modbus::decode_tcp_frame;
using evidergy::modbus::registers_from_response_payload;
using evidergy::sunspec::PointType;
using evidergy::sunspec::decode_engineering_value;
using evidergy::sunspec::evidergy_point_map;

namespace {

int failures = 0;
void check(bool condition, const std::string& what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what.c_str());
    ++failures;
  }
}

struct Row {
  double grid_kw = 0, pv_kw = 0, bess_kw = 0, temperature_c = 0;
};

std::vector<std::string> split_csv_line(const std::string& line) {
  std::vector<std::string> fields;
  std::stringstream ss(line);
  std::string field;
  while (std::getline(ss, field, ',')) fields.push_back(field);
  if (!line.empty() && line.back() == ',') fields.push_back("");
  return fields;
}

std::vector<Row> load_reference_rows(const std::string& industrial_path,
                                      const std::string& weather_path, size_t max_rows) {
  std::ifstream ind(industrial_path);
  std::ifstream wx(weather_path);
  std::string ind_line, wx_line;
  std::getline(ind, ind_line);
  std::getline(wx, wx_line);
  std::vector<Row> rows;
  while (rows.size() < max_rows && std::getline(ind, ind_line) && std::getline(wx, wx_line)) {
    auto ind_fields = split_csv_line(ind_line);
    auto wx_fields = split_csv_line(wx_line);
    if (ind_fields.size() < 4 || wx_fields.size() < 2) continue;
    if (ind_fields[1].empty() || ind_fields[2].empty() || ind_fields[3].empty() ||
        wx_fields[1].empty()) {
      continue;  // matches encode_fixture's skip-if-missing rule
    }
    Row row;
    row.grid_kw = std::stod(ind_fields[1]);
    row.pv_kw = std::stod(ind_fields[2]);
    row.bess_kw = std::stod(ind_fields[3]);
    row.temperature_c = std::stod(wx_fields[1]);
    rows.push_back(row);
  }
  return rows;
}

std::vector<uint8_t> read_file_bytes(const std::string& path) {
  std::ifstream input(path, std::ios::binary);
  return std::vector<uint8_t>(std::istreambuf_iterator<char>(input), {});
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 4) {
    std::fprintf(stderr, "usage: test_end_to_end_real_fixture <fixture.bin> <industrial2.csv> <weather.csv>\n");
    return 2;
  }
  const std::string fixture_path = argv[1];
  const std::string industrial_path = argv[2];
  const std::string weather_path = argv[3];

  // encode_fixture was invoked with a row cap; mirror it here via the
  // fixture's own frame count rather than assuming a fixed number.
  std::vector<uint8_t> stream = read_file_bytes(fixture_path);
  check(!stream.empty(), "fixture file is non-empty");

  std::vector<std::vector<uint16_t>> decoded_register_blocks;
  size_t offset = 0;
  try {
    while (offset < stream.size()) {
      auto decoded = decode_tcp_frame(stream.data() + offset, stream.size() - offset);
      if (decoded.bytes_consumed == 0) {
        throw std::runtime_error("decode_tcp_frame reported zero bytes consumed -- would loop forever");
      }
      decoded_register_blocks.push_back(registers_from_response_payload(decoded.frame.payload));
      offset += decoded.bytes_consumed;
    }
  } catch (const std::exception& e) {
    std::fprintf(stderr, "FAIL: frame decoding threw after %zu of %zu bytes and %zu frames: %s\n",
                 offset, stream.size(), decoded_register_blocks.size(), e.what());
    return 1;
  }

  auto reference_rows = load_reference_rows(industrial_path, weather_path, decoded_register_blocks.size());
  check(reference_rows.size() == decoded_register_blocks.size(),
        "decoded frame count matches the real reference rows used to build the fixture");

  // Both tolerances equal the maximum possible quantization error for their
  // encoded resolution (round-to-nearest over a step of size S has worst-case
  // error S/2); comparisons below use <= since real data lands exactly on
  // that boundary often enough to matter (e.g. a source value of 6.75 C
  // quantizes to 6.8 C at 0.1 C resolution -- a genuine, expected 0.05 C
  // rounding step, not data corruption).
  // +1e-9 absorbs IEEE-754 double representation error at the boundary
  // itself (0.1 and 0.05 are not exactly representable in binary floating
  // point) -- it is not slack in the quantization argument above.
  const double tol_kw = 0.0005 + 1e-9;    // encoded at 1 W resolution -> 0.001 kW step
  const double tol_temp = 0.05 + 1e-9;    // encoded at 0.1 C resolution

  size_t compared = std::min(reference_rows.size(), decoded_register_blocks.size());
  // evidergy_point_map() heap-allocates a fresh vector on every call; computed once
  // here rather than once per row (x4000) to avoid needless allocation churn in the
  // comparison loop.
  const auto point_map = evidergy_point_map();
  for (size_t i = 0; i < compared; ++i) {
    const auto& regs = decoded_register_blocks[i];
    const auto& ref = reference_rows[i];
    for (const auto& point : point_map) {
      if (point.type == PointType::kScaleFactor) continue;
      double decoded_value = decode_engineering_value(regs, point);
      if (point.name == "grid_kw") {
        check(std::fabs(decoded_value - ref.grid_kw) <= tol_kw, "row " + std::to_string(i) + " grid_kw matches real CSV");
      } else if (point.name == "pv_kw") {
        check(std::fabs(decoded_value - ref.pv_kw) <= tol_kw, "row " + std::to_string(i) + " pv_kw matches real CSV");
      } else if (point.name == "bess_kw") {
        check(std::fabs(decoded_value - ref.bess_kw) <= tol_kw, "row " + std::to_string(i) + " bess_kw matches real CSV");
      } else if (point.name == "temperature_c") {
        check(std::fabs(decoded_value - ref.temperature_c) <= tol_temp,
              "row " + std::to_string(i) + " temperature_c matches real weather CSV");
      }
      // soc_pct and unix_timestamp are derived/collector-clock fields, not
      // directly present in the source CSVs, so they are covered by
      // test_sunspec_decode.cpp's deterministic round trip instead.
    }
  }

  std::printf("test_end_to_end_real_fixture: compared %zu real intervals, %d failure(s)\n",
              compared, failures);
  return failures == 0 ? 0 : 1;
}
