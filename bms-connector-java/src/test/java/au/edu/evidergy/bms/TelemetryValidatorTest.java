package au.edu.evidergy.bms;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import static au.edu.evidergy.bms.TestSupport.check;

public final class TelemetryValidatorTest {

  private static Map<String, Object> validPayload() {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("timestamp", "2026-08-09T06:00:00Z");
    payload.put("site_id", "evidergy-bms-demo");
    payload.put("grid_kw", 2.5);
    payload.put("load_kw", 8.6);
    payload.put("pv_kw", 6.1);
    payload.put("bess_kw", 0.0);
    payload.put("soc_pct", 70.0);
    payload.put("temperature_c", 21.4);
    payload.put("irradiance_wm2", 540.0);
    return payload;
  }

  public static void main(String[] args) throws Exception {
    Instant fixedNow = Instant.parse("2026-08-09T06:00:00Z");
    TelemetryValidator validator = new TelemetryValidator(() -> fixedNow);

    CanonicalRecord record = validator.validate(validPayload());
    check(record.gridKw == 2.5, "valid payload: grid_kw round-trips");
    check(record.socPct == 70.0, "valid payload: soc_pct round-trips");
    check(record.irradianceWm2 != null && record.irradianceWm2 == 540.0, "valid payload: irradiance round-trips");

    check(rejects(validator, missingField("site_id")), "missing site_id is rejected");
    check(rejects(validator, missingField("grid_kw")), "missing grid_kw is rejected");

    check(rejects(validator, withValue("soc_pct", 150.0)), "soc_pct > 100 is rejected");
    check(rejects(validator, withValue("soc_pct", -5.0)), "soc_pct < 0 is rejected");
    check(rejects(validator, withValue("temperature_c", 200.0)), "implausible temperature_c is rejected");
    check(rejects(validator, withValue("irradiance_wm2", 5000.0)), "implausible irradiance_wm2 is rejected");
    check(rejects(validator, withValue("timestamp", "not-a-timestamp")), "malformed timestamp is rejected");
    check(rejects(validator, withValue("timestamp", "2026-08-09T07:00:00Z")),
        "timestamp far in the future (beyond clock-skew tolerance) is rejected");
    check(rejects(validator, withValue("site_id", "")), "blank site_id is rejected");
    check(rejects(validator, withValue("grid_kw", "not-a-number")), "non-numeric grid_kw is rejected");

    // Optional field absent entirely is fine.
    Map<String, Object> noIrradiance = validPayload();
    noIrradiance.remove("irradiance_wm2");
    CanonicalRecord withoutIrradiance = validator.validate(noIrradiance);
    check(withoutIrradiance.irradianceWm2 == null, "irradiance_wm2 is optional and defaults to null");

    TestSupport.finish("TelemetryValidatorTest");
  }

  private static Map<String, Object> missingField(String field) {
    Map<String, Object> payload = validPayload();
    payload.remove(field);
    return payload;
  }

  private static Map<String, Object> withValue(String field, Object value) {
    Map<String, Object> payload = validPayload();
    payload.put(field, value);
    return payload;
  }

  private static boolean rejects(TelemetryValidator validator, Map<String, Object> payload) {
    try {
      validator.validate(payload);
      return false;
    } catch (TelemetryValidator.ValidationException e) {
      return true;
    }
  }
}
