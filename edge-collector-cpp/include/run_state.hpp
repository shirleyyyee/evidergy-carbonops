// A simple, generically-documented equipment run-state classifier: OFF / IDLE / RUN,
// debounced against transient spikes, with UNKNOWN for missing/invalid samples.
//
// Honesty note: this is an independently designed prototype written for this public
// repository. It is NOT a reproduction of Evidergy's internal EAF-GW4 production
// state-recognition algorithm (different thresholds, different debounce/UNKNOWN
// handling, and not published here or anywhere in this repo) -- see
// hardware-final-2026-08-16/README (internal, not part of this repository) for that
// separate, confidential work. This module exists to demonstrate, on real reference
// telemetry, the same general technique (threshold + debounce state machine) the
// hardware architecture depends on, without disclosing the production thresholds.
#pragma once

#include <string>

namespace evidergy::state {

enum class RunState { kOff, kIdle, kRun, kUnknown };

std::string to_string(RunState state);

struct RunStateThresholds {
  double off_threshold_kw;  // |power| below this -> OFF candidate
  double run_threshold_kw;  // |power| at/above this -> RUN candidate (must be > off_threshold_kw)
  int debounce_intervals;   // consecutive same-candidate samples required before a state change is accepted
};

class RunStateClassifier {
 public:
  explicit RunStateClassifier(RunStateThresholds thresholds);

  // Feed one new power sample (kW; sign-agnostic magnitude is used internally, since
  // both charge and discharge count as "equipment active"). Returns the accepted
  // state after this sample (which may still be the previous state, if debounce for
  // a candidate change has not yet been satisfied).
  RunState update(double power_kw, bool missing = false);

  RunState current_state() const { return state_; }

 private:
  RunStateThresholds thresholds_;
  RunState state_ = RunState::kUnknown;
  RunState candidate_ = RunState::kUnknown;
  int candidate_streak_ = 0;

  static RunState classify_raw(double abs_power_kw, const RunStateThresholds& t);
};

}  // namespace evidergy::state
