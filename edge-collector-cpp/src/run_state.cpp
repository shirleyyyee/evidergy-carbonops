#include "run_state.hpp"

#include <cmath>
#include <stdexcept>

namespace evidergy::state {

std::string to_string(RunState state) {
  switch (state) {
    case RunState::kOff: return "OFF";
    case RunState::kIdle: return "IDLE";
    case RunState::kRun: return "RUN";
    case RunState::kUnknown: return "UNKNOWN";
  }
  return "UNKNOWN";
}

RunStateClassifier::RunStateClassifier(RunStateThresholds thresholds) : thresholds_(thresholds) {
  if (!(thresholds_.run_threshold_kw > thresholds_.off_threshold_kw)) {
    throw std::invalid_argument("run_threshold_kw must be greater than off_threshold_kw");
  }
  if (thresholds_.debounce_intervals < 1) {
    throw std::invalid_argument("debounce_intervals must be >= 1");
  }
}

RunState RunStateClassifier::classify_raw(double abs_power_kw, const RunStateThresholds& t) {
  if (abs_power_kw >= t.run_threshold_kw) return RunState::kRun;
  if (abs_power_kw < t.off_threshold_kw) return RunState::kOff;
  return RunState::kIdle;
}

RunState RunStateClassifier::update(double power_kw, bool missing) {
  if (missing || std::isnan(power_kw)) {
    candidate_ = RunState::kUnknown;
    candidate_streak_ = 0;
    state_ = RunState::kUnknown;
    return state_;
  }

  const RunState raw = classify_raw(std::fabs(power_kw), thresholds_);
  if (raw == candidate_) {
    ++candidate_streak_;
  } else {
    candidate_ = raw;
    candidate_streak_ = 1;
  }

  if (candidate_streak_ >= thresholds_.debounce_intervals) {
    state_ = candidate_;
  }
  return state_;
}

}  // namespace evidergy::state
