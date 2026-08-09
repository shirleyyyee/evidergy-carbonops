package au.edu.periscope.bms;

import java.io.BufferedReader;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static au.edu.periscope.bms.TestSupport.check;

/**
 * Starts the real BmsIngestServer, replays real intervals from the
 * checksummed Periscope reference dataset (residential4, 2016 -- see
 * docs/REFERENCE_DATASET.md) as HTTP POST /ingest requests exactly as a real
 * BMS gateway would send them, then reads back the server's own output CSV
 * and confirms every value survived the HTTP + validation + CSV round trip
 * unchanged. No fabricated numbers: every grid_kw/pv_kw value POSTed here is
 * a real, previously-checksummed measurement.
 */
public final class EndToEndRealDataTest {

  private static final int MAX_ROWS = 500;

  public static void main(String[] args) throws Exception {
    Path repoRoot = Path.of("..").toAbsolutePath().normalize();
    Path residentialCsv = repoRoot.resolve("data_processed/reference_2016/residential4_2016_normalised.csv");
    Path weatherCsv = repoRoot.resolve("data_processed/reference_2016/konstanz_2016_weather_15min.csv");

    if (!Files.exists(residentialCsv) || !Files.exists(weatherCsv)) {
      System.out.println("EndToEndRealDataTest: SKIPPED -- run `python data_pipeline/reference_backtest.py` "
          + "first to produce data_processed/reference_2016/*.csv (see docs/REFERENCE_DATASET.md)");
      return;
    }

    List<double[]> rows = loadRealRows(residentialCsv, weatherCsv, MAX_ROWS);
    check(!rows.isEmpty(), "at least one fully-covered real interval was loaded");

    Path outputCsv = Files.createTempFile("bms-connector-e2e-", ".csv");
    Files.deleteIfExists(outputCsv);
    BmsIngestServer server = new BmsIngestServer(outputCsv, new TelemetryValidator());
    server.start(0);
    int port = server.getPort();
    HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();

    try {
      List<String> timestamps = new ArrayList<>();
      int accepted = 0;
      for (int i = 0; i < rows.size(); i++) {
        double[] row = rows.get(i);
        String timestamp = unixSecondsToIso(row[0]);
        timestamps.add(timestamp);
        String payload = buildPayload(timestamp, row);
        HttpResponse<String> response = post(client, port, payload);
        if (response.statusCode() == 201) accepted++;
      }
      check(accepted == rows.size(), "all " + rows.size() + " real intervals were accepted (got " + accepted + ")");

      // Re-submitting the first real interval must be rejected as a duplicate.
      String replay = buildPayload(timestamps.get(0), rows.get(0));
      HttpResponse<String> duplicateResponse = post(client, port, replay);
      check(duplicateResponse.statusCode() == 409, "re-submitting the same real interval is rejected as duplicate");

      // Malformed request is rejected, not silently dropped.
      HttpResponse<String> malformed = post(client, port, "{not json");
      check(malformed.statusCode() == 400, "malformed JSON payload returns 400");

    } finally {
      server.stop();
    }

    // Verify the written CSV round-trips every real value.
    List<String> lines = Files.readAllLines(outputCsv, StandardCharsets.UTF_8);
    check(lines.size() - 1 == rows.size(), "output CSV has exactly one row per accepted real interval");
    for (int i = 1; i < lines.size(); i++) {
      String[] fields = lines.get(i).split(",", -1);
      double[] source = rows.get(i - 1);
      check(Math.abs(Double.parseDouble(fields[2]) - source[1]) < 1e-3, "row " + i + " grid_kw matches submitted real value");
      check(Math.abs(Double.parseDouble(fields[4]) - source[2]) < 1e-3, "row " + i + " pv_kw matches submitted real value");
      check(Math.abs(Double.parseDouble(fields[8]) - source[3]) < 1e-3, "row " + i + " temperature_c matches submitted real value");
    }

    Files.deleteIfExists(outputCsv);
    System.out.println("EndToEndRealDataTest: replayed and verified " + rows.size() + " real intervals over HTTP");
    TestSupport.finish("EndToEndRealDataTest");
  }

  /** Each row: [unix_seconds, grid_kw, pv_kw, temperature_c]. */
  private static List<double[]> loadRealRows(Path residentialCsv, Path weatherCsv, int maxRows) throws IOException {
    List<double[]> rows = new ArrayList<>();
    try (BufferedReader res = Files.newBufferedReader(residentialCsv);
         BufferedReader wx = Files.newBufferedReader(weatherCsv)) {
      res.readLine();  // header
      wx.readLine();
      String resLine, wxLine;
      while (rows.size() < maxRows && (resLine = res.readLine()) != null && (wxLine = wx.readLine()) != null) {
        String[] resFields = resLine.split(",", -1);
        String[] wxFields = wxLine.split(",", -1);
        if (resFields.length < 4 || wxFields.length < 2) continue;
        if (resFields[1].isEmpty() || resFields[2].isEmpty() || wxFields[1].isEmpty()) continue;
        double gridKw = Double.parseDouble(resFields[1]);
        double pvKw = Double.parseDouble(resFields[2]);
        double temperatureC = Double.parseDouble(wxFields[1]);
        double unixSeconds = parseTimestamp(resFields[0]);
        rows.add(new double[] {unixSeconds, gridKw, pvKw, temperatureC});
      }
    }
    return rows;
  }

  private static double parseTimestamp(String isoLike) {
    // "2016-01-01 00:15:00+00:00" -> Instant
    String normalised = isoLike.replace(" ", "T").replace("+00:00", "Z");
    return java.time.Instant.parse(normalised).getEpochSecond();
  }

  private static String unixSecondsToIso(double unixSeconds) {
    return java.time.Instant.ofEpochSecond((long) unixSeconds).toString();
  }

  private static String buildPayload(String timestamp, double[] row) {
    Map<String, Object> payload = new LinkedHashMap<>();
    payload.put("timestamp", timestamp);
    payload.put("site_id", "periscope-residential4-real-replay");
    payload.put("grid_kw", row[1]);
    payload.put("load_kw", row[1] + row[2]);  // whole-building identity load, matches Python module's definition
    payload.put("pv_kw", row[2]);
    payload.put("bess_kw", 0.0);  // real fact: this real site has no battery
    payload.put("soc_pct", 0.0);
    payload.put("temperature_c", row[3]);
    return MinimalJson.writeObject(payload);
  }

  private static HttpResponse<String> post(HttpClient client, int port, String jsonBody) throws IOException, InterruptedException {
    HttpRequest request = HttpRequest.newBuilder()
        .uri(URI.create("http://localhost:" + port + "/ingest"))
        .timeout(Duration.ofSeconds(5))
        .header("Content-Type", "application/json")
        .POST(HttpRequest.BodyPublishers.ofString(jsonBody, StandardCharsets.UTF_8))
        .build();
    return client.send(request, HttpResponse.BodyHandlers.ofString());
  }
}
