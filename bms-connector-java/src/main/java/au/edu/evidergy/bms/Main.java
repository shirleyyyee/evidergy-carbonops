package au.edu.evidergy.bms;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public final class Main {

  public static void main(String[] args) throws IOException {
    Map<String, String> options = parseArgs(args);
    int port = Integer.parseInt(options.getOrDefault("port", "8089"));
    Path outputCsv = Path.of(options.getOrDefault("out", "bms_canonical_output.csv"));

    BmsIngestServer server = new BmsIngestServer(outputCsv, new TelemetryValidator());
    server.start(port);
    System.out.println("evidergy bms-connector listening on http://localhost:" + port
        + "  (POST /ingest, GET /health)");
    System.out.println("writing validated canonical records to " + outputCsv.toAbsolutePath());
    Runtime.getRuntime().addShutdownHook(new Thread(server::stop));
  }

  private static Map<String, String> parseArgs(String[] args) {
    Map<String, String> options = new HashMap<>();
    for (int i = 0; i < args.length - 1; i++) {
      if (args[i].startsWith("--")) {
        options.put(args[i].substring(2), args[i + 1]);
      }
    }
    return options;
  }
}
