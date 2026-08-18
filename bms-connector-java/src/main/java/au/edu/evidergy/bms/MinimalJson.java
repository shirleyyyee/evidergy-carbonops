package au.edu.evidergy.bms;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * A small, dependency-free JSON parser/writer for flat objects (string,
 * number, boolean, null values only -- no nested objects/arrays). This is
 * intentionally scoped, not a general-purpose JSON library: the BMS/OPC-UA
 * gateway payloads this connector accepts are flat telemetry records, and
 * pulling in an external JSON library would require Maven/network dependency
 * resolution that this module deliberately avoids (see README.md).
 */
public final class MinimalJson {

  private MinimalJson() {}

  public static Map<String, Object> parseObject(String json) {
    Parser parser = new Parser(json);
    Map<String, Object> result = parser.parseObject();
    parser.skipWhitespace();
    if (!parser.atEnd()) {
      throw new JsonParseException("unexpected trailing content at position " + parser.pos);
    }
    return result;
  }

  public static String writeObject(Map<String, ?> values) {
    StringBuilder out = new StringBuilder("{");
    boolean first = true;
    for (Map.Entry<String, ?> entry : values.entrySet()) {
      if (!first) out.append(',');
      first = false;
      out.append('"').append(escape(entry.getKey())).append("\":");
      out.append(writeValue(entry.getValue()));
    }
    return out.append('}').toString();
  }

  private static String writeValue(Object value) {
    if (value == null) return "null";
    if (value instanceof String) return "\"" + escape((String) value) + "\"";
    if (value instanceof Boolean) return value.toString();
    if (value instanceof Number) return value.toString();
    throw new IllegalArgumentException("unsupported JSON value type: " + value.getClass());
  }

  private static String escape(String s) {
    StringBuilder out = new StringBuilder();
    for (int i = 0; i < s.length(); i++) {
      char c = s.charAt(i);
      switch (c) {
        case '"': out.append("\\\""); break;
        case '\\': out.append("\\\\"); break;
        case '\n': out.append("\\n"); break;
        case '\r': out.append("\\r"); break;
        case '\t': out.append("\\t"); break;
        default:
          if (c < 0x20) {
            out.append(String.format("\\u%04x", (int) c));
          } else {
            out.append(c);
          }
      }
    }
    return out.toString();
  }

  public static final class JsonParseException extends RuntimeException {
    public JsonParseException(String message) {
      super(message);
    }
  }

  private static final class Parser {
    private final String src;
    private int pos = 0;

    Parser(String src) {
      this.src = src;
    }

    boolean atEnd() {
      return pos >= src.length();
    }

    void skipWhitespace() {
      while (!atEnd() && Character.isWhitespace(src.charAt(pos))) pos++;
    }

    char peek() {
      if (atEnd()) throw new JsonParseException("unexpected end of input at position " + pos);
      return src.charAt(pos);
    }

    void expect(char c) {
      if (atEnd() || src.charAt(pos) != c) {
        throw new JsonParseException("expected '" + c + "' at position " + pos);
      }
      pos++;
    }

    Map<String, Object> parseObject() {
      skipWhitespace();
      expect('{');
      Map<String, Object> result = new LinkedHashMap<>();
      skipWhitespace();
      if (!atEnd() && peek() == '}') {
        pos++;
        return result;
      }
      while (true) {
        skipWhitespace();
        String key = parseString();
        skipWhitespace();
        expect(':');
        skipWhitespace();
        Object value = parseValue();
        result.put(key, value);
        skipWhitespace();
        if (peek() == ',') {
          pos++;
          continue;
        }
        expect('}');
        break;
      }
      return result;
    }

    Object parseValue() {
      skipWhitespace();
      char c = peek();
      if (c == '"') return parseString();
      if (c == '{') return parseObject();
      if (c == 't') return parseLiteral("true", Boolean.TRUE);
      if (c == 'f') return parseLiteral("false", Boolean.FALSE);
      if (c == 'n') return parseLiteral("null", null);
      return parseNumber();
    }

    Object parseLiteral(String literal, Object value) {
      if (pos + literal.length() > src.length() || !src.startsWith(literal, pos)) {
        throw new JsonParseException("invalid literal at position " + pos);
      }
      pos += literal.length();
      return value;
    }

    String parseString() {
      expect('"');
      StringBuilder out = new StringBuilder();
      while (true) {
        if (atEnd()) throw new JsonParseException("unterminated string starting before position " + pos);
        char c = src.charAt(pos++);
        if (c == '"') break;
        if (c == '\\') {
          if (atEnd()) throw new JsonParseException("unterminated escape sequence");
          char esc = src.charAt(pos++);
          switch (esc) {
            case '"': out.append('"'); break;
            case '\\': out.append('\\'); break;
            case '/': out.append('/'); break;
            case 'n': out.append('\n'); break;
            case 'r': out.append('\r'); break;
            case 't': out.append('\t'); break;
            case 'b': out.append('\b'); break;
            case 'f': out.append('\f'); break;
            case 'u':
              if (pos + 4 > src.length()) throw new JsonParseException("truncated unicode escape");
              out.append((char) Integer.parseInt(src.substring(pos, pos + 4), 16));
              pos += 4;
              break;
            default:
              throw new JsonParseException("invalid escape '\\" + esc + "' at position " + pos);
          }
        } else {
          out.append(c);
        }
      }
      return out.toString();
    }

    Object parseNumber() {
      int start = pos;
      if (!atEnd() && (peek() == '-' || peek() == '+')) pos++;
      boolean isDouble = false;
      while (!atEnd() && (Character.isDigit(peek()) || peek() == '.' || peek() == 'e' || peek() == 'E'
          || peek() == '-' || peek() == '+')) {
        if (peek() == '.' || peek() == 'e' || peek() == 'E') isDouble = true;
        pos++;
      }
      String token = src.substring(start, pos);
      if (token.isEmpty()) throw new JsonParseException("expected a number at position " + start);
      try {
        return isDouble ? (Object) Double.parseDouble(token) : (Object) Long.parseLong(token);
      } catch (NumberFormatException e) {
        throw new JsonParseException("invalid number '" + token + "' at position " + start);
      }
    }
  }
}
