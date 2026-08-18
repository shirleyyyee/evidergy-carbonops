// Builds a real-data test fixture: reads the already-validated Evidergy
// reference-dataset CSVs (data_processed/reference_2016/*.csv, produced by
// data_pipeline/reference_backtest.py from real Open Power System Data +
// Open-Meteo telemetry) and re-encodes each fully-covered real 15-minute
// interval as a Modbus TCP "Read Holding Registers" response frame, using
// this collector's point map (see sunspec_point.cpp).
//
// This does NOT fabricate any measurement: every grid/PV/battery value
// encoded here is a real, previously-checksummed number from the same
// dataset documented in docs/REFERENCE_DATASET.md. The only *derived* value
// is the SOC proxy, computed with the identical per-day integration method
// already documented there (reset to 50% at each real calendar day boundary,
// integrate real bess_kw over a 5.1 kWh data-driven capacity estimate) --
// not a new assumption introduced by this tool.
#include <cstdint>
#include <cmath>
#include <fstream>
#include <iostream>
#include <optional>
#include <sstream>
#include <string>
#include <vector>

#include "modbus_frame.hpp"

namespace {

constexpr double kCapacityKwh = 5.1;  // matches bess_evidence module's estimate

struct Row {
  std::string timestamp;
  std::optional<double> grid_kw, pv_kw, bess_kw, temperature_c;
};

std::vector<std::string> split_csv_line(const std::string& line) {
  std::vector<std::string> fields;
  std::stringstream ss(line);
  std::string field;
  while (std::getline(ss, field, ',')) fields.push_back(field);
  // trailing empty field after a final comma is significant (means "missing")
  if (!line.empty() && line.back() == ',') fields.push_back("");
  return fields;
}

std::optional<double> parse_optional_double(const std::string& s) {
  if (s.empty()) return std::nullopt;
  try {
    return std::stod(s);
  } catch (...) {
    return std::nullopt;
  }
}

// Howard Hinnant's public-domain civil-date-to-days-since-epoch algorithm.
int64_t days_from_civil(int64_t y, unsigned m, unsigned d) {
  y -= m <= 2;
  const int64_t era = (y >= 0 ? y : y - 399) / 400;
  const unsigned yoe = static_cast<unsigned>(y - era * 400);
  const unsigned doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1;
  const unsigned doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
  return era * 146097 + static_cast<int64_t>(doe) - 719468;
}

uint32_t parse_unix_seconds(const std::string& timestamp) {
  // Format: "YYYY-MM-DD HH:MM:SS+00:00" (always UTC in this dataset).
  int year, month, day, hour, minute, second;
  std::sscanf(timestamp.c_str(), "%d-%d-%d %d:%d:%d", &year, &month, &day, &hour, &minute, &second);
  int64_t days = days_from_civil(year, static_cast<unsigned>(month), static_cast<unsigned>(day));
  int64_t seconds = days * 86400 + hour * 3600 + minute * 60 + second;
  return static_cast<uint32_t>(seconds);
}

std::string day_key(const std::string& timestamp) {
  return timestamp.substr(0, 10);  // "YYYY-MM-DD"
}

std::vector<Row> load_rows(const std::string& industrial_path, const std::string& weather_path) {
  std::ifstream ind(industrial_path);
  std::ifstream wx(weather_path);
  if (!ind || !wx) throw std::runtime_error("cannot open input CSVs");

  std::string ind_line, wx_line;
  std::getline(ind, ind_line);  // headers
  std::getline(wx, wx_line);

  std::vector<Row> rows;
  while (std::getline(ind, ind_line) && std::getline(wx, wx_line)) {
    auto ind_fields = split_csv_line(ind_line);
    auto wx_fields = split_csv_line(wx_line);
    if (ind_fields.size() < 4 || wx_fields.size() < 2) continue;
    Row row;
    row.timestamp = ind_fields[0];
    row.grid_kw = parse_optional_double(ind_fields[1]);
    row.pv_kw = parse_optional_double(ind_fields[2]);
    row.bess_kw = parse_optional_double(ind_fields[3]);
    row.temperature_c = parse_optional_double(wx_fields[1]);
    rows.push_back(std::move(row));
  }
  return rows;
}

uint16_t low16(int32_t v) { return static_cast<uint16_t>(static_cast<uint32_t>(v) & 0xFFFF); }
uint16_t high16(int32_t v) { return static_cast<uint16_t>((static_cast<uint32_t>(v) >> 16) & 0xFFFF); }

}  // namespace

int main(int argc, char** argv) {
  if (argc < 5) {
    std::cerr << "usage: encode_fixture <industrial2_2016_normalised.csv> "
                 "<konstanz_2016_weather_15min.csv> <output.bin> <max_rows>\n";
    return 2;
  }
  const std::string industrial_path = argv[1];
  const std::string weather_path = argv[2];
  const std::string output_path = argv[3];
  const size_t max_rows = static_cast<size_t>(std::stoul(argv[4]));

  std::vector<Row> rows;
  try {
    rows = load_rows(industrial_path, weather_path);
  } catch (const std::exception& e) {
    std::cerr << "fatal: " << e.what() << '\n';
    return 1;
  }

  std::ofstream out(output_path, std::ios::binary);
  if (!out) {
    std::cerr << "fatal: cannot open output: " << output_path << '\n';
    return 1;
  }

  size_t encoded = 0, skipped_missing = 0;
  double soc = 50.0;
  std::string current_day;
  uint16_t transaction_id = 0;

  for (const Row& row : rows) {
    if (encoded >= max_rows) break;
    if (!row.grid_kw || !row.pv_kw || !row.bess_kw || !row.temperature_c) {
      ++skipped_missing;
      continue;
    }
    const std::string this_day = day_key(row.timestamp);
    if (this_day != current_day) {
      soc = 50.0;
      current_day = this_day;
    }
    soc += 100.0 * (*row.bess_kw * 0.25) / kCapacityKwh;
    soc = std::max(0.0, std::min(100.0, soc));

    const int32_t grid_w = static_cast<int32_t>(std::lround(*row.grid_kw * 1000.0));
    const int32_t pv_w = static_cast<int32_t>(std::lround(*row.pv_kw * 1000.0));
    const int32_t bess_w = static_cast<int32_t>(std::lround(*row.bess_kw * 1000.0));
    const uint16_t soc_raw = static_cast<uint16_t>(std::lround(soc * 10.0));
    const uint16_t temp_raw = static_cast<uint16_t>(
        static_cast<int16_t>(std::lround(*row.temperature_c * 10.0)));
    const uint32_t ts = parse_unix_seconds(row.timestamp);

    std::vector<uint16_t> registers = {
        0,  // power_scale_factor = 0 (raw register values are already Watts)
        high16(grid_w), low16(grid_w),
        high16(pv_w), low16(pv_w),
        high16(bess_w), low16(bess_w),
        soc_raw,
        temp_raw,
        static_cast<uint16_t>((ts >> 16) & 0xFFFF), static_cast<uint16_t>(ts & 0xFFFF),
    };

    auto frame = evidergy::modbus::encode_read_holding_registers_response(
        transaction_id++, /*unit_id=*/1, registers);
    out.write(reinterpret_cast<const char*>(frame.data()), static_cast<std::streamsize>(frame.size()));
    ++encoded;
  }

  std::cerr << "encoded " << encoded << " real intervals into " << output_path
            << " (" << skipped_missing << " intervals skipped: missing real telemetry)\n";
  return 0;
}
