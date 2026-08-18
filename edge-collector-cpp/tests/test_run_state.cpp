// Deterministic unit tests for the run-state classifier's own logic: debounce
// behaviour, all four states reachable, UNKNOWN on missing data. These test the
// state machine itself, not a claim about real equipment (that's
// test_run_state_real_data.cpp).
#include <cstdio>
#include <stdexcept>
#include <string>

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

}  // namespace

int main() {
  const RunStateThresholds thresholds{/*off=*/0.05, /*run=*/0.3, /*debounce=*/3};

  // A single sample above the run threshold is not enough to accept RUN --
  // debounce requires 3 consecutive candidate samples.
  {
    RunStateClassifier classifier(thresholds);
    check(classifier.update(1.0) == RunState::kUnknown, "single high sample does not immediately accept RUN");
    check(classifier.update(1.0) == RunState::kUnknown, "second high sample still below debounce threshold");
    check(classifier.update(1.0) == RunState::kRun, "third consecutive high sample accepts RUN");
  }

  // A brief spike that does not persist for the full debounce window must not
  // flip the accepted state.
  {
    RunStateClassifier classifier(thresholds);
    classifier.update(0.01);
    classifier.update(0.01);
    check(classifier.update(0.01) == RunState::kOff, "three low samples accept OFF");
    classifier.update(1.0);  // one-sample spike, streak resets on the next low sample
    check(classifier.update(0.01) == RunState::kOff, "single-sample spike does not flip accepted state");
  }

  // IDLE is reachable when power sits between the two thresholds.
  {
    RunStateClassifier classifier(thresholds);
    classifier.update(0.15);
    classifier.update(0.15);
    check(classifier.update(0.15) == RunState::kIdle, "mid-range power accepts IDLE after debounce");
  }

  // Missing/NaN samples are UNKNOWN immediately (no debounce delay -- a gap is a
  // gap, not something to wait out) and do not silently reuse the last known state.
  {
    RunStateClassifier classifier(thresholds);
    classifier.update(1.0);
    classifier.update(1.0);
    classifier.update(1.0);
    check(classifier.current_state() == RunState::kRun, "precondition: state is RUN before the gap");
    check(classifier.update(0.0, /*missing=*/true) == RunState::kUnknown, "missing sample is immediately UNKNOWN");
  }

  // Sign of power must not matter -- charge and discharge both count as active.
  {
    RunStateClassifier classifier(thresholds);
    classifier.update(-1.0);
    classifier.update(-1.0);
    check(classifier.update(-1.0) == RunState::kRun, "negative (charging) power still accepts RUN by magnitude");
  }

  // Constructor validates its thresholds rather than accepting a nonsensical config.
  {
    bool threw = false;
    try {
      RunStateClassifier bad({0.5, 0.1, 3});
    } catch (const std::invalid_argument&) {
      threw = true;
    }
    check(threw, "constructor rejects run_threshold_kw <= off_threshold_kw");
  }

  check(to_string(RunState::kRun) == "RUN", "to_string(RUN)");
  check(to_string(RunState::kOff) == "OFF", "to_string(OFF)");
  check(to_string(RunState::kIdle) == "IDLE", "to_string(IDLE)");
  check(to_string(RunState::kUnknown) == "UNKNOWN", "to_string(UNKNOWN)");

  std::printf("test_run_state: %d failure(s)\n", failures);
  return failures == 0 ? 0 : 1;
}
