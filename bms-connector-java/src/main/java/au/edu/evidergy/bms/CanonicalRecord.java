package au.edu.evidergy.bms;

/**
 * Mirrors the canonical field set in data_pipeline/normalize_energy.py's
 * CANONICAL_FIELDS, so BMS-sourced telemetry lands in the same schema as the
 * Python data pipeline and the C++ edge collector output, without a second
 * mapping layer downstream.
 */
public final class CanonicalRecord {
  public final String timestamp;   // ISO-8601 UTC
  public final String siteId;
  public final double gridKw;
  public final double loadKw;
  public final double pvKw;
  public final double bessKw;
  public final double socPct;
  public final Double irradianceWm2;  // nullable: BMS meters rarely carry a pyranometer channel
  public final double temperatureC;
  public final String qualityFlags;   // pipe-separated, matches normalize_energy.py convention

  public CanonicalRecord(String timestamp, String siteId, double gridKw, double loadKw, double pvKw,
      double bessKw, double socPct, Double irradianceWm2, double temperatureC, String qualityFlags) {
    this.timestamp = timestamp;
    this.siteId = siteId;
    this.gridKw = gridKw;
    this.loadKw = loadKw;
    this.pvKw = pvKw;
    this.bessKw = bessKw;
    this.socPct = socPct;
    this.irradianceWm2 = irradianceWm2;
    this.temperatureC = temperatureC;
    this.qualityFlags = qualityFlags;
  }

  public String toCsvRow() {
    return String.join(",",
        timestamp,
        siteId,
        fmt(gridKw),
        fmt(loadKw),
        fmt(pvKw),
        fmt(bessKw),
        fmt(socPct),
        irradianceWm2 == null ? "" : fmt(irradianceWm2),
        fmt(temperatureC),
        qualityFlags == null ? "" : qualityFlags);
  }

  public static String csvHeader() {
    return "timestamp,site_id,grid_kw,load_kw,pv_kw,bess_kw,soc_pct,irradiance_wm2,temperature_c,quality_flags";
  }

  private static String fmt(double v) {
    return String.valueOf(Math.round(v * 10000.0) / 10000.0);
  }
}
