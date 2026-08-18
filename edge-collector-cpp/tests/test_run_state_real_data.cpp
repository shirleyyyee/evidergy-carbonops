// Runs the run-state classifier over the REAL industrial2 2016 bess_kw column (the
// same reference dataset used by every other test in this repo) and checks
// structural invariants -- not a recall/accuracy claim, since this public dataset
// carries no real labelled RUN/OFF/IDLE ground truth to score against (the same
// honesty constraint documented for the PV/BESS fault-injection evidence modules
// in docs/REFERENCE_DATASET.md). What this test DOES prove, on real data: every
// state transition the classifier reports is backed by a real debounced streak,
// gaps in the real data produce UNKNOWN rather than a silently stale state, and the
// classifier does not crash or diverge over a full real year of noisy telemetry.
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

#include "run_state.hpp"

using evidergy::state::RunState;
using evidergy::state::RunStateClassifier;
using evidergy::state::RunStateThresholds;
using evidergy::state::to_string;

namespace {

int failures = 0;
void check(bool condition, const std::string& what) {
  if (!condition) {
    std::fprintf(stderr, "FAIL: %s\n", what.c_str());
    ++failures;
  }
}

std::vector<std::string> split_csv_line(const std::string& line) {
  std::vector<std::string> fields;
  std::stringstream ss(line);
  std::string field;
  while (std::getline(ss, field, ',')) fields.push_back(field);
  if (!line.empty() && line.back() == ',') fields.push_back("");
  return fields;
}

struct Sample {
  double bess_kw = 0.0;
  bool missing = true;
};

std::vector<Sample> load_real_bess_kw(const std::string& path) {
  std::ifstream in(path);
  std::string line;
  std::getline(in, line);  // header: timestamp,grid_kw,pv_kw,bess_kw
  std::vector<Sample> samples;
  while (std::getline(in, line)) {
    auto fields = split_csv_line(line);
    if (fields.size() < 4 || fields[3].empty()) {
      samples.push_back({0.0, true});
      continue;
    }
    samples.push_back({std::strtod(fields[3].c_str(), nullptr), false});
  }
  return samples;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: test_run_state_real_data <industrial2_2016_normalised.csv>\n");
    return 2;
  }

  const auto samples = load_real_bess_kw(argv[1]);
  check(!samples.empty(), "real reference CSV is non-empty");

  // Thresholds are illustrative for this prototype -- 0.05 kW / 0.3 kW / 3 intervals
  // (45 min at this site's 15-min interval data) -- chosen to sit inside this real
  // system's own power range (99th-percentile power ~1.4 kW; see
  // docs/REFERENCE_DATASET.md's BESS evidence deadband derivation for the same real
  // system), not tuned against any labelled outcome.
  const RunStateThresholds thresholds{0.05, 0.3, 3};
  RunStateClassifier classifier(thresholds);

  size_t off = 0, idle = 0, run = 0, unknown = 0;
  RunState previous_state = RunState::kUnknown;
  double raw_streak_value_sign = 0;  // unused placeholder to keep clang-tidy quiet about narrowing
  (void)raw_streak_value_sign;

  int real_candidate_streak = 0;
  RunState real_candidate = RunState::kUnknown;

  for (const auto& sample : samples) {
    // Independently track the same "raw classification streak" the classifier is
    // supposed to be enforcing, so we can check its output against it below --
    // this re-derivation (not a call into the classifier's internals) is what
    // makes the invariant check below meaningful rather than circular.
    if (sample.missing) {
      real_candidate = RunState::kUnknown;
      real_candidate_streak = 0;
    } else {
      const double abs_kw = sample.bess_kw < 0 ? -sample.bess_kw : sample.bess_kw;
      RunState raw = abs_kw >= thresholds.run_threshold_kw
                         ? RunState::kRun
                         : (abs_kw < thresholds.off_threshold_kw ? RunState::kOff : RunState::kIdle);
      if (raw == real_candidate) {
        ++real_candidate_streak;
      } else {
        real_candidate = raw;
        real_candidate_streak = 1;
      }
    }

    const RunState state = classifier.update(sample.bess_kw, sample.missing);

    if (sample.missing) {
      check(state == RunState::kUnknown, "a missing real interval is reported as UNKNOWN, not a stale state");
    }

    // Invariant: any change to a *different, non-UNKNOWN* accepted state must be
    // backed by a real debounced streak of at least `debounce_intervals` real
    // samples of that same raw classification, ending at this sample.
    if (state != previous_state && state != RunState::kUnknown) {
      check(real_candidate == state && real_candidate_streak >= thresholds.debounce_intervals,
            "state change to " + to_string(state) + " is backed by a real debounced streak");
    }
    previous_state = state;

    switch (state) {
      case RunState::kOff: ++off; break;
      case RunState::kIdle: ++idle; break;
      case RunState::kRun: ++run; break;
      case RunState::kUnknown: ++unknown; break;
    }
  }

  const size_t total = off + idle + run + unknown;
  check(total == samples.size(), "every real interval produced exactly one classified state");

  std::printf(
      "test_run_state_real_data: %zu real intervals -- OFF %.1f%%  IDLE %.1f%%  RUN %.1f%%  UNKNOWN %.1f%%  "
      "(%d failure(s))\n",
      total, 100.0 * off / total, 100.0 * idle / total, 100.0 * run / total, 100.0 * unknown / total, failures);
  return failures == 0 ? 0 : 1;
}
