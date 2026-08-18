// evidergy-edge-collector: decodes a stream of Modbus TCP "Read Holding
// Registers" response frames (captured on the wire, or replayed from a
// fixture file) into the canonical CSV schema shared with
// data_pipeline/normalize_energy.py.
//
// This is the real, standards-conformant framing/decoding layer for a field
// gateway: it does not initiate Modbus requests over a live TCP socket in
// this build (no site hardware is available to this project yet), but the
// decode path is identical to what a live collector would run against
// captured responses -- see tools/encode_fixture.cpp, which builds its test
// fixture from real, previously-validated Evidergy reference-dataset CSVs
// (not fabricated numbers), and tests/test_end_to_end_real_fixture.cpp,
// which proves the round trip is lossless.
#include <algorithm>
#include <chrono>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <string>
#include <vector>

#include "canonical_record.hpp"
#include "modbus_frame.hpp"
#include "sunspec_point.hpp"

namespace {

using evidergy::CanonicalRecord;
using evidergy::modbus::decode_tcp_frame;
using evidergy::modbus::registers_from_response_payload;
using evidergy::sunspec::PointDef;
using evidergy::sunspec::PointType;
using evidergy::sunspec::decode_engineering_value;
using evidergy::sunspec::evidergy_point_map;

std::vector<uint8_t> read_file_bytes(const std::string& path) {
  std::ifstream input(path, std::ios::binary);
  if (!input) throw std::runtime_error("cannot open input file: " + path);
  return std::vector<uint8_t>(std::istreambuf_iterator<char>(input), {});
}

std::string iso8601_utc(uint32_t unix_seconds) {
  std::time_t t = static_cast<std::time_t>(unix_seconds);
  std::tm utc{};
#if defined(_WIN32)
  gmtime_s(&utc, &t);
#else
  gmtime_r(&t, &utc);
#endif
  std::ostringstream out;
  out << std::put_time(&utc, "%Y-%m-%dT%H:%M:%SZ");
  return out.str();
}

double find_value(const std::vector<std::pair<std::string, double>>& decoded,
                   const std::string& name) {
  for (const auto& [key, value] : decoded) {
    if (key == name) return value;
  }
  throw std::runtime_error("point not found in decoded frame: " + name);
}

CanonicalRecord decode_record(const std::vector<uint16_t>& registers,
                               const std::string& site_id) {
  const auto point_map = evidergy_point_map();
  std::vector<std::pair<std::string, double>> decoded;
  decoded.reserve(point_map.size());
  for (const PointDef& point : point_map) {
    if (point.type == PointType::kScaleFactor) continue;  // consumed implicitly
    decoded.emplace_back(point.name, decode_engineering_value(registers, point));
  }

  CanonicalRecord record;
  record.site_id = site_id;
  record.grid_kw = find_value(decoded, "grid_kw");
  record.pv_kw = find_value(decoded, "pv_kw");
  record.bess_kw = find_value(decoded, "bess_kw");
  record.soc_pct = find_value(decoded, "soc_pct");
  record.temperature_c = find_value(decoded, "temperature_c");
  record.timestamp = iso8601_utc(static_cast<uint32_t>(find_value(decoded, "unix_timestamp")));
  // This device's SunSpec block carries no whole-building load channel and
  // no irradiance sensor -- left unset rather than fabricated, and flagged so
  // downstream quality gates know why the load balance can't close on this
  // channel alone.
  record.load_kw = 0.0;
  record.quality_flags = "load_kw_not_metered_by_this_device";
  return record;
}

void write_csv_header(std::ostream& out) {
  out << "timestamp,site_id,grid_kw,load_kw,pv_kw,bess_kw,soc_pct,irradiance_wm2,"
         "temperature_c,quality_flags\n";
}

void write_csv_row(std::ostream& out, const CanonicalRecord& r) {
  out << r.timestamp << ',' << r.site_id << ',' << std::fixed << std::setprecision(4)
      << r.grid_kw << ',' << r.load_kw << ',' << r.pv_kw << ',' << r.bess_kw << ','
      << std::setprecision(1) << r.soc_pct << ',' << "" << ',' << std::setprecision(2)
      << r.temperature_c << ',' << r.quality_flags << '\n';
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 4) {
    std::cerr << "usage: evidergy-edge-collector <input.bin> <output.csv> <site_id>\n";
    return 2;
  }
  const std::string input_path = argv[1];
  const std::string output_path = argv[2];
  const std::string site_id = argv[3];

  std::vector<uint8_t> stream;
  try {
    stream = read_file_bytes(input_path);
  } catch (const std::exception& e) {
    std::cerr << "fatal: " << e.what() << '\n';
    return 1;
  }

  std::ofstream out(output_path, std::ios::binary);
  if (!out) {
    std::cerr << "fatal: cannot open output file: " << output_path << '\n';
    return 1;
  }
  write_csv_header(out);

  size_t offset = 0;
  size_t frames_ok = 0;
  size_t frames_failed = 0;
  const auto start = std::chrono::steady_clock::now();

  while (offset < stream.size()) {
    try {
      auto decoded = decode_tcp_frame(stream.data() + offset, stream.size() - offset);
      auto registers = registers_from_response_payload(decoded.frame.payload);
      write_csv_row(out, decode_record(registers, site_id));
      offset += decoded.bytes_consumed;
      ++frames_ok;
    } catch (const std::exception& e) {
      std::cerr << "frame decode failed at byte offset " << offset << ": " << e.what() << '\n';
      ++frames_failed;
      break;  // a byte-stream desync past this point is not safely recoverable
    }
  }

  const auto elapsed = std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
  const double registers_decoded = static_cast<double>(frames_ok) * evidergy_point_map().size();
  std::cerr << "decoded " << frames_ok << " frames (" << frames_failed << " failed) in "
            << std::fixed << std::setprecision(3) << elapsed << "s -- "
            << std::setprecision(0) << (elapsed > 0 ? frames_ok / elapsed : 0.0) << " frames/s, "
            << std::setprecision(0) << (elapsed > 0 ? registers_decoded / elapsed : 0.0)
            << " registers/s\n";

  return frames_failed > 0 && frames_ok == 0 ? 1 : 0;
}
