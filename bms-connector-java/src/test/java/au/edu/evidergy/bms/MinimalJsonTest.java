package au.edu.evidergy.bms;

import java.util.LinkedHashMap;
import java.util.Map;

import static au.edu.evidergy.bms.TestSupport.check;

public final class MinimalJsonTest {

  public static void main(String[] args) {
    // Flat object, mixed types.
    Map<String, Object> parsed = MinimalJson.parseObject(
        "{\"site_id\": \"evidergy-bms-demo\", \"grid_kw\": 2.5, \"count\": 12, \"ok\": true, \"note\": null}");
    check("evidergy-bms-demo".equals(parsed.get("site_id")), "string field parses");
    check(((Number) parsed.get("grid_kw")).doubleValue() == 2.5, "double field parses");
    check(((Number) parsed.get("count")).longValue() == 12L, "integer field parses as Long");
    check(Boolean.TRUE.equals(parsed.get("ok")), "boolean literal parses");
    check(parsed.containsKey("note") && parsed.get("note") == null, "null literal parses");

    // Escapes.
    Map<String, Object> escaped = MinimalJson.parseObject("{\"text\": \"line1\\nline2\\t\\\"quoted\\\"\"}");
    check("line1\nline2\t\"quoted\"".equals(escaped.get("text")), "backslash escapes decode correctly");

    // Negative and scientific-notation numbers.
    Map<String, Object> numbers = MinimalJson.parseObject("{\"a\": -4.2, \"b\": 1.5e3, \"c\": -7}");
    check(((Number) numbers.get("a")).doubleValue() == -4.2, "negative double parses");
    check(((Number) numbers.get("b")).doubleValue() == 1500.0, "scientific notation parses");
    check(((Number) numbers.get("c")).longValue() == -7L, "negative integer parses");

    // Round trip through writeObject for a flat object.
    Map<String, Object> toWrite = new LinkedHashMap<>();
    toWrite.put("status", "accepted");
    toWrite.put("value", 3.14);
    String written = MinimalJson.writeObject(toWrite);
    Map<String, Object> reparsed = MinimalJson.parseObject(written);
    check("accepted".equals(reparsed.get("status")), "write-then-parse round trip: string");
    check(((Number) reparsed.get("value")).doubleValue() == 3.14, "write-then-parse round trip: number");

    // Malformed input must raise JsonParseException, not silently return partial data.
    boolean threw = false;
    try {
      MinimalJson.parseObject("{\"a\": }");
    } catch (MinimalJson.JsonParseException e) {
      threw = true;
    }
    check(threw, "malformed JSON raises JsonParseException");

    TestSupport.finish("MinimalJsonTest");
  }
}
