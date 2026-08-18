package au.edu.evidergy.bms;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * A minimal, dependency-free HTTP ingest endpoint standing in for the "vendor
 * API" leg of the Data Hub described in docs/CODE_IMPLEMENTATION_INSTRUCTIONS_CN.md
 * section 5.1 -- specifically, receiving telemetry already normalised by a
 * site's BMS/OPC-UA-to-REST gateway (a common real integration pattern for
 * Australian commercial-building energy management; see README.md for why
 * this connector speaks REST rather than raw OPC-UA binary).
 */
public final class BmsIngestServer {

  private final Path outputCsvPath;
  private final TelemetryValidator validator;
  private final Object writeLock = new Object();
  private final Set<String> seenKeys = new LinkedHashSet<>();
  private static final int DEDUPE_CACHE_CAP = 10_000;

  private HttpServer server;
  private ExecutorService executor;

  public BmsIngestServer(Path outputCsvPath, TelemetryValidator validator) throws IOException {
    this.outputCsvPath = outputCsvPath;
    this.validator = validator;
    if (!Files.exists(outputCsvPath)) {
      Files.writeString(outputCsvPath, CanonicalRecord.csvHeader() + "\n", StandardOpenOption.CREATE);
    }
  }

  public void start(int port) throws IOException {
    // Bind to loopback only: this is a local ingest endpoint (a real
    // deployment would sit behind the site's own network boundary), and
    // binding the wildcard address is also what triggers a Windows Firewall
    // "allow this app" prompt in a non-interactive environment.
    server = HttpServer.create(new InetSocketAddress(InetAddress.getLoopbackAddress(), port), 0);
    server.createContext("/health", new HealthHandler());
    server.createContext("/ingest", new IngestHandler());
    // HttpServer.stop() does not shut down a custom executor -- its threads
    // are non-daemon by default, so without shutting it down here the JVM
    // would hang after main() returns instead of exiting (only matters for
    // short-lived callers like the test suite; Main.java runs forever anyway).
    executor = Executors.newFixedThreadPool(4);
    server.setExecutor(executor);
    server.start();
  }

  public void stop() {
    if (server != null) server.stop(0);
    if (executor != null) executor.shutdownNow();
  }

  public int getPort() {
    if (server == null) throw new IllegalStateException("server not started");
    return server.getAddress().getPort();
  }

  private final class HealthHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      respond(exchange, 200, MinimalJson.writeObject(Map.of("status", "ok", "service", "bms-connector")));
    }
  }

  private final class IngestHandler implements HttpHandler {
    @Override
    public void handle(HttpExchange exchange) throws IOException {
      if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
        respond(exchange, 405, MinimalJson.writeObject(Map.of("error", "method_not_allowed")));
        return;
      }
      String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      Map<String, Object> payload;
      try {
        payload = MinimalJson.parseObject(body);
      } catch (MinimalJson.JsonParseException e) {
        respond(exchange, 400, MinimalJson.writeObject(Map.of("error", "invalid_json", "detail", e.getMessage())));
        return;
      }

      CanonicalRecord record;
      try {
        record = validator.validate(payload);
      } catch (TelemetryValidator.ValidationException e) {
        respond(exchange, 400, MinimalJson.writeObject(Map.of("error", "validation_failed", "detail", e.getMessage())));
        return;
      }

      String dedupeKey = record.siteId + "|" + record.timestamp;
      synchronized (writeLock) {
        if (seenKeys.contains(dedupeKey)) {
          respond(exchange, 409, MinimalJson.writeObject(Map.of("error", "duplicate_timestamp", "key", dedupeKey)));
          return;
        }
        Files.writeString(outputCsvPath, record.toCsvRow() + "\n", StandardOpenOption.APPEND);
        seenKeys.add(dedupeKey);
        if (seenKeys.size() > DEDUPE_CACHE_CAP) {
          seenKeys.remove(seenKeys.iterator().next());  // evict eldest (LinkedHashSet insertion order)
        }
      }

      Map<String, Object> response = new LinkedHashMap<>();
      response.put("status", "accepted");
      response.put("site_id", record.siteId);
      response.put("timestamp", record.timestamp);
      respond(exchange, 201, MinimalJson.writeObject(response));
    }
  }

  private static void respond(HttpExchange exchange, int status, String jsonBody) throws IOException {
    byte[] bytes = jsonBody.getBytes(StandardCharsets.UTF_8);
    exchange.getResponseHeaders().add("Content-Type", "application/json; charset=utf-8");
    exchange.sendResponseHeaders(status, bytes.length);
    try (OutputStream os = exchange.getResponseBody()) {
      os.write(bytes);
    }
  }
}
