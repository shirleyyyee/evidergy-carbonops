// Canonical output record, matching the field set and naming in
// data_pipeline/normalize_energy.py's CANONICAL_FIELDS so this collector's
// output can be consumed by the same downstream pipeline without a second
// mapping layer.
#pragma once

#include <optional>
#include <string>

namespace periscope {

struct CanonicalRecord {
  std::string timestamp;  // ISO-8601, as decoded from the frame's site clock
  std::string site_id;
  double grid_kw = 0.0;
  double load_kw = 0.0;  // not derivable from this device alone; left 0 + flagged
  double pv_kw = 0.0;
  double bess_kw = 0.0;
  double soc_pct = 0.0;
  std::optional<double> irradiance_wm2;
  double temperature_c = 0.0;
  std::string quality_flags;  // pipe-separated, matches normalize_energy.py convention
};

}  // namespace periscope
