package au.edu.evidergy.bms;

import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.Map;

/**
 * Validates and normalises a flat JSON telemetry payload (as a real
 * BMS/OPC-UA-to-REST gateway would forward it) into a CanonicalRecord.
 * Rejects malformed, out-of-range, or physically implausible values rather
 * than silently passing them through -- the same "quality gate before
 * anything downstream" principle as data_pipeline/core_models.py's
 * quality_flags / energy_balance checks.
 */
public final class TelemetryValidator {

  private static final double MAX_PLAUSIBLE_IRRADIANCE_WM2 = 1400.0;  // solar constant ~1361 W/m2 + margin
  private static final double MIN_PLAUSIBLE_TEMPERATURE_C = -60.0;
  private static final double MAX_PLAUSIBLE_TEMPERATURE_C = 65.0;
  private static final long MAX_CLOCK_SKEW_SECONDS = 300;  // reject timestamps > 5 min in the future

  public static final class ValidationException extends Exception {
    public ValidationException(String message) {
      super(message);
    }
  }

  private final java.util.function.Supplier<Instant> clock;

  public TelemetryValidator() {
    this(Instant::now);
  }

  /** Package-visible constructor for tests that need a fixed clock. */
  TelemetryValidator(java.util.function.Supplier<Instant> clock) {
    this.clock = clock;
  }

  public CanonicalRecord validate(Map<String, Object> payload) throws ValidationException {
    String timestamp = requireString(payload, "timestamp");
    String siteId = requireString(payload, "site_id");
    double gridKw = requireFiniteNumber(payload, "grid_kw");
    double loadKw = requireFiniteNumber(payload, "load_kw");
    double pvKw = requireFiniteNumber(payload, "pv_kw");
    double bessKw = requireFiniteNumber(payload, "bess_kw");
    double socPct = requireFiniteNumber(payload, "soc_pct");
    double temperatureC = requireFiniteNumber(payload, "temperature_c");
    Double irradianceWm2 = optionalFiniteNumber(payload, "irradiance_wm2");

    Instant parsedTimestamp;
    try {
      parsedTimestamp = Instant.parse(timestamp);
    } catch (DateTimeParseException e) {
      throw new ValidationException("timestamp is not valid ISO-8601 UTC: " + timestamp);
    }
    long skewSeconds = parsedTimestamp.getEpochSecond() - clock.get().getEpochSecond();
    if (skewSeconds > MAX_CLOCK_SKEW_SECONDS) {
      throw new ValidationException(
          "timestamp is " + skewSeconds + "s in the future, exceeds " + MAX_CLOCK_SKEW_SECONDS + "s skew tolerance");
    }

    if (siteId.isBlank()) {
      throw new ValidationException("site_id must not be blank");
    }
    if (socPct < 0.0 || socPct > 100.0) {
      throw new ValidationException("soc_pct out of physical range [0,100]: " + socPct);
    }
    if (temperatureC < MIN_PLAUSIBLE_TEMPERATURE_C || temperatureC > MAX_PLAUSIBLE_TEMPERATURE_C) {
      throw new ValidationException("temperature_c implausible: " + temperatureC);
    }
    if (irradianceWm2 != null && (irradianceWm2 < 0.0 || irradianceWm2 > MAX_PLAUSIBLE_IRRADIANCE_WM2)) {
      throw new ValidationException("irradiance_wm2 implausible: " + irradianceWm2);
    }

    return new CanonicalRecord(timestamp, siteId, gridKw, loadKw, pvKw, bessKw, socPct, irradianceWm2,
        temperatureC, "");
  }

  private static String requireString(Map<String, Object> payload, String key) throws ValidationException {
    Object value = payload.get(key);
    if (!(value instanceof String) || ((String) value).isEmpty()) {
      throw new ValidationException("missing or non-string field: " + key);
    }
    return (String) value;
  }

  private static double requireFiniteNumber(Map<String, Object> payload, String key) throws ValidationException {
    Double value = optionalFiniteNumber(payload, key);
    if (value == null) {
      throw new ValidationException("missing or non-numeric field: " + key);
    }
    return value;
  }

  private static Double optionalFiniteNumber(Map<String, Object> payload, String key) throws ValidationException {
    Object value = payload.get(key);
    if (value == null) return null;
    if (!(value instanceof Number)) {
      throw new ValidationException("field is not numeric: " + key);
    }
    double d = ((Number) value).doubleValue();
    if (Double.isNaN(d) || Double.isInfinite(d)) {
      throw new ValidationException("field is NaN/Infinite: " + key);
    }
    return d;
  }
}
